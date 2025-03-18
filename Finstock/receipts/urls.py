from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReceiptViewSet, export_receipts_pdf

router = DefaultRouter()
router.register(r'', ReceiptViewSet, basename="receipt")

urlpatterns = [
    path('', include(router.urls)),
    path('export/pdf/', export_receipts_pdf, name='export-receipts-pdf'),
]
