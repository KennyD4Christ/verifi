from rest_framework import serializers
from products.models import Product
from transactions.models import Transaction

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'sales', 'category']


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['id', 'order', 'invoice', 'customer', 'transaction_type', 'category', 'amount', 'date', 'payment_method', 'status']
