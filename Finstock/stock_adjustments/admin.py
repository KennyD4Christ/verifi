from django.contrib import admin
from .models import StockAdjustment

class StockAdjustmentAdmin(admin.ModelAdmin):
    list_display = ('product', 'quantity', 'adjusted_by', 'adjustment_date')
    list_filter =  ('adjustment_date', 'adjusted_by')
    search_fields = ('product__name', 'adjusted_by__first_name', 'adjusted_by__last_name')
    date_hierarchy = 'adjustment_date'

admin.site.register(StockAdjustment, StockAdjustmentAdmin)
