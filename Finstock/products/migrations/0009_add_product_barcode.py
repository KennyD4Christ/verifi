from django.db import migrations, models
import uuid

def generate_barcodes(apps, schema_editor):
    if schema_editor.connection.alias != 'default':
        return
    Product = apps.get_model('products', 'Product')
    db_alias = schema_editor.connection.alias
    products = Product.objects.using(db_alias).all()
    
    for product in products:
        while True:
            new_barcode = f"PRD{str(uuid.uuid4())[:8].upper()}"
            if not Product.objects.using(db_alias).filter(barcode=new_barcode).exists():
                product.barcode = new_barcode
                product.save(using=db_alias)
                break

def reverse_migration(apps, schema_editor):
    if schema_editor.connection.alias != 'default':
        return
    Product = apps.get_model('products', 'Product')
    db_alias = schema_editor.connection.alias
    Product.objects.using(db_alias).update(barcode=None)

class Migration(migrations.Migration):
    dependencies = [
        ('products', '0008_product_qr_code_product_qr_code_data'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='barcode',
            field=models.CharField(
                max_length=100,
                unique=True,
                null=True,
                blank=True,
            ),
        ),
        migrations.RunPython(
            generate_barcodes,
            reverse_migration,
        ),
    ]
