from rest_framework import serializers, viewsets
from django.db import transaction
from django.core.exceptions import ValidationError
from django.core.exceptions import ObjectDoesNotExist
from products.models import Product
from stock_adjustments.models import StockAdjustment
from products.serializers import ProductSerializer
from .models import Customer, Order, OrderItem, Address, CompanyInfo, Promotion
import logging
from decimal import Decimal
from django.contrib.auth import get_user_model

User = get_user_model()


logger = logging.getLogger(__name__)


class ProductPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    def to_internal_value(self, data):
        logger.debug(f"Attempting to fetch product with id: {data}")
        try:
            return self.get_queryset().get(pk=data)
        except ObjectDoesNotExist:
            logger.error(f"Product with id {data} does not exist")
            self.fail('does_not_exist', pk_value=data)


class ProductChoiceField(serializers.PrimaryKeyRelatedField):
    def to_representation(self, value):
        if isinstance(value, Product):
            return {'id': value.pk, 'name': value.name, 'price': value.price}
        return value.pk if value else None

    def to_internal_value(self, data):
        if isinstance(data, dict):
            return self.queryset.get(pk=data['id'])
        return super().to_internal_value(data)


class CompanyInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyInfo
        fields = ['id', 'name', 'address', 'phone']


class CustomerSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)

    class Meta:
        model = Customer
        fields = ['id', 'user', 'first_name', 'last_name', 'email', 'phone', 'address', 'created', 'modified']
        read_only_fields = ['id', 'created', 'modified']

    def validate_first_name(self, value):
        if not value or len(value) < 2:
            raise serializers.ValidationError("First name must be at least 2 characters long.")
        return value

    def validate_last_name(self, value):
        if not value or len(value) < 2:
            raise serializers.ValidationError("Last name must be at least 2 characters long.")
        return value


class PromotionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Promotion
        fields = ['id', 'code', 'description', 'discount_percent', 'valid_from', 'valid_to', 'is_active']


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductChoiceField(
        queryset=Product.objects.all(),
        error_messages={
            'does_not_exist': 'Product with id {pk_value} does not exist.',
        }
    )
    product_name = serializers.SerializerMethodField()
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'quantity', 'unit_price']

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None

    def validate(self, attrs):
        attrs = super().validate(attrs)
        product = attrs['product']
        quantity = attrs['quantity']
        
        if product.stock < quantity:
            raise serializers.ValidationError(f"Insufficient stock for product {product.name}. Available: {product.stock}, Requested: {quantity}")
        
        return attrs

    def validate_product_id(self, value):
        print(f"Validating product_id: {value}")
        available_products = list(Product.objects.values('id', 'name', 'price'))
        print(f"Available products: {available_products}")
        if not any(p['id'] == value.id for p in available_products):
            raise serializers.ValidationError(f"Product with id {value.id} is not available. Available products: {available_products}")
        return value

    def to_internal_value(self, data):
        logger.debug(f"OrderItemSerializer to_internal_value called with data: {data}")
        product_data = data.get('product')
        if isinstance(product_data, dict):
            data['product'] = product_data.get('id')
        return super().to_internal_value(data)

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['product'] = self.fields['product'].to_representation(instance.product)
        return representation

    def create(self, validated_data):
        product = validated_data.pop('product')
        return OrderItem.objects.create(product=product, **validated_data)

    def update(self, instance, validated_data):
        if 'product' in validated_data:
            product = validated_data.pop('product')
            validated_data['unit_price'] = validated_data.get('unit_price', product.price)
        return super().update(instance, validated_data)


class OrderSerializer(serializers.ModelSerializer):
    from invoices.serializers import InvoiceSerializer
    customer = CustomerSerializer(read_only=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.all(), source='customer'
    )
    items = OrderItemSerializer(many=True)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    shipping_address = serializers.CharField()
    billing_address = serializers.CharField()
    previous_status = serializers.CharField(read_only=True)
    invoice = InvoiceSerializer(read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'customer', 'customer_id', 'order_date', 'user', 'shipped_date', 'is_paid', 'is_shipped',
            'items', 'created', 'modified', 'status', 'total_price', 'previous_status',
            'shipping_address', 'billing_address', 'special_instructions', 'invoice'
        ]
        read_only_fields = ['id', 'user']

    def to_internal_value(self, data):
        logger.debug(f"OrderSerializer to_internal_value called with data: {data}")
        return super().to_internal_value(data)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        user = self.context['request'].user

        # Validate order creation permissions
        if self.context['request'].method in ['POST', 'PUT', 'PATCH']:
            self._validate_order_creation_permission(user)
            self._validate_order_status_change(user, attrs)
        
        # Validate items
        items = attrs.get('items', [])
        if not items:
            raise serializers.ValidationError("At least one item is required.")
        
        return attrs

    def _validate_order_creation_permission(self, user):
        # Check if user has permission to create/edit orders
        allowed_roles = ['Sales Representative', 'Administrator']

        if not user.role.name in allowed_roles:
            raise serializers.ValidationError({
                'permission': 'You do not have permission to create or modify orders.'
            })

    def _validate_order_status_change(self, user, data):
        # Implement status change restrictions based on user role
        if 'status' in data:
            # Only certain roles can change order status
            status_change_roles = ['Sales Representative', 'Administrator']

            if user.role.name not in status_change_roles:
                raise serializers.ValidationError({
                    'status': 'You are not authorized to change order status.'
                })

    def get_total_price(self, obj):
        return sum(item.quantity * item.unit_price for item in obj.items.all())

    def validate_items(self, value):
        logger.debug(f"OrderSerializer validate_items called with value: {value}")
        return value

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        shipping_address_str = validated_data.pop('shipping_address')
        billing_address_str = validated_data.pop('billing_address')

        # Create or get Address instances
        shipping_address = Address.create_from_string(shipping_address_str)
        billing_address = Address.create_from_string(billing_address_str)

        # Create the order
        order = Order.objects.create(
            shipping_address=shipping_address,
            billing_address=billing_address,
            **validated_data
        )

        # Create order items and stock adjustments
        for item_data in items_data:
            order_item = OrderItem.objects.create(order=order, **item_data)
            
            StockAdjustment.objects.create(
                product=order_item.product,
                quantity=-order_item.quantity,
                adjusted_by=order.customer.user if order.customer.user else None,
                adjustment_type='REMOVE',
                reason=f"New Order {order.id} created"
            )
            logger.info(f"Created order {order.id}")
        # Always create an invoice, but set its status based on the order status
        invoice = order.create_invoice()
        logger.info(f"Created invoice {invoice.id} for order {order.id}")
    
        # Refresh the order to ensure we have the latest data
        order.refresh_from_db()
        logger.info(f"Refreshed order {order.id} from database")

        return order

    @transaction.atomic
    def update(self, instance, validated_data):
        if 'status' in validated_data:
            new_status = validated_data['status']
            old_status = instance.status
            instance = super().update(instance, validated_data)
            
            if new_status != old_status:
                instance.update_stock()
        else:
            instance = super().update(instance, validated_data)

        return instance

    def update_stock(self, order, previous_status):
        if order.status in ['shipped', 'delivered'] and previous_status not in ['shipped', 'delivered']:
            # Decrease stock
            for item in order.items.all():
                product = item.product
                product.stock -= item.quantity
                if product.stock < 0:
                    raise serializers.ValidationError(f"Insufficient stock for product {product.name}")
                product.save()
        elif previous_status in ['shipped', 'delivered'] and order.status not in ['shipped', 'delivered']:
            # Increase stock (e.g., order cancelled)
            for item in order.items.all():
                product = item.product
                product.stock += item.quantity
                product.save()

    def to_representation(self, instance):
        from invoices.serializers import InvoiceSerializer
        representation = super().to_representation(instance)
        representation['shipping_address'] = str(instance.shipping_address) if instance.shipping_address else None
        representation['billing_address'] = str(instance.billing_address) if instance.billing_address else None
        representation['total_price'] = str(instance.total_price)
        if instance.invoice:
            representation['invoice'] = InvoiceSerializer(instance.invoice).data
        else:
            representation['invoice'] = None
        return representation

class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = [
            'id', 'street', 'city', 'state', 'postal_code',
            'country', 'created', 'modified'
        ]
