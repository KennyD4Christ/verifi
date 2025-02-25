from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from .models import StockAdjustment
from users.constants import PermissionConstants
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from users.models import Role, CustomUser
from products.models import Product, Category
from django.core.files.temp import NamedTemporaryFile
from PIL import Image
import time
import datetime
from django.utils import timezone
from io import BytesIO
import json
import base64
import qrcode
from decimal import Decimal

User = get_user_model()

class BaseTestCase:
    """Base test case with common setup methods"""
    def create_test_data(self):
        # Create test category
        self.category = Category.objects.create(
            name='Test Category',
            description='Test Category Description'
        )
        
        # Create test product with exact fields from your model
        self.product = Product.objects.create(
            name='Test Product',
            description='Test Product Description',
            category=self.category,
            price=Decimal('10.00'),
            stock=100,
            sku='TEST-SKU-001',
            is_active=True,
            low_stock_threshold=10
        )

    def cleanup_test_data(self):
        if hasattr(self, 'adjustment') and self.adjustment.qr_code:
            self.adjustment.qr_code.delete()
        if hasattr(self, 'product'):
            self.product.delete()
        if hasattr(self, 'category'):
            self.category.delete()

class StockAdjustmentQRCodeTestCase(TestCase, BaseTestCase):
    @classmethod
    def setUpTestData(cls):
        # Set up non-modified data used by all test methods
        cls.user = User.objects.create_superuser(
            username='testadmin',
            email='testadmin@example.com',
            password='testpass123'
        )

    def setUp(self):
        self.create_test_data()
        
        self.adjustment = StockAdjustment.objects.create(
            product=self.product,
            quantity=10,
            adjusted_by=self.user,
            adjustment_type='ADD',
            reason='Test adjustment'
        )

    def tearDown(self):
        self.cleanup_test_data()

    def test_qr_code_generation(self):
        """Test if QR code is generated automatically"""
        self.assertIsNotNone(self.adjustment.qr_code)
        self.assertIsNotNone(self.adjustment.qr_code_data)
        
        expected_data = {
            'adjustment_id': str(self.adjustment.id),
            'product_id': str(self.product.id),
            'product_name': self.product.name,
            'quantity': self.adjustment.quantity,
            'adjustment_type': self.adjustment.adjustment_type,
            'adjustment_date': self.adjustment.adjustment_date.strftime('%Y-%m-%d')
        }
        self.assertEqual(self.adjustment.qr_code_data, expected_data)

    def test_qr_code_image_format(self):
        """Test if the generated QR code is a valid image"""
        try:
            Image.open(self.adjustment.qr_code)
            is_valid_image = True
        except Exception:
            is_valid_image = False
        
        self.assertTrue(is_valid_image)

    def test_qr_code_update(self):
        """Test if QR code updates when adjustment details change"""
        # Store initial QR code data
        initial_qr_data = self.adjustment.qr_code_data.copy()
        initial_qr_name = self.adjustment.qr_code.name
        
        # Force a delay to ensure different timestamp in filename
        time.sleep(1)
        
        # Update adjustment
        self.adjustment.quantity = 20
        self.adjustment.save()
        
        # Refresh from database to ensure we have latest data
        self.adjustment.refresh_from_db()
        
        # Verify QR code has been updated
        self.assertNotEqual(initial_qr_name, self.adjustment.qr_code.name)
        self.assertNotEqual(initial_qr_data, self.adjustment.qr_code_data)
        self.assertEqual(self.adjustment.qr_code_data['quantity'], 20)

class StockAdjustmentAPITestCase(APITestCase, BaseTestCase):
    def setUp(self):
        self.client = APIClient()
        
        self.user = User.objects.create_superuser(
            username='testadmin',
            email='testadmin@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        self.create_test_data()
        
        self.adjustment = StockAdjustment.objects.create(
            product=self.product,
            quantity=10,
            adjusted_by=self.user,
            adjustment_type='ADD',
            reason='Test adjustment',
            adjustment_date=timezone.now().date()
        )
        
        self.qr_code_url = f'/api/stock_adjustments/stock_adjustments/{self.adjustment.pk}/qr_code/'
        self.scan_qr_url = f'/api/stock_adjustments/stock_adjustments/{self.adjustment.pk}/scan_qr/'

    def tearDown(self):
        self.cleanup_test_data()
        self.user.delete()

    def test_qr_code_endpoint(self):
        """Test QR code image endpoint"""
        response = self.client.get(self.qr_code_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['content-type'], 'image/png')

    def test_scan_qr_endpoint(self):
        """Test QR code data endpoint"""
        response = self.client.get(self.scan_qr_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        expected_data = {
            'adjustment_id': str(self.adjustment.id),
            'product_id': str(self.product.id),
            'product_name': self.product.name,
            'quantity': self.adjustment.quantity,
            'adjustment_type': self.adjustment.adjustment_type,
            'adjustment_date': self.adjustment.adjustment_date.strftime('%Y-%m-%d')
        }
        self.assertEqual(response.data, expected_data)

    def test_create_adjustment_with_qr(self):
        """Test QR code generation when creating new adjustment"""
        url = '/api/stock_adjustments/stock_adjustments/'
        data = {
            'product': self.product.id,
            'quantity': 15,
            'adjustment_type': 'ADD',
            'reason': 'New test adjustment',
            'adjustment_date': timezone.now().date().isoformat()
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('qr_code_url', response.data)
        self.assertIn('qr_code_data', response.data)
        self.assertTrue(response.data['qr_code_url'].startswith('http://testserver/media/'))

class StockAdjustmentPermissionTestCase(APITestCase, BaseTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()

        cls.category = Category.objects.create(
            name='Test Category',
            description='Test Category Description'
        )

        cls.product = Product.objects.create(
            name='Test Product',
            description='Test Description',
            price=Decimal('10.00'),
            sku='TEST-SKU-001',
            stock=100,
            category=cls.category,
            low_stock_threshold=10
        )

    def setUp(self):
        super().setUp()

        self.client = APIClient()

        # Create the user
        self.regular_user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )

        # Create the role
        self.inventory_manager_role = Role.objects.get_or_create(
            name='Inventory Manager',
            defaults={'description': 'Role for managing inventory'}
        )[0]

        # Get or create the actual Django permission
        content_type = ContentType.objects.get_for_model(StockAdjustment)
        view_permission = Permission.objects.get_or_create(
            codename='view_adjustment',
            content_type=content_type,
            defaults={'name': 'Can view stock adjustment'}
        )[0]

        # Add the permission to the role
        self.inventory_manager_role.permissions.add(view_permission)

        # Add the role to the user
        self.regular_user.roles.add(self.inventory_manager_role)

        # Create the test adjustment
        self.adjustment = StockAdjustment.objects.create(
            product=self.product,
            quantity=10,
            adjustment_type='ADD',
            reason='Test adjustment',
            adjusted_by=self.regular_user,
            adjustment_date=timezone.now().date()
        )

        if hasattr(self.adjustment, 'generate_qr_code'):
            self.adjustment.generate_qr_code()

        self.qr_code_url = reverse(
            'stockadjustment-qr-code',
            kwargs={'pk': self.adjustment.pk}
        )
