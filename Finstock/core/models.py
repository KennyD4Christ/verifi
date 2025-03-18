from django.db import models
from django.db import transaction
from stock_adjustments.models import StockAdjustment
from django.db.models.signals import post_save
from django.core.exceptions import ValidationError
from django.dispatch import receiver
from products.models import Product
from django.conf import settings
from django.utils import timezone
from django.db.models import Sum, F
from django.db.models.functions import Coalesce
from decimal import Decimal
import hashlib
import uuid
import logging
from core.utils.currency import currency_formatter

logger = logging.getLogger(__name__)


class TimeStampedModel(models.Model):
    """
    An abstract base class model that provides self-updating 'created'
    and 'modified' fields.
    """
    created = models.DateTimeField(default=timezone.now, editable=False)
    modified = models.DateTimeField(auto_now=True)


    class Meta:
        abstract = True


class CompanyInfo(models.Model):
    name = models.CharField(max_length=255)
    address = models.TextField()
    phone = models.CharField(max_length=20)

    class Meta:
        verbose_name_plural = "Company Information"

    def __str__(self):
        return self.name


class Customer(TimeStampedModel):
    """
    Model representing a customer.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.OneToOneField(
        'core.Address',
        on_delete=models.CASCADE,
        related_name='customer',
        blank=True,
        null=True
    )
    billing_address = models.OneToOneField(
        'core.Address',
        on_delete=models.SET_NULL,
        related_name='billing_customer',
        blank=True,
        null=True
    )

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def name(self):
        return f"{self.first_name} {self.last_name}"


class Address(models.Model):
    street = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100)

    @classmethod
    def create_from_string(cls, address_string):
        # This is a simple parsing logic. You might need to adjust it based on your address format.
        parts = address_string.split(', ')
        if len(parts) < 5:
            raise ValueError("Address string doesn't contain all required parts")

        return cls.objects.create(
            street=parts[0],
            city=parts[1],
            state=parts[2],
            country=parts[3],
            postal_code=parts[4]
        )

    def __str__(self):
        return f"{self.street}, {self.city}, {self.state} {self.postal_code}, {self.country}"


class Order(TimeStampedModel):
    """
    Model representing an order.
    """
    sales_rep = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sales_orders')
    customer = models.ForeignKey(Customer, related_name='orders', on_delete=models.SET_NULL, null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders', null=True)
    order_date = models.DateTimeField(default=timezone.now)
    shipped_date = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled')
    ], default='pending')
    is_paid = models.BooleanField(default=False)
    shipping_address = models.ForeignKey(Address, on_delete=models.SET_NULL, null=True, related_name='shipping_orders')
    billing_address = models.ForeignKey(Address, on_delete=models.SET_NULL, null=True, related_name='billing_orders')
    special_instructions = models.TextField(blank=True)
    tracking_number = models.CharField(max_length=100, blank=True)
    estimated_delivery = models.DateTimeField(blank=True, null=True)
    previous_status = models.CharField(max_length=20, null=True, blank=True)
    invoice = models.OneToOneField('invoices.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='related_order')
    qr_scanned_items = models.JSONField(default=list, blank=True)
    transaction_category = models.CharField(max_length=50, choices=[
        ('income', 'Income'),
        ('expense', 'Expense'),
        ('cost_of_services', 'Cost of Services'),
    ], default='income')

    def add_scanned_item(self, product_data, quantity=1):
        """Add item scanned via QR code to the order"""
        if not self.qr_scanned_items:
            self.qr_scanned_items = []

        scanned_item = {
            'product_id': product_data['id'],
            'sku': product_data['sku'],
            'quantity': quantity,
            'scanned_at': timezone.now().isoformat(),
            'price': str(product_data['price'])
        }

        self.qr_scanned_items.append(scanned_item)
        self.save()

        # Create or update OrderItem
        OrderItem.objects.update_or_create(
            order=self,
            product_id=product_data['id'],
            defaults={
                'quantity': quantity,
                'unit_price': product_data['price']
            }
        )

    @property
    def formatted_total_price(self):
        return currency_formatter.format_currency(self.total_price)



    def __str__(self):
        customer_name = self.customer.get_full_name() if self.customer else "No Customer"
        return f"Order {self.id} by {self.sales_rep.get_full_name()} for {customer_name}"

    @property
    def total_price(self):
        logger.info(f"Calculating total price for order {self.id}")
        total = self.items.aggregate(
            total=Coalesce(Sum(F('quantity') * F('unit_price')), Decimal('0'))
        )['total']
        logger.info(f"Final calculated total price for order {self.id}: {total}")
        return total

    def create_invoice(self):
        from invoices.models import Invoice, InvoiceItem
        logger.info(f"Creating invoice for order {self.id}")

        if not self.items.exists():
            logger.warning(f"No items found for order {self.id}. Delaying invoice creation.")
            return None

        if not hasattr(self, 'invoice') or self.invoice is None:
            invoice = Invoice.objects.create(
                user=self.user,
                customer=self.customer,
                issue_date=timezone.now().date(),
                due_date=timezone.now().date() + timezone.timedelta(days=30),
                status='sent' if self.status in ['shipped', 'delivered'] else 'draft'
            )

            logger.info(f"Created invoice {invoice.id} for order {self.id}")

            order_items = self.items.all()
            logger.info(f"Order {self.id} has {order_items.count()} items")

            for order_item in self.items.all():
                invoice_item = InvoiceItem.objects.create(
                    invoice=invoice,
                    product=order_item.product,
                    description=order_item.product.name,
                    quantity=order_item.quantity,
                    unit_price=order_item.unit_price
                )

                logger.info(f"Created invoice item {invoice_item.id} for order item {order_item.id}")

            invoice.update_total_amount()
            logger.info(f"Updated total amount for invoice {invoice.id}: {invoice.total_amount}")

            self.invoice = invoice
            self.save(update_fields=['invoice'])
            logger.info(f"Saved invoice {invoice.id} to order {self.id}")
            
        else:
            logger.info(f"Invoice already exists for order {self.id}")
            
        return self.invoice

    def create_receipt_for_invoice(self, invoice):
        from receipts.models import Receipt
    
        if invoice is None:
            logger.warning(f"Cannot create receipt: No invoice provided for order {self.id}")
            return None

        logger.info(f"Attempting to create receipt for invoice {invoice.id}, current status: {invoice.status}")
    
        try:
            with transaction.atomic():
                # Explicitly set invoice to paid first
                if invoice.status != 'paid':
                    logger.info(f"Setting invoice {invoice.id} status to paid before creating receipt")
                    invoice.status = 'paid'
                    invoice.save(update_fields=['status'])
            
                # Use select_for_update to lock the row during checking
                existing_receipt = Receipt.objects.filter(invoice=invoice).select_for_update(nowait=True).first()
                if existing_receipt:
                    logger.info(f"Receipt {existing_receipt.receipt_number} already exists for invoice {invoice.id}")
                    return existing_receipt
                
                # Create the receipt since none exists
                receipt = Receipt.objects.create(
                    user=self.user or invoice.user,
                    invoice=invoice,
                    amount_paid=invoice.total_amount,
                    payment_date=timezone.now(),
                    payment_method='online',
                    notes=f"Automatically generated receipt for Order #{self.id}"
                )
                logger.info(f"Successfully created receipt {receipt.receipt_number} for invoice {invoice.id}")
                return receipt
        except Exception as e:
            logger.error(f"Error creating receipt for invoice {invoice.id}: {str(e)}", exc_info=True)
            return None

    @property
    def is_shipped(self):
        return self.status == 'shipped'

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        was_paid = False
        had_invoice = False
        
        # Check if this is an update to an existing order
        if not is_new:
            try:
                old_instance = Order.objects.get(pk=self.pk)
                self.previous_status = old_instance.status
                was_paid = old_instance.is_paid
                had_invoice = hasattr(old_instance, 'invoice') and old_instance.invoice is not None
            except Order.DoesNotExist:
                self.previous_status = None
        else:
            self.previous_status = None
            
        # For new orders or if payment status changed
        payment_status_changed = was_paid != self.is_paid
        logger.info(f"Order {self.pk if self.pk else 'new'} save: is_new={is_new}, was_paid={was_paid}, is_paid={self.is_paid}, payment_status_changed={payment_status_changed}")
        
        # Special handling for update_fields to prevent recursion
        update_fields = kwargs.get('update_fields')
        is_internal_update = update_fields is not None and 'invoice' in update_fields and len(update_fields) == 1
        
        # Save the order
        super().save(*args, **kwargs)

        # Update stock if needed
        if self.status in ['shipped', 'delivered'] and self.previous_status not in ['shipped', 'delivered']:
            self.update_stock()

        # Skip invoice creation for internal updates to prevent recursion
        if not is_internal_update:
            # Always create invoice for new orders or if there isn't one
            if is_new or not had_invoice:
                logger.info(f"Creating invoice for {'new' if is_new else 'existing'} order {self.id}")
                self.create_invoice()
            elif payment_status_changed and self.is_paid:
                # Order was just marked as paid, make sure receipt exists
                logger.info(f"Order {self.id} was just marked as paid, checking for receipt")
                if hasattr(self, 'invoice') and self.invoice:
                    # Update invoice status
                    if self.invoice.status != 'paid':
                        self.invoice.status = 'paid'
                        self.invoice.save(update_fields=['status'])
                        logger.info(f"Updated invoice {self.invoice.id} status to paid")

    @transaction.atomic
    def update_stock(self):
        if self.status in ['shipped', 'delivered'] and self.previous_status not in ['shipped', 'delivered']:
            self._decrease_stock()
        elif self.previous_status in ['shipped', 'delivered'] and self.status not in ['shipped', 'delivered']:
            self._increase_stock()

    def _adjust_stock(self, adjustment_type):
        for item in self.items.all():
            if adjustment_type == 'REMOVE':
                if item.product.stock < item.quantity:
                    raise ValidationError(f"Insufficient stock for product {item.product.name}")

            StockAdjustment.objects.create(
                product=item.product,
                quantity=item.quantity,
                adjusted_by=self.customer.user,
                adjustment_type=adjustment_type,
                reason=f"Order {self.id} status changed to {self.status}"
            )

    def _decrease_stock(self):
        for item in self.items.all():
            if item.product.stock < item.quantity:
                raise ValidationError(f"Insufficient stock for product {item.product.name}")
            
            StockAdjustment.objects.create(
                product=item.product,
                quantity=-item.quantity,
                adjusted_by=self.customer.user if self.customer.user else None,
                adjustment_type='REMOVE',
                reason=f"Order {self.id} status changed to {self.status}"
            )

    def _increase_stock(self):
        for item in self.items.all():
            StockAdjustment.objects.create(
                product=item.product,
                quantity=item.quantity,
                adjusted_by=self.customer.user if self.customer.user else None,
                adjustment_type='ADD',
                reason=f"Order {self.id} status changed from {self.previous_status} to {self.status}"
            )

@receiver(post_save, sender=Order)
def order_post_save(sender, instance, created, **kwargs):
    pass


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name='order_items', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    customization = models.TextField(blank=True)

    def __str__(self):
        return f"{self.product.name} - {self.quantity} x {self.unit_price}"

    def save(self, *args, **kwargs):
        if not self.unit_price:
            self.unit_price = self.product.price
        super().save(*args, **kwargs)

    def total_price(self):
        total = self.quantity * self.unit_price
        logger.debug(f"Calculated total price for order item {self.id}: {total} (quantity: {self.quantity}, unit_price: {self.unit_price})")
        return total

class Promotion(models.Model):
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField()
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2)
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.code

class OrderPromotion(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='promotions')
    promotion = models.ForeignKey(Promotion, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.promotion.code} applied to Order {self.order.id}"

class Visit(models.Model):
    """
    Model representing a visit to the application.
    """
    # User Information
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visits',
        help_text="Authenticated user associated with the visit (if any)."
    )
    session_id = models.CharField(
        max_length=64,  # Reduced to a fixed-length hash
        db_index=True,
        help_text="Session identifier for the visit."
    )

    # Rest of the model remains the same
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of the visitor."
    )
    user_agent = models.TextField(
        null=True,
        blank=True,
        help_text="User agent string of the visitor's browser."
    )
    referrer_url = models.URLField(
        null=True,
        blank=True,
        max_length=2000,  # Increased URL length
        help_text="URL of the page that referred the visitor."
    )
    visited_url = models.URLField(
        max_length=2000,
        help_text="URL that was visited."
    )

    # Timestamp
    timestamp = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        help_text="Date and time of the visit."
    )

    # Additional Information
    geo_location = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Geographical location of the visitor based on IP."
    )
    device_type = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Type of device used (e.g., Mobile, Tablet, Desktop)."
    )
    operating_system = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Operating system of the visitor's device."
    )

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp']),
            models.Index(fields=['user']),
            models.Index(fields=['ip_address']),
            # Removed the problematic unique_together
        ]
        verbose_name = "Visit"
        verbose_name_plural = "Visits"

    def __str__(self):
        user_str = self.user.username if self.user else "Anonymous"
        return f"Visit by {user_str} on {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"

    @classmethod
    def create_visit(cls, request, user_agent_obj):
        """
        Class method to create a visit record with consistent logic
        """
        # Generate session ID
        unique_string = (
            f"{request.META.get('HTTP_USER_AGENT', '')}"
            f"{request.META.get('REMOTE_ADDR', '')}"
            f"{timezone.now().isoformat()}"
        )
        session_id = hashlib.sha256(unique_string.encode()).hexdigest()[:64]

        # Get user info and IP
        user = request.user if request.user.is_authenticated else None
        ip_address = cls.get_client_ip(request)

        # Extract additional metadata
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        referrer_url = request.META.get('HTTP_REFERER', '')
        visited_url = request.build_absolute_uri()
        device_type = cls.get_device_type(user_agent_obj)
        operating_system = cls.get_operating_system(user_agent_obj)

        # Check for recent visit to prevent duplicates
        recent_visit = cls.objects.filter(
            session_id=session_id,
            timestamp__gte=timezone.now() - timezone.timedelta(minutes=30)
        ).first()

        if recent_visit:
            recent_visit.timestamp = timezone.now()
            recent_visit.save()
            return recent_visit

        # Create new visit
        return cls.objects.create(
            user=user,
            session_id=session_id,
            ip_address=ip_address,
            user_agent=user_agent,
            referrer_url=referrer_url,
            visited_url=visited_url,
            timestamp=timezone.now(),
            device_type=device_type,
            operating_system=operating_system
        )

    @staticmethod
    def get_client_ip(request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    @staticmethod
    def get_device_type(user_agent_obj):
        if user_agent_obj.is_mobile:
            return 'Mobile'
        elif user_agent_obj.is_tablet:
            return 'Tablet'
        elif user_agent_obj.is_pc:
            return 'Desktop'
        elif user_agent_obj.is_bot:
            return 'Bot'
        return 'Other'

    @staticmethod
    def get_operating_system(user_agent_obj):
        return user_agent_obj.os.family or 'Unknown'
