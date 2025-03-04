from django.contrib import admin
from .models import Receipt

@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ('receipt_number', 'invoice', 'payment_date', 'payment_method', 'amount_paid')
    search_fields = ('receipt_number', 'invoice__invoice_number', 'invoice__customer__first_name', 'invoice__customer__last_name')
    list_filter = ('payment_date', 'payment_method')
    readonly_fields = ('receipt_number', 'qr_code')
    date_hierarchy = 'payment_date'
    
    fieldsets = (
        (None, {
            'fields': ('receipt_number', 'invoice', 'user')
        }),
        ('Payment Details', {
            'fields': ('payment_date', 'payment_method', 'payment_reference', 'amount_paid')
        }),
        ('Additional Information', {
            'fields': ('notes', 'qr_code')
        }),
    )
