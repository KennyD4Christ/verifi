from rest_framework import serializers
from .models import Transaction
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
import logging

logger = logging.getLogger(__name__)

class TransactionSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(0.01)]
    )

    class Meta:
        model = Transaction
        fields = '__all__'
        ref_name = 'TransactionSerializer'

    def validate(self, data):
        # Simpler checks that don't require database queries
        if data.get('transaction_type') not in dict(Transaction.TRANSACTION_TYPES):
            raise serializers.ValidationError("Invalid transaction type")

        if data.get('status') not in dict(Transaction.TRANSACTION_STATUSES):
            raise serializers.ValidationError("Invalid status")

        if data.get('payment_method') not in dict(Transaction.PAYMENT_METHODS):
            raise serializers.ValidationError("Invalid payment method")

        if data.get('category') and data['category'] not in dict(Transaction.CATEGORY_CHOICES):
            raise serializers.ValidationError("Invalid category")

        return data

    def create(self, validated_data):
        logger.info(f"Creating transaction with data: {validated_data}")
        try:
            return super().create(validated_data)
        except ValidationError as e:
            logger.error(f"Validation error in create: {str(e)}")
            raise serializers.ValidationError(str(e))
        except Exception as e:
            logger.error(f"Unexpected error in create: {str(e)}")
            raise

    def update(self, instance, validated_data):
        try:
            return super().update(instance, validated_data)
        except ValidationError as e:
            raise serializers.ValidationError(str(e))
