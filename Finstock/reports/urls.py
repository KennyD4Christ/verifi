from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReportViewSet, ReportEntryViewSet, ReportFileViewSet, CalculatedFieldViewSet, ReportAccessLogViewSet

router = DefaultRouter()
router.register(r'reports', ReportViewSet)
router.register(r'report-entries', ReportEntryViewSet)
router.register(r'report-files', ReportFileViewSet)
router.register(r'calculated-fields', CalculatedFieldViewSet)
router.register(r'access-logs', ReportAccessLogViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
