from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from users.models import Role, Permission

class Command(BaseCommand):
    help = 'Initialize default roles and permissions'

    def handle(self, *args, **kwargs):
        # Create Administrator Role
        admin_role, created = Role.objects.get_or_create(
            name='Administrator',
            defaults={
                'description': 'Full system access and management role'
            }
        )

        # Create comprehensive admin permissions
        admin_permissions = [
            Permission.objects.get_or_create(
                name='admin.manage_users',
                defaults={
                    'description': 'Create, edit, and manage users',
                    'category': 'ADMIN'
                }
            )[0],
            Permission.objects.get_or_create(
                name='admin.manage_roles',
                defaults={
                    'description': 'Create, edit, and manage roles',
                    'category': 'ADMIN'
                }
            )[0]
        ]

        # Add permissions to Administrator role
        admin_role.permissions.add(*admin_permissions)

        self.stdout.write(self.style.SUCCESS('Successfully initialized Administrator role'))
