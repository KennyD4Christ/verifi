from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
import random
import pyotp
import base64
import os

class Permission(models.Model):
    """
    This model represents a permission within the system.
    """
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    category = models.CharField(
        max_length=50, 
        choices=[
            ('USER', 'User Management'),
            ('ROLE', 'Role Management'),
            ('RESOURCE', 'Resource Access'),
            ('SYSTEM', 'System Configuration')
        ],
        default='USER'
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} - {self.category}"

class Role(models.Model):
    """
    This model represents a user role within the system.
    """
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(Permission, related_name='roles')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class CustomUser(AbstractUser):
    """
    This model represents a custom user extending
    the built-in Django User model.
    """
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    roles = models.ManyToManyField(Role, related_name='users')
    two_factor_enabled = models.BooleanField(default=False)
    otp_secret = models.CharField(max_length=255, blank=True, null=True)
    otp_backup_codes = models.JSONField(default=list, blank=True, null=True)
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='customuser_set',
        blank=True,
        help_text='The groups this user belongs to.',
        related_query_name='user',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='customuser_set',
        blank=True,
        help_text='Specific permissions for this user.',
        related_query_name='user',
    )

    def get_permissions(self):
        """
        Retrieve all unique permissions across user's roles
        """
        return Permission.objects.filter(
            roles__users=self,
            is_active=True
        ).distinct()

    def get_roles(self):
        """
        Returns a list of role names for the user
        """
        return list(self.roles.values_list('name', flat=True))

    def is_role(self, role_name):
        """
        Check if user has a specific role
        """
        return role_name in self.get_roles()

    def has_role_permission(self, permission_name):
        if self.is_superuser:
            return True

        # Check custom role-based permissions
        has_custom_permission = Permission.objects.filter(
            roles__users=self,
            name=permission_name,
            is_active=True
        ).exists()

        if has_custom_permission:
            return True

        # Check Django permissions
        try:
            app_label, codename = permission_name.split('.')
            return self.has_perm(f'{app_label}.{codename}')
        except ValueError:
            return False

    def has_module_perms(self, app_label):
        """
        Override to check permissions across roles
        """
        return self.is_active and (
            self.is_superuser or
            Permission.objects.filter(
                roles__users=self,
                name__startswith=f'{app_label}.',
                is_active=True
            ).exists()
        )

    def has_perm(self, perm, obj=None):
        """
        Robust permission checking with real-time role validation
        """
        # Immediately return False if user is not active
        if not self.is_active:
            return False

        # Superuser always has full access
        if self.is_superuser:
            return True

        # Real-time permission check based on current roles
        current_active_permissions = Permission.objects.filter(
            roles__users=self,  # Permissions from current roles
            roles__is_active=True,  # Only from active roles
            name=perm,
            is_active=True
        )

        return current_active_permissions.exists()

    def add_role_permission(self, permission):
        """
        Adds a permission to the user via their roles.
        If no suitable role exists, creates a new one.
        """
        # Get or create a default role for the user
        if not isinstance(permission, Permission):
            return False
            
        # Get or create a default role for the user
        default_role, _ = Role.objects.get_or_create(
            name=f'role_{self.username}',
            defaults={'description': f'Default role for {self.username}'}
        )
        
        # Add the role to the user if not already added
        if default_role not in self.roles.all():
            self.roles.add(default_role)
            
        # Add the permission to the role
        default_role.permissions.add(permission)
        return True

    def remove_role_permission(self, permission):
        """
        Removes a permission from all of the user's roles.
        Accepts either a Permission object or a permission name string.
        """
        try:
            if isinstance(permission, Permission):
                permission_obj = permission
            else:
                app_label, codename = permission.split('.')
                permission_obj = Permission.objects.get(
                    content_type__app_label=app_label,
                    codename=codename
                )

            removed = False
            for role in self.roles.all():
                if permission_obj in role.permissions.all():
                    role.permissions.remove(permission_obj)
                    removed = True

            return removed

        except (ValueError, AttributeError, Permission.DoesNotExist):
            return False


    def clear_role_permissions(self):
        """
        Removes all permissions from all of the user's roles.
        """
        for role in self.roles.all():
            role.permissions.clear()

    def enable_2fa(self):
        """Enable 2FA and generate OTP secret key"""
        if not self.otp_secret:
            # Generate a secure random secret
            self.otp_secret = base64.b32encode(os.urandom(10)).decode('utf-8')
        
        self.two_factor_enabled = True
        self.save()
        return self.otp_secret
    
    def disable_2fa(self):
        """Disable 2FA and clear OTP secret"""
        self.two_factor_enabled = False
        self.otp_secret = None
        self.otp_backup_codes = []
        self.save()
        
    def verify_otp(self, provided_code):
        """Verify the OTP code"""
        if not self.two_factor_enabled or not self.otp_secret:
            return False
            
        totp = pyotp.TOTP(self.otp_secret)
        return totp.verify(provided_code)
    
    def generate_backup_codes(self, count=5):
        """Generate backup codes for 2FA recovery"""
        backup_codes = []
        for i in range(count):
            # Generate a random 8-character backup code
            code = ''.join([str(random.randint(0, 9)) for _ in range(8)])
            backup_codes.append(code)
            
        self.otp_backup_codes = backup_codes
        self.save()
        return backup_codes
    
    def verify_backup_code(self, code):
        """Verify and consume a backup code"""
        if not self.otp_backup_codes:
            return False
            
        if code in self.otp_backup_codes:
            # Remove the used backup code
            codes = self.otp_backup_codes
            codes.remove(code)
            self.otp_backup_codes = codes
            self.save()
            return True
            
        return False
    
    def get_otp_uri(self):
        """Get the OTP URI for QR code generation"""
        if not self.otp_secret:
            return None
            
        totp = pyotp.TOTP(self.otp_secret)
        return totp.provisioning_uri(name=self.username, issuer_name="verifi")

    def __str__(self):
        return self.username

class PermissionChangeLog(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    previous_roles = models.TextField()
    new_roles = models.TextField()
    changed_by = models.ForeignKey(CustomUser, related_name='role_changes', on_delete=models.SET_NULL, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        # Additional validation or notification logic
        super().save(*args, **kwargs)


class PermissionAuditLog(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)
    resource = models.CharField(max_length=255)
    status = models.CharField(max_length=50)
    
    @classmethod
    def log_permission_event(cls, user, action, resource, status='SUCCESS'):
        """
        Centralized method for logging permission-related events
        """
        cls.objects.create(
            user=user,
            action=action,
            resource=resource,
            status=status
        )


class UserPreference(models.Model):
    """
    This model represents user preferences.
    """
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='preferences')
    dark_mode = models.BooleanField(default=False)
    notification_frequency = models.CharField(max_length=10, choices=[('daily', 'Daily'), ('weekly', 'Weekly'), ('monthly', 'Monthly')], default='daily')

    def __str__(self):
        return f"{self.user.username}'s preferences"

class Insight(models.Model):
    """
    This model represents business insights.
    """
    title = models.CharField(max_length=255)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class TwoFactorActivityLog(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    activity_type = models.CharField(max_length=50, choices=[
        ('ENABLED', '2FA Enabled'),
        ('DISABLED', '2FA Disabled'),
        ('VERIFIED', '2FA Verified'),
        ('FAILED', '2FA Failed Attempt'),
        ('BACKUP_USED', 'Backup Code Used'),
        ('CODES_REGENERATED', 'Backup Codes Regenerated')
    ])
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
