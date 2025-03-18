from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
from .views import TransactionViewSet

router = DefaultRouter()
router.register(r'transactions', TransactionViewSet)

@api_view(['GET'])
def transactions_api_root(request, format=None):
    return Response({
        'transactions': reverse('transaction-list', request=request, format=format),
    })

urlpatterns = [
    path('', transactions_api_root, name='api-root'),
    path('', include(router.urls)),
]
