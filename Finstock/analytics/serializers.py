from rest_framework import serializers
from products.models import Product
from transactions.models import Transaction
from stock_adjustments.serializers import StockAdjustmentSerializer

class ProductSerializer(serializers.ModelSerializer):

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'sales', 'category', 'stock', 'sku']


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['id', 'order', 'invoice', 'customer', 'transaction_type', 'category', 'amount', 'date', 'payment_method', 'status']
