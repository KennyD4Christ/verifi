from django.contrib import admin
from .models import Order, OrderItem, Address, Customer, Promotion, OrderPromotion, Visit


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 1


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'order_date', 'is_paid', 'status', 'is_shipped')
    list_filter = ('is_paid', 'status', 'order_date')
    inlines = [OrderItemInline]
    search_fields = ['customer__user__username', 'customer__user__email']
    date_hierarchy = 'order_date'
    actions = ['bulk_delete_orders']

    def bulk_delete_orders(self, request, queryset):
        deleted_count, _ = queryset.delete()
        self.message_user(request, f"Successfully deleted {deleted_count} order(s)", messages.SUCCESS)
    bulk_delete_orders.short_description = "Delete selected orders"


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product', 'quantity', 'unit_price')
    list_filter = ('order__id', 'product')


@admin.register(Promotion)
class PromotionAdmin(admin.ModelAdmin):
    list_display = ['code', 'discount_percent', 'valid_from', 'valid_to', 'is_active']
    list_filter = ['is_active']
    search_fields = ['code', 'description']

@admin.register(OrderPromotion)
class OrderPromotionAdmin(admin.ModelAdmin):
    list_display = ['order', 'promotion']
    search_fields = ['order__id', 'promotion__code']


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('street', 'city', 'state', 'postal_code', 'country')
    search_fields = ('street', 'city', 'state', 'postal_code', 'country')


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'first_name', 'last_name', 'email', 'phone', 'address'
    )
    list_display_links = ('id', 'first_name', 'last_name')
    search_fields = ('first_name', 'last_name', 'email', 'phone')
    list_filter = ('address__city', 'address__state', 'address__country')

    fieldsets = (
        ('Personal Info', {
            'fields': ('first_name', 'last_name', 'email', 'phone')
        }),
        ('Address Info', {
            'fields': ('address',),
        }),
    )
    readonly_fields = ('id',)


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = ('user', 'session_id', 'visited_url', 'timestamp', 'ip_address', 'device_type', 'operating_system')
    search_fields = ('user__username', 'session_id', 'ip_address', 'visited_url')
    list_filter = ('timestamp', 'device_type', 'operating_system')
    readonly_fields = ('session_id', 'timestamp')
