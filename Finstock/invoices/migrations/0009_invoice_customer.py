# Generated by Django 4.2.14 on 2024-09-12 14:06

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_address_created_address_modified_and_more'),
        ('invoices', '0008_alter_invoice_invoice_number'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='customer',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='invoices', to='core.customer'),
        ),
    ]
