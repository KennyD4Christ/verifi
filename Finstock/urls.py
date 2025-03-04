from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from channels.routing import URLRouter
from channels.auth import AuthMiddlewareStack
from core import routing
from django.conf.urls.static import static

schema_view = get_schema_view(
    openapi.Info(
        title="Accounting and Inventory API",
        default_version='v1',
        description="API for the accounting and inventory management system",
        terms_of_service="https://www.google.com/policies/terms/",
        contact=openapi.Contact(email="contact@example.com"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/core/', include('core.urls')),
    path('api/transactions/', include('transactions.urls')),
    path('api/receipts/', include('receipts.urls')),
    path('api/invoices/', include('invoices.urls')),
    path('api/users/', include('users.urls')),
    path('api/products/', include('products.urls')),
    path('api/stock_adjustments/', include('stock_adjustments.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/', include('analytics.urls')),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    path('ws/', AuthMiddlewareStack(URLRouter(routing.websocket_urlpatterns))),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
