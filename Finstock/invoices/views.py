from django.db.models import Q
from django.conf import settings
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
from receipts.models import Receipt
from products.models import Product
from products.serializers import ProductSerializer
from decimal import Decimal
from django.utils import timezone
from .models import Invoice, InvoiceItem
from users.models import CustomUser
from users.constants import PermissionConstants
from users.views import BaseAccessControlViewSet
from .serializers import InvoiceSerializer, InvoiceItemSerializer
from users.permissions import CanViewResource, CanManageResource, SuperuserOrReadOnly
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


class InvoiceViewSet(BaseAccessControlViewSet):
    """
    ViewSet for listing, creating, retrieving, updating,
    and deleting invoices.
    """
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'issue_date', 'due_date']
    search_fields = ['customer__name', 'invoice_number']
    ordering_fields = ['issue_date', 'due_date', 'total_amount', 'status']
    ordering = ['-issue_date']

    model = Invoice
    model_name = 'invoice'

    view_permission = PermissionConstants.INVOICE_VIEW
    create_permission = PermissionConstants.INVOICE_CREATE
    edit_permission = PermissionConstants.INVOICE_EDIT
    delete_permission = PermissionConstants.INVOICE_DELETE

    def get_queryset(self):
        """
        Override get_queryset to ensure proper model initialization
        """
        if not self.request.user.is_authenticated:
            return Invoice.objects.none()

        if settings.TESTING:
            return self.queryset

        base_queryset = super().get_queryset()
        return base_queryset.select_related('customer').prefetch_related('items')

    def apply_role_based_filtering(self):
        """
        Implement role-specific filtering for invoices
        """
        queryset = Invoice.objects.all()
        user = self.request.user

        try:
            if user.is_superuser:
                return queryset

            # Check if user has explicit view permission regardless of role
            if user.has_role_permission(self.view_permission):
                if user.is_role('Administrator'):
                    return queryset
                elif user.is_role('Sales Representative'):
                    return queryset.filter(order__sales_rep=user)
                elif user.is_role('Customer'):
                    return queryset.filter(order__customer__user=user)
                elif user.is_role('Accountant'):
                    # Accountants can view all invoices if they have view permission
                    return queryset
                else:
                    # For other roles with view permission, show invoices they created
                    return queryset.filter(
                        Q(created_by=user) |
                        Q(order__created_by=user)
                    )
        
            logger.info(f"User {user.username} lacks view permission for invoices")
            return Invoice.objects.none()

        except Exception as e:
            logger.error(f"Error in apply_role_based_filtering for user {user.id}: {str(e)}")
            return Invoice.objects.none()

    def apply_additional_filters(self, queryset):
        """
        Apply invoice-specific filters in addition to base filters
        """
        queryset = super().apply_additional_filters(queryset)
        
        # Apply amount-based filters
        min_amount = self.request.query_params.get('min_amount')
        max_amount = self.request.query_params.get('max_amount')
        status = self.request.query_params.get('status')

        if min_amount:
            queryset = queryset.filter(total_amount__gte=min_amount)
        if max_amount:
            queryset = queryset.filter(total_amount__lte=max_amount)
        if status:
            queryset = queryset.filter(status__iexact=status)

        return queryset.select_related('customer').prefetch_related('items')
    
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
            permission_classes = [IsAuthenticated, CanViewResource]
        else:
            permission_classes = [IsAuthenticated, CanManageResource]
        return [permission() for permission in permission_classes]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        if not self.request.user.has_role_permission(self.create_permission):
            raise PermissionDenied("You do not have permission to create invoices")
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        if not self.request.user.has_role_permission(self.edit_permission):
            raise PermissionDenied("You do not have permission to update invoices")
        serializer.save()

    def perform_destroy(self, instance):
        if not self.request.user.has_role_permission(self.delete_permission):
            raise PermissionDenied("You do not have permission to delete invoices")
        instance.delete()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def has_receipt(self, request, pk=None):
        """
        Check if a receipt exists for this invoice
        """
        instance = self.get_object()
        has_receipt = Receipt.objects.filter(invoice=instance).exists()
        return Response({'has_receipt': has_receipt})

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

        def draw_text(text, x, y, font="Helvetica", size=10, color=colors.black):
            p.setFont(font, size)
            p.setFillColor(color)
            p.drawString(x, y, text)

        # Modern header with gradient-like effect
        p.setFillColor(colors.Color(0.180, 0.235, 0.345))  # Primary blue
        p.rect(0, height - 2.5*inch, width, 2.5*inch, fill=1)
        p.setFillColor(colors.Color(0.150, 0.205, 0.315))  # Slightly darker blue
        p.rect(0, height - 2.5*inch, width, 0.5*inch, fill=1)

        # Set consistent left margin for all header elements
        left_margin = 0.5*inch

        # Logo path setup
        logo_path = os.path.expanduser('~/verifi/Finstock/static/Logo 10.png')

        # Get company information
        company_info = CompanyInfo.objects.first()

        if company_info:
            # Company name positioned above logo
            name_y = height - 0.75*inch
            draw_text(company_info.name, left_margin, name_y, "Helvetica-Bold", 24, colors.white)
    
            # Company Logo - Positioned below company name
            logo_y = height - 1.85*inch
            p.drawImage(logo_path, left_margin, logo_y, width=1.5*inch, height=1*inch)
    
            # Address and phone below logo, aligned with same left margin
            info_y = logo_y - 0.27*inch
            draw_text(company_info.address, left_margin, info_y, "Helvetica", 11, colors.white)
            draw_text(f"Tel: {company_info.phone}", left_margin, info_y - 0.25*inch, "Helvetica", 11, colors.white)
            if hasattr(company_info, 'website'):
                draw_text(f"Web: {company_info.website}", left_margin, info_y - 0.5*inch, "Helvetica", 11, colors.white)
        else:
            logger.warning("No CompanyInfo found. Using default values.")
            draw_text("Company Name Not Set", left_margin, height - 1.5*inch, "Helvetica-Bold", 24, colors.white)

        # Professional Invoice Title
        draw_text("INVOICE", width - 2*inch, height - 0.75*inch, "Helvetica-Bold", 28, colors.white)

        # Invoice Details Box
        p.setFillColor(colors.Color(0.95, 0.95, 0.95))  # Light gray background
        p.rect(0.5*inch, height - 3.75*inch, 3*inch, 1*inch, fill=1)

        # Shortened invoice number (first 6 digits)
        shortened_invoice_number = str(invoice.invoice_number)[:6]
        draw_text("Invoice Number:", 0.75*inch, height - 3*inch, "Helvetica-Bold", 10)
        draw_text(f"#{shortened_invoice_number}", 1.75*inch, height - 3*inch)

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
                f"N{item.unit_price:,.2f}",
                f"N{item.total_price:,.2f}"
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
        draw_text(f"N{invoice.total_amount:,.2f}", width - 1.25*inch, y_position, "Helvetica", 10)
    
        if hasattr(invoice, 'tax_amount'):
            y_position -= 0.25*inch
            draw_text("Tax:", width - 2.75*inch, y_position, "Helvetica-Bold", 10)
            draw_text(f"N{invoice.tax_amount:,.2f}", width - 1.25*inch, y_position, "Helvetica", 10)
    
        y_position -= 0.25*inch
        p.setFillColor(colors.Color(0.180, 0.235, 0.345))
        draw_text("Total:", width - 2.75*inch, y_position, "Helvetica-Bold", 12)
        draw_text(f"N{invoice.total_amount:,.2f}", width - 1.25*inch, y_position, "Helvetica-Bold", 12)

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

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def export_pdf(self, request):
        """
        Generates a professional bulk PDF export of invoices with advanced styling and layout.
        Supports multiple export formats and comprehensive filtering.
        """
        logger.info(f"Raw request data: {request.body}")
        logger.info(f"Parsed request data: {request.data}")
        logger.info(f"Content-Type header: {request.headers.get('Content-Type')}")

        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required'}, 
                          status=status.HTTP_401_UNAUTHORIZED)

        if not request.user.has_role_permission(self.view_permission):
            logger.warning(f"Permission denied for PDF export to user {request.user.username}")
            raise PermissionDenied("You don't have permission to export invoices")

        invoice_ids = request.data.get('invoice_ids', [])
        export_format = request.data.get('format', 'detailed')

        if not invoice_ids:
            logger.warning(f"Bulk PDF export attempted without invoice IDs by user {request.user.username}")
            return Response(
                {'error': 'No invoice IDs provided for export'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            accessible_invoices = self.apply_role_based_filtering()
            invoices = accessible_invoices.filter(id__in=invoice_ids)

            if not invoices.exists():
                logger.warning(f"No accessible invoices found for bulk export by user {request.user.username}")
                return Response(
                    {'error': 'No invoices found or access denied'},
                    status=status.HTTP_404_NOT_FOUND
                )

            logger.info(f"Exporting {invoices.count()} invoices for user {request.user.username}")

            # Prepare PDF buffer
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter)
            elements = []

            # Company information retrieval
            company_info = CompanyInfo.objects.first()
            if not company_info:
                logger.warning("No CompanyInfo found. Using default values.")

            # Styling and layout consistent with generate_pdf method
            def create_header(canvas, doc):
                canvas.saveState()
                width, height = letter

                # Header background
                canvas.setFillColor(colors.Color(0.180, 0.235, 0.345))  # Primary blue
                canvas.rect(0, height - 2.5*inch, width, 2.5*inch, fill=1)
                canvas.setFillColor(colors.Color(0.150, 0.205, 0.315))  # Darker blue
                canvas.rect(0, height - 2.5*inch, width, 0.5*inch, fill=1)

                # Company Logo
                logo_path = os.path.expanduser('~/verifi/Finstock/static/Logo 10.png')
                canvas.drawImage(logo_path, 0.5*inch, height - 2*inch, width=1.5*inch, height=1*inch)

                # Bulk Export Title
                canvas.setFont("Helvetica-Bold", 24)
                canvas.setFillColor(colors.white)
                canvas.drawString(2.25*inch, height - 0.75*inch, "Invoice Bulk Export")

                # Export Metadata
                canvas.setFont("Helvetica", 10)
                canvas.drawString(0.5*inch, 0.75*inch,
                    f"Exported by {request.user.username} on {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}")

                canvas.restoreState()

            # Prepare invoice data for table
            table_data = [['Invoice #', 'Customer', 'Issue Date', 'Due Date', 'Subtotal', 'Total']]

            for invoice in invoices:
                row = [
                    str(invoice.invoice_number)[:6],  # Consistent with generate_pdf approach
                    invoice.customer.name if invoice.customer else 'N/A',
                    invoice.issue_date.strftime("%B %d, %Y"),
                    invoice.due_date.strftime("%B %d, %Y"),
                    f"N{invoice.total_amount:,.2f}",
                    f"N{invoice.total_amount:,.2f}"  # Placeholder for potential tax/adjustment
                ]

                if export_format == 'detailed':
                    # Add more columns for detailed export
                    row.extend([
                        invoice.status,
                        invoice.customer.phone if invoice.customer else 'N/A'
                    ])
                    table_data[0].extend(['Status', 'Contact'])

                table_data.append(row)

            # Table styling consistent with generate_pdf
            table_style = [
                ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.180, 0.235, 0.345)),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]

            # Create table
            table = Table(table_data, repeatRows=1)
            table.setStyle(TableStyle(table_style))

            # Aggregate summary
            total_invoices = len(invoices)
            total_amount = sum(invoice.total_amount for invoice in invoices)

            # Summary paragraph
            summary_style = getSampleStyleSheet()['Normal']
            summary_text = (
                f"Bulk Export Summary: {total_invoices} invoices exported. "
                f"Total amount: N{total_amount:,.2f}"
            )
            summary_paragraph = Paragraph(summary_text, summary_style)

            # Assemble PDF elements
            elements.extend([
                Spacer(1, 2*inch),  # Add some initial spacing
                summary_paragraph,
                Spacer(1, 0.5*inch),
                table
            ])

            # Build PDF with custom header
            doc.build(elements, onFirstPage=create_header, onLaterPages=create_header)

            # Prepare response
            buffer.seek(0)
            response = FileResponse(
                buffer,
                as_attachment=True,
                filename=f'invoice_bulk_export_{timezone.now().strftime("%Y%m%d_%H%M%S")}.pdf'
            )

            # Log export event
            logger.info(f"Bulk PDF export of {total_invoices} invoices by user {request.user.username}")

            return response

        except Exception as e:
            logger.error(f"Error in bulk PDF export: {str(e)}")
            return Response(
                {'error': 'An error occurred while generating bulk PDF export'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
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
