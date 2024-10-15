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
            request.user.is_staff or  # Assuming staff status indicates administrator
            request.user.has_perm('core.manage_resource')  # Generic permission for management
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
