from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
from .views import StockAdjustmentViewSet


router = DefaultRouter()
router.register(r'stock_adjustments', StockAdjustmentViewSet)

@api_view(['GET'])
def stock_adjustments_api_root(request, format=None):
    return Response({
        'stock_adjustments': reverse('stockadjustment-list', request=request, format=format),
    })

urlpatterns = [
    path('', stock_adjustments_api_root, name='api-root'),
    path('', include(router.urls)),
]
