# Generated by Django 4.2.14 on 2024-09-11 16:35

from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0007_alter_invoice_invoice_number'),
    ]

    operations = [
        migrations.AlterField(
            model_name='invoice',
            name='invoice_number',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]