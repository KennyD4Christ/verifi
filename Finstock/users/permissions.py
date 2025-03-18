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
                'destroy': getattr(view, 'delete_permission', None),
                'scan_qr': getattr(view, 'qr_scan_permission', None),
                'qr_code': getattr(view, 'qr_code_permission', None)
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


