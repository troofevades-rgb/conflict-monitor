from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Event
from app.schemas import EventRead

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[EventRead])
async def list_events(
    limit: int = Query(50, ge=1, le=500),
    event_type: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Event).order_by(Event.timestamp.desc()).limit(limit)
    if event_type:
        stmt = stmt.where(Event.event_type == event_type)
    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/{event_id}", response_model=EventRead)
async def get_event(
    event_id: int,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Event not found")
    return event
