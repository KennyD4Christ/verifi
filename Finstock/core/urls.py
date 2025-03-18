from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CustomerViewSet,
    OrderViewSet,
    OrderItemViewSet,
    AddressViewSet,
    CompanyInfoViewSet,
    PromotionViewSet,
    sales_representatives_view,
    home
)

router = DefaultRouter()
router.register(r'customers', CustomerViewSet)
router.register(r'orders', OrderViewSet)
router.register(r'order-items', OrderItemViewSet)
router.register(r'addresses', AddressViewSet)
router.register(r'company-info', CompanyInfoViewSet)
router.register(r'promotions', PromotionViewSet)

urlpatterns = [
    path('', home, name='home'),
    path('', include(router.urls)),
    path('customers/search/', CustomerViewSet.as_view({'get': 'search'}), name='customer-search'),
    path('sales-reps/', sales_representatives_view, name='sales-representatives'),
    path('orders/<int:pk>/add-scanned-item/', OrderViewSet.as_view({'post': 'add_scanned_item'}), name='order-add-scanned-item'),
]
