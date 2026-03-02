import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.broadcaster import broadcaster

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/events")
async def websocket_events(ws: WebSocket):
    await broadcaster.connect(ws)
    try:
        while True:
            # Keep connection alive; client can send pings
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await broadcaster.disconnect(ws)
