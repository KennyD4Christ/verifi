from django.test import TestCase
from django.urls import reverse
from django.contrib.contenttypes.models import ContentType
from django.conf import settings
from rest_framework import status
from users.models import CustomUser, Role, Permission
from users.constants import PermissionConstants
from products.models import Product, Category
from core.models import Customer, Order, Address
import json
import qrcode
from io import BytesIO
import base64

class QRCodeTestUtility:
    @staticmethod
    def generate_test_qr(product_data):
        """Generate a QR code for testing"""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(json.dumps(product_data))
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode()

class QRCodeIntegrationTests(TestCase):
    def setUp(self):
        print("\nDEBUG: Setting up test case")
        
        # Create Category and Product
        self.category = Category.objects.create(name='Test Category')
        self.product = Product.objects.create(
            name='Test Product',
            sku='TEST123',
            price=99.99,
            stock=100,
            category=self.category
        )
        
        # Create test user for customer
        self.customer_user = CustomUser.objects.create_user(
            username='customeruser',
            password='customerpass123',
            email='customer@test.com'
        )
        
        # Create Customer with proper fields
        self.customer = Customer.objects.create(
            user=self.customer_user,
            first_name='Test',
            last_name='Customer',
            email='customer@test.com',
            phone='1234567890'
        )

        # Create Custom Permission
        self.view_permission = Permission.objects.create(
            name=PermissionConstants.PRODUCT_VIEW,
            is_active=True
        )

        # Create Role with Permission
        self.sales_role = Role.objects.create(
            name='Sales Representative',
            is_active=True
        )
        self.sales_role.permissions.add(self.view_permission)

        # Create User with Role (Sales Representative)
        self.user = CustomUser.objects.create_user(
            username='testuser',
            password='testpass123',
            email='test@example.com'
        )
        self.user.roles.add(self.sales_role)

        # Authenticate the client
        self.client.force_login(self.user)

        # Debug information
        print(f"DEBUG: User roles: {list(self.user.roles.all())}")
        print(f"DEBUG: Role permissions: {list(self.sales_role.permissions.all())}")
        print(f"DEBUG: User permissions: {list(self.user.get_permissions())}")

    def test_qr_code_scanning(self):
        product_data = {
            "id": self.product.id,
            "sku": self.product.sku,
            "name": self.product.name,
            "price": str(self.product.price)
        }

        qr_code = QRCodeTestUtility.generate_test_qr(product_data)

        response = self.client.post(
            reverse('product-qr-scan', kwargs={'pk': self.product.id}),
            {
                'qr_data': qr_code,
                'customer_id': self.customer.id,
                'quantity': 1
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('order_id', response.data)

        order = Order.objects.get(id=response.data['order_id'])
        self.assertEqual(order.customer, self.customer)
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.first().product, self.product)

    def test_invalid_product_scan(self):
        response = self.client.post(
            reverse('product-qr-scan', kwargs={'pk': 999}),
            {'quantity': 1},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_qr_scan_without_permission(self):
        # Remove permission and verify access is denied
        self.sales_role.permissions.remove(self.view_permission)
        
        response = self.client.post(
            reverse('product-qr-scan', kwargs={'pk': self.product.id}),
            {
                'customer_id': self.customer.id,
                'quantity': 1
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
