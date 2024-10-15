from django.test import TestCase
from .models import Transaction
from core.models import Customer, Order, Invoice


class TransactionModelTest(TestCase):
    """
    This class defines a unit test for the Transaction model.
    """

    def setUp(self):
        """
        This method sets up the test data used by the test case.
        """
        self.customer = Customer.objects.create(
            first_name='John',
            last_name='Doe',
            email='john@example.com'
        )
        self.order = Order.objects.create(
            customer=self.customer,
            order_date='2023-01-01'
        )
        self.invoice = Invoice.objects.create(
            customer=self.customer,
            invoice_number='INV-0001',
            issue_date='2023-01-01',
            due_date='2023-01-15',
            paid=False
        )
        self.transaction = Transaction.objects.create(
            order=self.order,
            invoice=self.invoice,
            customer=self.customer,
            transaction_type='income',
            category='salary',
            amount=1000.00,
            date='2023-01-01',
            payment_method='bank_transfer',
            status='completed'
        )

    def test_transaction_creation(self):
        """
        This test case verifies the creation of a Transaction object.
        """
        self.assertEqual(self.transaction.order, self.order)
        self.assertEqual(self.transaction.invoice, self.invoice)
        self.assertEqual(self.transaction.customer, self.customer)
        self.assertEqual(self.transaction.transaction_type, 'income')
        self.assertEqual(self.transaction.category, 'salary')
        self.assertEqual(self.transaction.amount, 1000.00)
        self.assertEqual(self.transaction.date, '2023-01-01')
        self.assertEqual(self.transaction.payment_method, 'bank_transfer')
        self.assertEqual(self.transaction.status, 'completed')
