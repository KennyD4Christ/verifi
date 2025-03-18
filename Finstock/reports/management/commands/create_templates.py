from django.core.management.base import BaseCommand
from reports.models import Report, ReportEntry
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Creates initial report templates'

    def handle(self, *args, **kwargs):
        # Ensure there's at least one user in the system
        user, created = User.objects.get_or_create(username='admin', is_staff=True, is_superuser=True)
        if created:
            user.set_password('admin123')
            user.save()

        # Create a simple PDF template
        pdf_template, _ = Report.objects.get_or_create(
            name="Simple PDF Template",
            defaults={
                'description': "A basic template for generating PDF reports",
                'is_template': True,
                'created_by': user,
                'last_modified_by': user
            }
        )

        ReportEntry.objects.get_or_create(
            report=pdf_template,
            title="Introduction",
            defaults={
                'content': "This is an introduction to the report.",
                'order': 1,
                'created_by': user,
                'last_modified_by': user
            }
        )

        ReportEntry.objects.get_or_create(
            report=pdf_template,
            title="Main Content",
            defaults={
                'content': "This is the main content of the report.",
                'order': 2,
                'created_by': user,
                'last_modified_by': user
            }
        )

        ReportEntry.objects.get_or_create(
            report=pdf_template,
            title="Conclusion",
            defaults={
                'content': "This is the conclusion of the report.",
                'order': 3,
                'created_by': user,
                'last_modified_by': user
            }
        )

        # Create an email template
        email_template, _ = Report.objects.get_or_create(
            name="Basic Email Template",
            defaults={
                'description': "A simple template for sending report emails",
                'is_template': True,
                'created_by': user,
                'last_modified_by': user
            }
        )

        ReportEntry.objects.get_or_create(
            report=email_template,
            title="Email Subject",
            defaults={
                'content': "Monthly Report: {{report_name}}",
                'order': 1,
                'created_by': user,
                'last_modified_by': user
            }
        )

        ReportEntry.objects.get_or_create(
            report=email_template,
            title="Email Body",
            defaults={
                'content': "Dear {{recipient_name}},\n\nPlease find attached the monthly report for {{report_name}}.\n\nBest regards,\nThe Reporting Team",
                'order': 2,
                'created_by': user,
                'last_modified_by': user
            }
        )

        self.stdout.write(self.style.SUCCESS('Successfully created report templates'))
