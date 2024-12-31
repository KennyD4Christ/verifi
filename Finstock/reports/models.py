import os
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.core import validators
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import JSONField
from django.core.exceptions import ValidationError

User = get_user_model()

def report_file_path(instance, filename):
    """
    Generate a unique file path for report files.

    Args:
        instance (ReportFile): The ReportFile instance
        filename (str): Original filename

    Returns:
        str: Generated file path
    """
    # Generate a unique filename to prevent overwriting
    timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
    ext = filename.split('.')[-1]
    unique_filename = f"{timestamp}_{instance.entry.report.id}_{instance.entry.id}.{ext}"

    # Organize files by report and entry
    return os.path.join(
        'reports',
        str(instance.entry.report.id),
        str(instance.entry.id),
        unique_filename
    )

class Report(models.Model):
    name = models.CharField(
        max_length=255, 
        null=False, 
        blank=False, 
        verbose_name="Report Name",
        validators=[
            validators.RegexValidator(
                regex=r'^[A-Za-z0-9\s\-_]+$',
                message='Invalid name format'
            )
        ]
    )
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_reports')
    last_modified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='modified_reports')
    is_archived = models.BooleanField(default=False)
    is_template = models.BooleanField(default=False)
    schedule = models.CharField(max_length=50, blank=True, null=True)  # For report scheduling (e.g., 'daily', 'weekly', 'monthly')
    last_run = models.DateTimeField(null=True, blank=True)
    total_records = models.IntegerField(default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    performance_rating = models.CharField(max_length=50, null=True, blank=True)
    financial_impact = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    strategic_alignment = models.CharField(max_length=100, null=True, blank=True)
    revenue_growth = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    operational_efficiency = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    resource_utilization = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    compliance_status = models.CharField(max_length=50, null=True, blank=True)
    audit_trail = models.TextField(null=True, blank=True)

    def get_audit_trail(self):
        return self.audit_trail or "No audit trail available"

    def get_report_metrics(self):
        """
        Returns a dictionary of report metrics with safe default values.
        """
        return {
            'total_records': self.total_records,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else 'N/A',
            'start_date': self.start_date.strftime('%Y-%m-%d') if self.start_date else 'N/A',
            'end_date': self.end_date.strftime('%Y-%m-%d') if self.end_date else 'N/A',
            'performance_rating': self.performance_rating or 'N/A',
            'financial_impact': str(self.financial_impact) if self.financial_impact else 'N/A',
            'strategic_alignment': self.strategic_alignment or 'N/A',
            'revenue_growth': self.revenue_growth or 0,
            'operational_efficiency': self.operational_efficiency or 0,
            'resource_utilization': self.resource_utilization or 0,
            'compliance_status': self.compliance_status or 'N/A'
        }
    
    def __str__(self):
        return self.name

    @property
    def template_content(self):
        """
        Returns the template content if this is a template report.
        """
        if not self.is_template:
            raise ValueError("This report is not a template")
        return self.description or ''

    @classmethod
    def get_email_template(cls):
        """
        Retrieves the enhanced email template.
        Returns:
            Report: The email template report object
        Raises:
            Report.DoesNotExist: If the template is not found
        """
        return cls.objects.get(
            name="Enhanced Email Template",
            is_template=True
        )

    def generate_email_context(self, recipient_name, **additional_context):
        """
        Generates the context for email template rendering.
        """
        from django.conf import settings
        from django.utils import timezone

        base_context = {
            'recipient_name': recipient_name,
            'report_title': self.name,
            'company_name': getattr(settings, 'COMPANY_NAME', ''),
            'company_logo_url': getattr(settings, 'COMPANY_LOGO_URL', ''),
            'report_url': f"{getattr(settings, 'SITE_URL', '')}/reports/{self.id}/",
            'unsubscribe_url': f"{getattr(settings, 'SITE_URL', '')}/unsubscribe/{recipient_name}/",
            'current_year': timezone.now().year,
        }
        base_context.update(additional_context)
        return base_context

class ReportEntry(models.Model):
    report = models.ForeignKey(Report, related_name='entries', on_delete=models.CASCADE)
    title = models.CharField(max_length=255, null=False, blank=False)
    content = models.TextField(null=False, blank=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_entries')
    last_modified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='modified_entries')
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return self.title

class ReportFile(models.Model):
    entry = models.ForeignKey(
        'ReportEntry', 
        related_name='files', 
        on_delete=models.CASCADE
    )
    file = models.FileField(
        upload_to=report_file_path,
        max_length=255,
        null=False, 
        blank=False
    )
    file_type = models.CharField(
        max_length=50, 
        choices=[
            ('pdf', 'PDF Document'),
            ('excel', 'Excel Spreadsheet'),
            ('csv', 'CSV File'),
            ('other', 'Other File Type')
        ],
        default='pdf'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True
    )

    def __str__(self):
        return f"{self.file.name} (Uploaded by {self.uploaded_by})"

class CalculatedField(models.Model):
    report = models.ForeignKey(Report, related_name='calculated_fields', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    formula = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.report.name})"

class ReportAccessLog(models.Model):
    report = models.ForeignKey(Report, related_name='access_logs', on_delete=models.CASCADE)
    user = models.ForeignKey(get_user_model(), on_delete=models.SET_NULL, null=True, blank=True)
    accessed_at = models.DateTimeField(auto_now_add=True)
    action = models.CharField(max_length=50)
    metadata = models.JSONField(null=True, blank=True)

    def __str__(self):
        user_identifier = self.user.email if self.user else self.metadata.get('recipient_email', 'Unknown')
        return f"{user_identifier} {self.action} {self.report} at {self.accessed_at}"

    class Meta:
        ordering = ['-accessed_at']
