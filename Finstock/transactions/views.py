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
from users.models import CustomUser
from django.db.models import Q
import logging

logger = logging.getLogger(__name__)

from users.permissions import CanViewResource, CanManageResource, SuperuserOrReadOnly, TransactionPermission


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class TransactionViewSet(BaseAccessControlViewSet):
    """
    API endpoint for managing transactions
    """
    queryset = Transaction.objects.all().order_by('-date', '-id')
    serializer_class = TransactionSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [
        DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter
    ]
    filterset_fields = ['status', 'transaction_type', 'date', 'category', 'order']
    search_fields = ['order__id', 'invoice__id', 'customer__id', 'amount']
    ordering_fields = ['date', 'amount', 'id']
    ordering = ['-date', '-id']

    model = Transaction
    model_name = 'transaction'

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
        # Additional role-based creation permission check
        allowed_roles = ['Accountant', 'Administrator', 'Sales Representative']
        user = self.request.user

        if not user.role.name in allowed_roles:
            logger.warning(f"Unauthorized transaction creation attempt by user {user.username}")
            raise PermissionDenied("You are not authorized to create transactions")

        logger.info(f"Transaction creation authorized for user {user.username}")
        serializer.save()

    def perform_update(self, serializer):
        # Additional role-based update permission check
        allowed_roles = ['Accountant', 'Administrator']
        user = self.request.user

        if not user.role.name in allowed_roles:
            logger.warning(f"Unauthorized transaction update attempt by user {user.username}")
            raise PermissionDenied("You are not authorized to update transactions")

        logger.info(f"Transaction update authorized for user {user.username}")
        serializer.save()

    def perform_destroy(self, instance):
        # Additional role-based deletion permission check
        allowed_roles = ['Administrator']
        user = self.request.user

        if not user.role.name in allowed_roles:
            logger.warning(f"Unauthorized transaction deletion attempt by user {user.username}")
            raise PermissionDenied("You are not authorized to delete transactions")

        logger.info(f"Transaction deletion authorized for user {user.username}")
        instance.delete()
    
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

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """
        Exports all filtered transactions to a CSV file.
        """
        transactions = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = (
            'attachment; filename="transactions.csv"'
        )
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Order', 'Invoice', 'Customer', 'Type', 'Category',
            'Amount', 'Date', 'Payment Method', 'Status'
        ])
        for transaction in transactions:
            writer.writerow([
                transaction.id, transaction.order, transaction.invoice,
                transaction.customer, transaction.transaction_type,
                transaction.category, transaction.amount, transaction.date,
                transaction.payment_method, transaction.status
            ])
        return response

    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        """
        Exports all filtered transactions to a PDF report with proper formatting
        """
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
    
        # Create custom styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Title'],
            fontSize=24,
            spaceAfter=30,
            alignment=TA_CENTER
        )
    
        # Add title with date
        title_text = (f"Transactions Report<br/>"
                     f"<font size=12>Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</font>")
        elements.append(Paragraph(title_text, title_style))
        elements.append(Spacer(1, 20))
    
        # Define column widths as proportions of the page width
        page_width = landscape(letter)[0] - 60  # Total width minus margins
        col_widths = [
            page_width * 0.05,  # ID (5%)
            page_width * 0.10,  # Order (10%)
            page_width * 0.10,  # Invoice (10%)
            page_width * 0.12,  # Customer (12%)
            page_width * 0.10,  # Type (10%)
            page_width * 0.12,  # Category (12%)
            page_width * 0.11,  # Amount (11%)
            page_width * 0.10,  # Date (10%)
            page_width * 0.10,  # Payment Method (10%)
            page_width * 0.10   # Status (10%)
        ]
    
        # Prepare data for table
        headers = ['ID', 'Order', 'Invoice', 'Customer', 'Type', 'Category', 
                  'Amount', 'Date', 'Payment Method', 'Status']
    
        # Create header rows with wrapped text
        header_rows = [[Paragraph(header, styles['Heading2']) for header in headers]]
    
        # Prepare data rows with wrapped text
        data_rows = []
        for transaction in transactions:
            row = [
                Paragraph(str(transaction.id), styles['Normal']),
                Paragraph(str(transaction.order or ''), styles['Normal']),
                Paragraph(str(transaction.invoice or ''), styles['Normal']),
                Paragraph(str(transaction.customer or ''), styles['Normal']),
                Paragraph(transaction.get_transaction_type_display(), styles['Normal']),
                Paragraph(transaction.get_category_display() if transaction.category else '', styles['Normal']),
                Paragraph(f"${transaction.amount:.2f}", styles['Normal']),
                Paragraph(transaction.date.strftime("%Y-%m-%d"), styles['Normal']),
                Paragraph(transaction.get_payment_method_display(), styles['Normal']),
                Paragraph(transaction.get_status_display(), styles['Normal'])
            ]
            data_rows.append(row)
    
        # Combine headers and data
        data = header_rows + data_rows
    
        # Create table with defined column widths
        table = Table(data, colWidths=col_widths, repeatRows=1)
    
        # Apply table styles
        table.setStyle(TableStyle([
            # Header styles
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ffffff')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#ffffff')),
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
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        
            # Grid styles
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        
            # Alternate row colors
            *[('BACKGROUND', (0, i), (-1, i), colors.HexColor('#F8F9FA'))
              for i in range(2, len(data), 2)],
        ]))
    
        # Add table to elements
        elements.append(table)
    
        # Build PDF
        try:
            doc.build(elements)
            buffer.seek(0)
        
            # Prepare response
            response = HttpResponse(buffer, content_type='application/pdf')
            filename = f"transactions_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
            return response
        
        except Exception as e:
            logger.error(f"Error generating PDF: {str(e)}")
            return Response(
                {"error": "Failed to generate PDF report"},
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
