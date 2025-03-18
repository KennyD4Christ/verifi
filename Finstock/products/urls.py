from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
from . import views

# Create a router and register viewsets
router = DefaultRouter()
router.register(r'categories', views.CategoryViewSet)
router.register(r'products', views.ProductViewSet)
router.register(r'images', views.ProductImageViewSet)
router.register(r'reviews', views.ReviewViewSet)

@api_view(['GET'])
def products_api_root(request, format=None):
    return Response({
        'categories': reverse('category-list', request=request, format=format),
        'products': reverse('product-list', request=request, format=format),
        'images': reverse('productimage-list', request=request, format=format),
        'reviews': reverse('review-list', request=request, format=format),
    })

urlpatterns = [
    path('', products_api_root, name='api-root'),    
    path('', include(router.urls)),
    path('products/<int:pk>/qr-scan/', views.ProductViewSet.as_view({'post': 'qr_scan'}), name='product-qr-scan'),
    path('products/<int:pk>/qr-regenerate/', views.ProductViewSet.as_view({'post': 'regenerate_qr'}), name='product-qr-regenerate'),
]
