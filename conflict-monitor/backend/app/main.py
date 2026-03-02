import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.db import engine
from app.models import Base
from app.routes.events import router as events_router
from app.routes.ws import router as ws_router
from app.services.telegram import start_telegram_listener

logger = logging.getLogger("conflict-monitor")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables (replaced by Alembic in production)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready")

    # Start Telegram listener in background
    telegram_task = None
    if settings.telegram_api_id and settings.telegram_api_hash:
        telegram_task = asyncio.create_task(start_telegram_listener())
        logger.info("Telegram listener started")
    else:
        logger.warning("Telegram credentials not set — listener disabled")

    yield

    if telegram_task:
        telegram_task.cancel()


app = FastAPI(title="Conflict Monitor", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events_router)
app.include_router(ws_router)


@app.get("/")
async def health():
    return {"status": "ok"}
