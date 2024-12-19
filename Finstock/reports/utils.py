from django.core.mail import send_mail
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from django.conf import settings
from reportlab.pdfgen import canvas
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
import io
import logging
from django.core.files.base import ContentFile
import csv
from .models import ReportEntry, ReportFile
import xlsxwriter
from django.db.models import Sum, Avg, Count, F, ExpressionWrapper, DecimalField, IntegerField, Case, When, Q, Subquery, OuterRef
import ast
import operator as op
import statistics
from transactions.models import Transaction
from products.models import Product
from core.models import Customer, Order, OrderItem
from django.utils import timezone
from django.db.models.functions import TruncMonth, Coalesce
from decimal import Decimal

logger = logging.getLogger(__name__)


def generate_comprehensive_report(report):
    """
    Generate a comprehensive PDF report with financial, inventory, and performance insights
    """
    def generate_financial_overview(start_date, end_date):
        """
        Generate detailed financial analysis
        """
        # Income and Expense Analysis
        transactions = Transaction.objects.filter(
            date__range=[start_date, end_date]
        )

        income_transactions = transactions.filter(transaction_type='income')
        expense_transactions = transactions.filter(transaction_type='expense')

        financial_overview = {
            'total_income': income_transactions.aggregate(
                total=Sum('amount')
            )['total'] or Decimal('0.00'),

            'total_expenses': expense_transactions.aggregate(
                total=Sum('amount')
            )['total'] or Decimal('0.00'),

            'net_profit': (
                income_transactions.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            ) - (
                expense_transactions.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            ),

            'income_breakdown': _analyze_income_breakdown(income_transactions),

            'expense_breakdown': _analyze_expense_breakdown(expense_transactions),

            'monthly_cash_flow': _calculate_monthly_cash_flow(transactions)
        }

        return financial_overview

    def _analyze_income_breakdown(income_transactions):
        """
        Detailed breakdown of income sources
        """
        return income_transactions.values('category').annotate(
            total_amount=Sum('amount'),
            transaction_count=Count('id')
        ).order_by('-total_amount')

    def _analyze_expense_breakdown(expense_transactions):
        """
        Detailed breakdown of expense categories
        """
        return expense_transactions.values('category').annotate(
            total_amount=Sum('amount'),
            transaction_count=Count('id')
        ).order_by('-total_amount')

    def _calculate_monthly_cash_flow(transactions):
        """
        Calculate monthly cash flow trends
        """
        return transactions.annotate(
            month=TruncMonth('date')
        ).values('month', 'transaction_type').annotate(
            total_amount=Sum('amount')
        ).order_by('month')

    def generate_inventory_insights():
        """
        Generate comprehensive inventory analysis
        """
        inventory_data = Product.objects.filter(is_active=True).annotate(
            total_stock=Sum('stock'),
            total_value=ExpressionWrapper(
                F('stock') * F('price'),
                output_field=DecimalField()
            ),
            total_sales=Coalesce(
                Sum(
                    Case(
                        When(
                            order_items__order__status__in=['delivered', 'shipped'],
                            then='order_items__quantity'
                        ),
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
                0,
                output_field=IntegerField()
            ),
            total_revenue=Coalesce(
                Sum(
                    Case(
                        When(
                            order_items__order__status__in=['delivered', 'shipped'],
                            then=F('order_items__quantity') * F('order_items__unit_price')
                        ),
                        default=0,
                        output_field=DecimalField(max_digits=10, decimal_places=2)
                    )
                ),
                0,
                output_field=DecimalField(max_digits=10, decimal_places=2)
            )
        )

        return {
            'total_product_count': inventory_data.count(),
            'total_stock_value': inventory_data.aggregate(
                total=Sum(F('stock') * F('price'))
            )['total'] or Decimal('0.00'),

            'low_stock_products': inventory_data.filter(
                stock__lt=F('low_stock_threshold')
            ),

            'top_selling_products': inventory_data.filter(
                Q(total_sales__gt=0) | Q(total_revenue__gt=0)
            ).order_by('-total_sales')[:10].values(
                'name', 
                'total_sales', 
                'total_revenue'
            )
        }

    def generate_performance_metrics():
        """
        Calculate key performance indicators
        """
        # Calculate customer metrics using order items
        customer_metrics = Customer.objects.annotate(
            total_orders=Count('orders'),
            total_spend=Coalesce(
                Sum(
                    F('orders__items__quantity') * F('orders__items__unit_price'),
                    filter=Q(orders__status__in=['delivered', 'shipped'])
                ),
                Decimal('0.00'),
                output_field=DecimalField(max_digits=10, decimal_places=2)
            )
        )

        # Calculate order performance using order items
        order_performance = Order.objects.aggregate(
            total_orders=Count('id'),
            average_order_value=Coalesce(
                Avg(
                    Subquery(
                        Order.objects.filter(
                            id=OuterRef('id')
                        ).annotate(
                            order_total=Sum(F('items__quantity') * F('items__unit_price'))
                        ).values('order_total')[:1]
                    )
                ),
                Decimal('0.00'),
                output_field=DecimalField(max_digits=10, decimal_places=2)
            ),
            total_revenue=Coalesce(
                Sum(F('items__quantity') * F('items__unit_price')),
                Decimal('0.00'),
                output_field=DecimalField(max_digits=10, decimal_places=2)
            )
        )

        return {
            'customer_metrics': {
                'total_customers': customer_metrics.count(),
                'average_orders_per_customer': float(
                    statistics.mean([c.total_orders for c in customer_metrics] or [0])
                ),
                'top_customers': customer_metrics.order_by('-total_spend')[:5].values(
                    'id', 'first_name', 'last_name', 'email', 'total_orders', 'total_spend'
                )
            },
            'order_performance': order_performance,
            'sales_trend': _calculate_sales_trend()
        }

    def _calculate_sales_trend():
        """
        Calculate monthly sales trend
        """
        return Order.objects.annotate(
            month=TruncMonth('order_date')
        ).values('month').annotate(
            total_sales=Coalesce(
                Sum(F('items__quantity') * F('items__unit_price')),
                Decimal('0.00'),
                output_field=DecimalField(max_digits=10, decimal_places=2)
            )
        ).order_by('month')

    # Combine all insights
    report_data = {
        'financial_overview': generate_financial_overview(
            report.created_at,
            timezone.now()
        ),
        'inventory_insights': generate_inventory_insights(),
        'performance_metrics': generate_performance_metrics()
    }

    return report_data

def generate_pdf_report(report):
    """
    Generate a comprehensive PDF report with professional formatting and detailed analytics.
    
    Args:
        report (Report): The report object containing all necessary data
        
    Returns:
        ContentFile: A professionally formatted PDF file with comprehensive analytics
    """
    # Get comprehensive report data
    report_data = generate_comprehensive_report(report)
    
    # Initialize PDF document
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                          rightMargin=72, leftMargin=72,
                          topMargin=72, bottomMargin=18)
    
    styles = getSampleStyleSheet()
    # Add custom styles
    styles.add(ParagraphStyle(
        name='SectionHeader',
        parent=styles['Heading1'],
        fontSize=14,
        spaceAfter=16
    ))
    
    content = []
    
    # Company Header
    header_text = f"Comprehensive Business Report: {report.name}"
    header = Paragraph(header_text, styles['Title'])
    content.append(header)
    content.append(Spacer(1, 20))
    
    # Report Description and Metadata
    if report.description:
        desc_para = Paragraph(f"Description: {report.description}", styles['Normal'])
        content.append(desc_para)
        content.append(Spacer(1, 20))
    
    metadata = [
        ['Created By', str(report.created_by)],
        ['Created At', report.created_at.strftime('%Y-%m-%d %H:%M')],
        ['Last Modified', report.updated_at.strftime('%Y-%m-%d %H:%M')]
    ]
    content.append(_create_styled_table(metadata, ['Metadata', 'Value']))
    content.append(Spacer(1, 20))
    
    # Financial Overview Section
    content.append(Paragraph("Financial Overview", styles['SectionHeader']))
    financial_data = report_data['financial_overview']
    financial_summary = [
        ['Total Income', f"${financial_data['total_income']:,.2f}"],
        ['Total Expenses', f"${financial_data['total_expenses']:,.2f}"],
        ['Net Profit', f"${financial_data['net_profit']:,.2f}"]
    ]
    content.append(_create_styled_table(financial_summary, ['Metric', 'Amount']))
    content.append(Spacer(1, 20))
    
    # Income Breakdown
    content.append(Paragraph("Income Breakdown", styles['SectionHeader']))
    income_data = [[category['category'], 
                   f"${category['total_amount']:,.2f}",
                   str(category['transaction_count'])]
                  for category in financial_data['income_breakdown']]
    content.append(_create_styled_table(income_data, ['Category', 'Amount', 'Transactions']))
    content.append(Spacer(1, 20))
    
    # Inventory Insights
    content.append(Paragraph("Inventory Analysis", styles['SectionHeader']))
    inventory_data = report_data['inventory_insights']
    inventory_summary = [
        ['Total Products', str(inventory_data['total_product_count'])],
        ['Total Stock Value', f"${inventory_data['total_stock_value']:,.2f}"],
        ['Low Stock Items', str(inventory_data['low_stock_products'].count())]
    ]
    content.append(_create_styled_table(inventory_summary, ['Metric', 'Value']))
    content.append(Spacer(1, 20))
    
    # Performance Metrics
    content.append(Paragraph("Performance Metrics", styles['SectionHeader']))
    performance_data = report_data['performance_metrics']
    performance_summary = [
        ['Total Customers', str(performance_data['customer_metrics']['total_customers'])],
        ['Average Orders/Customer', f"{performance_data['customer_metrics']['average_orders_per_customer']:.2f}"],
        ['Average Order Value', f"${performance_data['order_performance']['average_order_value']:,.2f}"],
        ['Total Revenue', f"${performance_data['order_performance']['total_revenue']:,.2f}"]
    ]
    content.append(_create_styled_table(performance_summary, ['Metric', 'Value']))
    
    # Build PDF
    doc.build(content)
    pdf_content = buffer.getvalue()
    buffer.close()
    
    # Create named file
    pdf_file = ContentFile(pdf_content)
    pdf_file.name = f"{report.name}_comprehensive_report.pdf"
    
    return pdf_file

def _create_styled_table(data, headers=None):
    """
    Create a professionally styled table for the PDF report.
    """
    if headers:
        data.insert(0, headers)
    
    col_widths = [2.5*inch] * len(data[0])
    table = Table(data, colWidths=col_widths)
    
    style = [
        ('BACKGROUND', (0,0), (-1,0), colors.grey),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 12),
        ('BOTTOMPADDING', (0,0), (-1,0), 12),
        ('BACKGROUND', (0,1), (-1,-1), colors.beige),
        ('GRID', (0,0), (-1,-1), 1, colors.black),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 10),
        ('PADDING', (0,0), (-1,-1), 6),
    ]
    
    table.setStyle(TableStyle(style))
    return table

def send_report_email(report, recipient_email):
    email_template = Report.objects.filter(is_template=True, name="Basic Email Template").first()
    
    if not email_template:
        raise ValueError("Email template not found")

    subject_entry = email_template.entries.filter(title="Email Subject").first()
    body_entry = email_template.entries.filter(title="Email Body").first()

    if not subject_entry or not body_entry:
        raise ValueError("Email template is missing subject or body")

    subject_template = Template(subject_entry.content)
    body_template = Template(body_entry.content)

    context = Context({
        'report_name': report.name,
        'recipient_name': recipient_email.split('@')[0]  # Simple way to get a name from email
    })

    subject = subject_template.render(context)
    message = body_template.render(context)

    from_email = settings.DEFAULT_FROM_EMAIL
    recipient_list = [recipient_email]

    pdf_file = generate_pdf_report(report)

    send_mail(
        subject,
        message,
        from_email,
        recipient_list,
        fail_silently=False,
        attachments=[(f"{report.name}_report.pdf", pdf_file.read(), 'application/pdf')]
    )

def export_report_to_csv(report):
    """
    Export report entries to a structured CSV file.
    
    Args:
        report (Report): The report object to export
    
    Returns:
        ContentFile: A comprehensive CSV file
    """
    import csv
    
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    
    # Write report metadata
    writer.writerow(['Report Metadata'])
    writer.writerow(['Name', 'Description', 'Created By', 'Created At', 'Last Modified', 'Is Archived', 'Is Template'])
    writer.writerow([
        report.name,
        report.description or 'No description',
        str(report.created_by),
        report.created_at,
        report.updated_at,
        report.is_archived,
        report.is_template
    ])
    
    writer.writerow([])  # Blank row for readability
    
    # Write entries
    writer.writerow(['Report Entries'])
    writer.writerow(['Title', 'Content', 'Order', 'Created By', 'Created At'])
    
    for entry in report.entries.order_by('order'):
        writer.writerow([
            entry.title,
            entry.content,
            entry.order,
            str(entry.created_by),
            entry.created_at
        ])

    # Associated Files Section
    writer.writerow([])
    writer.writerow(['Associated Files'])
    writer.writerow(['Entry Title', 'File Name', 'File Type', 'Uploaded By', 'Uploaded At'])

    for entry in report.entries.all():
        for file in entry.files.all():
            writer.writerow([
                entry.title,
                file.file,  # Use file.file directly
                file.file_type,
                str(file.uploaded_by),
                file.uploaded_at
            ])
    
    # Get CSV content and encode
    csv_content = buffer.getvalue().encode('utf-8')
    buffer.close()
    
    csv_file = ContentFile(csv_content)
    csv_file.name = f"{report.name}_comprehensive_report.csv"
    
    return csv_file

def export_report_to_excel(report):
    """
    Generate a comprehensive Excel report with multiple worksheets.
    
    Args:
        report (Report): The report object to export
    
    Returns:
        ContentFile: An Excel file with detailed report information
    """
    import pandas as pd
    from datetime import datetime

    def make_timezone_unaware(value):
        """Convert timezone-aware datetime to timezone-unaware."""
        if isinstance(value, datetime) and value.tzinfo is not None:
            return value.astimezone(tz=None).replace(tzinfo=None)
        return value
    
    # Prepare report metadata
    metadata_df = pd.DataFrame([{
        'Name': report.name,
        'Description': report.description or 'No description',
        'Created By': str(report.created_by),
        'Created At': make_timezone_unaware(report.created_at),
        'Last Modified': make_timezone_unaware(report.updated_at),
        'Is Archived': report.is_archived,
        'Is Template': report.is_template
    }])
    
    # Prepare entries
    entries_data = [{
        'Title': entry.title,
        'Content': entry.content,
        'Order': entry.order,
        'Created By': str(entry.created_by),
        'Created At': make_timezone_unaware(entry.created_at)
    } for entry in report.entries.order_by('order')]
    entries_df = pd.DataFrame(entries_data)
    
    # Prepare files associated with entries
    files_data = []
    for entry in report.entries.all():
        for file in entry.files.all():
            files_data.append({
                'Entry Title': entry.title,
                'File Name': file.file,
                'File Type': file.file_type,
                'Uploaded By': str(file.uploaded_by),
                'Uploaded At': make_timezone_unaware(file.uploaded_at)
            })
    files_df = pd.DataFrame(files_data) if files_data else pd.DataFrame()
    
    # Write to Excel
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        metadata_df.to_excel(writer, sheet_name='Report Metadata', index=False)
        entries_df.to_excel(writer, sheet_name='Report Entries', index=False)
        
        if not files_df.empty:
            files_df.to_excel(writer, sheet_name='Associated Files', index=False)
    
    excel_content = buffer.getvalue()
    buffer.close()
    
    excel_file = ContentFile(excel_content)
    excel_file.name = f"{report.name}_comprehensive_report.xlsx"
    
    return excel_file

def save_generated_file(report, file_content, file_type):
    """
    Save generated report file to ReportFile model.

    Args:
        report (Report): The report object
        file_content (ContentFile): Generated file content
        file_type (str): Type of file (pdf, excel, csv)

    Returns:
        ReportFile: Created file instance
    """
    try:
        # Create a default entry if no entries exist
        entry, _ = ReportEntry.objects.get_or_create(
            report=report,
            title=f"Generated {file_type.upper()} Report",
            defaults={
                'content': f"Automatically generated {file_type.upper()} report",
                'created_by': report.created_by,
                'last_modified_by': report.created_by
            }
        )

        # Create ReportFile instance
        report_file = ReportFile.objects.create(
            entry=entry,
            file=file_content,
            file_type=file_type,
            uploaded_by=report.created_by
        )

        return report_file
    except Exception as e:
        logger.error(f"File saving failed: {str(e)}")
        raise

def calculate_custom_field(calculated_field):
    # This is a simplified example. You might need to implement more complex logic
    # based on your specific requirements.
    report = calculated_field.report
    formula = calculated_field.formula
    
    # Example: Count of entries
    if formula == 'COUNT_ENTRIES':
        return report.entries.count()
    
    # Example: Average word count of entries
    elif formula == 'AVG_WORD_COUNT':
        word_counts = [len(entry.content.split()) for entry in report.entries.all()]
        return sum(word_counts) / len(word_counts) if word_counts else 0
    
    # Add more custom calculations as needed
    
    return None  # Return None if the formula is not recognized
