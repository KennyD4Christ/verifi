# Generated by Django 4.2.14 on 2024-12-26 08:27

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('reports', '0007_report_audit_trail_report_compliance_status_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='reportaccesslog',
            name='email',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AddField(
            model_name='reportaccesslog',
            name='ip_address',
            field=models.GenericIPAddressField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='reportaccesslog',
            name='action',
            field=models.CharField(choices=[('view', 'View'), ('edit', 'Edit'), ('delete', 'Delete'), ('email_sent', 'Email Sent'), ('download', 'Download')], max_length=50),
        ),
        migrations.AlterField(
            model_name='reportaccesslog',
            name='user',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddIndex(
            model_name='reportaccesslog',
            index=models.Index(fields=['user', 'email'], name='reports_rep_user_id_991ab3_idx'),
        ),
        migrations.AddIndex(
            model_name='reportaccesslog',
            index=models.Index(fields=['accessed_at'], name='reports_rep_accesse_984cf1_idx'),
        ),
        migrations.AddIndex(
            model_name='reportaccesslog',
            index=models.Index(fields=['action'], name='reports_rep_action_5768ef_idx'),
        ),
    ]
