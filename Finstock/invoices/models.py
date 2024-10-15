from django.db import models
from core.models import TimeStampedModel, Customer
from django.contrib.auth import get_user_model
from django.db.models import Sum, F
import uuid
from products.models import Product

User = get_user_model()

class Invoice(TimeStampedModel):
    """
    Model representing an invoice.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
    ]
    user = models.ForeignKey(
        User, related_name='invoices', on_delete=models.CASCADE
    )
    customer = models.ForeignKey(
        Customer, related_name='invoices', on_delete=models.SET_NULL, null=True, blank=True
    )
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    invoice_number = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    issue_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    def __str__(self):
        return f"Invoice {self.invoice_number} for {self.customer or self.user.username}"

    def update_total_amount(self):
        self.total_amount = self.items.aggregate(
            total=Sum(F('quantity') * F('unit_price'))
        )['total'] or 0
        self.save(update_fields=['total_amount'])

class InvoiceItem(models.Model):
    """
    Model representing an item within an invoice.
    """
    invoice = models.ForeignKey(
        Invoice, related_name='items', on_delete=models.CASCADE
    )
    product = models.ForeignKey(Product, related_name='invoice_items', on_delete=models.SET_NULL, null=True)
    description = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.product.name if self.product else self.description} - {self.quantity} x {self.unit_price}"

    @property
    def total_price(self):
        return self.quantity * self.unit_price

    def save(self, *args, **kwargs):
        if self.product:
            self.description = self.product.name
            self.unit_price = self.product.price
        super().save(*args, **kwargs)
        self.invoice.update_total_amount()

    def delete(self, *args, **kwargs):
        invoice = self.invoice
        super().delete(*args, **kwargs)
        invoice.update_total_amount()
