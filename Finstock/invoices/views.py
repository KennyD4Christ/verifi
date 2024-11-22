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
from datetime import datetime
from reportlab.lib.fonts import addMapping
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from products.models import Product
from products.serializers import ProductSerializer
from decimal import Decimal
from .models import Invoice, InvoiceItem
from .serializers import InvoiceSerializer, InvoiceItemSerializer
from users.permissions import CanViewResource, CanManageResource, SuperuserOrReadOnly, InvoicePermission
from core.models import Customer, CompanyInfo
import logging
import io
import os
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
    permission_classes = [InvoicePermission]
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
        Generates a professional PDF invoice with enhanced styling and layout.
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


        # Helper function for drawing text
        def draw_text(text, x, y, font="Helvetica", size=10, color=colors.black):
            p.setFont(font, size)
            p.setFillColor(color)
            p.drawString(x, y, text)

        # Modern header with gradient-like effect
        p.setFillColor(colors.Color(0.180, 0.235, 0.345))  # Primary blue
        p.rect(0, height - 2.5*inch, width, 2.5*inch, fill=1)
        p.setFillColor(colors.Color(0.150, 0.205, 0.315))  # Slightly darker blue
        p.rect(0, height - 2.5*inch, width, 0.5*inch, fill=1)

        logo_path = os.path.expanduser('~/verifi/Finstock/static/Logo 10.png')

        # Company Logo
        p.drawImage(logo_path, 0.5*inch, height - 1.75*inch, width=1.5*inch, height=1*inch)

        # Company Information with improved layout
        company_info = CompanyInfo.objects.first()
        if company_info:
            draw_text(company_info.name, 0.5*inch, height - 0.75*inch, "Helvetica-Bold", 24, colors.white)
            draw_text(company_info.address, 0.5*inch, height - 1.25*inch, "Helvetica", 11, colors.white)
            draw_text(f"Tel: {company_info.phone}", 0.5*inch, height - 1.5*inch, "Helvetica", 11, colors.white)
            if hasattr(company_info, 'website'):
                draw_text(f"Web: {company_info.website}", 0.5*inch, height - 1.75*inch, "Helvetica", 11, colors.white)
        else:
            logger.warning("No CompanyInfo found. Using default values.")
            draw_text("Company Name Not Set", 0.5*inch, height - 0.75*inch, "Helvetica-Bold", 24, colors.white)

        # Professional Invoice Title
        draw_text("INVOICE", width - 2*inch, height - 0.75*inch, "Helvetica-Bold", 28, colors.white)

        # Invoice Details Box
        p.setFillColor(colors.Color(0.95, 0.95, 0.95))  # Light gray background
        p.rect(0.5*inch, height - 3.75*inch, 3*inch, 1*inch, fill=1)
    
        draw_text("Invoice Number:", 0.75*inch, height - 3*inch, "Helvetica-Bold", 10)
        draw_text(f"#{invoice.invoice_number}", 1.75*inch, height - 3*inch)
    
        draw_text("Issue Date:", 0.75*inch, height - 3.25*inch, "Helvetica-Bold", 10)
        draw_text(invoice.issue_date.strftime("%B %d, %Y"), 1.75*inch, height - 3.25*inch)
    
        draw_text("Due Date:", 0.75*inch, height - 3.5*inch, "Helvetica-Bold", 10)
        draw_text(invoice.due_date.strftime("%B %d, %Y"), 1.75*inch, height - 3.5*inch)

        # Customer Information Box
        if invoice.customer:
            p.setFillColor(colors.Color(0.95, 0.95, 0.95))
            p.rect(width - 3.5*inch, height - 3.75*inch, 3*inch, 1*inch, fill=1)
        
            draw_text("Bill To:", width - 3.25*inch, height - 3*inch, "Helvetica-Bold", 10)
            draw_text(invoice.customer.name, width - 3.25*inch, height - 3.25*inch)
            if invoice.customer.billing_address:
                address_lines = str(invoice.customer.billing_address).split('\n')
                for i, line in enumerate(address_lines):
                    draw_text(line, width - 3.25*inch, height - (3.5 + i*0.25)*inch)
            draw_text(invoice.customer.phone, width - 3.25*inch, height - 3.5*inch)

        # Items Table with improved styling
        data = [["Description", "Quantity", "Unit Price", "Total"]]
        for item in invoice.items.all():
            data.append([
                item.description,
                str(item.quantity),
                f"${item.unit_price:,.2f}",
                f"${item.total_price:,.2f}"
            ])

        # Add empty rows if needed to maintain consistent spacing
        while len(data) < 5:
            data.append(["", "", "", ""])

        table = Table(data, colWidths=[4*inch, 1.25*inch, 1.25*inch, 1.25*inch])
        table.setStyle(TableStyle([
            # Header styling
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.180, 0.235, 0.345)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            # Content styling
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        table.wrapOn(p, width, height)
        table.drawOn(p, 0.5*inch, height - 7*inch)

        # Totals section with subtle styling
        p.setFillColor(colors.Color(0.95, 0.95, 0.95))
        p.rect(width - 3*inch, height - 8*inch, 2.5*inch, 1*inch, fill=1)
    
        y_position = height - 7.5*inch
        draw_text("Subtotal:", width - 2.75*inch, y_position, "Helvetica-Bold", 10)
        draw_text(f"${invoice.total_amount:,.2f}", width - 1.25*inch, y_position, "Helvetica", 10)
    
        if hasattr(invoice, 'tax_amount'):
            y_position -= 0.25*inch
            draw_text("Tax:", width - 2.75*inch, y_position, "Helvetica-Bold", 10)
            draw_text(f"${invoice.tax_amount:,.2f}", width - 1.25*inch, y_position, "Helvetica", 10)
    
        y_position -= 0.25*inch
        p.setFillColor(colors.Color(0.180, 0.235, 0.345))
        draw_text("Total:", width - 2.75*inch, y_position, "Helvetica-Bold", 12)
        draw_text(f"${invoice.total_amount:,.2f}", width - 1.25*inch, y_position, "Helvetica-Bold", 12)

        # Footer with payment terms and notes
        p.setFillColor(colors.grey)
        p.rect(0, 1*inch, width, 0.05*inch, fill=1)  # Separator line
    
        draw_text("Payment Terms", 0.5*inch, 0.75*inch, "Helvetica-Bold", 10, colors.black)
        draw_text("Please pay within 30 days. Make checks payable to your company name or pay online at your-website.com",
                  0.5*inch, 0.5*inch, "Helvetica", 9, colors.grey)
    
        draw_text(f"Invoice generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                  0.5*inch, 0.25*inch, "Helvetica", 8, colors.grey)

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
