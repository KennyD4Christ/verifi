import json
from channels.generic.websocket import AsyncWebsocketConsumer

class SocketIOConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send(text_data=json.dumps({"type": "connection", "data": "Connected"}))

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get('type') == 'message':
                await self.send(text_data=json.dumps({
                    'type': 'message',
                    'data': data.get('data')
                }))
        except json.JSONDecodeError:
            pass

