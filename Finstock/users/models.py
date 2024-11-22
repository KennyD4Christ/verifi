from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings

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

    def __str__(self):
        return self.name

class CustomUser(AbstractUser):
    """
    This model represents a custom user extending
    the built-in Django User model.
    """
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    roles = models.ManyToManyField(Role, related_name='users')
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='customuser_set',  # unique related_name
        blank=True,
        help_text='The groups this user belongs to.',
        related_query_name='user',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='customuser_set',  # unique related_name
        blank=True,
        help_text='Specific permissions for this user.',
        related_query_name='user',
    )

    def __str__(self):
        return self.username

# New models to add:

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
