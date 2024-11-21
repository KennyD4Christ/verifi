from django.utils.deprecation import MiddlewareMixin
from django.utils import timezone
from .models import Visit
from django_user_agents.utils import get_user_agent
import logging

logger = logging.getLogger(__name__)

class VisitTrackingMiddleware(MiddlewareMixin):
    """
    Middleware to track unique visits to the application.
    """
    def process_request(self, request):
        try:
            # Skip logging for admin, static, and media paths
            if request.path.startswith('/admin/') or request.path.startswith('/static/') or request.path.startswith('/media/'):
                return

            # Get user agent
            user_agent_obj = get_user_agent(request)

            # Create or update visit record
            try:
                Visit.create_visit(request, user_agent_obj)
            except Exception as e:
                logger.error(f"Error tracking visit: {str(e)}")

        except Exception as e:
            logger.error(f"Unexpected error in visit tracking: {str(e)}")
