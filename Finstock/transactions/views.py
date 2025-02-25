from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.core.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from .models import Transaction
from .serializers import TransactionSerializer
import csv
from decimal import Decimal
from django.http import HttpResponse
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import io
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER
from datetime import datetime
from users.views import BaseAccessControlViewSet
from users.constants import PermissionConstants
from users.models import CustomUser
from django.db.models import Q
import logging

logger = logging.getLogger(__name__)

from users.permissions import CanViewResource, CanManageResource, SuperuserOrReadOnly


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class TransactionViewSet(BaseAccessControlViewSet):
    """
    API endpoint for managing transactions
    """
    queryset = Transaction.objects.all().select_related('customer', 'created_by').order_by('-date', '-id')
    serializer_class = TransactionSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [
        DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter
    ]
    filterset_fields = ['status', 'transaction_type', 'date', 'category', 'order']
    search_fields = ['order__id', 'invoice__id', 'customer__name', 'customer__first_name', 'customer__last_name', 'amount', 'created_by__username']
    ordering_fields = ['date', 'amount', 'customer__name', 'customer__first_name', 'customer__last_name','id', 'created_by__username']
    ordering = ['-date', '-id']

    model = Transaction
    model_name = 'transaction'

    view_permission = PermissionConstants.TRANSACTION_VIEW
    create_permission = PermissionConstants.TRANSACTION_CREATE
    edit_permission = PermissionConstants.TRANSACTION_EDIT
    delete_permission = PermissionConstants.TRANSACTION_DELETE

    def apply_role_based_filtering(self):
        user = self.request.user

        if user.is_superuser or user.is_role('Administrator'):
            return self.model.objects.all()

        elif user.is_role('Accountant'):
            return self.model.objects.all()  # Full access to all transactions

        elif user.is_role('Sales Representative'):
            # Can only see transactions related to their own orders or customers
            return self.model.objects.filter(
                Q(order__user=user) | Q(customer__user=user)
            )

        elif user.is_role('Auditor'):
            # Read-only access to all transactions
            return self.model.objects.all()

        elif user.is_role('Inventory Manager'):
            # Limited access, only to transactions related to their managed products
            return self.model.objects.filter(
                order__items__product__in=Product.objects.filter(managed_by=user)
            ).distinct()

        return self.model.objects.none()

    def get_queryset(self):
        queryset = super().get_queryset()

        user = self.request.user

        if user.is_superuser or user.is_role('Administrator'):
            pass  # No additional filtering

        elif user.is_role('Accountant'):
            pass  # Accountants can view all transactions

        elif user.is_role('Sales Representative'):
            # Can only view transactions related to their own orders or customers
            queryset = queryset.filter(
                Q(order__user=user) | Q(customer__user=user)
            )

        elif user.is_role('Auditor'):
            pass  # Auditors can view all transactions

        elif user.is_role('Inventory Manager'):
            # Can only view transactions related to products they manage
            queryset = queryset.filter(
                order__items__product__in=Product.objects.filter(managed_by=user)
            ).distinct()

        else:
            # Default to no access
            queryset = queryset.none()

        return queryset.prefetch_related('order', 'invoice', 'customer')

    def perform_create(self, serializer):
        user = self.request.user
        allowed_roles = ['Accountant', 'Administrator', 'Sales Representative']
    
        if not any(user.is_role(role) for role in allowed_roles):
            logger.warning(f"Unauthorized transaction creation attempt by user {user.username}")
            raise PermissionDenied("You are not authorized to create transactions")

        logger.info(f"Transaction creation authorized for user {user.username}")
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        # Additional role-based update permission check
        if not user.is_role('Administrator'):
            logger.warning(f"Unauthorized transaction update attempt by user {user.username}")
            raise PermissionDenied("You are not authorized to update transactions")

        if not self.request.user.has_role_permission(self.edit_permission):
            logger.warning(f"Unauthorized transaction update attempt by user {self.request.user.username}")
            raise PermissionDenied("You are not authorized to update transactions")

        logger.info(f"Transaction update authorized for user {self.request.user.username}")
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
    
        # Check for Administrator role using the correct method
        if not user.is_role('Administrator'):
            logger.warning(f"Unauthorized transaction deletion attempt by user {user.username}")
            raise PermissionDenied("You are not authorized to delete transactions")
        
        # Also verify the user has the delete permission
        if not user.has_role_permission(self.delete_permission):
            logger.warning(f"User {user.username} lacks delete permission for transactions")
            raise PermissionDenied("You don't have permission to delete transactions")
    
        try:
            logger.info(f"Transaction deletion authorized for user {user.username}")
            instance.delete()
        except Exception as e:
            logger.error(f"Error deleting transaction {instance.id}: {str(e)}")
            raise ValidationError("Unable to delete transaction")

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def create(self, request, *args, **kwargs):
        logger.info(f"Received data for transaction creation: {request.data}")
        try:
            return super().create(request, *args, **kwargs)
        except ValidationError as e:
            logger.error(f"Validation error creating transaction: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Unexpected error creating transaction: {str(e)}")
            return Response({"error": "An unexpected error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error in transaction list view: {str(e)}")
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
            return Transaction.objects.none()

        return queryset

    def update(self, request, *args, **kwargs):
        try:
            logger.info(f"Received update request for transaction ID: {kwargs.get('pk')}")
            logger.info(f"Request data: {request.data}")
            return super().update(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error updating transaction: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def verify(self, request, pk=None):
        """Verify transaction details through QR code"""
        transaction = self.get_object()

        return Response({
            'id': transaction.id,
            'amount': str(transaction.amount),
            'date': str(transaction.date),
            'type': transaction.transaction_type,
            'status': transaction.status,
            'verified': True
        })

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({"error": "No IDs provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            deleted_count = Transaction.objects.filter(id__in=ids).delete()[0]
            return Response({"message": f"Successfully deleted {deleted_count} transactions"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _get_customer_display(self, customer):
        """Helper method to format customer display name"""
        if not customer:
            return ''
        if hasattr(customer, 'name') and customer.name:
            return customer.name
        return f"{customer.first_name} {customer.last_name}".strip()

    def _format_currency(self, amount):
        return f"N{amount:,.2f}" if amount is not None else ''

    def _format_related_object(self, obj):
        """Helper method to format related object references"""
        return obj.id if obj else ''

    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        """
        Exports all filtered transactions to a PDF report with proper formatting
        """
        try:
            # Get filtered transactions
            transactions = self.filter_queryset(self.get_queryset())

            # Create buffer and PDF document in landscape orientation
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=landscape(letter),
                rightMargin=30,
                leftMargin=30,
                topMargin=30,
                bottomMargin=30
            )

            # Initialize elements list for PDF content
            elements = []

            # Enhanced custom styles
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Title'],
                fontSize=24,
                spaceAfter=30,
                alignment=TA_CENTER,
                textColor=colors.HexColor('#1a237e')  # Dark blue color for title
            )

            # Add title with date and total count
            title_text = (
                f"Transactions Report<br/>"
                f"<font size=12>Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br/>"
                f"Total Transactions: {transactions.count():,}</font>"
            )
            elements.append(Paragraph(title_text, title_style))
            elements.append(Spacer(1, 20))

            # Define column widths as proportions of the page width
            page_width = landscape(letter)[0] - 60
            col_widths = [
                page_width * 0.05,  # ID
                page_width * 0.10,  # Order
                page_width * 0.10,  # Invoice
                page_width * 0.15,  # Customer (increased width)
                page_width * 0.10,  # Type
                page_width * 0.12,  # Category
                page_width * 0.11,  # Amount
                page_width * 0.09,  # Date
                page_width * 0.09,  # Payment Method
                page_width * 0.09   # Status
            ]

            # Enhanced header style
            header_style = ParagraphStyle(
                'HeaderStyle',
                parent=styles['Heading2'],
                fontSize=12,
                textColor=colors.white,
                alignment=TA_CENTER
            )

            headers = ['ID', 'Order', 'Invoice', 'Customer', 'Type', 'Category',
                      'Amount', 'Date', 'Payment Method', 'Status']
            header_rows = [[Paragraph(header, header_style) for header in headers]]

            # Prepare data rows with enhanced formatting
            data_rows = []
            for transaction in transactions:
                row = [
                    Paragraph(str(transaction.id), styles['Normal']),
                    Paragraph(str(transaction.order.id if transaction.order else ''), styles['Normal']),
                    Paragraph(str(transaction.invoice.id if transaction.invoice else ''), styles['Normal']),
                    Paragraph(self._get_customer_display(transaction.customer), styles['Normal']),
                    Paragraph(transaction.get_transaction_type_display(), styles['Normal']),
                    Paragraph(transaction.get_category_display() if transaction.category else '', styles['Normal']),
                    Paragraph(self._format_currency(transaction.amount), styles['Normal']),
                    Paragraph(transaction.date.strftime("%Y-%m-%d"), styles['Normal']),
                    Paragraph(transaction.get_payment_method_display(), styles['Normal']),
                    Paragraph(transaction.get_status_display(), styles['Normal'])
                ]
                data_rows.append(row)

            # Combine headers and data
            data = header_rows + data_rows

            # Create table with defined column widths
            table = Table(data, colWidths=col_widths, repeatRows=1)

            # Enhanced table styles
            table.setStyle(TableStyle([
                # Header styles
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),  # Dark blue header
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('TOPPADDING', (0, 0), (-1, 0), 12),

                # Data row styles
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('TOPPADDING', (0, 1), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 8),

                # Grid styles
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),

                # Alternate row colors - lighter blue for better readability
                *[('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f5f7ff'))
                  for i in range(2, len(data), 2)],
            ]))

            # Add table to elements
            elements.append(table)

            # Build PDF
            doc.build(elements)
            buffer.seek(0)

            # Prepare response
            response = HttpResponse(buffer, content_type='application/pdf')
            filename = f"transactions_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            return response

        except Exception as e:
            logger.error(f"Error generating PDF: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to generate PDF report", "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """
        Exports all filtered transactions to a CSV file with enhanced formatting.

        Features:
        - Proper formatting for all fields
        - Meaningful file naming
        - Error handling
        - Progress tracking for large datasets
        """
        try:
            # Get filtered transactions
            transactions = self.filter_queryset(self.get_queryset())

            # Create the HttpResponse object with CSV header
            response = HttpResponse(content_type='text/csv')

            # Generate a meaningful filename with timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"transactions_export_{timestamp}.csv"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            # Create CSV writer
            writer = csv.writer(response, quoting=csv.QUOTE_ALL)

            # Write headers
            headers = [
                'Transaction ID',
                'Order ID',
                'Invoice ID',
                'Customer',
                'Transaction Type',
                'Category',
                'Amount',
                'Date',
                'Payment Method',
                'Status',
                'Created By',
                'Created Date',
                'Last Modified'
            ]
            writer.writerow(headers)

            # Write data rows with proper formatting
            for transaction in transactions:
                row = [
                    transaction.id,
                    self._format_related_object(transaction.order),
                    self._format_related_object(transaction.invoice),
                    self._get_customer_display(transaction.customer),
                    transaction.get_transaction_type_display(),
                    transaction.get_category_display() if transaction.category else '',
                    self._format_currency(transaction.amount),
                    transaction.date.strftime("%Y-%m-%d") if transaction.date else '',
                    transaction.get_payment_method_display(),
                    transaction.get_status_display(),
                    transaction.created_by.get_full_name() if transaction.created_by else '',
                    transaction.created_at.strftime("%Y-%m-%d %H:%M:%S") if hasattr(transaction, 'created_at') else '',
                    transaction.modified_at.strftime("%Y-%m-%d %H:%M:%S") if hasattr(transaction, 'modified_at') else ''
                ]
                writer.writerow(row)

            # Log successful export
            logger.info(f"Successfully exported {transactions.count()} transactions to CSV")

            return response

        except Exception as e:
            error_message = f"Error exporting transactions to CSV: {str(e)}"
            logger.error(error_message, exc_info=True)
            return Response(
                {
                    "error": "Failed to generate CSV export",
                    "details": str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def bulk_update_status(self, request):
        """
        Updates the status of multiple transactions identified by their IDs.
        """
        status = request.data.get('status')
        ids = request.data.get('ids')
        if status and ids:
            transactions = Transaction.objects.filter(id__in=ids)
            transactions.update(status=status)
            return Response(
                {'message': 'Transactions updated successfully'},
                status=status.HTTP_200_OK
            )
        return Response(
            {'message': 'Invalid data'}, status=status.HTTP_400_BAD_REQUEST
        )
