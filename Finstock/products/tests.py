from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User

from .models import Product, Category, ProductImage, Review


class CategoryTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')

    def test_create_category(self):
        self.client.login(username='testuser', password='testpass')
        url = reverse('category-list')
        data = {'name': 'Electronics', 'description': 'Electronic items'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Category.objects.count(), 1)
        self.assertEqual(Category.objects.get().name, 'Electronics')

    def test_get_category_list(self):
        Category.objects.create(name='Electronics', description='Electronic items')
        url = reverse('category-list')
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)


class ProductTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.category = Category.objects.create(name='Electronics', description='Electronic items')
        self.client.login(username='testuser', password='testpass')

    def test_create_product(self):
        url = reverse('product-list')
        data = {
            'name': 'Laptop',
            'description': 'A high-end laptop',
            'price': '1500.00',
            'sku': 'LAP123',
            'stock': 50,
            'category': self.category.id
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Product.objects.count(), 1)
        self.assertEqual(Product.objects.get().name, 'Laptop')

    def test_get_product_list(self):
        Product.objects.create(name='Laptop', description='A high-end laptop', price='1500.00', sku='LAP123', stock=50, category=self.category)
        url = reverse('product-list')
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_get_product_detail(self):
        product = Product.objects.create(name='Laptop', description='A high-end laptop', price='1500.00', sku='LAP123', stock=50, category=self.category)
        url = reverse('product-detail', args=[product.id])
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Laptop')


class ProductImageTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.category = Category.objects.create(name='Electronics', description='Electronic items')
        self.product = Product.objects.create(name='Laptop', description='A high-end laptop', price='1500.00', sku='LAP123', stock=50, category=self.category)
        self.client.login(username='testuser', password='testpass')

    def test_create_product_image(self):
        url = reverse('productimage-list')
        data = {
            'product': self.product.id,
            'image': '/path/to/image.jpg',
            'alt_text': 'Image of Laptop'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ProductImage.objects.count(), 1)
        self.assertEqual(ProductImage.objects.get().alt_text, 'Image of Laptop')


class ReviewTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.category = Category.objects.create(name='Electronics', description='Electronic items')
        self.product = Product.objects.create(name='Laptop', description='A high-end laptop', price='1500.00', sku='LAP123', stock=50, category=self.category)
        self.client.login(username='testuser', password='testpass')

    def test_create_review(self):
        url = reverse('review-list')
        data = {
            'product': self.product.id,
            'rating': 5,
            'comment': 'Great laptop!'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Review.objects.count(), 1)
        self.assertEqual(Review.objects.get().comment, 'Great laptop!')

    def test_get_review_list(self):
        Review.objects.create(product=self.product, user=self.user, rating=5, comment='Great laptop!')
        url = reverse('review-list')
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
