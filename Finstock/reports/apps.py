from django.apps import AppConfig


class ReportsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'reports'
    verbose_name = 'Reports Management'

    def ready(self):
        # This method is called when Django starts so you can perform initialization tasks here
        pass  # No initialization tasks specified here
