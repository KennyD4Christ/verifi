from django.conf import settings
from django.db import models
from django.db.models import Sum
import qrcode
import uuid
from io import BytesIO
from django.core.files.base import ContentFile
from PIL import Image

class Category(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class ProductManager(models.Manager):
    def get_queryset(self):
        qs = super().get_queryset()
        print(f"Product queryset: {qs.query}")
        return qs

class ProductQuerySet(models.QuerySet):
    def get(self, *args, **kwargs):
        print(f"Product.objects.get called with args: {args}, kwargs: {kwargs}")
        return super().get(*args, **kwargs)


class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    sku = models.CharField(max_length=100, unique=True)
    stock = models.PositiveIntegerField()
    sales = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)
    category = models.ForeignKey(Category, related_name='products', on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    qr_code = models.ImageField(upload_to='product_qr_codes/', blank=True, null=True)
    qr_code_data = models.JSONField(default=dict, blank=True)
    barcode = models.CharField(max_length=100, unique=True, null=True, blank=True)
    low_stock_threshold = models.PositiveIntegerField(
        default=10,
        help_text="Minimum stock level that triggers low stock alert"
    )

    def __str__(self):
        return f"{self.name} (ID: {self.id})"

    def update_stock(self, quantity_change, reason="Manual adjustment", adjusted_by=None):
        """
        Updates product stock by creating a StockAdjustment record.
        This method should be used for all stock modifications.
        """
        adjustment_type = 'ADD' if quantity_change > 0 else 'REMOVE'
        
        try:
            StockAdjustment.objects.create(
                product=self,
                quantity=abs(quantity_change),  # Store absolute value
                adjustment_type=adjustment_type,
                reason=reason,
                adjusted_by=adjusted_by
            )
            return True
        except Exception as e:
            logger.error(f"Error creating stock adjustment for product {self.id}: {str(e)}")
            raise

    def get_sales_in_range(self, start_date, end_date):
        return self.order_items.filter(
            order__order_date__range=[start_date, end_date]
        ).aggregate(total_sales=Sum('quantity'))['total_sales'] or 0

    def generate_qr_code(self):
        """Generate QR code containing product information"""
        qr_data = {
            'id': self.id,
            'sku': self.sku,
            'name': self.name,
            'price': str(self.price),
            'stock': self.stock,
            'barcode': self.barcode  # Add barcode to QR data
        }
        # Create QR code instance
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        # Add data
        qr.add_data(str(qr_data))
        qr.make(fit=True)
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        # Save QR code image
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        filename = f'qr_code_{self.sku}.png'
        # Save to model
        self.qr_code.save(filename, ContentFile(buffer.getvalue()), save=False)
        self.qr_code_data = qr_data
        self.save()

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        
        # Generate barcode for new products if not provided
        if is_new and not self.barcode:
            self.barcode = f"PRD{str(uuid.uuid4())[:8].upper()}"
            
        super().save(*args, **kwargs)
        
        # Generate QR code for new products or if SKU/barcode changed
        if is_new or self.qr_code_data.get('sku') != self.sku or self.qr_code_data.get('barcode') != self.barcode:
            self.generate_qr_code()

class ProductImage(models.Model):
    product = models.ForeignKey(Product, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(upload_to='products/images/')
    alt_text = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return self.alt_text if self.alt_text else f"Image for {self.product.name}"

class Review(models.Model):
    product = models.ForeignKey(Product, related_name='reviews', on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    rating = models.PositiveIntegerField()
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Review by {self.user.username} for {self.product.name}"
