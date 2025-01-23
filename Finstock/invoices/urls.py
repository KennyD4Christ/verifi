from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
from .views import InvoiceViewSet, InvoiceItemViewSet

router = DefaultRouter()
router.register(r'invoices', InvoiceViewSet)
router.register(r'invoice-items', InvoiceItemViewSet)

@api_view(['GET'])
def invoices_api_root(request, format=None):
    return Response({
        'invoices': reverse('invoice-list', request=request, format=format),
        'invoice-items': reverse('invoiceitem-list', request=request, format=format),
    })

urlpatterns = [
    path('', invoices_api_root, name='api-root'),
    path('', include(router.urls)),
]
