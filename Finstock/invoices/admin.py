from django.contrib import admin
from .models import Invoice, InvoiceItem


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    """
    This class configures the admin interface for the Invoice model.
    """
    list_display = (
        'invoice_number', 'user', 'issue_date', 'due_date',
        'status', 'created', 'modified'
    )
    search_fields = (
        'invoice_number', 'user__first_name', 'user__last_name',
        'user__email'
    )
    list_filter = ('status', 'issue_date', 'due_date')


@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    """
    This class configures the admin interface for the InvoiceItem model.
    """
    list_display = ('invoice', 'description', 'quantity', 'unit_price', 'total_price')
    search_fields = ('description',)
    list_filter = ('invoice',)

    def total_price(self, obj):
        return obj.total_price()
    total_price.short_description = 'Total Price'
