from django.utils.deprecation import MiddlewareMixin
from django.utils import timezone
from .models import Visit
from django_user_agents.utils import get_user_agent
import uuid

class VisitTrackingMiddleware(MiddlewareMixin):
    """
    Middleware to track unique visits to the application.
    """

    def process_request(self, request):
        # Skip logging for admin, static, and media paths
        if request.path.startswith('/admin/') or request.path.startswith('/static/') or request.path.startswith('/media/'):
            return

        # Generate or retrieve session ID
        session_id = request.session.get('session_id')
        if not session_id:
            session_id = str(uuid.uuid4())
            request.session['session_id'] = session_id

        # Get user info and IP
        user = request.user if request.user.is_authenticated else None
        ip_address = self.get_client_ip(request)

        # Check for an existing visit record for this session within the last 30 minutes
        recent_visit_exists = Visit.objects.filter(
            session_id=session_id,
            timestamp__gte=timezone.now() - timezone.timedelta(minutes=30)
        ).exists()

        if recent_visit_exists:
            return  # Skip creating a new Visit record if a recent one exists

        # Extract additional metadata
        user_agent_obj = get_user_agent(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        referrer_url = request.META.get('HTTP_REFERER', '')
        visited_url = request.build_absolute_uri()
        device_type = self.get_device_type(user_agent_obj)
        operating_system = self.get_operating_system(user_agent_obj)

        # Create a new Visit record for unique or timed visits
        Visit.objects.create(
            user=user,
            session_id=session_id,
            ip_address=ip_address,
            user_agent=user_agent,
            referrer_url=referrer_url,
            visited_url=visited_url,
            timestamp=timezone.now(),
            device_type=device_type,
            operating_system=operating_system
        )

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    def get_device_type(self, user_agent_obj):
        if user_agent_obj.is_mobile:
            return 'Mobile'
        elif user_agent_obj.is_tablet:
            return 'Tablet'
        elif user_agent_obj.is_pc:
            return 'Desktop'
        elif user_agent_obj.is_bot:
            return 'Bot'
        else:
            return 'Other'

    def get_operating_system(self, user_agent_obj):
        return user_agent_obj.os.family or 'Unknown'