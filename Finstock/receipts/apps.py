from django.apps import AppConfig


class ReceiptsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'receipts'
    verbose_name = 'Receipts'

    def ready(self):
        """
        Import and register signals when the application is ready.
        This is called once when Django starts.
        """
        # Import signals to ensure they are registered
        try:
            import receipts.signals
        except ImportError:
            pass
