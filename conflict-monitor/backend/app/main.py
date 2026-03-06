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
from app.routes.tracking import router as tracking_router
from app.routes.ws import router as ws_router
from app.services.maritime import start_maritime_poller
from app.services.opensky import start_opensky_poller
from app.services.satellites import start_tle_fetcher
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

    tasks: list[asyncio.Task] = []

    # Start Telegram listener in background
    if settings.telegram_api_id and settings.telegram_api_hash:
        tasks.append(asyncio.create_task(start_telegram_listener()))
        logger.info("Telegram listener started")
    else:
        logger.warning("Telegram credentials not set — listener disabled")

    # Start OpenSky aircraft poller
    tasks.append(asyncio.create_task(start_opensky_poller()))
    logger.info("OpenSky poller started")

    # Start CelesTrak TLE fetcher
    tasks.append(asyncio.create_task(start_tle_fetcher()))
    logger.info("CelesTrak TLE fetcher started")

    # Start AISStream maritime vessel tracker
    tasks.append(asyncio.create_task(start_maritime_poller()))
    logger.info("AISStream maritime poller started")

    yield

    for task in tasks:
        task.cancel()


app = FastAPI(title="Conflict Monitor", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events_router)
app.include_router(tracking_router)
app.include_router(ws_router)


@app.get("/")
async def health():
    return {"status": "ok"}
