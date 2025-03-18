from django.test import TestCase
from django.core.files.base import ContentFile
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from django.contrib.auth.models import Permission
from users.constants import PermissionConstants
from django.test import TransactionTestCase
from django.contrib.contenttypes.models import ContentType
from users.models import Role
from rest_framework import status
from .models import Invoice
from core.models import Customer
from datetime import date
import time
import datetime
from django.utils import timezone
from django.db import transaction
import logging
import json

logger = logging.getLogger(__name__)

class InvoiceQRCodeTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.customer = Customer.objects.create(
            first_name='John',
            last_name='Doe',
            email='john.doe@example.com',
            phone='1234567890'
        )
        self.invoice = Invoice.objects.create(
            user=self.user,
            customer=self.customer,
            issue_date=date.today(),
            due_date=date.today(),
            status='draft'
        )

    def test_qr_code_generation(self):
        self.assertIsNotNone(self.invoice.qr_code)
        self.assertTrue(self.invoice.qr_code.name.startswith('invoice_qr_'))
        self.assertTrue(self.invoice.qr_code.name.endswith('.png'))

    def test_qr_code_content(self):
        self.invoice.generate_qr_code()
        self.assertTrue(self.invoice.qr_code.storage.exists(self.invoice.qr_code.name))

    def test_qr_code_update(self):
        original_qr_code = self.invoice.qr_code.name
        self.invoice.status = 'sent'
        self.invoice.save()
        self.assertEqual(original_qr_code, self.invoice.qr_code.name)


class InvoiceAPIQRCodeTests(TransactionTestCase):
    def setUp(self):
        logger.info("Starting test setup")

        try:
            self.content_type = ContentType.objects.get_for_model(Invoice)
            
            # Simplified permission setup similar to StockAdjustment
            self.permissions = {}
            for permission_name in ['view_invoice', 'add_invoice', 'change_invoice', 'delete_invoice']:
                permission = Permission.objects.get_or_create(
                    content_type=self.content_type,
                    codename=permission_name,
                    defaults={'name': f'Can {permission_name.split("_")[0]} invoice'}
                )[0]
                self.permissions[permission_name] = permission

            # Use a static role name with get_or_create
            self.role = Role.objects.get_or_create(
                name='Invoice Manager Test',
                defaults={
                    'description': 'Test invoice management role',
                    'is_active': True
                }
            )[0]

            # Create test user with a static, predictable name
            username = f'invoice_test_user_{timezone.now().strftime("%H%M%S")}'
            self.user = get_user_model().objects.create_user(
                username=username,
                email=f'{username}@example.com',
                password='testpass123',
                is_active=True
            )

            # Rest of your setup remains the same
            self.user.roles.add(self.role)
            
            for permission in self.permissions.values():
                self.role.permissions.add(permission)

            self.customer = Customer.objects.create(
                first_name='John',
                last_name='Doe',
                email=f'john.doe_{timezone.now().strftime("%H%M%S")}@example.com',
                phone='1234567890'
            )

            self.client = APIClient()
            self.client.force_authenticate(user=self.user)

            self.invoice_data = {
                'customer_id': self.customer.id,
                'issue_date': '2025-02-15',
                'due_date': '2025-03-15',
                'status': 'draft',
                'items': []
            }
            
            logger.info("Test setup completed successfully")

        except Exception as e:
            logger.error(f"Setup failed: {str(e)}")
            self.tearDown()
            raise

    def tearDown(self):
        logger.info("Starting test cleanup")
        
        try:
            if hasattr(self, 'customer'):
                self.customer.delete()
                logger.info("Customer deleted")

            if hasattr(self, 'user'):
                self.user.roles.clear()
                self.user.delete()
                logger.info("User and role associations deleted")

            if hasattr(self, 'role'):
                self.role.permissions.clear()
                self.role.delete()
                logger.info("Role and permission associations deleted")

            logger.info("Cleanup completed successfully")

        except Exception as e:
            logger.error(f"Cleanup failed: {str(e)}")
            raise

    def id(self):
        """Generate a unique identifier for test resources"""
        return f"{self._testMethodName}_{id(self)}"

    def test_invoice_creation_with_qr(self):
        logger.info("Starting invoice creation test")
        url = reverse('invoice-list')
        
        try:
            response = self.client.post(url, self.invoice_data, format='json')
            logger.info(f"Invoice creation response status: {response.status_code}")
            
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertIn('qr_code', response.data)
            self.assertIsNotNone(response.data['qr_code'])
            
            logger.info("Invoice creation test completed successfully")
        except Exception as e:
            logger.error(f"Invoice creation test failed: {str(e)}")
            raise

    def test_invoice_retrieval_with_qr(self):
        logger.info("Starting invoice retrieval test")
        
        try:
            invoice = Invoice.objects.create(
                user=self.user,
                customer=self.customer,
                issue_date='2025-02-15',
                due_date='2025-03-15',
                status='draft'
            )
            logger.info(f"Test invoice created with ID: {invoice.id}")

            url = reverse('invoice-detail', kwargs={'pk': invoice.pk})
            response = self.client.get(url)
            
            logger.info(f"Invoice retrieval response status: {response.status_code}")
            
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn('qr_code', response.data)
            self.assertIsNotNone(response.data['qr_code'])
            
            logger.info("Invoice retrieval test completed successfully")
        except Exception as e:
            logger.error(f"Invoice retrieval test failed: {str(e)}")
            raise

    def test_invoice_permissions(self):
        logger.info("Starting invoice permissions test")
        url = reverse('invoice-list')
        
        try:
            # Clear permissions and test forbidden access
            self.role.permissions.clear()
            logger.info("Cleared role permissions")
            
            response = self.client.post(url, self.invoice_data, format='json')
            logger.info(f"Permission denied response status: {response.status_code}")
            
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

            # Add permission and test successful access
            self.role.permissions.add(self.permissions['add_invoice'])
            logger.info("Added invoice creation permission")
            
            response = self.client.post(url, self.invoice_data, format='json')
            logger.info(f"Permission granted response status: {response.status_code}")
            
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            
            logger.info("Permission test completed successfully")
        except Exception as e:
            logger.error(f"Permission test failed: {str(e)}")
            raise
