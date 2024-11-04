from rest_framework import serializers
from .models import Product, Category, ProductImage, Review

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description']
        ref_name = 'CategorySerializer'

class TopProductSerializer(serializers.ModelSerializer):
    total_sales = serializers.IntegerField(read_only=True)
    total_revenue = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = Product
        fields = ['id', 'name', 'sku', 'price', 'total_sales', 'total_revenue']
    
    def get_total_revenue(self, obj):
        if obj.total_sales and obj.price:
            return float(obj.price) * obj.total_sales
        return 0

class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'product', 'image', 'alt_text']
        ref_name = 'ProductImageSerializer'

class ReviewSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Review
        fields = ['id', 'product', 'user', 'rating', 'comment', 'created_at']
        ref_name = 'ReviewSerializer'

class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category',
        write_only=True
    )
    images = ProductImageSerializer(many=True, read_only=True)
    reviews = ReviewSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'sku', 'stock', 'sales', 'category', 'category_id', 'images', 'reviews']
        ref_name = 'ProductSerializer'

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['product'] = representation['id']
        return representation

    def create(self, validated_data):
        category = validated_data.pop('category', None)
        product = Product.objects.create(**validated_data, category=category)
        return product

    def update(self, instance, validated_data):
        instance.name = validated_data.get('name', instance.name)
        instance.description = validated_data.get('description', instance.description)
        instance.price = validated_data.get('price', instance.price)
        instance.sku = validated_data.get('sku', instance.sku)
        instance.stock = validated_data.get('stock', instance.stock)
        instance.sales = validated_data.get('sales', instance.sales)
        instance.category = validated_data.pop('category', instance.category)
        instance.save()
        return instance
