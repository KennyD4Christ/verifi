from rest_framework import serializers
from .models import StockAdjustment
from products.models import Product
from products.serializers import ProductSerializer

class StockAdjustmentSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source='product', required=False
    )
    adjustment_date = serializers.DateField(format="%Y-%m-%d")

    class Meta:
        model = StockAdjustment
        fields = ['id', 'product', 'product_id', 'quantity', 'adjustment_type', 'adjustment_date', 'reason']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['product'] = {
            'id': instance.product.id,
            'name': instance.product.name,
            'stock': instance.product.stock
        }
        return representation

    def create(self, validated_data):
        product_id = self.initial_data.get('product')
        if product_id and not validated_data.get('product'):
            product = Product.objects.get(id=product_id)
            validated_data['product'] = product
        return super().create(validated_data)
