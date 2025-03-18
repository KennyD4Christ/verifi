# transactions/tests/test_qr_integration.py
from decimal import Decimal
from django.test import TestCase
from django.core.files.base import ContentFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
import json
from ..models import Transaction, TransactionQRCode
from core.models import Order, OrderItem, Customer
from products.models import Product, Category

User = get_user_model()

class TransactionQRCodeModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )

        self.customer = Customer.objects.create(
            first_name='Test',
            last_name='Customer',
            email='test@example.com'
        )

        self.category = Category.objects.create(
            name='Test Category',
            description='Test category description'
        )

        self.product = Product.objects.create(
            name='Test Product',
            sku='TEST123',
            price=Decimal('100.00'),
            stock=10,
            low_stock_threshold=5,
            category=self.category,
            description='Test product description'
        )

        self.order = Order.objects.create(
            sales_rep=self.user,
            customer=self.customer,
            user=self.user,
            status='pending',
            transaction_category='income',
            qr_scanned_items=[]
        )

        product_data = {
            'id': self.product.id,
            'sku': self.product.sku,
            'price': str(self.product.price)
        }
        self.order.add_scanned_item(product_data, quantity=2)

        self.transaction = Transaction.objects.create(
            order=self.order,
            customer=self.customer,
            transaction_type='income',
            created_by=self.user,
            amount=Decimal('200.00'),
            date=timezone.now().date(),
            payment_method='cash',
            status='pending'
        )

class TransactionQRCodeAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            is_staff=True,
            first_name='Test',
            last_name='User'
        )
        self.client.force_authenticate(user=self.user)

        self.customer = Customer.objects.create(
            first_name='Test',
            last_name='Customer',
            email='test@example.com'
        )

        self.category = Category.objects.create(
            name='Test Category',
            description='Test category description'
        )

        self.product = Product.objects.create(
            name='Test Product',
            sku='TEST123',
            price=Decimal('100.00'),
            stock=10,
            low_stock_threshold=5,
            category=self.category,
            description='Test product description'
        )

        self.order = Order.objects.create(
            sales_rep=self.user,
            customer=self.customer,
            user=self.user,
            status='pending',
            transaction_category='income',
            qr_scanned_items=[]
        )

    def test_transaction_creation_with_scanned_items(self):
        product_data = {
            'id': self.product.id,
            'sku': self.product.sku,
            'price': str(self.product.price)
        }

        # Test the API endpoint using the full path
        url = f'/api/core/orders/{self.order.id}/add-scanned-item/'
        data = {
            'product_data': product_data,
            'quantity': 2
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify the response structure
        self.assertIn('message', response.data)
        self.assertIn('order_id', response.data)
        self.assertIn('scanned_items', response.data)

        # Create transaction from order
        transaction = Transaction.create_from_order(self.order)

        self.assertTrue(hasattr(transaction, 'qr_code'))
        qr_data = json.loads(transaction.qr_code.generate_qr_data())

        self.assertIn('scanned_items', qr_data)
        scanned_item = qr_data['scanned_items'][0]
        self.assertEqual(scanned_item['product_id'], self.product.id)
        self.assertEqual(scanned_item['sku'], self.product.sku)
        self.assertEqual(scanned_item['quantity'], 2)
