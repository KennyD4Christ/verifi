from django.db.models import Q
from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from django.db import transaction
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from django.http import HttpResponse, FileResponse
from rest_framework.pagination import PageNumberPagination
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from products.models import Product
from products.serializers import ProductSerializer
from decimal import Decimal
from .models import Invoice, InvoiceItem
from .serializers import InvoiceSerializer, InvoiceItemSerializer
from users.permissions import CanViewResource, CanManageResource, SuperuserOrReadOnly
from core.models import Customer, CompanyInfo
import logging
import io
import json


logger = logging.getLogger(__name__)

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super(DecimalEncoder, self).default(obj)

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for listing, creating, retrieving, updating,
    and deleting invoices.
    """
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'issue_date', 'due_date']
    search_fields = ['customer__name', 'invoice_number']
    ordering_fields = ['issue_date', 'due_date', 'total_amount', 'status']

    def get_queryset(self):
        user = self.request.user
        logger.debug(f"User authenticated: {user.is_authenticated}")
        if user.is_authenticated:
            queryset = Invoice.objects.filter(user=user).select_related('customer').prefetch_related('items')
            logger.debug(f"Initial queryset count: {queryset.count()}")

            min_amount = self.request.query_params.get('min_amount')
            max_amount = self.request.query_params.get('max_amount')
            status = self.request.query_params.get('status')

            if min_amount:
                queryset = queryset.filter(total_amount__gte=min_amount)
            if max_amount:
                queryset = queryset.filter(total_amount__lte=max_amount)
            if status:
                queryset = queryset.filter(status__iexact=status)

            logger.debug(f"Final queryset count: {queryset.count()}")
            return queryset
        logger.debug("User not authenticated, returning empty queryset")
        return Invoice.objects.none()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.update_total_amount()  # Ensure total_amount is up to date
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        # Update total_amount for all invoices in the queryset
        for invoice in queryset:
            invoice.update_total_amount()
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated(), CanViewResource()]
        return [IsAuthenticated(), CanManageResource()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=False, methods=['post'], permission_classes=[CanViewResource, CanManageResource])
    def associate_with_customer(self, request):
        """
        Associates invoices with customers.
        """
        invoice_ids = request.data.get('invoice_ids')
        customer_id = request.data.get('customer_id')

        if not invoice_ids or not customer_id:
            return Response({'error': 'Both invoice_ids and customer_id are required'}, status=status.HTTP_400_BAD_REQUEST)

        customer = get_object_or_404(Customer, id=customer_id)
        invoices = Invoice.objects.filter(id__in=invoice_ids)
        invoices.update(customer=customer)
        return Response({'status': 'Invoices updated successfully'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, CanManageResource])
    def bulk_delete(self, request):
        invoice_ids = request.data.get('invoice_ids', [])
        if not invoice_ids:
            return Response({'error': 'No invoice IDs provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                deleted_count = Invoice.objects.filter(
                    id__in=invoice_ids,
                    user=request.user
                ).delete()[0]

            if deleted_count == 0:
                return Response({'error': 'No invoices were deleted'}, status=status.HTTP_404_NOT_FOUND)

            return Response({'message': f'{deleted_count} invoice(s) were successfully deleted'}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error in bulk delete: {str(e)}")
            return Response({'error': 'An error occurred while deleting invoices'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=True, methods=['get'], permission_classes=[CanViewResource])
    def generate_pdf(self, request, pk=None):
        """
        Generates a detailed PDF of the invoice.
        """
        try:
            invoice = self.get_object()
            if not invoice:
                logger.warning(f"Invoice with id {pk} not found.")
                return HttpResponseNotFound("Invoice not found")
        except Exception as e:
            logger.error(f"Error retrieving invoice with id {pk}: {str(e)}")
            raise NotFound(detail="Invoice not found")

        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter

        # Header with background color
        p.setFillColor(colors.Color(0.180, 0.235, 0.345))  # Darker Egyptian Blue
        p.rect(0, height - 2*inch, width, 2*inch, fill=1)
        p.setFillColor(colors.white)

        # Company Information
        company_info = CompanyInfo.objects.first()
        if company_info:
            p.setFont("Helvetica-Bold", 18)
            p.drawString(0.5*inch, height - 0.75*inch, company_info.name)
            p.setFont("Helvetica", 10)
            p.drawString(0.5*inch, height - 1*inch, company_info.address)
            p.drawString(0.5*inch, height - 1.25*inch, company_info.phone)
        else:
            logger.warning("No CompanyInfo found. Using default values.")
            p.setFont("Helvetica-Bold", 18)
            p.drawString(0.5*inch, height - 0.75*inch, "Company Name Not Set")
            p.setFont("Helvetica", 10)
            p.drawString(0.5*inch, height - 1*inch, "Address Not Set")
            p.drawString(0.5*inch, height - 1.25*inch, "Phone Not Set")

        # Invoice Information
        p.setFillColor(colors.black)
        p.setFont("Helvetica-Bold", 12)
        p.drawString(0.5*inch, height - 2.5*inch, f"Invoice #{invoice.invoice_number}")
        p.setFont("Helvetica", 10)
        p.drawString(0.5*inch, height - 2.75*inch, f"Issue Date: {invoice.issue_date}")
        p.drawString(0.5*inch, height - 3*inch, f"Due Date: {invoice.due_date}")

        # Customer Information
        if invoice.customer:
            p.drawString(0.5*inch, height - 3.5*inch, "Bill To:")
            p.drawString(0.5*inch, height - 3.75*inch, invoice.customer.name)
            if invoice.customer.billing_address:
                p.drawString(0.5*inch, height - 4*inch, str(invoice.customer.billing_address))
            p.drawString(0.5*inch, height - 4.25*inch, invoice.customer.phone)
            p.drawString(0.5*inch, height - 4.5*inch, invoice.customer.email)

        # Invoice Items
        data = [["Description", "Quantity", "Unit Price", "Total"]]
        for item in invoice.items.all():
            data.append([
                item.description,
                str(item.quantity),
                f"${item.unit_price:.2f}",
                f"${item.total_price:.2f}"
            ])
    
        table = Table(data, colWidths=[4*inch, 1*inch, 1.25*inch, 1.25*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        table.wrapOn(p, width, height)
        table.drawOn(p, 0.5*inch, height - 6.5*inch)

        # Total
        p.drawString(5.5*inch, height - 7*inch, f"Total: ${invoice.total_amount:.2f}")

        p.showPage()
        p.save()

        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename=f'invoice_{invoice.invoice_number}.pdf')

    @action(detail=True, methods=['post'], permission_classes=[CanManageResource])
    def mark_as_paid(self, request, pk=None):
        """
        Marks the invoice as paid.
        """
        invoice = self.get_object()
        invoice.status = 'paid'
        invoice.save()
        return Response({'status': 'Invoice marked as paid'}, status=status.HTTP_200_OK)


class InvoiceItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for listing, creating, retrieving, updating,
    and deleting invoice items.
    """
    queryset = InvoiceItem.objects.all()
    serializer_class = InvoiceItemSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.permission_classes = [CanViewResource]
        else:
            self.permission_classes = [CanManageResource]
            return super().get_permissions()
