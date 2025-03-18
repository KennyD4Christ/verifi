import uuid
from io import BytesIO
from django.db import models
from django.core.files.base import ContentFile
from django.contrib.auth import get_user_model
from core.models import TimeStampedModel
import qrcode
from django.utils.timezone import now
from django.utils.dateparse import parse_date

User = get_user_model()

class Receipt(TimeStampedModel):
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('credit_card', 'Credit Card'),
        ('bank_transfer', 'Bank Transfer'),
        ('cheque', 'Cheque'),
        ('online', 'Online Payment'),
        ('other', 'Other'),
    ]
    
    user = models.ForeignKey(
        User, related_name='receipts', on_delete=models.CASCADE
    )
    invoice = models.OneToOneField(
        'invoices.Invoice', related_name='receipt', on_delete=models.CASCADE, null=True
    )
    receipt_number = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    payment_date = models.DateField(default=now)
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        default='online'
    )
    payment_reference = models.CharField(max_length=100, blank=True, null=True)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    notes = models.TextField(blank=True, null=True)
    qr_code = models.ImageField(upload_to='receipt_qr_codes/', null=True, blank=True)
    
    def __str__(self):
        return f"Receipt {self.receipt_number} for Invoice {self.invoice.invoice_number}"
    
    def generate_qr_code(self):
        payment_date = self.payment_date
        
        if isinstance(payment_date, str):
            payment_date = parse_date(payment_date)
            
        qr_data = {
            'receipt_number': str(self.receipt_number),
            'invoice_number': str(self.invoice.invoice_number),
            'amount_paid': str(self.amount_paid),
            'customer': f"{self.invoice.customer.first_name} {self.invoice.customer.last_name}" if self.invoice.customer else self.user.username,
            'payment_date': payment_date.isoformat(),
            'payment_method': self.payment_method,
            'payment_reference': self.payment_reference or '',
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
            f'receipt_qr_{self.receipt_number}.png',
            ContentFile(blob.getvalue()),
            save=False
        )
    
    def save(self, *args, **kwargs):
        # Set amount_paid to invoice total if not specified
        if not self.amount_paid:
            self.amount_paid = self.invoice.total_amount
            
        # Generate QR code if not present
        if not self.qr_code:
            self.generate_qr_code()
            
        # Update invoice status to 'paid' if not already
        if self.invoice.status != 'paid':
            self.invoice.status = 'paid'
            self.invoice.save(update_fields=['status'])
            
        super().save(*args, **kwargs)
