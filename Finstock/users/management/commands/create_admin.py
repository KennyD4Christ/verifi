from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from users.models import Role

class Command(BaseCommand):
    help = 'Create or update the first administrator user'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, nargs='?', help='Username of the admin')
        parser.add_argument('password', type=str, nargs='?', help='Password for the admin')

    def handle(self, *args, **options):
        User = get_user_model()
        admin_role = Role.objects.get(name='Administrator')

        username = options['username'] or input('Enter username: ')
        password = options['password'] or input('Enter password: ')

        # Check if the user already exists
        user, created = User.objects.get_or_create(username=username)
        user.set_password(password)
        user.roles.add(admin_role)
        user.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f'Administrator {username} created successfully'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Administrator {username} updated successfully'))
