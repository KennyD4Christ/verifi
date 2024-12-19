from rest_framework.permissions import BasePermission

class StrictRoleBasedPermission(BasePermission):
    def has_permission(self, request, view):
        # Handle unauthenticated or superuser access
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True

        # Determine the required permission based on HTTP method
        method_permission_map = {
            'GET': view.view_permission,
            'POST': view.create_permission,
            'PUT': view.edit_permission,
            'PATCH': view.edit_permission,
            'DELETE': view.delete_permission
        }

        # Get the required permission for this method
        required_permission = method_permission_map.get(request.method)
        
        if not required_permission:
            return False

        # Strict check against predefined roles and permissions
        user_permissions = request.user.get_permissions()
        return user_permissions.filter(name=required_permission).exists()

    def has_object_permission(self, request, view, obj):
        # Superuser always has access
        if request.user.is_superuser:
            return True

        # Strict object-level permission check
        method_permission_map = {
            'GET': view.view_permission,
            'PUT': view.edit_permission,
            'PATCH': view.edit_permission,
            'DELETE': view.delete_permission
        }

        required_permission = method_permission_map.get(request.method)
        
        if not required_permission:
            return False

        # Check if user has specific permission
        user_permissions = request.user.get_permissions()
        return user_permissions.filter(name=required_permission).exists()
