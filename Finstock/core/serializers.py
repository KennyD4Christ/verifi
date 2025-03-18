from rest_framework import serializers, viewsets
from django.db import transaction
from django.core.exceptions import ValidationError, PermissionDenied
from django.core.exceptions import ObjectDoesNotExist
from products.models import Product
from stock_adjustments.models import StockAdjustment
from products.serializers import ProductSerializer
from transactions.serializers import TransactionSerializer
from transactions.models import Transaction
from .models import Customer, Order, OrderItem, Address, CompanyInfo, Promotion
from receipts.models import Receipt
import logging
from decimal import Decimal
from .utils.currency import currency_formatter
from users.constants import PermissionConstants
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
    sales_rep_name = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.all(), source='customer'
    )
    items = OrderItemSerializer(many=True)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    previous_status = serializers.CharField(read_only=True)
    invoice = InvoiceSerializer(read_only=True)
    sales_rep = serializers.PrimaryKeyRelatedField(read_only=True)
    qr_scanned_items = serializers.JSONField(read_only=True)

    def get_sales_rep_name(self, obj):
        if obj.sales_rep:
            first_name = obj.sales_rep.first_name or ''
            last_name = obj.sales_rep.last_name or ''
            full_name = f"{first_name} {last_name}".strip()
            return full_name or obj.sales_rep.username
        return "N/A"

    def get_customer_name(self, obj):
        if obj.customer and obj.customer.user:
            return f"{obj.customer.user.first_name} {obj.customer.user.last_name}"
        return "N/A"

    class Meta:
        model = Order
        fields = [
            'id', 'customer', 'customer_id', 'customer_name', 'order_date', 'user', 'shipped_date', 'is_paid', 'is_shipped',
            'items', 'created', 'modified', 'status', 'total_price', 'previous_status', 'sales_rep', 'sales_rep_name',
            'special_instructions', 'invoice', 'transaction_category', 'qr_scanned_items'
        ]
        read_only_fields = ['id', 'user', 'sales_rep', 'qr_scanned_items']

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
        if not user.has_role_permission(PermissionConstants.ORDER_CREATE):
            raise serializers.ValidationError({
                'permission': 'You do not have permission to create or modify orders.'
            })

    def _validate_order_status_change(self, user, data):
        if 'status' in data:
            if not user.has_role_permission(PermissionConstants.ORDER_EDIT):
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
        user = validated_data.get('user')

        # Save the order and related items in one transaction
        order = Order.objects.create(**validated_data)
        logger.info(f"Initial order {order.id} created")

        total_amount = Decimal('0')
    
        for item_data in items_data:
            order_item = OrderItem.objects.create(order=order, **item_data)
            total_amount += order_item.quantity * order_item.unit_price

            StockAdjustment.objects.create(
                product=order_item.product,
                quantity=-order_item.quantity,
                adjusted_by=user,
                adjustment_type='REMOVE',
                reason=f"Order #{order.id} - Item: {order_item.product.name}"
            )
            logger.info(f"Created stock adjustment for order {order.id}, item {order_item.product.name}")

        # Create invoice in this transaction
        invoice = order.create_invoice()
    
        if order.status in ['shipped', 'delivered']:
            self._create_transaction(order, user)
    
        # After the transaction completes, create the receipt in a separate transaction
        if invoice:
            try:
                # This is intentionally outside the main transaction
                receipt = order.create_receipt_for_invoice(invoice)
                if receipt:
                    logger.info(f"Created receipt {receipt.receipt_number} for order {order.id}")
                else:
                    logger.warning(f"No receipt created for order {order.id}")
            except Exception as e:
                logger.error(f"Exception creating receipt for order {order.id}: {str(e)}")

        order.refresh_from_db()
        return order

    def _create_transaction(self, order, user):
        logger.info(f"Creating transaction for order {order.id}")
        try:
            if not user.has_role_permission(PermissionConstants.TRANSACTION_CREATE):
                logger.error(f"User {user.username} does not have permission to create transactions")
                raise PermissionDenied("User does not have permission to create transactions")

            transaction = Transaction.objects.create(
                order=order,
                customer=order.customer,
                transaction_type='income',
                amount=order.total_price,
                date=order.shipped_date or order.order_date,
                payment_method='other',
                status='completed',
                category='income',
                created_by=user
            )
            logger.info(f"Successfully created transaction {transaction.id} for order {order.id}")
            return transaction
        except Exception as e:
            logger.error(f"Failed to create transaction for order {order.id}: {str(e)}")
            raise ValidationError(f"Failed to create transaction: {str(e)}")

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
        pass

    def to_representation(self, instance):
        from invoices.serializers import InvoiceSerializer
        representation = super().to_representation(instance)
        representation['total_price'] = currency_formatter.format_currency(instance.total_price)
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
