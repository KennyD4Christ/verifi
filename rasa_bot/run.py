import asyncio
import os
from rasa.core.agent import Agent
from rasa.utils.endpoints import EndpointConfig
from rasa.core.channels.socketio import SocketIOInput
from rasa.core.channels.rest import RestInput
from rasa.core.utils import AvailableEndpoints
from auth_middleware import create_auth_blueprint  # Import the auth middleware

def load_agent():
    model_path = os.getenv('RASA_MODEL_PATH', './models')
    endpoints_file = os.getenv('RASA_ENDPOINTS', 'endpoints.yml')
    endpoints = AvailableEndpoints.read_endpoints(endpoints_file)
    
    # Load agent with custom action endpoint if specified
    action_endpoint = None
    if endpoints and endpoints.action:
        action_endpoint = endpoints.action
    
    return Agent.load(model_path, action_endpoint=action_endpoint)

async def run_server():
    port = int(os.getenv('PORT', 5005))
    
    # Create auth middleware blueprint
    auth_blueprint = create_auth_blueprint()
    
    # Create custom SocketIO input with CORS settings
    socketio_input = SocketIOInput(
        # Use the settings from your credentials.yml
        user_message_evt="user_uttered",
        bot_message_evt="bot_uttered",
        session_persistence=True,
        cors_allowed_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
        async_mode="aiohttp",
        ping_timeout=120,
        ping_interval=60,
        path="/socket.io/"
    )
    
    # Create rest input
    rest_input = RestInput()
    
    agent = await load_agent()
    
    # Include auth blueprint when running server
    app = socketio_input.blueprint(agent)
    app.blueprint(rest_input.blueprint(agent))
    app.blueprint(auth_blueprint)  # Register auth middleware
    
    app.run(host='0.0.0.0', port=port, debug=False)

if __name__ == '__main__':
    asyncio.run(run_server())
