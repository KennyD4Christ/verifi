from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth import get_user_model
from users.models import Role, Permission
from users.constants import PermissionConstants

class Command(BaseCommand):
    help = 'Initialize comprehensive system roles and permissions'

    def handle(self, *args, **options):
        # Clear existing permissions to prevent duplicates
        Permission.objects.all().delete()

        # Define comprehensive permissions
        permissions_to_create = [
            # User Management Permissions
            {
                'name': PermissionConstants.USER_VIEW_ALL,
                'description': 'View all users in the system',
                'category': 'USER'
            },
            {
                'name': PermissionConstants.USER_CREATE,
                'description': 'Create new users',
                'category': 'USER'
            },
            {
                'name': PermissionConstants.USER_EDIT,
                'description': 'Edit existing user details',
                'category': 'USER'
            },
            {
                'name': PermissionConstants.USER_DELETE,
                'description': 'Delete users from the system',
                'category': 'USER'
            },

            # Product Permissions
            {
                'name': PermissionConstants.PRODUCT_VIEW,
                'description': 'View product information',
                'category': 'RESOURCE'
            },
            {
                'name': PermissionConstants.PRODUCT_CREATE,
                'description': 'Add new products',
                'category': 'RESOURCE'
            },
            {
                'name': PermissionConstants.PRODUCT_EDIT,
                'description': 'Modify product details',
                'category': 'RESOURCE'
            },
            {
                'name': PermissionConstants.PRODUCT_DELETE,
                'description': 'Remove products from the system',
                'category': 'RESOURCE'
            },

            # Invoice Permissions
            {
                'name': PermissionConstants.INVOICE_VIEW,
                'description': 'View invoice information',
                'category': 'FINANCE'
            },
            {
                'name': PermissionConstants.INVOICE_CREATE,
                'description': 'Create new invoices',
                'category': 'FINANCE'
            },
            {
                'name': PermissionConstants.INVOICE_EDIT,
                'description': 'Modify invoice details',
                'category': 'FINANCE'
            },
            {
                'name': PermissionConstants.INVOICE_DELETE,
                'description': 'Delete invoices from the system',
                'category': 'FINANCE'
            },

            # Transaction Permissions
            {
                'name': PermissionConstants.TRANSACTION_VIEW,
                'description': 'View transaction details',
                'category': 'FINANCE'
            },
            {
                'name': PermissionConstants.TRANSACTION_CREATE,
                'description': 'Create new transactions',
                'category': 'FINANCE'
            },
            {
                'name': PermissionConstants.TRANSACTION_EDIT,
                'description': 'Modify transaction details',
                'category': 'FINANCE'
            },
            {
                'name': PermissionConstants.TRANSACTION_DELETE,
                'description': 'Delete transactions',
                'category': 'FINANCE'
            },

            # Stock Adjustment Permissions
            {
                'name': PermissionConstants.STOCK_ADJUSTMENT_VIEW,
                'description': 'View stock adjustments',
                'category': 'INVENTORY'
            },
            {
                'name': PermissionConstants.STOCK_ADJUSTMENT_CREATE,
                'description': 'Create stock adjustments',
                'category': 'INVENTORY'
            },
            {
                'name': PermissionConstants.STOCK_ADJUSTMENT_EDIT,
                'description': 'Modify stock adjustments',
                'category': 'INVENTORY'
            },
            {
                'name': PermissionConstants.STOCK_ADJUSTMENT_DELETE,
                'description': 'Delete stock adjustments',
                'category': 'INVENTORY'
            },

            # Report Permissions
            {
                'name': PermissionConstants.REPORT_VIEW,
                'description': 'View system reports',
                'category': 'REPORTING'
            },
            {
                'name': PermissionConstants.REPORT_CREATE,
                'description': 'Generate new reports',
                'category': 'REPORTING'
            },
            {
                'name': PermissionConstants.REPORT_EDIT,
                'description': 'Modify report parameters',
                'category': 'REPORTING'
            },
            {
                'name': PermissionConstants.REPORT_DELETE,
                'description': 'Delete reports',
                'category': 'REPORTING'
            },

            # Order Management Permissions
            {
                'name': PermissionConstants.ORDER_VIEW,
                'description': 'View order information',
                'category': 'ORDER'
            },
            {
                'name': PermissionConstants.ORDER_CREATE,
                'description': 'Create new orders',
                'category': 'ORDER'
            },
            {
                'name': PermissionConstants.ORDER_EDIT,
                'description': 'Modify order details',
                'category': 'ORDER'
            },
            {
                'name': PermissionConstants.ORDER_DELETE,
                'description': 'Delete orders from the system',
                'category': 'ORDER'
            },
            {
                'name': PermissionConstants.ORDER_STATUS_UPDATE,
                'description': 'Update order status',
                'category': 'ORDER'
            },
            {
                'name': PermissionConstants.ORDER_ASSIGN,
                'description': 'Assign orders to sales representatives',
                'category': 'ORDER'
            },

            # System-level Permissions
            {
                'name': PermissionConstants.SYSTEM_FULL_ACCESS,
                'description': 'Complete system access',
                'category': 'SYSTEM'
            },
            {
                'name': PermissionConstants.SYSTEM_ANALYTICS_ACCESS,
                'description': 'Access to system analytics and reports',
                'category': 'SYSTEM'
            }
        ]

        # Create permissions
        created_permissions = []
        for perm_data in permissions_to_create:
            permission, created = Permission.objects.get_or_create(
                name=perm_data['name'],
                defaults={
                    'description': perm_data['description'],
                    'category': perm_data['category'],
                    'is_active': True
                }
            )
            created_permissions.append(permission)
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f"Permission '{perm_data['name']}' created successfully")
                )

        # Define roles with their associated permissions
        roles = {
            "Administrator": [
                # System Permissions
                PermissionConstants.SYSTEM_FULL_ACCESS,
                PermissionConstants.SYSTEM_ANALYTICS_ACCESS,
                
                # User Management
                PermissionConstants.USER_VIEW_ALL,
                PermissionConstants.USER_CREATE,
                PermissionConstants.USER_EDIT,
                PermissionConstants.USER_DELETE,
                
                # Product Management
                PermissionConstants.PRODUCT_VIEW,
                PermissionConstants.PRODUCT_CREATE,
                PermissionConstants.PRODUCT_EDIT,
                PermissionConstants.PRODUCT_DELETE,
                
                # Invoice Management
                PermissionConstants.INVOICE_VIEW,
                PermissionConstants.INVOICE_CREATE,
                PermissionConstants.INVOICE_EDIT,
                PermissionConstants.INVOICE_DELETE,
                
                # Transaction Management
                PermissionConstants.TRANSACTION_VIEW,
                PermissionConstants.TRANSACTION_CREATE,
                PermissionConstants.TRANSACTION_EDIT,
                PermissionConstants.TRANSACTION_DELETE,
                
                # Stock Adjustment Management
                PermissionConstants.STOCK_ADJUSTMENT_VIEW,
                PermissionConstants.STOCK_ADJUSTMENT_CREATE,
                PermissionConstants.STOCK_ADJUSTMENT_EDIT,
                PermissionConstants.STOCK_ADJUSTMENT_DELETE,
                
                # Report Management
                PermissionConstants.REPORT_VIEW,
                PermissionConstants.REPORT_CREATE,
                PermissionConstants.REPORT_EDIT,
                PermissionConstants.REPORT_DELETE,

                # Order Management
                PermissionConstants.ORDER_VIEW,
                PermissionConstants.ORDER_CREATE,
                PermissionConstants.ORDER_EDIT,
                PermissionConstants.ORDER_DELETE,
                PermissionConstants.ORDER_STATUS_UPDATE,
                PermissionConstants.ORDER_ASSIGN
            ],
            "Accountant": [
                PermissionConstants.INVOICE_VIEW,
                PermissionConstants.INVOICE_CREATE,
                PermissionConstants.TRANSACTION_VIEW,
                PermissionConstants.TRANSACTION_CREATE,
                PermissionConstants.PRODUCT_VIEW,
                PermissionConstants.ORDER_VIEW,
            ],
            "Inventory Manager": [
                PermissionConstants.PRODUCT_VIEW,
                PermissionConstants.PRODUCT_EDIT,
                PermissionConstants.STOCK_ADJUSTMENT_VIEW,
                PermissionConstants.STOCK_ADJUSTMENT_CREATE,
                PermissionConstants.STOCK_ADJUSTMENT_EDIT,
                PermissionConstants.ORDER_VIEW,
                PermissionConstants.ORDER_STATUS_UPDATE,
            ],
            "Sales Representative": [
                PermissionConstants.PRODUCT_VIEW,
                PermissionConstants.INVOICE_CREATE,
                PermissionConstants.TRANSACTION_VIEW,
                PermissionConstants.ORDER_VIEW,
                PermissionConstants.ORDER_CREATE,
                PermissionConstants.ORDER_EDIT,
                PermissionConstants.ORDER_STATUS_UPDATE,
            ],
            "Auditor": [
                PermissionConstants.SYSTEM_ANALYTICS_ACCESS,
                PermissionConstants.REPORT_VIEW,
                PermissionConstants.TRANSACTION_VIEW,
                PermissionConstants.INVOICE_VIEW,
                PermissionConstants.ORDER_VIEW,
            ]
        }

        # Create roles and assign permissions
        for role_name, role_permissions in roles.items():
            role, created = Role.objects.get_or_create(name=role_name)
            
            # Find corresponding permission objects
            role_permission_objects = Permission.objects.filter(
                name__in=role_permissions
            )
            
            # Set permissions for the role
            role.permissions.set(role_permission_objects)
            role.save()

            self.stdout.write(
                self.style.SUCCESS(f"Role '{role_name}' created with {len(role_permission_objects)} permissions")
            )

        self.stdout.write(
            self.style.SUCCESS('System roles and permissions initialized successfully')
        )
