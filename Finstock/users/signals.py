from django.db.models.signals import m2m_changed
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission as DjangoPermission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.contrib.sessions.models import Session
from django.utils.timezone import now
from users.models import PermissionAuditLog
import logging

from users.models import Permission, CustomUser

# Set up logging
logger = logging.getLogger(__name__)

def map_custom_permission_to_django(permission):
    """
    Map a custom Permission object to Django's Permission model.

    Args:
        permission (Permission): The custom Permission instance to be mapped.

    Returns:
        django.contrib.auth.models.Permission: The corresponding Django Permission instance, or None if not found.
    """
    if not permission or not hasattr(permission, 'name'):
        logger.error("Invalid permission object passed for mapping.")
        return None

    # Extract codename and category
    try:
        codename = permission.name.split('.')[-1]  # Extract codename from custom permission name
        category = permission.category.lower() if hasattr(permission, 'category') else 'default'
    except (IndexError, AttributeError) as e:
        logger.error(f"Permission name is invalid: {permission.name}. Error: {str(e)}")
        return None

    # Determine content type
    try:
        content_type = ContentType.objects.get(app_label=category, model='user')
    except ContentType.DoesNotExist:
        # Fallback to default user content type if category does not exist
        content_type = ContentType.objects.get_for_model(get_user_model())

    # Find or map Django permission
    try:
        django_perm = DjangoPermission.objects.get(
            content_type=content_type,
            codename=codename
        )
        return django_perm
    except DjangoPermission.DoesNotExist:
        logger.warning(f"No corresponding Django Permission found for: {permission.name}")
        return None


@receiver(m2m_changed, sender=get_user_model().roles.through)
def sync_user_permissions(sender, instance, action, **kwargs):
    """
    Signal to synchronize user's Django permissions with their custom role-based permissions.

    Triggered when roles are added or removed from a user.

    Args:
        sender: The sender model (intermediate table between users and roles).
        instance: The user instance.
        action: The action being performed (e.g., 'post_add', 'post_remove').
        kwargs: Additional arguments.
    """
    if action in ["post_add", "post_remove"]:
        # Clear existing Django permissions
        instance.user_permissions.clear()
        logger.info(f"Cleared all permissions for user: {instance.username}")

        # Collect all permissions from user's roles
        role_permissions = Permission.objects.filter(
            roles__users=instance, 
            is_active=True
        )

        # Map custom permissions to Django permissions
        django_permissions = []
        for perm in role_permissions:
            django_perm = map_custom_permission_to_django(perm)
            if django_perm:
                django_permissions.append(django_perm)

        # Add mapped permissions
        if django_permissions:
            instance.user_permissions.add(*django_permissions)
            logger.info(f"Added {len(django_permissions)} permissions for user: {instance.username}")
        else:
            logger.warning(f"No valid Django permissions to add for user: {instance.username}")


@receiver(m2m_changed, sender=CustomUser.roles.through)
def reset_user_session_on_role_change(sender, instance, action, **kwargs):
    """
    Invalidate user's existing sessions when roles are modified
    """
    if action == 'post_add' or action == 'post_remove':
        # Fetch all sessions
        sessions = Session.objects.filter(expire_date__gte=now())
        
        # Invalidate sessions associated with the user
        for session in sessions:
            data = session.get_decoded()
            if data.get('_auth_user_id') == str(instance.id):
                session.delete()

        # Clear any authentication tokens (e.g., Django Rest Framework tokens)
        try:
            from rest_framework.authtoken.models import Token
            Token.objects.filter(user=instance).delete()
        except ImportError:
            # If DRF is not being used, skip token deletion
            pass

        # Log the role change event
        PermissionAuditLog.objects.create(
            user=instance,
            action='Role Modified',
            resource='User Roles',
            status='Role Change Detected'
        )
