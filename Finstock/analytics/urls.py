from django.urls import path
from .views import TopProductsView, RecentTransactionsView, NetProfitDataView, ConversionRateDataView, InventoryLevelsView, CashFlowView

urlpatterns = [
    path('products/top/', TopProductsView.as_view(), name='top-products'),
    path('transactions/recent/', RecentTransactionsView.as_view(), name='recent-transactions'),
    path('analytics/net-profit/', NetProfitDataView.as_view(), name='net-profit-data'),
    path('analytics/conversion-rate/', ConversionRateDataView.as_view(), name='conversion-rate-data'),
    path('inventory/levels/', InventoryLevelsView.as_view(), name='inventory-levels'),
    path('finance/cash-flow/', CashFlowView.as_view(), name='cash-flow'),
]
