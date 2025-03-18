from rest_framework import serializers
from .models import Receipt
from invoices.serializers import InvoiceItemSerializer
from invoices.models import InvoiceItem
import logging

logger = logging.getLogger(__name__)

class ReceiptSerializer(serializers.ModelSerializer):
    invoice_number = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    
    class Meta:
        model = Receipt
        fields = [
            'id', 'receipt_number', 'invoice', 'invoice_number', 
            'customer_name', 'payment_date', 'payment_method',
            'payment_reference', 'amount_paid', 'notes', 'qr_code',
            'created', 'modified', 'items'
        ]
        read_only_fields = ['receipt_number', 'qr_code']
    
    def get_invoice_number(self, obj):
        return str(obj.invoice.invoice_number)
    
    def get_customer_name(self, obj):
        if obj.invoice.customer:
            return f"{obj.invoice.customer.first_name} {obj.invoice.customer.last_name}"
        return obj.user.username

    def get_items(self, obj):
        if obj.invoice:
            items = InvoiceItem.objects.filter(invoice=obj.invoice)
            serialized_items = InvoiceItemSerializer(items, many=True).data
            logger.info(f"Found {len(serialized_items)} items for invoice {obj.invoice.id}")
            return serialized_items
        logger.warning(f"No invoice found for receipt {obj.id}")
        return []
        
    def validate(self, data):
        # Ensure the amount_paid matches the invoice total_amount
        invoice = data.get('invoice')
        amount_paid = data.get('amount_paid')

        if invoice and amount_paid and amount_paid != invoice.total_amount:
            raise serializers.ValidationError(
                "Amount paid must match the invoice total amount."
            )
            
        # Add validation to check for existing receipt
        if invoice and Receipt.objects.filter(invoice=invoice).exists():
            raise serializers.ValidationError({
                "invoice": f"A receipt already exists for invoice {invoice.invoice_number}. Please select a different invoice."
            })

        return data   

    def create(self, validated_data):
        # Set amount_paid to invoice total if not provided
        if 'amount_paid' not in validated_data:
            validated_data['amount_paid'] = validated_data['invoice'].total_amount
            
        return super().create(validated_data)

class ReceiptDetailSerializer(ReceiptSerializer):
    invoice_items = serializers.SerializerMethodField()
    
    class Meta(ReceiptSerializer.Meta):
        fields = ReceiptSerializer.Meta.fields + ['invoice_items']
    
    def get_invoice_items(self, obj):
        if obj.invoice:
            return InvoiceItemSerializer(obj.invoice.items.all(), many=True).data
        return []
