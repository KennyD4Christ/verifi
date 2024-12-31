from django.db import migrations
from django.utils import timezone

def create_default_email_template(apps, schema_editor):
    Report = apps.get_model('reports', 'Report')
    User = apps.get_model('auth', 'User')
    
    default_template = '''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            .report-container {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .content {
                margin: 20px 0;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                font-size: 12px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="report-container">
            <div class="header">
                <img src="{{ company_logo_url }}" alt="{{ company_name }}" style="max-width: 200px;">
                <h1>{{ report_title }}</h1>
            </div>
            
            <div class="content">
                <p>Dear {{ recipient_name }},</p>
                
                {{ email_content }}
            </div>
            
            <div class="footer">
                <p>© {{ current_year }} {{ company_name }}. All rights reserved.</p>
                <p><a href="{{ report_url }}">View Online</a> | <a href="{{ unsubscribe_url }}">Unsubscribe</a></p>
            </div>
        </div>
    </body>
    </html>
    '''
    
    Report.objects.create(
        name="Enhanced Email Template",
        description="Default email template for enhanced report emails",
        is_template=True,
        created_at=timezone.now(),
        updated_at=timezone.now()
    )

def reverse_default_template(apps, schema_editor):
    Report = apps.get_model('reports', 'Report')
    Report.objects.filter(name="Enhanced Email Template", is_template=True).delete()

class Migration(migrations.Migration):
    dependencies = [
        ('reports', '0005_alter_reportaccesslog_options_and_more'),
    ]

    operations = [
        migrations.RunPython(create_default_email_template, reverse_default_template),
    ]
