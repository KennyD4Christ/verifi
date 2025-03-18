from rest_framework import serializers
from .models import Invoice, InvoiceItem
from core.models import Customer
from products.models import Product
from core.serializers import CustomerSerializer


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'price']


class InvoiceItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), write_only=True, source='product')

    class Meta:
        model = InvoiceItem
        fields = ['id', 'product', 'product_id', 'description', 'quantity', 'unit_price', 'total_price']
        read_only_fields = ['description', 'unit_price', 'total_price']

    def create(self, validated_data):
        product = validated_data.pop('product')
        invoice_item = InvoiceItem.objects.create(product=product, **validated_data)
        return invoice_item

class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True)
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    invoice_number = serializers.UUIDField(read_only=True)
    customer = CustomerSerializer(read_only=True)
    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.all(),
        source='customer',
        write_only=True,
        required=False,
        allow_null=True
    )
    status = serializers.ChoiceField(choices=Invoice.status.field.choices, required=True)
    qr_code = serializers.ImageField(read_only=True)

    class Meta:
        model = Invoice
        fields = ['id', 'user', 'customer', 'customer_id', 'invoice_number', 'issue_date', 'due_date', 'status', 'items', 'total_amount', 'qr_code']
        read_only_fields = ['total_amount', 'user', 'invoice_number', 'qr_code']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        customer = validated_data.pop('customer', None)
        invoice = Invoice.objects.create(customer=customer, **validated_data)
        
        for item_data in items_data:
            InvoiceItem.objects.create(invoice=invoice, **item_data)
        
        invoice.update_total_amount()
        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        customer = validated_data.pop('customer', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        if customer is not None:
            instance.customer = customer
        
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                InvoiceItem.objects.create(invoice=instance, **item_data)
        
        instance.update_total_amount()
        return instance

    def validate(self, data):
        if 'items' not in data or not data['items']:
            raise serializers.ValidationError({"items": "At least one item is required."})
        return data
