from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from core.models import TimeStampedModel, Customer, Order
from invoices.models import Invoice
from django.conf import settings
import qrcode
from io import BytesIO
from django.core.files.base import ContentFile
import json


class TransactionQRCode(models.Model):
    """
    Model to store QR codes for transactions. Each transaction will have its own
    QR code containing transaction details and verification information.
    """
    transaction = models.OneToOneField(
        'Transaction', 
        on_delete=models.CASCADE,
        related_name='qr_code'
    )
    qr_image = models.ImageField(
        upload_to='transaction_qr_codes/',
        blank=True,
        null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def generate_qr_data(self):
        """
        Generate QR code data including transaction details and any scanned items
        from the associated order.
        """
        try:
            verification_url = f"{settings.SITE_URL}/api/transactions/verify/{self.transaction.id}/"
        except AttributeError:
            # Fallback to a relative URL if SITE_URL is not configured
            verification_url = f"/api/transactions/verify/{self.transaction.id}/"
            logger.warning("SITE_URL not configured, using relative URL for QR code verification")
    
        transaction_data = {
            'transaction_id': str(self.transaction.id),
            'amount': str(self.transaction.amount),
            'date': str(self.transaction.date),
            'type': self.transaction.transaction_type,
            'status': self.transaction.status,
            'verification_url': verification_url
        }
    
        if self.transaction.order and self.transaction.order.qr_scanned_items:
            transaction_data['scanned_items'] = self.transaction.order.qr_scanned_items
    
        return json.dumps(transaction_data)

    def generate_qr_code(self):
        """Generate and save QR code image for the transaction"""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(self.generate_qr_data())
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        filename = f'transaction_{self.transaction.id}_qr.png'
        
        self.qr_image.save(
            filename,
            ContentFile(buffer.getvalue()),
            save=False
        )

class Transaction(TimeStampedModel):
    """
    Model representing a financial transaction.
    """
    TRANSACTION_TYPES = (
        ('income', 'Income'),
        ('expense', 'Expense'),
        ('cost_of_services', 'Cost of Services'),
    )

    PAYMENT_METHODS = (
        ('cash', 'Cash'),
        ('credit_card', 'Credit Card'),
        ('bank_transfer', 'Bank Transfer'),
        ('paypal', 'PayPal'),
        ('other', 'Other'),
    )

    TRANSACTION_STATUSES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('refunded', 'Refunded'),
        ('canceled', 'Canceled'),
    )

    CATEGORY_CHOICES = (
        ('income', 'Income'),
        ('salary', 'Salary'),
        ('marketing_expenses', 'Marketing Expenses'),
        ('office_supplies', 'Office Supplies'),
        ('utilities', 'Utilities'),
        ('other', 'Other'),
        ('cost_of_services', 'Cost of Services'),
    )

    order = models.ForeignKey(
        Order, related_name='transactions',
        on_delete=models.SET_NULL, blank=True, null=True
    )
    invoice = models.ForeignKey(
        Invoice, related_name='transactions',
        on_delete=models.SET_NULL, blank=True, null=True
    )
    customer = models.ForeignKey(
        Customer, related_name='transactions',
        on_delete=models.SET_NULL, blank=True, null=True
    )
    transaction_type = models.CharField(
        max_length=20, choices=TRANSACTION_TYPES
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='created_transactions',
        on_delete=models.SET_NULL, blank=True, null=True
    )
    category = models.CharField(
        max_length=50, choices=CATEGORY_CHOICES, blank=True, null=True
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS)
    status = models.CharField(max_length=10, choices=TRANSACTION_STATUSES)

    def clean(self):
        # Complex validations that involve database queries or business logic
        if self.order and self.invoice:
            if self.order.customer != self.invoice.customer:
                raise ValidationError("Order and Invoice must belong to the same customer.")

        if self.transaction_type == 'expense' and self.amount < 0:
            raise ValidationError("Expense amount should be positive.")
        
        if self.transaction_type == 'income' and self.amount <= 0:
            raise ValidationError("Income amount should be greater than zero.")

        # Check if the transaction date is not in the future
        if self.date > timezone.now().date():
            raise ValidationError("Transaction date cannot be in the future.")

        if self.order and self.customer and self.order.customer != self.customer:
            raise ValidationError("Transaction customer must match the order customer.")

        # Validate category assignment
        if self.category and self.category not in dict(self.CATEGORY_CHOICES):
            raise ValidationError({
                'category': f'Invalid category. Must be one of: {", ".join(dict(self.CATEGORY_CHOICES).keys())}'
            })

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        self.full_clean()
        super().save(*args, **kwargs)
        
        # Generate or update QR code after transaction is saved
        if is_new:
            qr_code = TransactionQRCode.objects.create(transaction=self)
        else:
            qr_code = getattr(self, 'qr_code', None)
            if not qr_code:
                qr_code = TransactionQRCode.objects.create(transaction=self)
        
        qr_code.generate_qr_code()
        qr_code.save()

    @classmethod
    def create_from_order(cls, order):
        """
        Create a transaction from an order, including QR code with scanned items history.
        """
        transaction = cls.objects.create(
            order=order,
            customer=order.customer,
            transaction_type='income' if order.type == 'sale' else 'expense',
            created_by=order.created_by,
            category='income' if order.type == 'sale' else 'cost_of_services',
            amount=order.total_amount,
            date=order.created_at.date(),
            payment_method=order.payment_method,
            status='completed' if order.status == 'paid' else 'pending'
        )
        return transaction

    def __str__(self):
        return f"Transaction {self.id} - {self.transaction_type} - {self.amount}"
