from rest_framework import permissions


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

class BaseModelPermission(permissions.BasePermission):
    """
    Base class for model-specific permissions that checks for specific permission strings.
    """
    def has_permission(self, request, view):
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
        if required_permission:
            return request.user.is_authenticated and request.user.has_perm(required_permission)
        
        return False

class InvoicePermission(BaseModelPermission):
    """
    Permission class for Invoice-related operations.
    """
    view_permission = 'invoices.view_invoice'
    create_permission = 'invoices.create_invoice'
    edit_permission = 'invoices.edit_invoice'
    delete_permission = 'invoices.delete_invoice'

    def has_object_permission(self, request, view, obj):
        # Add additional object-level checks here
        # For example, users might only be able to edit their own invoices
        if request.method in ['PUT', 'PATCH', 'DELETE']:
            return (request.user.has_perm(self.edit_permission) and 
                   obj.created_by == request.user)
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

class ReportPermission(BaseModelPermission):
    """
    Permission class for Report operations.
    """
    view_permission = 'reports.view_report'
    create_permission = 'reports.create_report'
    edit_permission = 'reports.edit_report'
    delete_permission = 'reports.delete_report'

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
                request.user.has_role_permission('admin.manage_users') and
                request.user.has_role_permission('admin.manage_roles'))
