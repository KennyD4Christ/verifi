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
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
import io
import logging

logger = logging.getLogger(__name__)

from users.permissions import CanViewResource, CanManageResource, SuperuserOrReadOnly


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class TransactionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing transactions
    """
    queryset = Transaction.objects.all().order_by('-date', '-id')
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [
        DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter
    ]
    filterset_fields = ['status', 'transaction_type', 'date', 'category', 'order']
    search_fields = ['order__id', 'invoice__id', 'customer__id', 'amount']
    ordering_fields = ['date', 'amount', 'id']
    ordering = ['-date', '-id']
    
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
        Exports all filtered transactions to a PDF report
        """
        transactions = self.filter_queryset(self.get_queryset())
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []

        # Add title
        styles = getSampleStyleSheet()
        elements.append(Paragraph("Transactions Report", styles['Title']))

        # Prepare data for table
        data = [['ID', 'Order', 'Invoice', 'Customer', 'Type', 'Category', 'Amount', 'Date', 'Payment Method', 'Status']]
        for transaction in transactions:
            data.append([
                str(transaction.id),
                str(transaction.order),
                str(transaction.invoice),
                str(transaction.customer),
                transaction.transaction_type,
                transaction.category,
                f"${transaction.amount:.2f}",
                transaction.date.strftime("%Y-%m-%d"),
                transaction.payment_method,
                transaction.status
            ])

        # Create table
        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 12),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))

        elements.append(table)

        # Build PDF
        doc.build(elements)
        buffer.seek(0)
    
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="transactions_report.pdf"'
        return response

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
