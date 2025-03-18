from django.core.management.base import BaseCommand
from products.models import Product
from django.db import connection

class Command(BaseCommand):
    help = 'Check existing products and database connection'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS(f'Database: {connection.settings_dict["NAME"]}'))
        products = Product.objects.all()
        self.stdout.write(self.style.SUCCESS(f'Products: {list(products.values("id", "name", "price"))}'))
        self.stdout.write(self.style.SUCCESS(f'Raw SQL query: {products.query}'))
