from rest_framework import filters, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.conf import settings
from django.db.models import Q
from .models import Receipt
from .serializers import ReceiptSerializer, ReceiptDetailSerializer
from users.views import BaseAccessControlViewSet
from users.constants import PermissionConstants
from rest_framework.decorators import api_view, permission_classes, renderer_classes
from rest_framework.renderers import JSONRenderer
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
import qrcode
from PIL import Image
import datetime

import logging
logger = logging.getLogger(__name__)

class ReceiptViewSet(BaseAccessControlViewSet):
    queryset = Receipt.objects.all()
    serializer_class = ReceiptSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['payment_date', 'payment_method']
    search_fields = ['invoice__customer__name', 'receipt_number', 'invoice__invoice_number']
    ordering_fields = ['payment_date', 'amount_paid']
    ordering = ['-payment_date']
    
    model = Receipt
    model_name = 'receipt'
    
    view_permission = PermissionConstants.RECEIPT_VIEW
    create_permission = PermissionConstants.RECEIPT_CREATE
    edit_permission = PermissionConstants.RECEIPT_EDIT
    delete_permission = PermissionConstants.RECEIPT_DELETE
    
    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Receipt.objects.none()
            
        if settings.TESTING:
            return self.queryset
            
        base_queryset = super().get_queryset()
        queryset = base_queryset.select_related('invoice', 'invoice__customer')
        
        # Add logging to debug empty results
        logger.info(f"Receipt queryset count: {queryset.count()}")
        if queryset.count() == 0:
            logger.info("No receipts found. Checking filtering conditions...")
            # Check if any receipts exist at all
            all_receipts = Receipt.objects.all().count()
            logger.info(f"Total receipts in database: {all_receipts}")
            
            # If there are receipts but none in the queryset, log the user's roles
            if all_receipts > 0:
                logger.info(f"User {self.request.user.username} (ID: {self.request.user.id}) has roles: {self.request.user.get_roles()}")
        
        return queryset
    
    def apply_role_based_filtering(self):
        queryset = Receipt.objects.all()
        user = self.request.user
        
        try:
            if user.is_superuser:
                return queryset
                
            if user.has_role_permission(self.view_permission):
                if user.is_role('Administrator'):
                    return queryset
                elif user.is_role('Sales Representative'):
                    return queryset.filter(invoice__order__sales_rep=user)
                elif user.is_role('Customer'):
                    return queryset.filter(invoice__order__customer__user=user)
                elif user.is_role('Accountant'):
                    return queryset
                else:
                    return queryset.filter(
                        Q(created_by=user) |
                        Q(invoice__order__created_by=user)
                    )
                    
            logger.info(f"User {user.username} lacks view permission for receipts")
            return Receipt.objects.none()
            
        except Exception as e:
            logger.error(f"Error in apply_role_based_filtering for user {user.id}: {str(e)}")
            return Receipt.objects.none()

    @action(detail=True, methods=['get'])
    def custom_retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data

        # Add debugging information
        logger.info(f"Retrieved receipt {instance.id} with invoice {instance.invoice_id if instance.invoice else 'None'}")
        if instance.invoice:
            items_count = instance.invoice.items.count()
            logger.info(f"Invoice {instance.invoice_id} has {items_count} items")

        return Response(data)

    def get_serializer_class(self):
        if self.action == 'retrieve' and self.request.query_params.get('include_items'):
            return ReceiptDetailSerializer
        return self.serializer_class
            
    def perform_create(self, serializer):
        if not self.request.user.has_role_permission(self.create_permission):
            raise PermissionDenied("You do not have permission to create receipts")
        serializer.save(user=self.request.user)
        
    def perform_update(self, serializer):
        if not self.request.user.has_role_permission(self.edit_permission):
            raise PermissionDenied("You do not have permission to update receipts")
        serializer.save()
        
    def perform_destroy(self, instance):
        if not self.request.user.has_role_permission(self.delete_permission):
            raise PermissionDenied("You do not have permission to delete receipts")
        instance.delete()

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """
        Custom action to handle bulk deletion of receipts.
        """
        if not self.request.user.has_role_permission(self.delete_permission):
            raise PermissionDenied("You do not have permission to delete receipts")
            
        receipt_ids = request.data.get('receipt_ids', [])
        if not receipt_ids:
            return Response({"error": "No receipt IDs provided"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Delete the receipts with the given IDs
        deleted_count = Receipt.objects.filter(id__in=receipt_ids).delete()[0]
        
        return Response({
            "message": f"Successfully deleted {deleted_count} receipt(s)",
            "deleted_count": deleted_count
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        receipt = self.get_object()
    
        # Create a buffer and PDF document
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=0.5*inch,
            bottomMargin=0.5*inch
        )
    
        # Define styles
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(
            name='CompanyName',
            fontName='Helvetica-Bold',
            fontSize=14,
            textColor=colors.blue
        ))
        styles.add(ParagraphStyle(
            name='ReceiptTitle',
            fontName='Helvetica-Bold',
            fontSize=12,
            alignment=1  # Right aligned
        ))
        styles.add(ParagraphStyle(
            name='SectionTitle',
            fontName='Helvetica-Bold',
            fontSize=10,
            textColor=colors.gray
        ))
        styles.add(ParagraphStyle(
            name='PaidStatus',
            fontName='Helvetica-Bold',
            fontSize=12,
            textColor=colors.green,
            alignment=1  # Right aligned
        ))
    
        # Create elements list to hold content
        elements = []
    
        # Business and Receipt Info Header
        company_data = [
            ['Your Company Name', f'RECEIPT'],
            ['123 Business Street', f'Date: {receipt.payment_date.strftime("%m/%d/%Y")}'],
            ['City, State 12345', f'Receipt #: {receipt.receipt_number}'],
            ['Phone: (123) 456-7890', f'Invoice #: {receipt.invoice.invoice_number if receipt.invoice else "N/A"}'],
            ['Email: info@yourcompany.com', '']
        ]
    
        business_table = Table(company_data, colWidths=[3*inch, 3*inch])
        business_table.setStyle(TableStyle([
            ('FONT', (0, 0), (0, 0), 'Helvetica-Bold'),
            ('TEXTCOLOR', (0, 0), (0, 0), colors.blue),
            ('FONT', (1, 0), (1, 0), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
    
        elements.append(business_table)
        elements.append(Spacer(1, 0.2*inch))
    
        # Horizontal Line
        elements.append(Paragraph('<hr/>', styles['Normal']))
        elements.append(Spacer(1, 0.1*inch))
    
        # Customer Info
        customer_title = Paragraph('BILL TO:', styles['SectionTitle'])
        elements.append(customer_title)
    
        # Get customer information from the invoice if available
        customer_name = "N/A"
        customer_email = None
        customer_address = None
    
        if receipt.invoice:
            if hasattr(receipt.invoice, 'customer'):
                customer_name = receipt.invoice.customer.name if hasattr(receipt.invoice.customer, 'name') else "N/A"
                customer_email = receipt.invoice.customer.email if hasattr(receipt.invoice.customer, 'email') else None
                customer_address = receipt.invoice.customer.address if hasattr(receipt.invoice.customer, 'address') else None
    
        customer_info = [
            [f'<b>{customer_name}</b>'],
        ]
    
        if customer_email:
            customer_info.append([f'Email: {customer_email}'])
    
        if customer_address:
            customer_info.append([f'Address: {customer_address}'])
    
        customer_table = Table(customer_info, colWidths=[6*inch])
        customer_table.setStyle(TableStyle([
            ('FONT', (0, 0), (0, 0), 'Helvetica-Bold'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
    
        elements.append(customer_table)
        elements.append(Spacer(1, 0.2*inch))
    
        # Horizontal Line
        elements.append(Paragraph('<hr/>', styles['Normal']))
        elements.append(Spacer(1, 0.1*inch))
    
        # Payment Details
        payment_title = Paragraph('PAYMENT DETAILS:', styles['SectionTitle'])
        elements.append(payment_title)
    
        # Format payment method using the actual choices from the model
        payment_method_display = dict(receipt.PAYMENT_METHOD_CHOICES).get(receipt.payment_method, receipt.payment_method)
    
        payment_data = [
            [f'<b>Method:</b> {payment_method_display}', Paragraph('PAID', styles['PaidStatus'])],
        ]
    
        # Add payment reference if available
        if receipt.payment_reference:
            payment_data.append([f'<b>Reference:</b> {receipt.payment_reference}', f'<b>N{receipt.amount_paid:.2f}</b>'])
        else:
            payment_data.append(['', f'<b>N{receipt.amount_paid:.2f}</b>'])
    
        payment_table = Table(payment_data, colWidths=[3*inch, 3*inch])
        payment_table.setStyle(TableStyle([
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
    
        elements.append(payment_table)
        elements.append(Spacer(1, 0.2*inch))
    
        # Horizontal Line
        elements.append(Paragraph('<hr/>', styles['Normal']))
        elements.append(Spacer(1, 0.1*inch))
    
        # Purchased Items
        items_title = Paragraph('PURCHASED ITEMS:', styles['SectionTitle'])
        elements.append(items_title)
        elements.append(Spacer(1, 0.1*inch))
    
        # Create header for items table
        items_data = [['Item', 'Quantity', 'Unit Price', 'Total']]
    
        # Get items from the invoice if available
        if receipt.invoice and hasattr(receipt.invoice, 'items'):
            invoice_items = receipt.invoice.items.all()
            if invoice_items.exists():
                for item in invoice_items:
                    item_name = item.product.name if hasattr(item, 'product') and hasattr(item.product, 'name') else item.description
                    items_data.append([
                        item_name,
                        str(item.quantity),
                        f'N{item.unit_price:.2f}',
                        f'N{item.total_price:.2f}' if hasattr(item, 'total_price') else f'N{item.quantity * item.unit_price:.2f}'
                    ])
            else:
                items_data.append(['No items available', '', '', ''])
        else:
            items_data.append(['No items available', '', '', ''])
    
        # Add footer rows (subtotal, tax, discount, total)
        subtotal = receipt.amount_paid
        tax = 0
        discount = 0
    
        if receipt.invoice:
            if hasattr(receipt.invoice, 'tax_amount'):
                tax = receipt.invoice.tax_amount
            if hasattr(receipt.invoice, 'discount_amount'):
                discount = receipt.invoice.discount_amount
    
        items_data.append(['', '', 'Subtotal:', f'N{subtotal:.2f}'])
    
        if tax > 0:
            items_data.append(['', '', 'Tax:', f'N{tax:.2f}'])
        
        if discount > 0:
            items_data.append(['', '', 'Discount:', f'-N{discount:.2f}'])
        
        items_data.append(['', '', 'Total:', f'N{receipt.amount_paid:.2f}'])
    
        # Create and style the items table
        col_widths = [2.5*inch, 1*inch, 1.25*inch, 1.25*inch]
        items_table = Table(items_data, colWidths=col_widths)
    
        # Apply table styles
        table_style = TableStyle([
            # Header row styling
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, 0), 1, colors.black),
        
            # Data rows - center align description and quantity
            ('ALIGN', (0, 1), (0, -5), 'CENTER'),  # Center item names
            ('ALIGN', (1, 1), (1, -5), 'CENTER'),  # Center quantities
            ('ALIGN', (2, 1), (3, -1), 'RIGHT'),   # Right align prices
        
            # Add subtle grid to body of table
            ('GRID', (0, 1), (-1, -5), 0.5, colors.lightgrey),
    
            # Footer styling (Subtotal, tax, discount, total)
            ('FONTNAME', (2, -4), (3, -1), 'Helvetica-Bold'),  # Bold labels and values
            ('ALIGN', (2, -4), (2, -1), 'RIGHT'),  # Right align labels
            ('ALIGN', (3, -4), (3, -1), 'RIGHT'),  # Right align values
            ('LINEABOVE', (2, -4), (3, -4), 1, colors.grey),   # Line above subtotal
            ('LINEBELOW', (2, -1), (3, -1), 1, colors.black),  # Line below total
        ])

        table_style.add('SPAN', (0, -4), (1, -4))  # Subtotal row
        table_style.add('SPAN', (0, -3), (1, -3))  # Tax row
        table_style.add('SPAN', (0, -2), (1, -2))  # Discount row
        table_style.add('SPAN', (0, -1), (1, -1))  # Total row

        items_table.setStyle(table_style)
    
        # Add conditional spans based on whether tax and discount exist
        offset = 0
        if tax <= 0:
            offset += 1
        if discount <= 0:
            offset += 1
    
        # Apply the appropriate spans
        footer_start = -4 + offset
        for i in range(footer_start, 0):
            table_style.add('SPAN', (0, i), (2, i))
    
        items_table.setStyle(table_style)
        elements.append(items_table)
    
        # Notes (if available)
        if receipt.notes:
            elements.append(Spacer(1, 0.2*inch))
            notes_title = Paragraph('NOTES:', styles['SectionTitle'])
            elements.append(notes_title)
        
            notes_style = ParagraphStyle(
                'Notes',
                parent=styles['Normal'],
                backColor=colors.lightgrey,
                borderPadding=10
            )
            notes_paragraph = Paragraph(receipt.notes, notes_style)
            elements.append(notes_paragraph)
    
        # QR Code (if available)
        if receipt.qr_code and receipt.qr_code.name:  # Check both that qr_code exists and has a file
            elements.append(Spacer(1, 0.2*inch))
        
            # If we have a QR code image field, use it
            try:
                qr_img = Image.open(receipt.qr_code.path)
                qr_img_io = BytesIO()
                qr_img.save(qr_img_io, format='PNG')
                qr_img_io.seek(0)
            
                # Create a Table with a single cell for the QR code
                qr_table = Table([[qr_img_io]], colWidths=[2*inch])
                qr_table.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
                elements.append(qr_table)
            except Exception as e:
                # If using the stored QR code fails, generate a new one
                try:
                    qr = qrcode.QRCode(
                        version=1,
                        error_correction=qrcode.constants.ERROR_CORRECT_L,
                        box_size=4,
                        border=4,
                    )
                    qr_data = f"Receipt: {receipt.receipt_number}\nAmount: N{receipt.amount_paid}\nDate: {receipt.payment_date.strftime('%m/%d/%Y')}"
                    qr.add_data(qr_data)
                    qr.make(fit=True)
                
                    qr_img = qr.make_image(fill_color="black", back_color="white")
                    qr_img_io = BytesIO()
                    qr_img.save(qr_img_io)
                    qr_img_io.seek(0)
                
                    # Create a Table with a single cell for the QR code
                    qr_table = Table([[qr_img_io]], colWidths=[2*inch])
                    qr_table.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
                    elements.append(qr_table)
                except Exception as e:
                    # If QR code generation fails, skip it
                    pass
    
        # Thank You Message
        elements.append(Spacer(1, 0.3*inch))
        thank_you_style = ParagraphStyle(
            'ThankYou',
            parent=styles['Normal'],
            alignment=1,  # Center
            textColor=colors.grey
        )
        thank_you = Paragraph("Thank you for your business!", thank_you_style)
        elements.append(thank_you)
    
        # Build the PDF
        doc.build(elements)
        buffer.seek(0)
    
        # Create response
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Receipt-{receipt.receipt_number}.pdf"'
        return response

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def export_receipts_pdf(request):
    """
    Export multiple receipts as a single PDF file.
    Accepts a list of receipt IDs and format option.
    """
    receipt_ids = request.data.get('ids', [])
    export_format = request.data.get('format', 'detailed')

    if not receipt_ids:
        return Response({"error": "No receipt IDs provided"}, status=400)

    # Get receipts
    receipts = Receipt.objects.filter(id__in=receipt_ids).select_related('invoice__customer')

    if not receipts:
        return Response({"error": "No receipts found with the provided IDs"}, status=404)

    # Create PDF
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)

    # Add title
    p.setFont("Helvetica-Bold", 16)
    p.drawString(100, 780, "Receipt Export")
    p.setFont("Helvetica", 10)
    p.drawString(100, 760, f"Generated on: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}")
    p.drawString(100, 740, f"Number of receipts: {len(receipts)}")

    y_position = 700

    # Add receipts to PDF
    for receipt in receipts:
        if y_position < 100:  # Start a new page if not enough space
            p.showPage()
            y_position = 750

        p.setFont("Helvetica-Bold", 12)
        p.drawString(100, y_position, f"Receipt #{receipt.receipt_number}")
        y_position -= 20

        p.setFont("Helvetica", 10)
        p.drawString(100, y_position, f"Customer: {receipt.invoice.customer.name}")
        y_position -= 15

        p.drawString(100, y_position, f"Amount: {receipt.amount_paid}")
        y_position -= 15

        p.drawString(100, y_position, f"Date: {receipt.payment_date}")
        y_position -= 15

        # Add detailed information if requested
        if export_format == 'detailed' and hasattr(receipt, 'invoice') and receipt.invoice:
            p.drawString(100, y_position, "Items:")
            y_position -= 15

            for item in receipt.invoice.items.all():
                p.drawString(120, y_position, f"{item.product.name} - {item.quantity} x {item.unit_price} = {item.total_price}")
                y_position -= 15

        y_position -= 20  # Add some space between receipts

    p.showPage()
    p.save()
    buffer.seek(0)

    # Prepare response
    response = HttpResponse(buffer, content_type='application/pdf')
    filename = "receipts-export.pdf" if len(receipts) > 1 else f"receipt-{receipts[0].id}.pdf"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    return response
