from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from users.models import Role

class Command(BaseCommand):
    help = 'Create or update the first administrator user'

    def add_arguments(self, parser):
        parser.add_argument('--username', type=str, help='Username of the admin')
        parser.add_argument('--password', type=str, help='Password for the admin')

    def handle(self, *args, **options):
        User = get_user_model()
        
        # Ensure the "Administrator" role exists
        try:
            admin_role = Role.objects.get(name='Administrator')
        except Role.DoesNotExist:
            self.stderr.write(self.style.ERROR('Administrator role does not exist. Please create it first.'))
            return

        # Prompt for username if not provided
        username = options['username']
        while not username:
            username = input('Enter username: ').strip()
            if not username:
                self.stderr.write(self.style.ERROR('Username cannot be empty.'))

        # Prompt for password if not provided
        password = options['password']
        while not password:
            password = input('Enter password: ').strip()
            if not password:
                self.stderr.write(self.style.ERROR('Password cannot be empty.'))

        # Create or update the administrator user
        user, created = User.objects.get_or_create(username=username)
        user.set_password(password)
        user.roles.add(admin_role)
        user.is_staff = True  # Assign staff status for admin-level access
        user.is_superuser = True  # Assign superuser status for full access
        user.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f'Administrator "{username}" created successfully.'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Administrator "{username}" updated successfully.'))
