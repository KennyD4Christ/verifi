from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator

User = get_user_model()

class Report(models.Model):
    name = models.CharField(max_length=255, null=False, blank=False)
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
    entry = models.ForeignKey(ReportEntry, related_name='files', on_delete=models.CASCADE)
    file = models.FileField(upload_to='report_files/', null=False, blank=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return self.file.name

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

    def __str__(self):
        return f"{self.user} {self.action} {self.report} at {self.accessed_at}"
