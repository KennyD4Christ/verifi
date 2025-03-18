from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Role, Permission

class CustomUserAdmin(UserAdmin):
    # Custom user admin class to include additional user fields
    model = CustomUser
    fieldsets = UserAdmin.fieldsets + (
        (None, {'fields': ('phone_number', 'roles')}),
    )

admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(Role)
admin.site.register(Permission)
