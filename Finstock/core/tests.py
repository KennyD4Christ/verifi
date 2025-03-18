from django.test import TestCase
from .models import Address


class AddressModelTest(TestCase):
    """
    Tests that an Address object can be created with specific field values
    """
    def setUp(self):
        self.address = Address.objects.create(
            street='123 Main St',
            city='Anytown',
            state='Anystate',
            postal_code='12345',
            country='Anycountry'
        )

    def test_address_creation(self):
        self.assertEqual(self.address.street, '123 Main St')
        self.assertEqual(self.address.city, 'Anytown')
        self.assertEqual(self.address.state, 'Anystate')
        self.assertEqual(self.address.postal_code, '12345')
        self.assertEqual(self.address.country, 'Anycountry')
