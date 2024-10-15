from django.test import TestCase
from django.contrib.auth import get_user_model
from .models import Role, Permission


class UserTests(TestCase):
    """
    This test suite defines unit tests for the User model and
    related functionalities.
    """

    def test_create_user(self):
        """
        Tests the creation of a regular user with the User
        model's create_user method.
        """
        User = get_user_model()
        user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')
        self.assertEqual(user.username, 'testuser')
        self.assertEqual(user.email, 'test@example.com')
        self.assertTrue(user.check_password('testpass123'))

    def test_create_superuser(self):
        """
        Tests the creation of a superuser with the User
        model's create_superuser method.
        """
        User = get_user_model()
        admin_user = User.objects.create_superuser(username='admin', email='admin@example.com', password='adminpass123')
        self.assertEqual(admin_user.username, 'admin')
        self.assertEqual(admin_user.email, 'admin@example.com')
        self.assertTrue(admin_user.is_staff)
        self.assertTrue(admin_user.is_superuser)

    def test_role_creation(self):
        """
        Tests the creation of a Role model instance.
        """
        role = Role.objects.create(name='Manager', description='Can manage resources')
        self.assertEqual(role.name, 'Manager')
        self.assertEqual(role.description, 'Can manage resources')

    def test_permission_creation(self):
        """
        Tests the creation of a Permission model instance.
        """
        permission = Permission.objects.create(name='can_view_all_products', description='Can view all products')
        self.assertEqual(permission.name, 'can_view_all_products')
        self.assertEqual(permission.description, 'Can view all products')
