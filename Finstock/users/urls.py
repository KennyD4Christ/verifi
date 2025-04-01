from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, RoleViewSet,  PermissionViewSet, PermissionRefreshView, AuthViewSet, PasswordResetRequestView, PasswordResetView, current_user, UserPreferenceView, DetailView, InsightView

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='users')
router.register(r'roles', RoleViewSet)
router.register(r'permissions', PermissionViewSet)
router.register(r'auth', AuthViewSet, basename='auth')


urlpatterns = [
    path('', include(router.urls)),
    path('me/', current_user, name='current_user'),
    path('auth/refresh-permissions/', PermissionRefreshView.as_view(), name='permission-refresh'),
    path('password-reset-request/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('reset-password/<uidb64>/<token>/', PasswordResetView.as_view(), name='password_reset_confirm'),
    path('preferences/', UserPreferenceView.as_view(), name='user_preferences'),
    path('detail/<str:type>/<int:id>/', DetailView.as_view(), name='detail_view'),
    path('insights/', InsightView.as_view(), name='insights'),
]
