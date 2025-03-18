# users/utils.py
from django.contrib.auth.models import Permission as DjangoPermission
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.utils.timezone import now
from rest_framework.authtoken.models import Token
import logging

logger = logging.getLogger(__name__)

def _map_permission_to_django_perm(permission):
    """
    Map custom Permission to Django's Permission model.
    If no matching Django Permission exists, create it dynamically.
    """
    content_type = ContentType.objects.get_for_model(get_user_model())

    # Extract codename (e.g., 'view_all' from 'users.view_all')
    codename = permission.name.split('.')[-1]
    name = f"{codename.replace('_', ' ').capitalize()} permission"

    django_perm, created = DjangoPermission.objects.get_or_create(
        content_type=content_type,
        codename=codename,
        defaults={'name': name},
    )

    if created:
        logger.info(f"Created missing Django permission: {name}")

    return django_perm

def invalidate_user_sessions(user):
    """
    Invalidate all active sessions for the user.
    This includes:
    1. Deleting session records.
    2. Clearing authentication tokens, if applicable.
    """
    # Fetch all active sessions
    sessions = Session.objects.filter(expire_date__gte=now())
    for session in sessions:
        session_data = session.get_decoded()
        if session_data.get('_auth_user_id') == str(user.id):
            session.delete()

    # Optionally clear tokens if using Django REST Framework
    try:
        Token.objects.filter(user=user).delete()
    except Exception:
        pass

def recalculate_user_permissions(user):
    """
    Reset and recalculate user permissions based on roles.
    """
    # Clear all existing direct permissions
    user.user_permissions.clear()

    # Get permissions from active roles
    current_role_permissions = Permission.objects.filter(
        roles__users=user,
        roles__is_active=True,  # Permissions from active roles only
        is_active=True,         # Active permissions only
    )

    # Assign new permissions
    user.user_permissions.add(*current_role_permissions)
    user.save()
