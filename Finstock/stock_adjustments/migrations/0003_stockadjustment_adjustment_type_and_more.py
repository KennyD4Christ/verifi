# Generated by Django 5.0.6 on 2024-08-31 14:46

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stock_adjustments', '0002_remove_stockadjustment_adjustment_type'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='stockadjustment',
            name='adjustment_type',
            field=models.CharField(choices=[('ADD', 'Add'), ('REMOVE', 'Remove'), ('RETURN', 'Return'), ('DAMAGE', 'Damage')], default='UNKNOWN', max_length=10),
        ),
        migrations.AddField(
            model_name='stockadjustment',
            name='reason',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='stockadjustment',
            name='adjusted_by',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='stock_adjustments', to=settings.AUTH_USER_MODEL),
        ),
    ]