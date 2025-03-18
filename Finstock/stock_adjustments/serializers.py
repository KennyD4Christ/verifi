from rest_framework import serializers
from .models import StockAdjustment
from products.models import Product
from products.serializers import ProductSerializer
from django.urls import reverse

class StockAdjustmentSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source='product', required=False
    )
    adjustment_date = serializers.DateField(format="%Y-%m-%d")
    qr_code = serializers.SerializerMethodField()
    qr_code_url = serializers.SerializerMethodField()

    class Meta:
        model = StockAdjustment
        fields = ['id', 'product', 'product_id', 'quantity', 'adjustment_type', 'adjustment_date', 'reason', 'qr_code_url', 'qr_code_data', 'qr_code']

    def get_qr_code(self, obj):
        if obj.qr_code:
            request = self.context.get('request')
            return request.build_absolute_uri(reverse('stockadjustment-qr-code', 
                                                    kwargs={'pk': obj.pk}))
        return None
        
    def get_qr_code_url(self, obj):
        if obj.qr_code:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.qr_code.url)
        return None

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
