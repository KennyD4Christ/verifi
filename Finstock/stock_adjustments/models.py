from django.db import models
from django.utils import timezone
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

class StockAdjustment(models.Model):
    ADJUSTMENT_TYPES = (
        ('ADD', 'Add'),
        ('REMOVE', 'Remove'),
        ('RETURN', 'Return'),
        ('DAMAGE', 'Damage'),
    )

    product = models.ForeignKey(
        'products.Product',
        related_name='stock_adjustments',
        on_delete=models.CASCADE
    )
    quantity = models.IntegerField()
    adjusted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='stock_adjustments',
        on_delete=models.SET_NULL,
        null=True
    )
    adjustment_date = models.DateField(default=timezone.now)
    adjustment_type = models.CharField(max_length=10, choices=ADJUSTMENT_TYPES)
    reason = models.TextField(blank=True)

    def __str__(self):
        return f"{self.get_adjustment_type_display()} {abs(self.quantity)} for {self.product.name}"

    def save(self, *args, **kwargs):
        if self.adjustment_type in ['REMOVE', 'DAMAGE']:
            self.quantity = -abs(self.quantity)
        else:
            self.quantity = abs(self.quantity)
        super().save(*args, **kwargs)

@receiver(post_save, sender=StockAdjustment)
def update_product_stock(sender, instance, created, **kwargs):
    product = instance.product
    product.stock += instance.quantity
    product.stock = max(product.stock, 0)  # Ensure stock doesn't go below 0
    product.save()
