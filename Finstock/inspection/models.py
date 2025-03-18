# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.db import models


class AuthGroup(models.Model):
    name = models.CharField(unique=True, max_length=150)   

    class Meta:
        managed = False
        db_table = 'auth_group'


class AuthGroupPermissions(models.Model):
    id = models.BigAutoField(primary_key=True)
    group = models.ForeignKey(AuthGroup, models.DO_NOTHING)
    permission = models.ForeignKey('AuthPermission', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'auth_group_permissions'
        unique_together = (('group', 'permission'),)       


class AuthPermission(models.Model):
    name = models.CharField(max_length=255)
    content_type = models.ForeignKey('DjangoContentType', models.DO_NOTHING)
    codename = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = 'auth_permission'
        unique_together = (('content_type', 'codename'),)  


class AuthtokenToken(models.Model):
    key = models.CharField(primary_key=True, max_length=40)
    created = models.DateTimeField()
    user = models.OneToOneField('UsersCustomuser', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'authtoken_token'


class CoreAddress(models.Model):
    id = models.BigAutoField(primary_key=True)
    street = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = 'core_address'


class CoreCompanyinfo(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255)
    address = models.TextField()
    phone = models.CharField(max_length=20)

    class Meta:
        managed = False
        db_table = 'core_companyinfo'


class CoreCustomer(models.Model):
    id = models.BigAutoField(primary_key=True)
    created = models.DateTimeField()
    modified = models.DateTimeField()
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.CharField(unique=True, max_length=254)  
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.OneToOneField(CoreAddress, models.DO_NOTHING, blank=True, null=True)
    billing_address = models.OneToOneField(CoreAddress, models.DO_NOTHING, related_name='corecustomer_billing_address_set', blank=True, null=True)
    user = models.OneToOneField('UsersCustomuser', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'core_customer'


class CoreOrder(models.Model):
    id = models.BigAutoField(primary_key=True)
    created = models.DateTimeField()
    modified = models.DateTimeField()
    order_date = models.DateTimeField()
    shipped_date = models.DateTimeField(blank=True, null=True)
    is_paid = models.IntegerField()
    customer = models.ForeignKey(CoreCustomer, models.DO_NOTHING)
    billing_address = models.ForeignKey(CoreAddress, models.DO_NOTHING, blank=True, null=True)
    estimated_delivery = models.DateTimeField(blank=True, null=True)
    shipping_address = models.ForeignKey(CoreAddress, models.DO_NOTHING, related_name='coreorder_shipping_address_set', blank=True, null=True)
    special_instructions = models.TextField()
    status = models.CharField(max_length=20)
    tracking_number = models.CharField(max_length=100)     
    previous_status = models.CharField(max_length=20, blank=True, null=True)
    invoice = models.OneToOneField('InvoicesInvoice', models.DO_NOTHING, blank=True, null=True)
    user = models.ForeignKey('UsersCustomuser', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'core_order'


class CoreOrderitem(models.Model):
    id = models.BigAutoField(primary_key=True)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    order = models.ForeignKey(CoreOrder, models.DO_NOTHING)
    product = models.ForeignKey('ProductsProduct', models.DO_NOTHING)
    customization = models.TextField()

    class Meta:
        managed = False
        db_table = 'core_orderitem'


class CoreOrderpromotion(models.Model):
    id = models.BigAutoField(primary_key=True)
    order = models.ForeignKey(CoreOrder, models.DO_NOTHING)
    promotion = models.ForeignKey('CorePromotion', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_orderpromotion'


class CorePromotion(models.Model):
    id = models.BigAutoField(primary_key=True)
    code = models.CharField(unique=True, max_length=50)    
    description = models.TextField()
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2)
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()
    is_active = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'core_promotion'


class CoreVisit(models.Model):
    id = models.BigAutoField(primary_key=True)
    session_id = models.CharField(max_length=64)
    ip_address = models.CharField(max_length=39, blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)   
    referrer_url = models.CharField(max_length=2000, blank=True, null=True)
    visited_url = models.CharField(max_length=2000)        
    timestamp = models.DateTimeField()
    geo_location = models.CharField(max_length=255, blank=True, null=True)
    device_type = models.CharField(max_length=50, blank=True, null=True)
    operating_system = models.CharField(max_length=100, blank=True, null=True)
    user = models.ForeignKey('UsersCustomuser', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'core_visit'


class DjangoAdminLog(models.Model):
    action_time = models.DateTimeField()
    object_id = models.TextField(blank=True, null=True)    
    object_repr = models.CharField(max_length=200)
    action_flag = models.PositiveSmallIntegerField()       
    change_message = models.TextField()
    content_type = models.ForeignKey('DjangoContentType', models.DO_NOTHING, blank=True, null=True)
    user = models.ForeignKey('UsersCustomuser', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'django_admin_log'


class DjangoContentType(models.Model):
    app_label = models.CharField(max_length=100)
    model = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = 'django_content_type'
        unique_together = (('app_label', 'model'),)        


class DjangoMigrations(models.Model):
    id = models.BigAutoField(primary_key=True)
    app = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    applied = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'django_migrations'


class DjangoSession(models.Model):
    session_key = models.CharField(primary_key=True, max_length=40)
    session_data = models.TextField()
    expire_date = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'django_session'


class InvoicesInvoice(models.Model):
    id = models.BigAutoField(primary_key=True)
    created = models.DateTimeField()
    modified = models.DateTimeField()
    invoice_number = models.CharField(unique=True, max_length=32)
    issue_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=20)
    user = models.ForeignKey('UsersCustomuser', models.DO_NOTHING)
    customer = models.ForeignKey(CoreCustomer, models.DO_NOTHING, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed = False
        db_table = 'invoices_invoice'


class InvoicesInvoiceitem(models.Model):
    id = models.BigAutoField(primary_key=True)
    description = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    invoice = models.ForeignKey(InvoicesInvoice, models.DO_NOTHING)
    product = models.ForeignKey('ProductsProduct', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'invoices_invoiceitem'


class ProductsCategory(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)  

    class Meta:
        managed = False
        db_table = 'products_category'


class ProductsProduct(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)  
    price = models.DecimalField(max_digits=10, decimal_places=2)
    sku = models.CharField(unique=True, max_length=100)    
    stock = models.PositiveIntegerField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField()
    category = models.ForeignKey(ProductsCategory, models.DO_NOTHING)
    sales = models.PositiveIntegerField()
    is_active = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'products_product'


class ProductsProductimage(models.Model):
    id = models.BigAutoField(primary_key=True)
    image = models.CharField(max_length=100)
    alt_text = models.CharField(max_length=255, blank=True, null=True)
    product = models.ForeignKey(ProductsProduct, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'products_productimage'


class ProductsReview(models.Model):
    id = models.BigAutoField(primary_key=True)
    rating = models.PositiveIntegerField()
    comment = models.TextField(blank=True, null=True)      
    created_at = models.DateTimeField()
    product = models.ForeignKey(ProductsProduct, models.DO_NOTHING)
    user = models.ForeignKey('UsersCustomuser', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'products_review'


class ReportsCalculatedfield(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255)
    formula = models.TextField()
    created_at = models.DateTimeField()
    created_by = models.ForeignKey('UsersCustomuser', models.DO_NOTHING, blank=True, null=True)
    report = models.ForeignKey('ReportsReport', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'reports_calculatedfield'


class ReportsReport(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)  
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    created_by = models.ForeignKey('UsersCustomuser', models.DO_NOTHING, blank=True, null=True)
    is_archived = models.IntegerField()
    is_template = models.IntegerField()
    last_modified_by = models.ForeignKey('UsersCustomuser', models.DO_NOTHING, related_name='reportsreport_last_modified_by_set', blank=True, null=True)
    last_run = models.DateTimeField(blank=True, null=True) 
    schedule = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'reports_report'


class ReportsReportaccesslog(models.Model):
    id = models.BigAutoField(primary_key=True)
    accessed_at = models.DateTimeField()
    action = models.CharField(max_length=50)
    report = models.ForeignKey(ReportsReport, models.DO_NOTHING)
    user = models.ForeignKey('UsersCustomuser', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'reports_reportaccesslog'


class ReportsReportentry(models.Model):
    id = models.BigAutoField(primary_key=True)
    title = models.CharField(max_length=255)
    content = models.TextField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    report = models.ForeignKey(ReportsReport, models.DO_NOTHING)
    created_by = models.ForeignKey('UsersCustomuser', models.DO_NOTHING, blank=True, null=True)
    last_modified_by = models.ForeignKey('UsersCustomuser', models.DO_NOTHING, related_name='reportsreportentry_last_modified_by_set', blank=True, null=True)
    order = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'reports_reportentry'


class ReportsReportfile(models.Model):
    id = models.BigAutoField(primary_key=True)
    file = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField()
    entry = models.ForeignKey(ReportsReportentry, models.DO_NOTHING)
    uploaded_by = models.ForeignKey('UsersCustomuser', models.DO_NOTHING, blank=True, null=True)
    file_type = models.CharField(max_length=50)

    class Meta:
        managed = False
        db_table = 'reports_reportfile'


class StockAdjustmentsStockadjustment(models.Model):       
    id = models.BigAutoField(primary_key=True)
    quantity = models.IntegerField()
    adjustment_date = models.DateField()
    adjusted_by = models.ForeignKey('UsersCustomuser', models.DO_NOTHING, blank=True, null=True)
    product = models.ForeignKey(ProductsProduct, models.DO_NOTHING)
    adjustment_type = models.CharField(max_length=10)      
    reason = models.TextField()

    class Meta:
        managed = False
        db_table = 'stock_adjustments_stockadjustment'     


class TransactionsTransaction(models.Model):
    id = models.BigAutoField(primary_key=True)
    created = models.DateTimeField()
    modified = models.DateTimeField()
    transaction_type = models.CharField(max_length=20)     
    category = models.CharField(max_length=50, blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    payment_method = models.CharField(max_length=20)       
    status = models.CharField(max_length=10)
    customer = models.ForeignKey(CoreCustomer, models.DO_NOTHING, blank=True, null=True)
    invoice = models.ForeignKey(InvoicesInvoice, models.DO_NOTHING, blank=True, null=True)
    order = models.ForeignKey(CoreOrder, models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'transactions_transaction'


class UsersCustomuser(models.Model):
    id = models.BigAutoField(primary_key=True)
    password = models.CharField(max_length=128)
    last_login = models.DateTimeField(blank=True, null=True)
    is_superuser = models.IntegerField()
    username = models.CharField(unique=True, max_length=150)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.CharField(max_length=254)
    is_staff = models.IntegerField()
    is_active = models.IntegerField()
    date_joined = models.DateTimeField()
    phone_number = models.CharField(max_length=15, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'users_customuser'


class UsersCustomuserGroups(models.Model):
    id = models.BigAutoField(primary_key=True)
    customuser = models.ForeignKey(UsersCustomuser, models.DO_NOTHING)
    group = models.ForeignKey(AuthGroup, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'users_customuser_groups'
        unique_together = (('customuser', 'group'),)       


class UsersCustomuserRoles(models.Model):
    id = models.BigAutoField(primary_key=True)
    customuser = models.ForeignKey(UsersCustomuser, models.DO_NOTHING)
    role = models.ForeignKey('UsersRole', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'users_customuser_roles'
        unique_together = (('customuser', 'role'),)        


class UsersCustomuserUserPermissions(models.Model):        
    id = models.BigAutoField(primary_key=True)
    customuser = models.ForeignKey(UsersCustomuser, models.DO_NOTHING)
    permission = models.ForeignKey(AuthPermission, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'users_customuser_user_permissions'     
        unique_together = (('customuser', 'permission'),)  


class UsersInsight(models.Model):
    id = models.BigAutoField(primary_key=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'users_insight'


class UsersPermission(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(unique=True, max_length=50)    
    description = models.TextField()
    category = models.CharField(max_length=50)
    is_active = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'users_permission'


class UsersPermissionauditlog(models.Model):
    id = models.BigAutoField(primary_key=True)
    action = models.CharField(max_length=255)
    timestamp = models.DateTimeField()
    resource = models.CharField(max_length=255)
    status = models.CharField(max_length=50)
    user = models.ForeignKey(UsersCustomuser, models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'users_permissionauditlog'


class UsersPermissionchangelog(models.Model):
    id = models.BigAutoField(primary_key=True)
    previous_roles = models.TextField()
    new_roles = models.TextField()
    timestamp = models.DateTimeField()
    changed_by = models.ForeignKey(UsersCustomuser, models.DO_NOTHING, blank=True, null=True)
    user = models.ForeignKey(UsersCustomuser, models.DO_NOTHING, related_name='userspermissionchangelog_user_set')    

    class Meta:
        managed = False
        db_table = 'users_permissionchangelog'


class UsersRole(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(unique=True, max_length=50)    
    description = models.TextField()
    is_active = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'users_role'


class UsersRolePermissions(models.Model):
    id = models.BigAutoField(primary_key=True)
    role = models.ForeignKey(UsersRole, models.DO_NOTHING) 
    permission = models.ForeignKey(UsersPermission, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'users_role_permissions'
        unique_together = (('role', 'permission'),)        


class UsersUserpreference(models.Model):
    id = models.BigAutoField(primary_key=True)
    dark_mode = models.IntegerField()
    notification_frequency = models.CharField(max_length=10)
    user = models.OneToOneField(UsersCustomuser, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'users_userpreference'
