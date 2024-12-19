from django.conf import settings
from django.db import models
from django.db.models import Sum

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
    low_stock_threshold = models.PositiveIntegerField(
        default=10,
        help_text="Minimum stock level that triggers low stock alert"
    )

    def __str__(self):
        return f"{self.name} (ID: {self.id})"

    def update_stock(self, quantity_change):
        self.stock += quantity_change
        if self.stock < 0:
            raise ValueError(f"Stock cannot be negative for product {self.name}")
        self.save()

    def get_sales_in_range(self, start_date, end_date):
        return self.order_items.filter(
            order__order_date__range=[start_date, end_date]
        ).aggregate(total_sales=Sum('quantity'))['total_sales'] or 0

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
