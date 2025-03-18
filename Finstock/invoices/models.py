from django.db import models
from core.models import TimeStampedModel, Customer
from django.contrib.auth import get_user_model
from django.db.models import Sum, F
import qrcode
from io import BytesIO
from django.core.files.base import ContentFile
from django.utils.dateparse import parse_date
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
    qr_code = models.ImageField(upload_to='invoice_qr_codes/', null=True, blank=True)

    def __str__(self):
        return f"Invoice {self.invoice_number} for {self.customer or self.user.username}"

    def update_total_amount(self):
        self.total_amount = self.items.aggregate(
            total=Sum(F('quantity') * F('unit_price'))
        )['total'] or 0
        self.save(update_fields=['total_amount'])

    def generate_qr_code(self):
        issue_date = self.issue_date
        due_date = self.due_date
    
        if isinstance(issue_date, str):
            issue_date = parse_date(issue_date)
        if isinstance(due_date, str):
            due_date = parse_date(due_date)
        
        qr_data = {
            'invoice_number': str(self.invoice_number),
            'total_amount': str(self.total_amount),
            'customer': f"{self.customer.first_name} {self.customer.last_name}" if self.customer else self.user.username,
            'customer_email': self.customer.email if self.customer else '',
            'issue_date': issue_date.isoformat(),
            'due_date': due_date.isoformat(),
            'status': self.status
        }
    
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(str(qr_data))
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        blob = BytesIO()
        img.save(blob, 'PNG')

        self.qr_code.save(
            f'invoice_qr_{self.invoice_number}.png',
            ContentFile(blob.getvalue()),
            save=False
        )

    def save(self, *args, **kwargs):
        if not self.qr_code:
            self.generate_qr_code()
        super().save(*args, **kwargs)

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
