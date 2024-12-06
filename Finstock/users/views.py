from rest_framework.views import APIView
from rest_framework import serializers
from django.urls import reverse
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.contrib.auth.tokens import default_token_generator
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from django.contrib.auth import authenticate, login, logout
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.shortcuts import get_object_or_404
from rest_framework.authtoken.models import Token
from .utils import invalidate_user_sessions, recalculate_user_permissions
from .models import CustomUser, Role, Permission, UserPreference, Insight
from products.models import Product
from invoices.models import Invoice
from transactions.models import Transaction
from stock_adjustments.models import StockAdjustment
from reports.models import Report
from .permissions import AdminUserRolePermission
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
    ReportSerializer
)
from rest_framework.pagination import PageNumberPagination

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


class UserViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer
    pagination_class = UserPagination

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
        permissions = list(request.user.get_all_permissions())
        accessible_routes = self.get_accessible_routes(request.user)

        serializer = UserPermissionsSerializer({
            'permissions': permissions,
            'accessible_routes': accessible_routes
        })

        return Response(serializer.data)

    def get_permissions(self):
        if self.action == 'register':
            permission_classes = [permissions.AllowAny]
        elif self.action in ['create', 'update', 'partial_update', 'destroy', 'assign_roles', 'update_roles']:
            # Restrict these actions to AdminUserRolePermission.
            permission_classes = [AdminUserRolePermission]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]

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

    @action(detail=False, methods=['GET'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    def register(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'user': UserSerializer(user).data,
                'token': token.key
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


class BaseAccessControlViewSet(viewsets.ModelViewSet):
    """
    Base viewset providing comprehensive role-based access control
    """
    model = None
    model_name = None

    def get_queryset(self):
        """
        Dynamic queryset filtering based on user permissions and roles
        """
        if not self.model or not self.model_name:
            raise NotImplementedError("Subclasses must define model and model_name")

        # Superuser always gets full access
        if self.request.user.is_superuser:
            return self.model.objects.all()
        
        # Check base view permission
        view_permission = f'{self.model_name}.view_{self.model_name}'
        if not self.request.user.has_perm(view_permission):
            return self.model.objects.none()
        
        # Apply role-specific filtering
        return self.apply_role_based_filtering()

    def apply_role_based_filtering(self):
        """
        Override in subclasses to implement role-specific data access
        """
        return self.model.objects.all()

    def get_permissions(self):
        """
        Dynamic permission class assignment
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), AdminUserRolePermission()]
        return [permissions.IsAuthenticated()]


class ProductAccessControlViewSet(BaseAccessControlViewSet):
    """
    Product-specific access control with role-based filtering
    """
    model = Product
    model_name = 'product'
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def apply_role_based_filtering(self):
        user = self.request.user

        # Sales Representative: View only active products
        if user.is_role('Sales Representative'):
            return self.queryset.filter(is_active=True)
        
        # Inventory Manager: View products in their assigned location
        if user.is_role('Inventory Manager'):
            return self.queryset.filter(location=user.location)
        
        # Accountant: Limited product view
        if user.is_role('Accountant'):
            return self.queryset.filter(is_billable=True)
        
        return self.queryset


class InvoiceAccessControlViewSet(BaseAccessControlViewSet):
    """
    Invoice-specific access control with role-based filtering
    """
    model = Invoice
    model_name = 'invoice'
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer

    def apply_role_based_filtering(self):
        user = self.request.user

        # Sales Representative: View only their own invoices
        if user.is_role('Sales Representative'):
            return self.queryset.filter(created_by=user)
        
        # Accountant: Full invoice access with date range restrictions
        if user.is_role('Accountant'):
            return self.queryset.filter(
                created_at__gte=timezone.now() - timedelta(days=90)
            )
        
        # Auditor: View invoices for reporting purposes
        if user.is_role('Auditor'):
            return self.queryset.filter(status__in=['COMPLETED', 'PROCESSED'])
        
        return self.queryset


class TransactionAccessControlViewSet(BaseAccessControlViewSet):
    """
    Transaction-specific access control with role-based filtering
    """
    model = Transaction
    model_name = 'transaction'
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer

    def apply_role_based_filtering(self):
        user = self.request.user

        # Sales Representative: View sales-related transactions
        if user.is_role('Sales Representative'):
            return self.queryset.filter(
                transaction_type__in=['SALE', 'REVENUE']
            )
        
        # Accountant: Comprehensive financial transaction view
        if user.is_role('Accountant'):
            return self.queryset.filter(
                transaction_type__in=['SALE', 'EXPENSE', 'REVENUE', 'PAYMENT']
            )
        
        # Auditor: View processed and completed transactions
        if user.is_role('Auditor'):
            return self.queryset.filter(
                status__in=['PROCESSED', 'COMPLETED']
            )
        
        return self.queryset


class StockAdjustmentAccessControlViewSet(BaseAccessControlViewSet):
    """
    Stock Adjustment-specific access control with role-based filtering
    """
    model = StockAdjustment
    model_name = 'stock_adjustment'
    queryset = StockAdjustment.objects.all()
    serializer_class = StockAdjustmentSerializer

    def apply_role_based_filtering(self):
        user = self.request.user

        # Inventory Manager: Full stock adjustment access
        if user.is_role('Inventory Manager'):
            return self.queryset
        
        # Accountant: Limited view of financial impact adjustments
        if user.is_role('Accountant'):
            return self.queryset.filter(adjustment_type='FINANCIAL')
        
        # Sales Representative: No access to stock adjustments
        if user.is_role('Sales Representative'):
            return self.queryset.none()
        
        return self.queryset


class ReportAccessControlViewSet(BaseAccessControlViewSet):
    """
    Report-specific access control with role-based filtering
    """
    model = Report
    model_name = 'report'
    queryset = Report.objects.all()
    serializer_class = ReportSerializer

    def apply_role_based_filtering(self):
        user = self.request.user

        # Auditor: Full report access
        if user.is_role('Auditor'):
            return self.queryset
        
        # Administrator: Access to all reports
        if user.is_role('Administrator'):
            return self.queryset
        
        # Others: Limited or no report access
        return self.queryset.none()


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
        permission_classes=[permissions.AllowAny])
    def login(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            token, created = Token.objects.get_or_create(user=user)
            return Response({'token': token.key}, status=200)
        return Response({'error': 'Invalid Credentials'}, status=400)

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
