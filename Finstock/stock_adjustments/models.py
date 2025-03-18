from django.db import models
from django.utils import timezone
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
import qrcode
from io import BytesIO
from django.core.files import File
from PIL import Image
import logging

logger = logging.getLogger(__name__)

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
    qr_code = models.ImageField(upload_to='stock_adjustments/qr_codes/', blank=True, null=True)
    qr_code_data = models.JSONField(blank=True, null=True)

    def __str__(self):
        return f"{self.get_adjustment_type_display()} {abs(self.quantity)} for {self.product.name}"

    def save(self, *args, **kwargs):
        # Track if this is a new instance
        is_new = self.pk is None
        
        # Get old QR code name if it exists
        old_qr_name = None
        if not is_new:
            try:
                old_instance = StockAdjustment.objects.get(pk=self.pk)
                old_qr_name = old_instance.qr_code.name if old_instance.qr_code else None
            except StockAdjustment.DoesNotExist:
                pass

        # First save to ensure we have an ID
        super().save(*args, **kwargs)

        # Generate new QR code data
        new_qr_data = {
            'adjustment_id': str(self.id),
            'product_id': str(self.product.id),
            'product_name': self.product.name,
            'quantity': self.quantity,
            'adjustment_type': self.adjustment_type,
            'adjustment_date': self.adjustment_date.strftime('%Y-%m-%d'),
        }

        # Check if QR code needs to be updated
        if is_new or self.qr_code_data != new_qr_data:
            self.qr_code_data = new_qr_data

            # Generate new QR code image
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(str(self.qr_code_data))
            qr.make(fit=True)
            qr_image = qr.make_image(fill_color="black", back_color="white")

            # Save QR code image
            buffer = BytesIO()
            qr_image.save(buffer, format='PNG')
            filename = f'stock_adjustment_qr_{self.product.id}_{timezone.now().strftime("%Y%m%d%H%M%S")}.png'

            # Delete old QR code if it exists
            if old_qr_name:
                self.qr_code.storage.delete(old_qr_name)

            # Save new QR code
            self.qr_code.save(filename, File(buffer), save=False)

            # Save again to update the QR code and data
            super().save(update_fields=['qr_code', 'qr_code_data'])

@receiver(post_save, sender=StockAdjustment)
def update_product_stock(sender, instance, created, **kwargs):
    """
    Signal handler to update product stock when a StockAdjustment is created.
    Only processes new adjustments to prevent double-counting.
    """
    if created:  # Only process new adjustments
        try:
            product = instance.product
            adjustment_quantity = instance.quantity

            # Apply the adjustment based on the adjustment type
            if instance.adjustment_type in ['REMOVE', 'DAMAGE']:
                adjustment_quantity = -abs(adjustment_quantity)
            else:
                adjustment_quantity = abs(adjustment_quantity)

            # Update the stock
            product.stock += adjustment_quantity
            product.stock = max(product.stock, 0)  # Ensure stock doesn't go below 0
            product.save(update_fields=['stock'])

            logger.info(
                f"Stock updated for product {product.id}: {instance.adjustment_type} "
                f"{abs(adjustment_quantity)} units. New stock level: {product.stock}"
            )
        except Exception as e:
            logger.error(f"Error updating stock for adjustment {instance.id}: {str(e)}")
            raise
