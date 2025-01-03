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
from .models import ReportEntry, ReportFile, Report, ReportAccessLog
import xlsxwriter
from django.db.models import Sum, Avg, Count, F, ExpressionWrapper, DecimalField, IntegerField, Case, When, Q, Subquery, OuterRef
import ast
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log
)
from smtplib import (
    SMTPException,
    SMTPServerDisconnected,
    SMTPConnectError,
    SMTPResponseException
)
from django.utils.html import strip_tags
import operator as op
import statistics
from transactions.models import Transaction
from products.models import Product
from core.models import Customer, Order, OrderItem
from django.utils import timezone
from django.db.models.functions import TruncMonth, Coalesce
from decimal import Decimal
from datetime import datetime
from datetime import timedelta
from django.utils.timezone import make_aware
from django.core.exceptions import ValidationError
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from django.template import Template, Context
from django.core.mail import EmailMultiAlternatives
from django.utils.html import strip_tags
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from email.utils import formataddr
import bleach
from premailer import transform
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)


@dataclass
class EmailRecipient:
    email: str
    full_name: Optional[str] = None
    role: Optional[str] = None
    permissions: List[str] = None

    def __post_init__(self):
        if self.permissions is None:
            self.permissions = []

    @property
    def display_name(self) -> str:
        if self.full_name:
            return self.full_name
        return self.email.split('@')[0].title()

    @property
    def is_administrator(self) -> bool:
        return 'Administrator' in self.role

    @property
    def is_auditor(self) -> bool:
        return 'Auditor' in self.role

class ReportContentGenerator:
    @staticmethod
    def _generate_summary_section(report, recipient, report_data=None):
        data = report_data or generate_comprehensive_report(report, None, None)
        summary_parts = []

        if recipient.is_administrator:
            summary_parts.extend([
                "<h2>Administrative Overview</h2>",
                f"<p>Total Records: {data['total_records']}</p>",
                f"<p>Last Updated: {data['updated_at']}</p>",
                "<p>System Status: All metrics within expected ranges</p>"
            ])
        elif recipient.is_auditor:
            summary_parts.extend([
                "<h2>Audit Summary</h2>",
                f"<p>Audit Trail: {report.get_audit_trail()}</p>",
                f"<p>Compliance Status: {data['compliance_status']}</p>",
                "<p>Key Findings:</p>",
                "<ul><li>All compliance requirements met</li></ul>"
            ])
        else:
            summary_parts.extend([
                "<h2>Report Summary</h2>",
                f"<p>Period: {data['start_date']} to {data['end_date']}</p>",
                "<p>Key Highlights:</p>",
                "<ul><li>Regular report summary available</li></ul>"
            ])

        return "\n".join(summary_parts)

    @staticmethod
    def _generate_manager_insights(report, report_data=None):
        # Use provided report_data or generate new data
        data = report_data or generate_comprehensive_report(report, None, None)
        return f"""
        <h2>Management Insights</h2>
        <div class="insights-section">
            <h3>Key Performance Indicators</h3>
            <ul>
                <li>Revenue Growth: {data['revenue_growth']}%</li>
                <li>Operational Efficiency: {data['operational_efficiency']}%</li>
                <li>Resource Utilization: {data['resource_utilization']}%</li>
            </ul>
            <h3>Action Items</h3>
            <ul>
                <li>Review performance metrics</li>
                <li>Assess resource allocation</li>
            </ul>
        </div>
        """

    @staticmethod
    def _generate_executive_summary(report, report_data=None):
        # Use provided report_data or generate new data
        data = report_data or generate_comprehensive_report(report, None, None)
        return f"""
        <h2>Executive Overview</h2>
        <div class="executive-summary">
            <p class="highlight">Overall Performance: {data['performance_rating']}</p>
            <div class="metrics-grid">
                <div class="metric">
                    <h4>Financial Impact</h4>
                    <p>{data,['financial_impact']}</p>
                </div>
                <div class="metric">
                    <h4>Strategic Alignment</h4>
                    <p>{data['strategic_alignment']}</p>
                </div>
            </div>
        </div>
        """

class EmailSendingError(Exception):
    """Custom exception for email sending failures"""
    def __init__(self, message: str, attempts: int = 0):
        self.attempts = attempts
        super().__init__(f"{message} (Attempts made: {attempts})")

def get_retry_config(exception: Exception) -> Dict[str, int]:
    """Determine retry configuration based on exception type"""
    if isinstance(exception, SMTPServerDisconnected):
        return {'max_attempts': 5, 'min_wait': 2, 'max_wait': 8}
    elif isinstance(exception, SMTPResponseException):
        if exception.smtp_code == 421:  # Service not available
            return {'max_attempts': 3, 'min_wait': 10, 'max_wait': 30}
    return {'max_attempts': 3, 'min_wait': 4, 'max_wait': 10}

def log_retry_attempt(retry_state):
    """Log information about retry attempts"""
    exc = retry_state.outcome.exception()
    retry_config = get_retry_config(exc)
    
    if retry_state.attempt_number >= retry_config['max_attempts'] - 1:
        logger.warning(
            f"Final retry attempt. Error: {str(exc)}. "
            f"Total attempts: {retry_state.attempt_number + 1}"
        )
    else:
        logger.info(
            f"Retry attempt {retry_state.attempt_number + 1} of {retry_config['max_attempts']}. "
            f"Error: {str(exc)}"
        )

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    retry=retry_if_exception_type((SMTPException, ConnectionError))
)
def send_enhanced_report_email(
    report,
    recipient: EmailRecipient,
    include_summary: bool = True,
    include_charts: bool = True,
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None,
    pdf_content: Optional[bytes] = None
) -> None:
    """
    Send enhanced report email with retry mechanism and improved error handling.
    """
    try:
        if not start_date_str:
            start_date_str = report.start_date.strftime('%Y-%m-%d') if report.start_date else report.created_at.strftime('%Y-%m-%d')
        if not end_date_str:
            end_date_str = report.end_date.strftime('%Y-%m-%d') if report.end_date else timezone.now().strftime('%Y-%m-%d')

        logger.info(f"Processing report email for period: {start_date_str} to {end_date_str}")

        report_data = generate_comprehensive_report(report, start_date_str, end_date_str)
        logger.info(f"Email report data for {report.id}: Total Revenue: ${report_data['financial_overview']['total_revenue']}")

        email_components = prepare_email_components(
            report=report,
            recipient=recipient,
            include_summary=include_summary,
            include_charts=include_charts,
            report_data=report_data
        )
        
        if pdf_content is None:
            with generate_pdf_report(report, start_date_str=start_date_str, end_date_str=end_date_str) as pdf_file:
                pdf_content = pdf_file.read()

        attempts = send_email_with_components(email_components, recipient, pdf_content)
        return attempts
        
        log_email_success(
            report=report,
            recipient=recipient,
            report_data=report_data,
            include_summary=include_summary,
            include_charts=include_charts,
            attempts=attempts
        )
        
        logger.info(f"Report email sent successfully to {recipient.email}")

    except Exception as e:
        logger.error(f"Failed to send report email to {recipient.email}: {str(e)}")
        raise EmailSendingError(str(e))

def prepare_email_components(
    report,
    recipient: EmailRecipient,
    include_summary: bool,
    include_charts: bool,
    report_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Prepare all components needed for the email.
    """
    try:
        # Generate PDF report
        pdf_content = generate_pdf_with_retry(report, report_data)
        
        # Get email template
        email_template = Report.get_email_template()
        if not email_template:
            raise ValueError("Email template configuration is missing")
        
        # Generate email content
        content_generator = ReportContentGenerator()
        email_content = _generate_email_content(
            report=report,
            recipient=recipient,
            include_summary=include_summary,
            include_charts=include_charts,
            content_generator=content_generator,
            report_data=report_data
        )
        
        # Prepare context
        context = {
            **report.generate_email_context(recipient_name=recipient.display_name),
            'email_content': email_content,
            'period_start': report_data['report_metadata']['period_start'],
            'period_end': report_data['report_metadata']['period_end'],
            'financial_overview': report_data['financial_overview'],
            'performance_metrics': report_data['performance_metrics'],
            'inventory_insights': report_data['inventory_insights']
        }
        
        return {
            'pdf_content': pdf_content,
            'email_template': email_template,
            'context': context,
            'report_name': report.name,
            'report_data': report_data
        }
    except Exception as e:
        logger.error(f"Error preparing email components: {str(e)}")
        raise

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    before_sleep=log_retry_attempt
)
def generate_pdf_with_retry(report, report_data: dict) -> bytes:
    """Generate PDF report with retry mechanism"""
    try:
        with generate_pdf_report(report, report_data=report_data) as pdf_file:
            return pdf_file.read()
    except Exception as e:
        logger.error(f"PDF generation failed: {str(e)}")
        raise

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    before_sleep=log_retry_attempt
)
def send_email_with_components(
    email_components: Dict[str, Any],
    recipient: EmailRecipient,
    pdf_content: bytes
) -> int:
    """Send email with retry mechanism and return number of attempts"""
    attempts = 0
    
    try:
        html_template = Template(email_components['email_template'].template_content)
        html_content = transform(html_template.render(Context(email_components['context'])))
        text_content = strip_tags(html_content)
        
        period_str = (
            f"{email_components['report_data']['report_metadata']['period_start']} to "
            f"{email_components['report_data']['report_metadata']['period_end']}"
        )
        
        msg = EmailMultiAlternatives(
            subject=f"Report: {email_components['report_name']} - {period_str}",
            body=text_content,
            from_email=formataddr((settings.COMPANY_NAME, settings.DEFAULT_FROM_EMAIL)),
            to=[formataddr((recipient.display_name, recipient.email))]
        )
        
        msg.attach_alternative(html_content, "text/html")
        msg.attach(
            f"{email_components['report_name']}_report.pdf",
            pdf_content,
            'application/pdf'
        )
        
        msg.send(fail_silently=False)
        return attempts
        
    except SMTPResponseException as e:
        attempts += 1
        logger.warning(
            f"SMTP response error (code: {e.smtp_code}) on attempt {attempts}: {str(e)}"
        )
        raise
    except SMTPException as e:
        attempts += 1
        logger.warning(f"SMTP error on attempt {attempts}: {str(e)}")
        raise
    except Exception as e:
        attempts += 1
        logger.error(f"Unexpected error on attempt {attempts}: {str(e)}")
        raise

def log_email_success(
    report,
    recipient: EmailRecipient,
    report_data: dict,
    include_summary: bool,
    include_charts: bool,
    attempts: int
) -> None:
    """Log successful email sending with metadata"""
    # Get user if exists
    User = get_user_model()
    try:
        user = User.objects.get(email=recipient.email)
    except User.DoesNotExist:
        user = None
    
    # Create access log
    ReportAccessLog.objects.create(
        report=report,
        user=user,
        action='email_sent',
        metadata={
            'recipient_email': recipient.email,
            'recipient_role': recipient.role,
            'included_summary': include_summary,
            'included_charts': include_charts,
            'pdf_attached': True,
            'period_start': report_data['report_metadata']['period_start'],
            'period_end': report_data['report_metadata']['period_end'],
            'data_timestamp': timezone.now().isoformat(),
            'sending_attempts': attempts
        }
    )
    
    if attempts > 1:
        logger.warning(f"Email sent successfully after {attempts} attempts to {recipient.email}")

def _generate_email_content(
    report,
    recipient: EmailRecipient,
    include_summary: bool,
    include_charts: bool,
    content_generator: ReportContentGenerator,
    report_data: dict
) -> str:
    content_parts = []

    financial_data = report_data['financial_overview']
    performance_data = report_data['performance_metrics']
    
    if recipient.is_administrator:
        content_parts.extend([
            "<h2>Administrative Overview</h2>",
            f"<p>Period: {report_data['report_metadata']['period_start']} to {report_data['report_metadata']['period_end']}</p>",
            f"<p>Total Revenue: ${financial_data['total_revenue']:,.2f}</p>",
            f"<p>Net Profit: ${financial_data['net_profit']:,.2f}</p>",
            f"<p>Total Orders: {performance_data['order_performance']['total_orders']}</p>"
        ])
    elif recipient.is_auditor:
        content_parts.extend([
            "<h2>Audit Summary</h2>",
            f"<p>Financial Period: {report_data['report_metadata']['period_start']} to {report_data['report_metadata']['period_end']}</p>",
            f"<p>Revenue Verified: ${financial_data['total_revenue']:,.2f}</p>",
            f"<p>Expenses Verified: ${financial_data['operating_expenses']:,.2f}</p>",
            f"<p>Cost of Services: ${financial_data['cost_of_services']:,.2f}</p>"
        ])
    else:
        content_parts.extend([
            "<h2>Report Summary</h2>",
            f"<p>Period: {report_data['report_metadata']['period_start']} to {report_data['report_metadata']['period_end']}</p>",
            "<p>Performance Overview:</p>",
            f"<p>Average Order Value: ${performance_data['order_performance']['average_order_value']:,.2f}</p>"
        ])

    return "\n".join(content_parts)


def validate_date_range(start_date_str: Optional[str], end_date_str: Optional[str]) -> tuple:
    """
    Validates and processes date range inputs, handling various scenarios and ensuring proper timezone awareness.
    Returns a tuple of validated start and end datetime objects.
    """
    try:
        current_time = timezone.now()

        # Handle cases where dates aren't provided
        if not start_date_str and not end_date_str:
            # Default to last 30 days if no dates provided
            end_date = current_time
            start_date = end_date - timedelta(days=30)
            return start_date, end_date

        # Process provided dates
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            start_date = make_aware(start_date)
        else:
            # If only end date provided, default start date to 30 days before
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            end_date = make_aware(end_date)
            start_date = end_date - timedelta(days=30)

        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            end_date = make_aware(
                datetime.combine(end_date.date(), datetime.max.time())
            )
        else:
            # If only start date provided, default end date to start date + 30 days
            end_date = min(start_date + timedelta(days=30), current_time)

        # Validate date range
        if end_date < start_date:
            raise ValidationError("End date must be after start date.")

        # Ensure end date doesn't exceed current time
        if end_date > current_time:
            end_date = current_time

        return start_date, end_date

    except ValueError:
        raise ValidationError("Invalid date format. Please use YYYY-MM-DD format.")
    except Exception as e:
        raise ValidationError(f"Error validating date range: {str(e)}")


def generate_comprehensive_report(report, start_date_str: Optional[str], end_date_str: Optional[str]) -> dict:
    """Generate a comprehensive report with date range filtering."""
    try:
        if start_date_str and end_date_str:
            # Use validated date range when dates are provided
            start_date, end_date = validate_date_range(start_date_str, end_date_str)
        else:
            # Handle cases where one or both dates are missing
            if start_date_str:
                # If only start date provided, validate it and set end date to current time
                temp_start, end_date = validate_date_range(start_date_str, timezone.now().strftime('%Y-%m-%d'))
                start_date = temp_start
            elif end_date_str:
                # If only end date provided, validate it and set start date to 30 days prior
                end_date_obj = datetime.strptime(end_date_str, '%Y-%m-%d')
                start_date_obj = end_date_obj - timedelta(days=30)
                start_date, end_date = validate_date_range(
                    start_date_obj.strftime('%Y-%m-%d'),
                    end_date_str
                )
            else:
                # If no dates provided, use custom default range based on report parameters
                if hasattr(report, 'reporting_period') and report.reporting_period:
                    # Use report's configured period if available
                    start_date = report.created_at
                    end_date = start_date + timedelta(days=report.reporting_period)
                    # Ensure end date doesn't exceed current time
                    if end_date > timezone.now():
                        end_date = timezone.now()
                else:
                    # Default to report creation date and current time
                    start_date = report.created_at
                    end_date = timezone.now()
        
        logger.info(f"Generating report for period: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")

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

def generate_pdf_report(report, start_date_str=None, end_date_str=None, report_data=None):
    """Generate a comprehensive PDF report with financial and inventory analysis."""
    logger.info(f"Beginning PDF generation for report: {report.name}")
    # Generate report data if not provided
    if report_data is None:
        report_data = generate_comprehensive_report(report, start_date_str, end_date_str)

    logger.info(f"Report data for PDF generation: {report_data}")

    logger.info(f"Initial financial data for report {report.name}:")
    logger.info(f"Total Revenue: ${report_data['financial_overview']['total_revenue']:,.2f}")
    logger.info(f"Cost of Services: ${report_data['financial_overview']['cost_of_services']:,.2f}")
    logger.info(f"Operating Expenses: ${report_data['financial_overview']['operating_expenses']:,.2f}")
    logger.info(f"Net Profit: ${report_data['financial_overview']['net_profit']:,.2f}")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=50,
        leftMargin=50,
        topMargin=50,
        bottomMargin=30
    )

    # Define document styles
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='MainTitle',
        parent=styles['Title'],
        fontSize=24,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1a237e')
    ))

    styles.add(ParagraphStyle(
        name='SectionHeader',
        parent=styles['Heading1'],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=12,
        textColor=colors.HexColor('#283593'),
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

    # Initialize content list
    content = []

    # Set up period text
    period_text = f"Report Period: {start_date_str} to {end_date_str}" if start_date_str and end_date_str else "Complete Business Overview"
    
    # Add report headers
    content.append(Paragraph(period_text, styles['SubHeader']))
    content.append(Paragraph(f"Financial & Inventory Analysis Report", styles['MainTitle']))
    content.append(Paragraph(report.name, styles['SubHeader']))

    # Define table styles
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

    # Add executive summary
    content.append(Paragraph("Executive Summary", styles['SectionHeader']))
    executive_summary = f"""
    This comprehensive report provides a detailed analysis of {report.name}'s financial performance,
    inventory status, and key business metrics. The analysis covers {period_text.lower()}.
    """
    content.append(Paragraph(executive_summary, styles['BodyText']))
    content.append(Spacer(1, 20))

    # Add financial overview
    content.append(Paragraph("Financial Performance Overview", styles['SectionHeader']))
    financial_data = report_data['financial_overview']
    logger.info(f"Financial data before table creation for report {report.name}:")
    logger.info(f"Financial data content: {financial_data}")
    
    financial_summary = [
        ['Metric', 'Amount', 'Analysis'],
        ['Total Revenue', f"${financial_data['total_revenue']:,.2f}", 'Gross business income'],
        ['Cost of Services', f"${financial_data['cost_of_services']:,.2f}", 'Direct service costs'],
        ['Operating Expenses', f"${financial_data['operating_expenses']:,.2f}", 'Operational costs'],
        ['Net Profit', f"${financial_data['net_profit']:,.2f}", 'Bottom line earnings']
    ]

    logger.info(f"Generated financial summary table rows: {financial_summary}")

    financial_table = Table(financial_summary, colWidths=[doc.width/3.0]*3)
    financial_table.setStyle(financial_table_style)
    content.append(financial_table)
    content.append(Spacer(1, 20))

    # Add revenue categories
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

    # Add inventory analytics
    content.append(Paragraph("Inventory Analytics", styles['SectionHeader']))
    inventory_data = report_data['inventory_insights']

    inventory_summary = [
        ['Metric', 'Current Status', 'Notes'],
        ['Total Products', str(inventory_data['total_product_count']), 'Active inventory items'],
        ['Stock Value', f"${inventory_data['total_stock_value']:,.2f}", 'Total inventory worth'],
        ['Low Stock Alert', str(inventory_data['low_stock_products'].count()), 'Items needing reorder']
    ]

    inventory_table = Table(inventory_summary, colWidths=[doc.width/3.0]*3)
    inventory_table.setStyle(financial_table_style)
    content.append(inventory_table)
    content.append(Spacer(1, 20))

    # Add performance metrics
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

    # Add page numbers
    def add_page_number(canvas, doc):
        page_num = canvas.getPageNumber()
        text = f"Page {page_num}"
        canvas.saveState()
        canvas.setFont('Helvetica', 9)
        canvas.drawRightString(doc.pagesize[0] - 50, 30, text)
        canvas.restoreState()

    logger.info(f"Preparing to build PDF document for report {report.name}")
    logger.info(f"Content length: {len(content)} sections")

    # Build the PDF document
    doc.build(content, onFirstPage=add_page_number, onLaterPages=add_page_number)

    # Prepare the final PDF file
    pdf_content = buffer.getvalue()
    buffer_size = len(pdf_content)
    logger.info(f"PDF generation completed. Buffer size: {buffer_size} bytes")

    buffer.close()

    formatted_date = datetime.now().strftime("%Y%m%d")
    pdf_file = ContentFile(pdf_content)
    pdf_file.name = f"{report.name}_Financial_Analysis_{formatted_date}.pdf"

    logger.info(f"PDF file created successfully: {pdf_file.name}")
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
    

def send_report_email(report, recipient_email, request=None, include_summary=True, include_charts=True, start_date_str=None, end_date_str=None):
    try:
        logger.info(f"Starting email preparation for report: {report.name}")
        
        # Validate and process date range
        if not start_date_str:
            start_date_str = report.start_date.strftime('%Y-%m-%d') if report.start_date else report.created_at.strftime('%Y-%m-%d')
        if not end_date_str:
            end_date_str = report.end_date.strftime('%Y-%m-%d') if report.end_date else timezone.now().strftime('%Y-%m-%d')
            
        logger.info(f"Generating report for date range: {start_date_str} to {end_date_str}")
        
        # Generate report with specified date range
        report_data = generate_comprehensive_report(report, start_date_str, end_date_str)

        logger.info(f"Generated report data for period: {start_date_str} to {end_date_str}")
        logger.info(f"Financial Overview - Total Revenue: ${report_data['financial_overview']['total_revenue']:,.2f}")

        pdf_file = generate_pdf_report(report, report_data=report_data)
        pdf_content = pdf_file.read()

        # Update email subject to include date range
        period_str = f"{start_date_str} to {end_date_str}"
        email_subject = f"Financial Report: {report.name} ({period_str})"

        email_template = Report.objects.filter(
            is_template=True,
            name="Basic Email Template"
        ).first()

        if not email_template:
            raise ValueError("Email template not found")

        msg = EmailMultiAlternatives(
            subject=email_subject,
            body=body_template.render(context),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient_email]
        )

        msg.attach(
            filename=f"{report.name}_report_{start_date_str}_to_{end_date_str}.pdf",
            content=pdf_content,
            mimetype='application/pdf'
        )

        logger.info(f"Sending email with PDF for period {period_str}")
        msg.send(fail_silently=False)
        
        logger.info(f"Report email sent successfully to {recipient_email}")
        return True

    except Exception as e:
        logger.error(f"Error sending report email: {str(e)}")
        raise EmailSendingError(str(e))

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
