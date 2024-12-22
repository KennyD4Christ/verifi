import os
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.core import validators
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import JSONField

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
    
    def __str__(self):
        return self.name

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
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    accessed_at = models.DateTimeField(auto_now_add=True)
    action = models.CharField(max_length=50)  # e.g., 'view', 'edit', 'delete'
    metadata = JSONField(null=True, blank=True)

    def __str__(self):
        return f"{self.user} {self.action} {self.report} at {self.accessed_at}"

    class Meta:
        ordering = ['-accessed_at']
