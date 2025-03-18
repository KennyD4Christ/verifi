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
    qr_code_url = serializers.SerializerMethodField()
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
        fields = ['id', 'name', 'description', 'price', 'sku', 'stock', 'sales', 'category', 'category_id', 'images', 'reviews', 'low_stock_threshold', 'qr_code', 'qr_code_url']
        ref_name = 'ProductSerializer'

    def get_qr_code_url(self, obj):
        if obj.qr_code:
            return self.context['request'].build_absolute_uri(obj.qr_code.url)
        return None

    def validate_low_stock_threshold(self, value):
        """
        Validate the low stock threshold value during serialization.

        Args:
            value (int): Proposed low stock threshold value

        Returns:
            int: Validated low stock threshold

        Raises:
            serializers.ValidationError: If threshold is invalid
        """
        if value < 0:
            raise serializers.ValidationError("Low stock threshold cannot be negative.")

        if value > 1000:  # Optional: Set a reasonable maximum threshold
            raise serializers.ValidationError("Low stock threshold cannot exceed 1000 units.")

        return value

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
        instance.low_stock_threshold = validated_data.get('low_stock_threshold', instance.low_stock_threshold)
        instance.sales = validated_data.get('sales', instance.sales)
        instance.category = validated_data.pop('category', instance.category)
        instance.save()
        return instance
