from django.apps import AppConfig


class CoreConfig(AppConfig):
    """
    Core application configuration for the project.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        import core.signals  # This ensures that the signals are connected
