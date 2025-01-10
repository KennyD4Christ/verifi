from rest_framework import permissions
from django.db import models
from django.utils import timezone
from datetime import timedelta
from users.models import CustomUser
from products.models import Product
from invoices.models import Invoice
from transactions.models import Transaction
from stock_adjustments.models import StockAdjustment
from reports.models import Report
from core.models import Order
from users.constants import PermissionConstants
import logging

logger = logging.getLogger(__name__)


class CanViewResource(permissions.BasePermission):
    """
    Allows access to view resources for all authenticated users.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated


class CanManageResource(permissions.BasePermission):
    """
    Allows access to manage resources for administrators and superusers.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_superuser or
            request.user.is_staff or
            request.user.has_perm('core.manage_resource')
        )


class SuperuserOrReadOnly(permissions.BasePermission):
    """
    Allows read access to all authenticated users, but only allows
    write access to superusers.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_superuser


class RoleBasedPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        try:
            if not request.user or not request.user.is_authenticated:
                return False

            if request.user.is_superuser:
                return True

            if not hasattr(view, 'model_name'):
                return True

            permission_mapping = {
                'list': getattr(view, 'view_permission', None),
                'retrieve': getattr(view, 'view_permission', None),
                'create': getattr(view, 'create_permission', None),
                'update': getattr(view, 'edit_permission', None),
                'partial_update': getattr(view, 'edit_permission', None),
                'destroy': getattr(view, 'delete_permission', None)
            }
            required_permission = permission_mapping.get(view.action)
            if not required_permission:
                return True

            return request.user.has_role_permission(required_permission)
        except AttributeError as e:
            logger.error(f"Permission check failed: {str(e)}")
            return False

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True

        # Check basic permission first
        if not self.has_permission(request, view):
            return False

        # Handle delete operations
        if request.method == 'DELETE':
            # Check if user has delete permission
            delete_permission = getattr(view, 'delete_permission', None)
            if delete_permission and not request.user.has_role_permission(delete_permission):
                return False
            
            # Additional role-based checks for deletion
            allowed_roles = ['Administrator', 'Accountant']
            return any(request.user.is_role(role) for role in allowed_roles)

        # Handle other operations
        if request.method in ['PUT', 'PATCH']:
            return (getattr(obj, 'created_by', None) == request.user or 
                   request.user.is_role('Administrator'))

        if request.method == 'GET':
            if request.user.is_role('Administrator'):
                return True
            return getattr(obj, 'created_by', None) == request.user

        return False


class AdminUserRolePermission(permissions.BasePermission):
    """
    Custom permission to only allow administrators to manage users and roles
    """
    def has_permission(self, request, view):
        # Allow read-only access to all authenticated users
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return request.user.is_authenticated

        # Check if user is an administrator for write operations
        return (request.user.is_authenticated and 
                (request.user.is_superuser or  # Always allow superusers
                 request.user.has_role_permission('edit') or  # Use the 'edit' permission
                 request.user.has_role_permission('full_access')))  # Or full access


class BaseModelPermission(permissions.BasePermission):
    """
    Base class for model-specific permissions that checks for specific permission strings.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True
        
        # Map HTTP methods to required permissions
        method_permission_map = {
            'GET': self.view_permission,
            'POST': self.create_permission,
            'PUT': self.edit_permission,
            'PATCH': self.edit_permission,
            'DELETE': self.delete_permission
        }
        
        required_permission = method_permission_map.get(request.method)
        
        if not required_permission:
            return False

        return (request.user.has_perm(required_permission) or 
                request.user.has_role_permission(required_permission))

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True

        if request.user.is_role('Administrator'):
            return True

        # Check if user is trying to modify the object
        is_modify_request = request.method in ['PUT', 'PATCH', 'DELETE']

        # For modification requests, require ownership
        if is_modify_request:
            if hasattr(obj, 'created_by'):
                return obj.created_by == request.user
            if hasattr(obj, 'user'):
                return obj.user == request.user
            return False

        # For read requests, check role-specific conditions
        if request.method == 'GET':
            # Check object ownership
            if hasattr(obj, 'created_by') and obj.created_by == request.user:
                return True
            if hasattr(obj, 'user') and obj.user == request.user:
                return True

            # Role-specific checks
            if request.user.is_role('Auditor'):
                return True

        return False


    def has_role_permission(self, permission_name):
        """
        Checks if the user has a specific permission through their assigned roles
        """
        return Permission.objects.filter(
            roles__users=self,
            name=permission_name,
            is_active=True
        ).exists()

    def get_permissions(self):
        """
        Retrieves all active permissions for the user across their roles
        """
        return Permission.objects.filter(
            roles__users=self,
            is_active=True
        ).distinct()


class InvoicePermission(BaseModelPermission):
    """
    Permission class for Invoice-related operations.
    """
    view_permission = 'invoices.view_invoice'
    create_permission = 'invoices.create_invoice'
    edit_permission = 'invoices.edit_invoice'
    delete_permission = 'invoices.delete_invoice'


class OrderPermission(BaseModelPermission):
    view_permission = 'orders.view_order'
    create_permission = 'orders.create_order'
    edit_permission = 'orders.edit_order'
    delete_permission = 'orders.delete_order'


class ProductPermission(BaseModelPermission):
    """
    Permission class for Product-related operations.
    """
    view_permission = 'products.view_product'
    create_permission = 'products.create_product'
    edit_permission = 'products.edit_product'
    delete_permission = 'products.delete_product'


class StockAdjustmentPermission(BaseModelPermission):
    """
    Permission class for Stock Adjustment operations.
    """
    view_permission = 'stock_adjustments.view_adjustment'
    create_permission = 'stock_adjustments.create_adjustment'
    edit_permission = 'stock_adjustments.edit_adjustment'
    delete_permission = 'stock_adjustments.delete_adjustment'


class TransactionPermission(BaseModelPermission):
    """
    Permission class for Transaction operations.
    """
    view_permission = 'transactions.view_transaction'
    create_permission = 'transactions.create_transaction'
    edit_permission = 'transactions.edit_transaction'
    delete_permission = 'transactions.delete_transaction'


class ReportPermission(BaseModelPermission):
    """
    Permission class for Report operations.
    """
    view_permission = 'reports.view_report'
    create_permission = 'reports.create_report'
    edit_permission = 'reports.edit_report'
    delete_permission = 'reports.delete_report'


class DynamicModelPermission(BaseModelPermission):
    """
    Dynamic Permission Checker with Enhanced Logging and Flexibility
    """
    def __init__(self, view_permission=None, create_permission=None, 
                 edit_permission=None, delete_permission=None):
        self.view_permission = view_permission
        self.create_permission = create_permission
        self.edit_permission = edit_permission
        self.delete_permission = delete_permission

    def has_permission(self, request, view):
        # Check if permissions are defined dynamically
        if not hasattr(self, 'view_permission'):
            logger.error(f"No view permission defined for {view.__class__.__name__}")
            return False

        # Rest of the existing method remains the same
        if not request.user.is_authenticated:
            logger.warning(f"Unauthorized access attempt to {view.__class__.__name__}")
            return False

        permission_map = {
            'GET': self.view_permission,
            'POST': self.create_permission,
            'PUT': self.edit_permission,
            'PATCH': self.edit_permission,
            'DELETE': self.delete_permission
        }

        required_permission = permission_map.get(request.method)

        if not required_permission:
            logger.warning(f"Unsupported HTTP method: {request.method}")
            return False

        has_permission = request.user.has_perm(required_permission)

        if not has_permission:
            logger.info(f"User {request.user.username} lacks permission: {required_permission}")

        return has_permission
