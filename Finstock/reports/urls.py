from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
from .views import ReportViewSet, ReportEntryViewSet, ReportFileViewSet, CalculatedFieldViewSet, ReportAccessLogViewSet

router = DefaultRouter()
router.register(r'reports', ReportViewSet)
router.register(r'report-entries', ReportEntryViewSet)
router.register(r'report-files', ReportFileViewSet)
router.register(r'calculated-fields', CalculatedFieldViewSet)
router.register(r'access-logs', ReportAccessLogViewSet)

@api_view(['GET'])
def reports_api_root(request, format=None):
    return Response({
        'reports': reverse('reports-list', request=request, format=format),
        'report-entries': reverse('reportentry-list', request=request, format=format),
        'report-files': reverse('reportfile-list', request=request, format=format),
        'calculated-fields': reverse('calculatedfield-list', request=request, format=format),
        'access-logs': reverse('reportaccesslog-list', request=request, format=format),
    })

urlpatterns = [
    path('', reports_api_root, name='api-root'),
    path('', include(router.urls)),
]
