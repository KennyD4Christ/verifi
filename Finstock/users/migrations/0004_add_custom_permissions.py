from django.db import migrations

def create_permissions(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    
    permissions_data = [
        # Invoice Permissions
        {'name': 'view_invoice', 'category': 'RESOURCE', 'description': 'Can view invoices'},
        {'name': 'create_invoice', 'category': 'RESOURCE', 'description': 'Can create invoices'},
        {'name': 'edit_invoice', 'category': 'RESOURCE', 'description': 'Can edit invoices'},
        {'name': 'delete_invoice', 'category': 'RESOURCE', 'description': 'Can delete invoices'},
        
        # Product Permissions
        {'name': 'view_product', 'category': 'RESOURCE', 'description': 'Can view products'},
        {'name': 'create_product', 'category': 'RESOURCE', 'description': 'Can create products'},
        {'name': 'edit_product', 'category': 'RESOURCE', 'description': 'Can edit products'},
        {'name': 'delete_product', 'category': 'RESOURCE', 'description': 'Can delete products'},

        # StockAdjustment Permissions
        {'name': 'view_adjustment', 'category': 'RESOURCE', 'description': 'Can view adjustments'},
        {'name': 'create_adjustment', 'category': 'RESOURCE', 'description': 'Can create adjustments'},
        {'name': 'edit_adjustment', 'category': 'RESOURCE', 'description': 'Can edit adjustments'},
        {'name': 'delete_adjustment', 'category': 'RESOURCE', 'description': 'Can delete adjustments'},

        # Transaction Permissions
        {'name': 'view_transaction', 'category': 'RESOURCE', 'description': 'Can view transactions'},
        {'name': 'create_transaction', 'category': 'RESOURCE', 'description': 'Can create transactions'},
        {'name': 'edit_transaction', 'category': 'RESOURCE', 'description': 'Can edit transactions'},
        {'name': 'delete_transaction', 'category': 'RESOURCE', 'description': 'Can delete transactions'},

        # Report Permissions
        {'name': 'view_report', 'category': 'RESOURCE', 'description': 'Can view reports'},
        {'name': 'create_report', 'category': 'RESOURCE', 'description': 'Can create reports'},
        {'name': 'edit_report', 'category': 'RESOURCE', 'description': 'Can edit reports'},
        {'name': 'delete_report', 'category': 'RESOURCE', 'description': 'Can delete reports'},
    ]
    
    for perm_data in permissions_data:
        Permission.objects.get_or_create(**perm_data)

class Migration(migrations.Migration):
    dependencies = [
        ('users', '0003_permission_category_permission_is_active'),
    ]

    operations = [
        migrations.RunPython(create_permissions),
    ]
