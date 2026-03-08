from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Event
from app.schemas import EventRead

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[EventRead])
async def list_events(
    limit: int = Query(50, ge=1, le=500),
    event_type: str | None = Query(None),
    after: datetime | None = Query(None),
    before: datetime | None = Query(None),
    min_reliability: int | None = Query(None, ge=1, le=5),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Event).order_by(Event.timestamp.desc()).limit(limit)
    if event_type:
        stmt = stmt.where(Event.event_type == event_type)
    if after:
        stmt = stmt.where(Event.timestamp >= after)
    if before:
        stmt = stmt.where(Event.timestamp <= before)
    if min_reliability:
        stmt = stmt.where(Event.source_reliability >= min_reliability)
    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/time-range")
async def event_time_range(
    session: AsyncSession = Depends(get_session),
):
    """Return the earliest and latest event timestamps."""
    result = await session.execute(
        select(func.min(Event.timestamp), func.max(Event.timestamp))
    )
    row = result.one_or_none()
    if row and row[0] and row[1]:
        return {"earliest": row[0].isoformat(), "latest": row[1].isoformat()}
    return {"earliest": None, "latest": None}


@router.get("/{event_id}", response_model=EventRead)
async def get_event(
    event_id: int,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event
