from django.core.management.base import BaseCommand
from daphne.server import Server
from daphne.endpoints import build_endpoint_description_strings
from config.asgi import application
import asyncio

class Command(BaseCommand):
    help = 'Runs the server with Daphne'

    def add_arguments(self, parser):
        parser.add_argument('addrport', nargs='?', default='0.0.0.0:8000', help='Optional port number, or ipaddr:port')

    def handle(self, *args, **options):
        addrport = options['addrport']
        host, port = addrport.split(':')
        port = int(port)

        async def run():
            endpoints = build_endpoint_description_strings(host=host, port=port)
            server = Server(application, endpoints=endpoints)
            await server.run()

        asyncio.run(run())
