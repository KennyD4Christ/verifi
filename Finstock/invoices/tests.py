from django.test import TestCase
from .models import Invoice, InvoiceItem
from core.models import Customer


class InvoiceModelTest(TestCase):
    """
    This class defines unit tests for the Invoice and InvoiceItem models.
    """

    def setUp(self):
        """
        This method sets up the test data used by the test cases.
        """
        self.customer = Customer.objects.create(
            first_name='John',
            last_name='Doe',
            email='john@example.com'
        )
        self.invoice = Invoice.objects.create(
            customer=self.customer,
            invoice_number='INV-0001',
            issue_date='2023-01-01',
            due_date='2023-01-15',
            paid=False
        )
        self.invoice_item = InvoiceItem.objects.create(
            invoice=self.invoice,
            description='Test Item',
            quantity=2,
            unit_price=50.00
        )

    def test_invoice_creation(self):
        """
        This test case verifies the creation of an Invoice object.
        """
        self.assertEqual(self.invoice.customer, self.customer)
        self.assertEqual(self.invoice.invoice_number, 'INV-0001')
        self.assertEqual(self.invoice.issue_date, '2023-01-01')
        self.assertEqual(self.invoice.due_date, '2023-01-15')
        self.assertFalse(self.invoice.paid)

    def test_invoice_item_creation(self):
        """
        This test case verifies the creation of an InvoiceItem object.
        """
        self.assertEqual(self.invoice_item.invoice, self.invoice)
        self.assertEqual(self.invoice_item.description, 'Test Item')
        self.assertEqual(self.invoice_item.quantity, 2)
        self.assertEqual(self.invoice_item.unit_price, 50.00)
        self.assertEqual(self.invoice_item.total_price(), 100.00)
