# Generated by Django 4.2.14 on 2024-09-14 12:54

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0009_invoice_customer'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='total_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
    ]
