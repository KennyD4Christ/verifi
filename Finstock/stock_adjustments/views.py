from rest_framework import viewsets, filters, status, permissions
from django.core.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.decorators import action, api_view
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, DateFromToRangeFilter, NumberFilter, CharFilter
from django.db.models import Q
from django.http import HttpResponse
from .models import StockAdjustment
from .serializers import StockAdjustmentSerializer
from users.views import BaseAccessControlViewSet
from users.permissions import RoleBasedPermission
from users.models import CustomUser
from users.constants import PermissionConstants
import logging
import csv
from django.views.decorators.http import require_GET
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from io import BytesIO
from products.models import Product
from products.serializers import ProductSerializer
from users.views import BaseAccessControlViewSet

logger = logging.getLogger(__name__)

class StockAdjustmentFilter(FilterSet):
    date = DateFromToRangeFilter(field_name="adjustment_date")
    min_quantity = NumberFilter(field_name="quantity", lookup_expr='gte')
    max_quantity = NumberFilter(field_name="quantity", lookup_expr='lte')
    product = CharFilter(field_name="product__name", lookup_expr='icontains')

    class Meta:
        model = StockAdjustment
        fields = ['product', 'adjustment_type', 'adjustment_date', 'min_quantity', 'max_quantity']

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

class StockAdjustmentViewSet(BaseAccessControlViewSet):
    """
    API endpoint for managing stock adjustments
    """
    queryset = StockAdjustment.objects.all()
    serializer_class = StockAdjustmentSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [
        DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter
    ]
    filterset_class = StockAdjustmentFilter
    search_fields = ['product__name', 'reason']
    ordering_fields = ['adjustment_date', 'quantity', 'product__name']
    ordering = ['-adjustment_date']

    model = StockAdjustment
    model_name = 'stock_adjustment'

    # Define permissions using PermissionConstants
    view_permission = PermissionConstants.STOCK_ADJUSTMENT_VIEW
    create_permission = PermissionConstants.STOCK_ADJUSTMENT_CREATE
    edit_permission = PermissionConstants.STOCK_ADJUSTMENT_EDIT
    delete_permission = PermissionConstants.STOCK_ADJUSTMENT_DELETE

    qr_code_permission = PermissionConstants.STOCK_ADJUSTMENT_VIEW

    def get_permissions(self):
        """
        Modified permissions method to handle QR code related actions
        """
        
        permission_map = {
            'list': [self.view_permission],
            'retrieve': [self.view_permission],
            'create': [self.create_permission],
            'update': [self.edit_permission],
            'partial_update': [self.edit_permission],
            'destroy': [self.delete_permission],
            'qr_code': [self.qr_code_permission],
            'scan_qr': [self.qr_code_permission]
        }

        if self.action in ['qr_code', 'scan_qr']:
            return [permissions.IsAuthenticated(), RoleBasedPermission()]
        
        return super().get_permissions()

        required_permissions = permission_map.get(self.action, [])

        class DynamicPermission(permissions.BasePermission):
            def has_permission(self, request, view):
                if request.user.is_superuser:
                    return True
                return any(request.user.has_perm(perm) for perm in required_permissions)

            def has_object_permission(self, request, view, obj):
                if request.user.is_superuser:
                    return True
                    
                # Allow access for users with appropriate role
                if request.user.is_role('Administrator') or request.user.is_role('Inventory Manager'):
                    return True
                    
                return False

        return [permissions.IsAuthenticated(), DynamicPermission()]

    def apply_role_based_filtering(self):
        user = self.request.user

        if user.is_superuser or user.is_role('Administrator'):
            return self.model.objects.all()

        elif user.is_role('Inventory Manager'):
            # Inventory Managers can view all stock adjustments
            return self.model.objects.all()

        return self.model.objects.none()

    def get_queryset(self):
        queryset = super().get_queryset()
        search_query = self.request.query_params.get('search', None)
        if search_query:
            queryset = queryset.filter(
                Q(product__name__icontains=search_query) |
                Q(reason__icontains=search_query)
            )
        return queryset

    def perform_create(self, serializer):
        if not self.request.user.has_role_permission(self.create_permission):
            raise PermissionDenied("You do not have permission to create stock adjustments")
        serializer.save(adjusted_by=self.request.user)

    def perform_update(self, serializer):
        if not self.request.user.has_role_permission(self.edit_permission):
            raise PermissionDenied("You do not have permission to update stock adjustments")
        serializer.save()

    def perform_destroy(self, instance):
        if not self.request.user.has_role_permission(self.delete_permission):
            raise PermissionDenied("You do not have permission to delete stock adjustments")
        instance.delete()

    def create(self, request, *args, **kwargs):
        logger.info(f"Received data for stock adjustment creation: {request.data}")
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error creating stock adjustment: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error in stock adjustment list view: {str(e)}")
            return Response({
                "error": f"An unexpected error occurred: {str(e)}",
                "results": [],
                "count": 0,
                "next": None,
                "previous": None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def qr_code(self, request, pk=None):
        try:
            logger.info(f"Attempting to get QR code for adjustment {pk}")
            instance = self.get_object()
        
            if not instance:
                logger.error(f"No StockAdjustment found with pk {pk}")
                return Response(
                    {'error': 'Stock adjustment not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            if not instance.qr_code:
                logger.warning(f"QR code not found for adjustment {pk}")
                return Response(
                    {'error': 'QR code not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            try:
                with instance.qr_code.open('rb') as f:
                    response = HttpResponse(f.read(), content_type='image/png')
                    response['Content-Disposition'] = f'inline; filename="{instance.qr_code.name}"'
                    return response
            except IOError as e:
                logger.error(f"Error reading QR code file for adjustment {pk}: {str(e)}", exc_info=True)
                return Response(
                    {'error': 'Error reading QR code file'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Exception as e:
            logger.error(f"Unexpected error serving QR code for adjustment {pk}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def scan_qr(self, request, pk=None):
        """
        Enhanced scan QR endpoint with better error handling
        """
        try:
            instance = self.get_object()
            if not instance.qr_code_data:
                logger.warning(f"QR code data not found for adjustment {pk}")
                return Response(
                    {'error': 'QR code data not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            return Response(instance.qr_code_data)
        except Exception as e:
            logger.error(f"Error retrieving QR code data for adjustment {pk}: {str(e)}")
            return Response(
                {'error': 'Error retrieving QR code data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({"error": "No IDs provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            deleted_count = StockAdjustment.objects.filter(id__in=ids).delete()[0]
            return Response({"message": f"{deleted_count} stock adjustments deleted successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in bulk delete: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def get_products(request):
        products = Product.objects.all()
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def get_adjustment_types(self, request):
        adjustment_types = ['increase', 'decrease', 'return', 'damage']
        return Response(adjustment_types)

    def update(self, request, *args, **kwargs):
        try:
            logger.info(f"Received update request for stock adjustment ID: {kwargs.get('pk')}")
            logger.info(f"Request data: {request.data}")
            return super().update(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error updating stock adjustment: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def filter_queryset(self, queryset):
        for backend in list(self.filter_backends):
            queryset = backend().filter_queryset(self.request, queryset, self)

        if not queryset.exists():
            return StockAdjustment.objects.none()

        return queryset

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="stock_adjustments.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['ID', 'Product', 'Quantity', 'Adjustment Type', 'Date', 'Reason'])
        
        for adjustment in queryset:
            writer.writerow([
                adjustment.id,
                adjustment.product.name,
                adjustment.quantity,
                adjustment.adjustment_type,
                adjustment.adjustment_date,
                adjustment.reason
            ])
        
        return response

    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        queryset = self.filter_queryset(self.get_queryset())

        # Create a file-like buffer to receive PDF data
        buffer = BytesIO()

        # Create the PDF object using SimpleDocTemplate
        doc = SimpleDocTemplate(buffer, pagesize=letter)

        # Container for the 'Flowable' objects
        elements = []

        # A large collection of style sheets pre-made for us
        styles = getSampleStyleSheet()

        # Add title
        elements.append(Paragraph("Stock Adjustments Report", styles['Title']))
        elements.append(Paragraph(" ", styles['Normal']))  # Add some space

        # Get all stock adjustments
        adjustments = StockAdjustment.objects.all().order_by('-adjustment_date')

        # Create table data
        data = [['ID', 'Product', 'Quantity', 'Type', 'Date', 'Reason']]
        for adj in adjustments:
            data.append([
                str(adj.id),
                adj.product.name,
                str(adj.quantity),
                adj.adjustment_type,
                adj.adjustment_date.strftime('%Y-%m-%d'),
                adj.reason
            ])

        # Create the table
        table = Table(data, colWidths=[0.5 * inch, 1.5 * inch, 1 * inch, 1 * inch, 1 * inch, 3 * inch])

        # Add style to the table
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),  # Professional header color
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),  # White body background
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 12),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ])
        table.setStyle(style)

        # Add the table to the elements
        elements.append(table)

        # Build the PDF
        doc.build(elements)

        # FileResponse sets the Content-Disposition header so that browsers
        # present the option to save the file.
        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="stock_adjustments_report.pdf"'

        return response
