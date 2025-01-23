from django.urls import path
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
from .views import TopProductsView, RecentTransactionsView, NetProfitDataView, ConversionRateDataView, InventoryLevelsView, CashFlowView

@api_view(['GET'])
def analytics_api_root(request, format=None):
    return Response({
        'top-products': reverse('top-products', request=request, format=format),
        'recent-transactions': reverse('recent-transactions', request=request, format=format),
        'net-profit-data': reverse('net-profit-data', request=request, format=format),
        'conversion-rate-data': reverse('conversion-rate-data', request=request, format=format),
        'inventory-levels': reverse('inventory-levels', request=request, format=format),
        'cash-flow': reverse('cash-flow', request=request, format=format),
    })

urlpatterns = [
    path('', analytics_api_root, name='api-root'),
    path('products/top/', TopProductsView.as_view(), name='top-products'),
    path('transactions/recent/', RecentTransactionsView.as_view(), name='recent-transactions'),
    path('analytics/net-profit/', NetProfitDataView.as_view(), name='net-profit-data'),
    path('analytics/conversion-rate/', ConversionRateDataView.as_view(), name='conversion-rate-data'),
    path('inventory/levels/', InventoryLevelsView.as_view(), name='inventory-levels'),
    path('finance/cash-flow/', CashFlowView.as_view(), name='cash-flow'),
]
