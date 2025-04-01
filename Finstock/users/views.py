from rest_framework.views import APIView
from rest_framework import serializers
from django.urls import reverse
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.contrib.auth.tokens import default_token_generator
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django.contrib.auth import authenticate, login, logout
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from django.core.exceptions import PermissionDenied
from rest_framework.authtoken.models import Token
from .utils import invalidate_user_sessions, recalculate_user_permissions
from .models import CustomUser, Role, Permission, UserPreference, Insight
from products.models import Product
from invoices.models import Invoice
from transactions.models import Transaction
from stock_adjustments.models import StockAdjustment
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from reports.models import Report
from core.models import Order
from .permissions import AdminUserRolePermission, RoleBasedPermission
from .constants import PermissionConstants
import pyotp
import qrcode
import io
import base64
import random
from .serializers import (
    UserSerializer,
    UserRegistrationSerializer,
    UserRoleSerializer,
    RoleSerializer,
    RoleAssignmentSerializer,
    PermissionSerializer,
    UserPreferenceSerializer,
    InsightSerializer,
    ProductSerializer,
    InvoiceSerializer,
    TransactionSerializer,
    StockAdjustmentSerializer,
    ReportSerializer,
    OrderSerializer,
    TwoFactorLoginSerializer,
    TwoFactorSetupSerializer,
    TwoFactorVerifySerializer
)
from rest_framework.pagination import PageNumberPagination
import logging

logger = logging.getLogger(__name__)

class TwoFactorRateThrottle(UserRateThrottle):
    scope = 'two_factor'

class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'

class UserPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class UserPreferenceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        preference, created = UserPreference.objects.get_or_create(user=request.user)
        serializer = UserPreferenceSerializer(preference)
        return Response(serializer.data)

    def put(self, request):
        preference, created = UserPreference.objects.get_or_create(user=request.user)
        serializer = UserPreferenceSerializer(preference, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, type, id):
        if type == 'product':
            # Fetch product details
            product = Product.objects.get(id=id)
            serializer = ProductSerializer(product)
        elif type == 'order':
            # Fetch order details
            order = Order.objects.get(id=id)
            serializer = OrderSerializer(order)
        elif type == 'customer':
            # Fetch customer details
            customer = CustomUser.objects.get(id=id)
            serializer = UserSerializer(customer)
        else:
            return Response({'error': 'Invalid type'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.data)


class InsightView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        insights = Insight.objects.all().order_by('-created_at')
        serializer = InsightSerializer(insights, many=True)
        return Response(serializer.data)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        email = request.data.get('email')
        try:
            user = CustomUser.objects.get(email=email)
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            reset_link = request.build_absolute_uri(
                reverse('password_reset_confirm', kwargs={'uidb64': uid, 'token': token})
            )
            send_mail(
                'Password Reset Request',
                f'Click the link below to reset your password:\n\n{reset_link}',
                'from@example.com',
                [user.email],
                fail_silently=False,
            )
            return Response({'message': 'Password reset email sent.'}, status=status.HTTP_200_OK)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User with this email does not exist.'}, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, uidb64, token, *args, **kwargs):
        new_password = request.data.get('new_password')
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = CustomUser.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
            return Response({'error': 'Invalid token.'}, status=status.HTTP_400_BAD_REQUEST)

        if default_token_generator.check_token(user, token):
            user.set_password(new_password)
            user.save()
            return Response({'message': 'Password has been reset.'}, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Invalid token.'}, status=status.HTTP_400_BAD_REQUEST)


class BaseAccessControlViewSet(viewsets.ModelViewSet):
    """
    Base viewset providing comprehensive role-based access control
    """
    permission_classes = [permissions.IsAuthenticated, RoleBasedPermission]
    model = None
    model_name = None

    def get_queryset(self):
        """
        Dynamic queryset filtering based on user permissions and roles
        """
        if not self.model or not self.model_name:
            return super().get_queryset()  # Fallback to default queryset

        if self.request.user.is_superuser:
            return self.model.objects.all()

        # Check if user has view permission using the constant
        if not self.request.user.has_role_permission(self.view_permission):
            return self.model.objects.none()

        queryset = self.apply_role_based_filtering()
        return self.apply_additional_filters(queryset)
        

    def apply_role_based_filtering(self):
        """
        Override in subclasses to implement role-specific data access
        """
        return self.model.objects.all()

    def apply_additional_filters(self, queryset):
        """
        Apply common filtering across all viewsets

        This method provides a centralized place to add common filters:
        - Date range filtering
        - Active status filtering
        - Search filters
        """
        # Filter by active status if the model has an is_active field
        if hasattr(self.model, 'is_active'):
            queryset = queryset.filter(is_active=True)

        # Optional date range filtering
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        date_field = self._get_model_date_field()

        if start_date and end_date:
            try:
                start = timezone.datetime.strptime(start_date, '%Y-%m-%d')
                end = timezone.datetime.strptime(end_date, '%Y-%m-%d')

                queryset = queryset.filter(**{f'{date_field}__range': [start, end]})
            except ValueError:
                raise ValidationError("Invalid date format. Use YYYY-MM-DD")

        # Optional search filtering if model has a searchable field
        search_query = self.request.query_params.get('search')
        if search_query and hasattr(self.model, 'search_fields'):
            search_filter = Q()
            for field in self.model.search_fields:
                search_filter |= Q(**{f'{field}__icontains': search_query})
            queryset = queryset.filter(search_filter)

        return queryset

    def _get_model_date_field(self):
        """
        Dynamically determine the appropriate date field for filtering
        """
        date_field_candidates = [
            'created_at',
            'order_date',
            'date',
            'created',
        ]

        for candidate in date_field_candidates:
            if hasattr(self.model, candidate):
                return candidate

        return None

    def get_permissions(self):
        """
        Dynamic permission class assignment
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), AdminUserRolePermission()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        if not self.has_action_permission('add'):
            raise PermissionDenied("You don't have permission to create this resource")
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        if not self.has_action_permission('change'):
            raise PermissionDenied("You don't have permission to update this resource")
        serializer.save(modified_by=self.request.user)

    def perform_destroy(self, instance):
        if not self.has_action_permission('delete'):
            raise PermissionDenied("You don't have permission to delete this resource")
        instance.delete()

    def has_action_permission(self, action_type):
        permission = f'{self.model_name}.{action_type}_{self.model_name}'
        return self.request.user.has_perm(permission)

    def check_permissions(self, request):

        if hasattr(self, 'action') and self.action == 'register':
            return

        super().check_permissions(request)

        # Additional logging for debugging
        if not request.user.is_authenticated:
            logger.warning(f"Unauthenticated access attempt to {self.action} on {self.model_name}")
            raise PermissionDenied("Authentication required")

        action_permission = getattr(self, f'{self.action}_permission', None)
        if action_permission and not request.user.has_role_permission(action_permission):
            logger.warning(
                f"Permission denied for user {request.user.username} "
                f"attempting {self.action} on {self.model_name}"
            )
            raise PermissionDenied(f"You don't have permission to {self.action} this resource")


class UserViewSet(BaseAccessControlViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer
    pagination_class = UserPagination
    model = CustomUser
    model_name = 'user'

    view_permission = PermissionConstants.USER_VIEW_ALL
    create_permission = PermissionConstants.USER_CREATE
    edit_permission = PermissionConstants.USER_EDIT
    delete_permission = PermissionConstants.USER_DELETE

    def list(self, request, *args, **kwargs):
        # Get the queryset and apply pagination
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        # If no pagination requested, return all results
        serializer = self.get_serializer(queryset, many=True)

        return Response(serializer.data)

    def get_accessible_routes(self, user):
        """
        Dynamically Generate Accessible Routes Based on User Permissions
        """
        route_permission_mapping = {
            '/invoices': 'invoices.view_invoice',
            '/products': 'products.view_product',
            '/stock-adjustments': 'stock_adjustments.view_adjustment',
            '/transactions': 'transactions.view_transaction',
            '/reports': 'reports.view_report',
        }

        return [
            route for route, permission
            in route_permission_mapping.items()
            if user.has_perm(permission)
        ]

    @action(detail=False, methods=['GET'])
    def permissions(self, request):
        """
        Endpoint to Retrieve User Permissions and Accessible Routes
        """
        if not request.user.has_perm('auth.view_permission'):
            raise PermissionDenied("You don't have permission to view permissions")
            
        permissions = list(request.user.get_all_permissions())
        accessible_routes = self.get_accessible_routes(request.user)

        serializer = UserPermissionsSerializer({
            'permissions': permissions,
            'accessible_routes': accessible_routes
        })
        return Response(serializer.data)

    def get_permissions(self):
        if self.action == 'register':
            return [AllowAny()]
        elif self.action in ['create', 'update', 'partial_update', 'destroy', 'assign_roles', 'update_roles']:
            return [permissions.IsAuthenticated(), RoleBasedPermission()]
        return super().get_permissions()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=['post'],
        serializer_class=RoleAssignmentSerializer
    )
    def assign_roles(self, request):
        """
        API endpoint to assign roles to a user
        """
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            user = serializer.validated_data['user_id']
            roles = serializer.validated_data['role_ids']

            # Clear existing roles and assign new ones
            user.roles.clear()
            user.roles.add(*roles)

            return Response({
                'message': 'Roles assigned successfully',
                'user_id': user.id,
                'assigned_roles': [role.name for role in roles]
            }, status=status.HTTP_200_OK)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def get_serializer_class(self):
        if self.action == 'update_roles':
            return UserRoleSerializer
        return self.serializer_class

    @action(detail=True, methods=['PUT'], url_path='roles')
    def update_roles(self, request, pk=None):
        """
        Update roles for a specific user
        """
        try:
            if not request.user.has_perm('auth.change_user'):
                raise PermissionDenied("You don't have permission to update user roles")

            # Attempt to get the user, handle potential non-existent users
            user = self.get_object()

            # Validate roles input
            role_ids = request.data.get('roles', [])
            if not isinstance(role_ids, list):
                return Response(
                    {'error': 'Roles must be provided as an array of role IDs'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate role IDs exist
            try:
                roles = Role.objects.filter(id__in=role_ids)
                if len(roles) != len(role_ids):
                    invalid_roles = set(role_ids) - set(roles.values_list('id', flat=True))
                    return Response(
                        {
                            'error': 'Some role IDs are invalid',
                            'invalid_roles': list(invalid_roles)
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except Exception as e:
                return Response(
                    {'error': 'Error validating roles'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = UserRoleSerializer(user, data={'roles': role_ids}, partial=True)

            if serializer.is_valid():
                updated_user = serializer.save()
                return Response({
                    'message': 'User roles updated successfully',
                    'user': {
                        'id': updated_user.id,
                        'username': updated_user.username,
                        'roles': [
                            {
                                'id': role.id,
                                'name': role.name
                            } for role in updated_user.roles.all()
                        ]
                    }
                }, status=status.HTTP_200_OK)

            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['POST'], permission_classes=[AllowAny])
    def register(self, request):
        try:
            serializer = UserRegistrationSerializer(data=request.data)
            if serializer.is_valid():
                user = serializer.save()
                token, created = Token.objects.get_or_create(user=user)
                
                response_data = {
                    'user': UserSerializer(user).data,
                    'token': token.key
                }
                
                logger.info(f"Successfully registered new user: {user.username}")
                return Response(response_data, status=status.HTTP_201_CREATED)
                
            logger.warning(f"Registration failed due to validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Unexpected error during registration: {str(e)}")
            return Response(
                {'error': 'Registration failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['POST'], permission_classes=[IsAuthenticated])
    def enable_2fa(self, request):
        """Initiate 2FA setup"""
        serializer = TwoFactorSetupSerializer(data=request.data, context={'request': request})

        if serializer.is_valid():
            user = request.user
            secret = user.enable_2fa()

            # Generate QR code
            totp = pyotp.TOTP(secret)
            uri = totp.provisioning_uri(name=user.username, issuer_name="YourApp")

            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(uri)
            qr.make(fit=True)

            img = qr.make_image(fill_color="black", back_color="white")
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            qr_code_image = base64.b64encode(buffer.getvalue()).decode()

            return Response({
                'secret': secret,
                'qr_code': qr_code_image,
                'message': 'Scan this QR code with your authenticator app',
            }, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['POST'], permission_classes=[IsAuthenticated], throttle_classes=[TwoFactorRateThrottle])
    def verify_2fa(self, request):
        """Verify and complete 2FA setup"""
        serializer = TwoFactorVerifySerializer(data=request.data)

        if serializer.is_valid():
            user = request.user
            code = serializer.validated_data['code']

            if user.verify_otp(code):
                # Generate backup codes
                backup_codes = user.generate_backup_codes()

                return Response({
                    'message': '2FA enabled successfully',
                    'backup_codes': backup_codes,
                    'warning': 'Save these backup codes in a secure place. They will not be shown again.'
                }, status=status.HTTP_200_OK)

            return Response({
                'error': 'Invalid verification code'
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['POST'], permission_classes=[IsAuthenticated])
    def disable_2fa(self, request):
        """Disable 2FA"""
        serializer = TwoFactorSetupSerializer(data=request.data, context={'request': request})

        if serializer.is_valid():
            user = request.user
            user.disable_2fa()

            return Response({
                'message': '2FA disabled successfully'
            }, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['POST'], permission_classes=[IsAuthenticated])
    def regenerate_backup_codes(self, request):
        """Regenerate backup codes"""
        serializer = TwoFactorSetupSerializer(data=request.data, context={'request': request})

        if serializer.is_valid():
            user = request.user

            if not user.two_factor_enabled:
                return Response({
                    'error': '2FA is not enabled'
                }, status=status.HTTP_400_BAD_REQUEST)

            backup_codes = user.generate_backup_codes()

            return Response({
                'message': 'Backup codes regenerated successfully',
                'backup_codes': backup_codes,
                'warning': 'Save these backup codes in a secure place. They will not be shown again.'
            }, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=False, methods=['GET'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

class PermissionRefreshView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        role_id = request.data.get('role_id')
        refresh_type = request.data.get('refresh_type', 'standard')

        try:
            # Log the permission refresh attempt
            PermissionAuditLog.objects.create(
                user=request.user,
                action='Permission Refresh',
                resource=f'Role ID: {role_id}',
                status='Initiated'
            )

            # Perform comprehensive permission re-evaluation
            if refresh_type == 'full':
                # Invalidate existing user sessions
                invalidate_user_sessions(request.user)

                # Force permission recalculation
                recalculate_user_permissions(request.user)

            return Response({
                'status': 'success',
                'message': 'Permissions successfully refreshed'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            # Comprehensive error handling
            return Response({
                'status': 'error',
                'message': 'Permission refresh failed',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [AdminUserRolePermission]

    @action(detail=True, methods=['GET'])
    def users(self, request, pk=None):
        """
        Get all users with this role
        """
        role = self.get_object()
        users = role.users.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.filter(is_active=True)
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get('category', None)
        if category:
            queryset = queryset.filter(category=category)
        return queryset


class AuthViewSet(viewsets.ViewSet):
    @action(
        detail=False,
        methods=['post'],
        permission_classes=[permissions.AllowAny],
        throttle_classes=[LoginRateThrottle])
    def login(self, request):
        serializer = TwoFactorLoginSerializer(data=request.data)
    
        if serializer.is_valid():
            validated_data = serializer.validated_data
        
            # Check if this is the first step of 2FA
            if 'requires_2fa' in validated_data and validated_data['requires_2fa']:
                return Response({
                    'message': '2FA verification required',
                    'requires_2fa': True,
                    'username': request.data.get('username')
                }, status=status.HTTP_200_OK)
            
            # Full authentication successful
            user = validated_data['user']
            login(request, user)
            token, created = Token.objects.get_or_create(user=user)
        
            # Add roles and permissions to response
            roles = [{'id': role.id, 'name': role.name} for role in user.roles.all()]
            permissions = list(user.get_permissions().values('id', 'name', 'category'))
        
            response_data = {
                'token': token.key,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'two_factor_enabled': user.two_factor_enabled
                },
                'roles': roles,
                'permissions': permissions
            }
        
            return Response(response_data, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(
        detail=False,
        methods=['post'],
        permission_classes=[permissions.IsAuthenticated])
    def logout(self, request):
        request.user.auth_token.delete()
        logout(request)
        return Response(status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)
