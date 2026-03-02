import asyncio
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class Broadcaster:
    def __init__(self):
        self._clients: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._clients.append(ws)
        logger.info("WebSocket client connected (%d total)", len(self._clients))

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self._clients = [c for c in self._clients if c is not ws]
        logger.info("WebSocket client disconnected (%d total)", len(self._clients))

    async def broadcast(self, message: str):
        async with self._lock:
            clients = list(self._clients)
        dead: list[WebSocket] = []
        for client in clients:
            try:
                await client.send_text(message)
            except Exception:
                dead.append(client)
        if dead:
            async with self._lock:
                self._clients = [c for c in self._clients if c not in dead]


broadcaster = Broadcaster()
