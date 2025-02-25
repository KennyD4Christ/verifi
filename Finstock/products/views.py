from rest_framework import viewsets, filters, status, permissions
from django.db import transaction
from core.models import Customer, Order, OrderItem
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.core.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, DateFromToRangeFilter, NumberFilter
from django.db.models import Q
from django.shortcuts import get_object_or_404
from .models import Product, ProductImage, Review, Category
from .serializers import ProductSerializer, ProductImageSerializer, ReviewSerializer, CategorySerializer
from django.core.exceptions import PermissionDenied
from users.constants import PermissionConstants
from users.views import BaseAccessControlViewSet
from users.models import CustomUser
from django.http import HttpResponse
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from reportlab.lib import colors
import csv
import io
import logging
from io import BytesIO

logger = logging.getLogger(__name__)

from users.permissions import CanViewResource, CanManageResource


class ProductFilter(FilterSet):
    created_at = DateFromToRangeFilter()
    min_price = NumberFilter(field_name="price", lookup_expr='gte')
    max_price = NumberFilter(field_name="price", lookup_expr='lte')

    class Meta:
        model = Product
        fields = ['category', 'is_active', 'created_at', 'min_price', 'max_price']

class CategoryViewSet(viewsets.ModelViewSet):
    """
    A viewset for viewing and editing category instances.
    """
    serializer_class = CategorySerializer
    queryset = Category.objects.all()
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.permission_classes = [IsAuthenticated]
        else:
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

class ProductViewSet(BaseAccessControlViewSet):
    """
    API endpoint for managing products
    """
    queryset = Product.objects.all().order_by('-created_at')
    serializer_class = ProductSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [
        DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter
    ]
    filterset_fields = ['category', 'price', 'is_active']
    search_fields = ['name', 'description', 'sku']
    ordering_fields = ['name', 'price', 'created_at']
    filterset_class = ProductFilter

    model = Product
    model_name = 'product'

    view_permission = PermissionConstants.PRODUCT_VIEW
    create_permission = PermissionConstants.PRODUCT_CREATE
    edit_permission = PermissionConstants.PRODUCT_EDIT
    delete_permission = PermissionConstants.PRODUCT_DELETE
    qr_scan_permission = PermissionConstants.PRODUCT_VIEW

    permission_map = {
        'list': [PermissionConstants.PRODUCT_VIEW],
        'retrieve': [PermissionConstants.PRODUCT_VIEW],
        'create': [PermissionConstants.PRODUCT_CREATE],
        'update': [PermissionConstants.PRODUCT_EDIT],
        'partial_update': [PermissionConstants.PRODUCT_EDIT],
        'destroy': [PermissionConstants.PRODUCT_DELETE],
        'qr_scan': [PermissionConstants.PRODUCT_VIEW],
        'qr_scan_info': [PermissionConstants.PRODUCT_VIEW],
        'regenerate_qr': [PermissionConstants.PRODUCT_EDIT]
    }

    def apply_role_based_filtering(self):
        user = self.request.user

        if user.is_superuser or user.is_role('Administrator'):
            return self.model.objects.all()

        elif user.is_role('Inventory Manager'):
            return self.model.objects.all()

        elif user.is_role('Sales Representative'):
            return self.model.objects.filter(is_active=True)

        elif user.is_role('Accountant'):
            return self.model.objects.all()

        elif user.is_role('Auditor'):
            return self.model.objects.all()

        return self.model.objects.none()

    def get_queryset(self):
        queryset = super().get_queryset()
        search_query = self.request.query_params.get('search', None)
        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(sku__icontains=search_query)
            )
        return queryset

    def perform_create(self, serializer):
        allowed_roles = ['Administrator', 'Inventory Manager']
        user = self.request.user

        if not self.has_action_permission('create'):
            raise PermissionDenied("You do not have permission to create products")

        serializer.save()

    def perform_update(self, serializer):
        allowed_roles = ['Administrator', 'Inventory Manager']
        user = self.request.user

        if not self.has_action_permission('change'):
            raise PermissionDenied("You do not have permission to update products")

        serializer.save()

    def perform_destroy(self, instance):
        allowed_roles = ['Administrator']
        user = self.request.user

        if not self.has_action_permission('delete'):
            raise PermissionDenied("You do not have permission to delete products")

        instance.delete()

    def get_permissions(self):
        print(f"\nDEBUG: Permission check for action: {self.action}")
        
        # Get the required permissions for the current action
        required_permissions = self.permission_map.get(self.action, [])
        print(f"DEBUG: Required permissions: {required_permissions}")

        class DynamicPermission(permissions.BasePermission):
            def has_permission(self_permission, request, view):
                print(f"DEBUG: Checking permissions for user: {request.user.username}")
                
                # Superusers always have access
                if request.user.is_superuser:
                    print("DEBUG: User is superuser - access granted")
                    return True

                # Check each required permission
                for permission in required_permissions:
                    has_perm = request.user.has_perm(permission)
                    print(f"DEBUG: Checking permission {permission}: {has_perm}")
                    if has_perm:
                        return True
                
                print("DEBUG: No required permissions found - access denied")
                return False

        return [IsAuthenticated(), DynamicPermission()]

    @action(detail=True, methods=['GET'])
    def regenerate_qr(self, request, pk=None):
        """Endpoint to regenerate QR code for a product"""
        if not self.has_action_permission('change'):
            raise PermissionDenied("You do not have permission to regenerate QR codes")

        product = self.get_object()
        product.generate_qr_code()

        return Response({
            'message': 'QR code regenerated successfully',
            'qr_code_url': request.build_absolute_uri(product.qr_code.url)
        })

    @action(detail=True, methods=['GET'], url_path='qr-scan-info')
    def qr_scan_info(self, request, pk=None):
        """Endpoint to handle QR code scanning"""
        product = self.get_object()

        # Update stock count if specified in query params
        quantity_change = request.query_params.get('quantity_change')
        if quantity_change:
            try:
                quantity_change = int(quantity_change)
                product.update_stock(quantity_change)
            except ValueError as e:
                return Response({'error': str(e)}, status=400)

        return Response({
            'id': product.id,
            'name': product.name,
            'sku': product.sku,
            'current_stock': product.stock,
            'price': product.price
        })

    def check_permissions(self, request):
        """
        Check if the request should be permitted.
        Raises an appropriate exception if the request is not permitted.
        """
        print(f"\nDEBUG: Starting permission check for action: {self.action}")
        print(f"DEBUG: User: {request.user.username}")
        
        try:
            super().check_permissions(request)
            print("DEBUG: Permission check passed successfully")
        except Exception as e:
            print(f"DEBUG: Permission check failed: {str(e)}")
            raise

    @action(detail=True, methods=['POST'], url_path='qr-scan')
    def qr_scan(self, request, pk=None):
        print(f"\nDEBUG: QR scan action started")
        print(f"DEBUG: Product ID: {pk}")
        
        try:
            # First attempt to get the product
            try:
                product = Product.objects.get(pk=pk)
                print(f"DEBUG: Product found: {product.name}")
            except Product.DoesNotExist:
                print(f"DEBUG: Product not found with ID: {pk}")
                return Response(
                    {'error': 'Product not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            customer_id = request.data.get('customer_id')
            quantity = int(request.data.get('quantity', 1))

            with transaction.atomic():
                customer = Customer.objects.get(id=customer_id) if customer_id else None
                
                order = Order.objects.create(
                    customer=customer,
                    user=request.user,
                    sales_rep=request.user,
                    status='processing'
                )

                OrderItem.objects.create(
                    order=order,
                    product=product,
                    quantity=quantity,
                    unit_price=product.price
                )

                return Response({
                    'message': 'Order created successfully from QR scan',
                    'order_id': order.id,
                    'invoice_id': order.invoice.id if order.invoice else None,
                    'product_id': product.id,
                    'quantity': quantity,
                    'total_price': float(product.price * quantity)
                }, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"DEBUG: Error in qr_scan: {str(e)}")
            raise

    @action(detail=False, methods=['GET'], url_path='barcode/(?P<barcode>[^/.]+)')
    def get_by_barcode(self, request, barcode=None):
        """Endpoint to fetch product by barcode"""
        try:
            product = self.queryset.get(barcode=barcode)
            serializer = self.get_serializer(product)
            return Response(serializer.data)
        except Product.DoesNotExist:
            return Response(
                {'error': 'Product not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['POST'])
    def scan_barcode(self, request, pk=None):
        """Endpoint to handle barcode scanning"""
        product = self.get_object()

        try:
            quantity = int(request.data.get('quantity', 1))
            customer_id = request.data.get('customer_id')

            with transaction.atomic():
                customer = Customer.objects.get(id=customer_id) if customer_id else None

                # Create order similar to your existing QR scan logic
                order = Order.objects.create(
                    customer=customer,
                    user=request.user,
                    sales_rep=request.user,
                    status='processing'
                )

                OrderItem.objects.create(
                    order=order,
                    product=product,
                    quantity=quantity,
                    unit_price=product.price
                )

                return Response({
                    'message': 'Order created successfully from barcode scan',
                    'order_id': order.id,
                    'product_id': product.id,
                    'quantity': quantity,
                    'total_price': float(product.price * quantity)
                }, status=status.HTTP_201_CREATED)

        except ValueError as e:
            return Response(
                {'error': 'Invalid quantity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        queryset = self.filter_queryset(self.get_queryset())

        # Create the CSV file
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow(['ID', 'Name', 'SKU', 'Price', 'Category', 'Is Active'])

        # Write data
        for product in queryset:
            writer.writerow([
                product.id, product.name, product.sku, product.price,
                product.category.name if product.category else 'N/A',
                product.is_active
            ])

        # Create the HTTP response
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename=products.csv'

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

        # Define table data and style
        data = [['ID', 'Name', 'SKU', 'Price', 'Category', 'Is Active']]  # Table header
        for product in queryset:
            data.append([
                str(product.id),
                product.name,
                product.sku,
                f"N{product.price:.2f}",
                product.category.name if product.category else 'N/A',
                'Yes' if product.is_active else 'No'
            ])

        # Create table
        table = Table(data)

        # Add style to table
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

        # Add table to elements
        elements.append(table)

        # Build PDF
        doc.build(elements)

        # Get the value of the BytesIO buffer and write it to the response
        pdf = buffer.getvalue()
        buffer.close()
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="products.pdf"'
        response.write(pdf)

        return response

    def create(self, request, *args, **kwargs):
        logger.info(f"Received data for product creation: {request.data}")
        try:
            return super().create(request, *args, **kwargs)
        except ValidationError as e:
            logger.error(f"Validation error creating product: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Unexpected error creating product: {str(e)}")
            return Response({"error": "An unexpected error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error in product list view: {str(e)}")
            return Response({
                "error": f"An unexpected error occurred: {str(e)}",
                "results": [],
                "count": 0,
                "next": None,
                "previous": None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def filter_queryset(self, queryset):
        for backend in list(self.filter_backends):
            queryset = backend().filter_queryset(self.request, queryset, self)

        if not queryset.exists():
            return Product.objects.none()

        return queryset

    def update(self, request, *args, **kwargs):
        try:
            logger.info(f"Received update request for product ID: {kwargs.get('pk')}")
            logger.info(f"Request data: {request.data}")
            return super().update(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error updating product: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], permission_classes=[CanViewResource])
    def images(self, request, pk=None):
        product = self.get_object()
        images = product.images.all()
        serializer = ProductImageSerializer(images, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], permission_classes=[CanViewResource])
    def reviews(self, request, pk=None):
        product = self.get_object()
        reviews = product.reviews.all()
        serializer = ReviewSerializer(reviews, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({"error": "No IDs provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            deleted_count = Product.objects.filter(id__in=ids).delete()[0]
            return Response({"message": f"Successfully deleted {deleted_count} products"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def bulk_update_status(self, request):
        """
        Updates the is_active status of multiple products identified by their IDs.
        """
        is_active = request.data.get('is_active')
        ids = request.data.get('ids')
        if is_active is not None and ids:
            products = Product.objects.filter(id__in=ids)
            products.update(is_active=is_active)
            return Response(
                {'message': 'Products updated successfully'},
                status=status.HTTP_200_OK
            )
        return Response(
            {'message': 'Invalid data'}, status=status.HTTP_400_BAD_REQUEST
        )

class ProductImageViewSet(viewsets.ModelViewSet):
    """
    A viewset for viewing and editing product image instances.
    """
    serializer_class = ProductImageSerializer
    queryset = ProductImage.objects.all()
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.permission_classes = [CanViewResource]
        else:
            self.permission_classes = [CanManageResource]
        return super().get_permissions()

    def perform_create(self, serializer):
        product_id = self.request.data.get('product')
        product = get_object_or_404(Product, id=product_id)
        serializer.save(product=product)


class ReviewViewSet(viewsets.ModelViewSet):
    """
    A viewset for viewing and editing review instances.
    """
    serializer_class = ReviewSerializer
    queryset = Review.objects.all()
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.permission_classes = [IsAuthenticated]
        else:
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()

    def perform_create(self, serializer):
        product_id = self.request.data.get('product')
        product = get_object_or_404(Product, id=product_id)
        serializer.save(product=product, user=self.request.user)
