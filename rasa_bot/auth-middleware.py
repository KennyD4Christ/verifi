from sanic import Blueprint, response
from sanic.request import Request
import jwt
from typing import Text, Callable, Awaitable, Dict, Any
import os

# Configure your secret key - should match the one used to create tokens in your React app
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')  # Use environment variable in production

class AuthMiddleware:
    """Custom authentication middleware for Rasa to verify JWT tokens."""
    
    @classmethod
    async def authenticate(cls, request: Request) -> Dict[Text, Any]:
        """Authenticate the request by verifying the token."""
        auth_header = request.headers.get('Authorization')
        
        # Allow OPTIONS requests without authentication (for CORS preflight)
        if request.method == 'OPTIONS':
            return {'is_authenticated': True, 'user_id': None}
            
        if not auth_header:
            return {'is_authenticated': False, 'error': 'No authorization header provided'}
            
        try:
            # Extract the token from "Bearer <token>"
            token_type, token = auth_header.split()
            if token_type.lower() != 'bearer':
                return {'is_authenticated': False, 'error': 'Invalid token format'}
                
            # Verify the token
            payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            return {'is_authenticated': True, 'user_id': payload.get('user_id')}
            
        except jwt.ExpiredSignatureError:
            return {'is_authenticated': False, 'error': 'Token expired'}
        except jwt.InvalidTokenError:
            return {'is_authenticated': False, 'error': 'Invalid token'}
        except Exception as e:
            return {'is_authenticated': False, 'error': str(e)}

# Function to create the auth middleware blueprint
def create_auth_blueprint():
    auth_bp = Blueprint('auth_middleware', url_prefix='')
    
    @auth_bp.middleware('request')
    async def authenticate_request(request: Request):
        # Skip authentication for non-webhook endpoints
        if not request.path.startswith('/webhooks/rest/webhook'):
            return
            
        auth_result = await AuthMiddleware.authenticate(request)
        
        if not auth_result.get('is_authenticated'):
            return response.json(
                {'error': auth_result.get('error', 'Authentication failed')},
                status=401
            )
            
        # Attach user_id to request context for use in custom actions
        request.ctx.user_id = auth_result.get('user_id')

    return auth_bp
