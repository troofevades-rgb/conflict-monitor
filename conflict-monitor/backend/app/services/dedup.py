"""Event deduplication — prevents duplicate markers when multiple channels report the same event.

Algorithm:
  1. Query PostGIS for events within ±15 minutes with matching event_type
  2. If both have coordinates, check ST_DWithin 50km
  3. Compute Jaccard similarity on summary word sets
  4. If similarity > 0.4, it's a duplicate — update existing instead of creating new
"""

import logging
import re
from datetime import timedelta

from sqlalchemy import and_, cast, select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2 import Geography
from geoalchemy2.functions import ST_DWithin
from geoalchemy2.shape import from_shape
from shapely.geometry import Point

from app.models import Event

logger = logging.getLogger(__name__)


def _normalize(text: str) -> set[str]:
    """Lowercase, strip punctuation, return word set."""
    words = re.sub(r"[^\w\s]", "", text.lower()).split()
    # Remove very short words
    return {w for w in words if len(w) > 2}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    intersection = len(a & b)
    union = len(a | b)
    return intersection / union if union > 0 else 0.0


async def check_duplicate(
    session: AsyncSession,
    summary: str,
    event_type: str,
    lat: float | None,
    lon: float | None,
    timestamp,
) -> Event | None:
    """Check if a similar event already exists. Returns the existing Event if duplicate, None if new."""
    time_window = timedelta(minutes=15)
    ts_min = timestamp - time_window
    ts_max = timestamp + time_window

    # Base query: same event type, within time window
    stmt = select(Event).where(
        and_(
            Event.event_type == event_type,
            Event.timestamp >= ts_min,
            Event.timestamp <= ts_max,
        )
    )

    # Spatial filter if we have coordinates
    if lat is not None and lon is not None:
        new_geom = from_shape(Point(lon, lat), srid=4326)
        # Cast to geography for meter-based distance (50km)
        stmt = stmt.where(
            ST_DWithin(
                cast(Event.geometry, Geography),
                cast(new_geom, Geography),
                50000,
            )
        )

    result = await session.execute(stmt.limit(20))
    candidates = result.scalars().all()

    if not candidates:
        return None

    new_words = _normalize(summary)

    for candidate in candidates:
        candidate_words = _normalize(candidate.summary)
        similarity = _jaccard(new_words, candidate_words)
        if similarity > 0.4:
            logger.info(
                "Duplicate detected: existing #%d (sim=%.2f) '%s' ≈ '%s'",
                candidate.id, similarity,
                candidate.summary[:50], summary[:50],
            )
            return candidate

    return None


async def merge_duplicate(
    session: AsyncSession,
    existing: Event,
    new_channel: str,
    new_severity: int,
    new_lat: float | None,
    new_lon: float | None,
):
    """Update an existing event with info from a duplicate report."""
    # Increment report count
    existing.report_count = (existing.report_count or 1) + 1

    # Append channel
    channels = existing.reporting_channels or existing.channel_name
    if new_channel and new_channel not in channels:
        channels = f"{channels}, {new_channel}"
    existing.reporting_channels = channels

    # Take higher severity
    if new_severity > existing.severity:
        existing.severity = new_severity

    # Fill in coordinates if existing has none
    if existing.lat is None and new_lat is not None:
        existing.lat = new_lat
        existing.lon = new_lon
        if new_lon is not None:
            existing.geometry = from_shape(Point(new_lon, new_lat), srid=4326)

    await session.commit()
    await session.refresh(existing)
    logger.info(
        "Merged into event #%d (now %d reports from: %s)",
        existing.id, existing.report_count, existing.reporting_channels,
    )
