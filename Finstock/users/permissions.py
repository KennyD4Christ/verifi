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
        # Skip permission check for unauthenticated requests
        if not request.user or not request.user.is_authenticated:
            return False

        # Superusers have full access
        if request.user.is_superuser:
            return True

        # Check if view has model_name attribute before accessing
        if not hasattr(view, 'model_name'):
            return True  # Allow access to root views or views without specific model
        permission_mapping = {
            'list': f'{view.model_name}.view_{view.model_name}',
            'retrieve': f'{view.model_name}.view_{view.model_name}',
            'create': f'{view.model_name}.add_{view.model_name}',
            'update': f'{view.model_name}.change_{view.model_name}',
            'partial_update': f'{view.model_name}.change_{view.model_name}',
            'destroy': f'{view.model_name}.delete_{view.model_name}'
        }
        
        required_permission = permission_mapping.get(view.action)
        if required_permission and not request.user.has_perm(required_permission):
            return False
        return True

    def has_object_permission(self, request, view, obj):
        """
        Provides object-level permission checking
        """
        if request.user.is_superuser:
            return True
            
        # Check ownership for certain roles
        if hasattr(obj, 'created_by') and request.user.is_role('Sales Representative'):
            return obj.created_by == request.user
            
        return True


class AdminUserRolePermission(permissions.BasePermission):
    """
    Custom permission to only allow administrators to manage users and roles
    """
    def has_permission(self, request, view):
        print(f"User: {request.user}")
        print(f"Is Superuser: {request.user.is_superuser}")
        print(f"User Roles: {request.user.get_roles()}")
        print(f"User Permissions: {list(request.user.get_permissions())}")
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
        print(f"User: {request.user}")
        print(f"Is Superuser: {request.user.is_superuser}")
        print(f"User Roles: {request.user.get_roles()}")
        print(f"User Permissions: {list(request.user.get_permissions())}")
        # Always allow GET requests for authenticated users if they have view permission
        if request.method == 'GET':
            return request.user.is_authenticated and request.user.has_perm(self.view_permission)
        
        # Map HTTP methods to required permissions
        method_permission_map = {
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

    def has_object_permission(self, request, view, obj):
        # Additional object-level permission check
        if request.method in ['PUT', 'PATCH', 'DELETE']:
            # Ensure user has permission and is the creator
            return (request.user.has_perm(self.edit_permission) and 
                   obj.created_by == request.user)
        return True


class OrderPermission(BaseModelPermission):
    view_permission = 'orders.view_order'
    create_permission = 'orders.create_order'
    edit_permission = 'orders.edit_order'
    delete_permission = 'orders.delete_order'

    def has_object_permission(self, request, view, obj):
        # Comprehensive permission logic for orders
        if request.method in ['GET']:
            return (
                request.user.is_superuser or  # Superuser always has access
                request.user.is_role('Administrator') or  # Administrators can view all
                request.user.is_role('Sales Representative') and (
                    obj.user == request.user or  # User who created the order
                    (obj.customer and obj.customer.user == request.user)  # Related customer
                ) or
                request.user.is_role('Auditor')  # Auditors can view
            )

        # Modification permissions
        if request.method in ['PUT', 'PATCH', 'DELETE']:
            return (
                request.user.is_superuser or  # Superuser always has full access
                request.user.is_role('Administrator') or  # Administrators can modify
                (request.user.has_perm(self.edit_permission) and 
                 obj.user == request.user)  # User who created the order
            )
        return True


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

    def has_object_permission(self, request, view, obj):
        if request.method in ['GET']:
            return (
                request.user.is_superuser or  # Superuser always has access
                request.user.is_role('Administrator') or  # Administrators can view all
                request.user.is_role('Accountant') or  # Accountants can view all transactions
                request.user.is_role('Auditor') or  # Auditors can view
                (obj.customer and obj.customer.user == request.user) or  # Related customer
                (obj.order and obj.order.user == request.user)  # Order creator
            )

        if request.method in ['PUT', 'PATCH', 'DELETE']:
            return (
                request.user.is_superuser or  # Superuser always has full access
                request.user.is_role('Administrator') or  # Administrators can modify
                request.user.is_role('Accountant') or  # Accountants can modify
                (request.user.has_perm(self.edit_permission) and
                 (obj.order and obj.order.user == request.user))  # Order creator
            )
        return True


class ReportPermission(BaseModelPermission):
    """
    Permission class for Report operations.
    """
    view_permission = 'reports.view_report'
    create_permission = 'reports.create_report'
    edit_permission = 'reports.edit_report'
    delete_permission = 'reports.delete_report'

    def has_object_permission(self, request, view, obj):
        if request.method in ['GET']:
            return (
                request.user.is_superuser or  # Superuser always has access
                request.user.is_role('Administrator') or  # Administrators can view all
                request.user.is_role('Auditor') or  # Auditors can view
                obj.created_by == request.user  # Report creator
            )

        if request.method in ['PUT', 'PATCH', 'DELETE']:
            return (
                request.user.is_superuser or  # Superuser always has full access
                request.user.is_role('Administrator') or  # Administrators can modify
                (request.user.has_perm(self.edit_permission) and
                 obj.created_by == request.user)  # Report creator
            )
        return True


class DynamicModelPermission(BaseModelPermission):
    """
    Dynamic Permission Checker with Enhanced Logging and Flexibility
    """
    def has_permission(self, request, view):
        # Enhanced logging for unauthorized access attempts
        if not request.user.is_authenticated:
            logger.warning(f"Unauthorized access attempt to {view.__class__.__name__}")
            return False

        # Use dynamic permission checking
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
