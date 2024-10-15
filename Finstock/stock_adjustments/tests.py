from django.test import TestCase
from django.utils import timezone
from .models import StockAdjustment

class StockAdjustmentTestCase(TestCase):
    def setUp(self):
        self.adjustment = StockAdjustment.objects.create(
            description="Test adjustment",
            adjustment_date=timezone.now(),
            quantity=10,
        )

    def test_stock_adjustment_creation(self):
        self.assertEqual(self.adjustment.description, "Test adjustment")
        self.assertTrue(self.adjustment.adjustment_date)
        self.assertEqual(self.adjustment.quantity, 10)

    def test_stock_adjustment_str(self):
        self.assertEqual(str(self.adjustment), "Test adjustment")

    def test_stock_adjustment_default_status(self):
        self.assertEqual(self.adjustment.status, "pending")
