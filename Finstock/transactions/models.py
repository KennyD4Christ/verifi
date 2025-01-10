from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from core.models import TimeStampedModel, Customer, Order
from invoices.models import Invoice


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
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Transaction {self.id} - {self.transaction_type} - {self.amount}"
