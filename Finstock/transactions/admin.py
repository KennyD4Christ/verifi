from django.contrib import admin
from .models import Transaction


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    """
    This class configures the admin interface for the Transaction model.
    """
    list_display = (
        'id', 'transaction_type', 'amount', 'date', 'payment_method',
        'status', 'created', 'modified'
    )
    search_fields = ('transaction_type', 'payment_method', 'status')
    list_filter = ('transaction_type', 'payment_method', 'status', 'date')
