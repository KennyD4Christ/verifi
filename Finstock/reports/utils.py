from django.core.mail import send_mail
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak, Flowable
from django.conf import settings
from reportlab.pdfgen import canvas
from io import BytesIO
from reportlab.lib.pagesizes import letter, A4
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
from datetime import datetime
from django.utils.timezone import make_aware
from django.core.exceptions import ValidationError
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT

logger = logging.getLogger(__name__)


def validate_date_range(start_date_str, end_date_str):
    """
    Validates and converts date strings to datetime objects for report date ranges.
    
    Parameters:
        start_date_str (str): Start date in 'YYYY-MM-DD' format
        end_date_str (str): End date in 'YYYY-MM-DD' format
        
    Returns:
        tuple: (start_date, end_date) as timezone-aware datetime objects
        
    Raises:
        ValidationError: If dates are invalid or if end_date is before start_date
    """
    try:
        # Parse the date strings into datetime objects
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
        
        # Make the dates timezone-aware using the current timezone
        start_date = make_aware(start_date)
        end_date = make_aware(
            datetime.combine(end_date.date(), datetime.max.time())
        )
        
        # Validate the date range
        if end_date < start_date:
            raise ValidationError("End date must be after start date.")
            
        # Ensure dates are not in the future
        current_time = timezone.now()
        if end_date > current_time:
            end_date = current_time
            
        return start_date, end_date
        
    except ValueError:
        raise ValidationError("Invalid date format. Please use YYYY-MM-DD format.")
    except Exception as e:
        raise ValidationError(f"Error validating date range: {str(e)}")


def generate_comprehensive_report(report, start_date_str=None, end_date_str=None):
    """Generate a comprehensive report with date range filtering."""
    try:
        # If no dates provided, use report creation date and current time
        if not start_date_str or not end_date_str:
            start_date = report.created_at
            end_date = timezone.now()
        else:
            start_date, end_date = validate_date_range(start_date_str, end_date_str)

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
            date_filter = Q(
                order_items__order__order_date__range=[start_date, end_date],
                order_items__order__status__in=['delivered', 'shipped']
            )
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
                        ),
                        filter=date_filter
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
                        ),
                        filter=date_filter
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
            date_filter = Q(orders__order_date__range=[start_date, end_date])
            customer_metrics = Customer.objects.annotate(
                total_orders=Count('orders'),
                total_spend=Coalesce(
                    Sum(
                        F('orders__items__quantity') * F('orders__items__unit_price'),
                        filter=date_filter & Q(orders__status__in=['delivered', 'shipped'])
                    ),
                    Decimal('0.00'),
                    output_field=DecimalField(max_digits=10, decimal_places=2)
                )
            )

            # Calculate order performance using order items
            order_performance = Order.objects.filter(
                order_date__range=[start_date, end_date]
            ).aggregate(
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


            def _calculate_sales_trend():
                return Order.objects.filter(
                    order_date__range=[start_date, end_date]
                ).annotate(
                    month=TruncMonth('order_date')
                ).values('month').annotate(
                    total_sales=Coalesce(
                        Sum(F('items__quantity') * F('items__unit_price')),
                        Decimal('0.00'),
                        output_field=DecimalField(max_digits=10, decimal_places=2)
                    )
                ).order_by('month')

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

        # Main report generation logic
        transactions = Transaction.objects.filter(
            date__range=[start_date, end_date]
        )

        revenue = transactions.filter(
            transaction_type='income'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        cost_of_services = transactions.filter(
            transaction_type='cost_of_services'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        operating_expenses = transactions.filter(
            transaction_type='expense'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        return {
            'report_metadata': {
                'period_start': start_date.strftime('%Y-%m-%d'),
                'period_end': end_date.strftime('%Y-%m-%d')
            },
            'financial_overview': {
                'total_revenue': revenue,
                'cost_of_services': cost_of_services,
                'operating_expenses': operating_expenses,
                'net_profit': revenue - cost_of_services - operating_expenses,
                'income_breakdown': _analyze_income_breakdown(
                    transactions.filter(transaction_type='income')
                ),
                'expense_breakdown': _analyze_expense_breakdown(
                    transactions.filter(transaction_type__in=['expense', 'cost_of_services'])
                ),
                'monthly_cash_flow': _calculate_monthly_cash_flow(transactions)
            },
            'inventory_insights': generate_inventory_insights(),
            'performance_metrics': generate_performance_metrics()
        }

    except ValueError as e:
        raise ValueError(f"Error generating report: {str(e)}")

class ChartPlaceholder(Flowable):
    """Custom flowable for chart placeholders"""
    def __init__(self, width, height):
        Flowable.__init__(self)
        self.width = width
        self.height = height

    def draw(self):
        self.canv.rect(0, 0, self.width, self.height)
        self.canv.line(0, 0, self.width, self.height)
        self.canv.line(self.width, 0, 0, self.height)

def generate_pdf_report(report, start_date_str=None, end_date_str=None):

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=50,
        leftMargin=50,
        topMargin=50,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='MainTitle',
        parent=styles['Title'],
        fontSize=24,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1a237e')  # Dark blue for corporate look
    ))

    styles.add(ParagraphStyle(
        name='SectionHeader',
        parent=styles['Heading1'],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=12,
        textColor=colors.HexColor('#283593'),  # Slightly lighter blue
        borderWidth=1,
        borderColor=colors.HexColor('#e8eaf6'),
        borderPadding=10,
        leading=20
    ))

    styles.add(ParagraphStyle(
        name='SubHeader',
        parent=styles['Heading2'],
        fontSize=12,
        spaceBefore=10,
        spaceAfter=8,
        textColor=colors.HexColor('#303f9f')
    ))

    bodyStyle = styles['Normal']
    bodyStyle.fontSize = 10
    bodyStyle.leading = 14
    bodyStyle.spaceBefore = 6
    bodyStyle.spaceAfter = 6

    content = []

    # Create header with company logo placeholder
    # img = Image('path_to_logo.png', width=100, height=50)  # Uncomment and adjust when logo is available
    # content.append(img)

    period_text = f"Report Period: {start_date_str} to {end_date_str}" if start_date_str and end_date_str else "Complete Business Overview"
    content.append(Paragraph(period_text, styles['SubHeader']))
    content.append(Paragraph(f"Financial & Inventory Analysis Report", styles['MainTitle']))
    content.append(Paragraph(report.name, styles['SubHeader']))

    metadata_style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8eaf6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e8eaf6'))
    ])

    report_data = generate_comprehensive_report(report, start_date_str, end_date_str)

    content.append(Paragraph("Executive Summary", styles['SectionHeader']))
    executive_summary = f"""
    This comprehensive report provides a detailed analysis of {report.name}'s financial performance,
    inventory status, and key business metrics. The analysis covers {period_text.lower()}.
    """
    content.append(Paragraph(executive_summary, styles['BodyText']))
    content.append(Spacer(1, 20))

    content.append(Paragraph("Financial Performance Overview", styles['SectionHeader']))

    financial_data = report_data['financial_overview']
    financial_table_style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8eaf6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('ALIGN', (-1, 1), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e8eaf6'))
    ])

    financial_summary = [
        ['Metric', 'Amount', 'Analysis'],
        ['Total Revenue', f"${financial_data['total_revenue']:,.2f}", 'Gross business income'],
        ['Cost of Services', f"${financial_data['cost_of_services']:,.2f}", 'Direct service costs'],
        ['Operating Expenses', f"${financial_data['operating_expenses']:,.2f}", 'Operational costs'],
        ['Net Profit', f"${financial_data['net_profit']:,.2f}", 'Bottom line earnings']
    ]

    financial_table = create_styled_table(
        financial_summary,
        headers=['Metric', 'Amount', 'Analysis'],
        style_type='financial'
    )
    financial_table.setStyle(financial_table_style)
    content.append(financial_table)
    content.append(Spacer(1, 20))

    content.append(Paragraph("Revenue by Category", styles['SectionHeader']))
    income_data = [[
        category['category'],
        f"${category['total_amount']:,.2f}",
        f"{category['transaction_count']} transactions",
        f"{(category['total_amount']/financial_data['total_revenue']*100):.1f}%"
    ] for category in financial_data['income_breakdown']]

    income_headers = ['Category', 'Revenue', 'Volume', 'Share']
    income_table = Table([income_headers] + income_data, colWidths=[doc.width/4.0]*4)
    income_table.setStyle(financial_table_style)
    content.append(income_table)
    content.append(Spacer(1, 20))

    content.append(Paragraph("Inventory Analytics", styles['SectionHeader']))
    inventory_data = report_data['inventory_insights']

    inventory_summary = [
        ['Metric', 'Current Status', 'Notes'],
        ['Total Products', str(inventory_data['total_product_count']), 'Active inventory items'],
        ['Stock Value', f"${inventory_data['total_stock_value']:,.2f}", 'Total inventory worth'],
        ['Low Stock Alert', str(inventory_data['low_stock_products'].count()), 'Items needing reorder']
    ]

    inventory_table = create_styled_table(
        inventory_summary,
        headers=['Metric', 'Current Status', 'Notes'],
        style_type='inventory'
    )
    inventory_table.setStyle(financial_table_style)
    content.append(inventory_table)
    content.append(Spacer(1, 20))

    content.append(Paragraph("Business Performance Metrics", styles['SectionHeader']))
    performance_data = report_data['performance_metrics']

    performance_summary = [
        ['Metric', 'Value', 'Industry Impact'],
        ['Customer Base', str(performance_data['customer_metrics']['total_customers']), 'Total active customers'],
        ['Avg. Orders/Customer', f"{performance_data['customer_metrics']['average_orders_per_customer']:.2f}", 'Customer engagement'],
        ['Avg. Order Value', f"${performance_data['order_performance']['average_order_value']:,.2f}", 'Transaction size'],
        ['Revenue', f"${performance_data['order_performance']['total_revenue']:,.2f}", 'Total business value']
    ]

    performance_table = Table(performance_summary, colWidths=[doc.width/3.0]*3)
    performance_table.setStyle(financial_table_style)
    content.append(performance_table)

    def add_page_number(canvas, doc):
        page_num = canvas.getPageNumber()
        text = f"Page {page_num}"
        canvas.saveState()
        canvas.setFont('Helvetica', 9)
        canvas.drawRightString(doc.pagesize[0] - 50, 30, text)
        canvas.restoreState()

    doc.build(content, onFirstPage=add_page_number, onLaterPages=add_page_number)

    pdf_content = buffer.getvalue()
    buffer.close()

    formatted_date = datetime.now().strftime("%Y%m%d")
    pdf_file = ContentFile(pdf_content)
    pdf_file.name = f"{report.name}_Financial_Analysis_{formatted_date}.pdf"

    return pdf_file

def create_styled_table(data, headers=None, style_type='default'):
    if headers:
        data.insert(0, headers)

    num_columns = len(data[0])
    col_widths = [2.5 * inch] * num_columns

    table = Table(data, colWidths=col_widths)

    corporate_blue = colors.HexColor('#1a237e')  # Dark blue
    corporate_light_blue = colors.HexColor('#e8eaf6')  # Light blue

    base_style = [
        ('BACKGROUND', (0, 0), (-1, 0), corporate_light_blue),
        ('TEXTCOLOR', (0, 0), (-1, 0), corporate_blue),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),

        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('PADDING', (0, 0), (-1, -1), 6),

        ('GRID', (0, 0), (-1, -1), 1, corporate_light_blue),
        ('LINEBELOW', (0, 0), (-1, 0), 1, corporate_blue),
    ]

    if style_type == 'financial':
        base_style.extend([
            ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),  # Right align numbers
            ('TEXTCOLOR', (-1, 1), (-1, -1), corporate_blue),  # Highlight totals
        ])
    elif style_type == 'inventory':
        base_style.extend([
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('ALIGN', (-1, 1), (-1, -1), 'CENTER'),  # Center align status
        ])

    table.setStyle(TableStyle(base_style))

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
