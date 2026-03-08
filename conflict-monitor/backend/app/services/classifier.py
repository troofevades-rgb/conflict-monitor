import asyncio
import json
import logging

import anthropic
from pydantic import BaseModel, Field, field_validator

from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an intelligence analyst classifying messages from Telegram channels covering the Israel/US & Iran conflict.

Given a raw message, extract the following fields as JSON:
- event_type: one of "military", "diplomatic", "economic", "cyber"
- severity: integer 1-10 (1=routine, 10=major escalation)
- location_name: the specific place or region mentioned (city, base, strait, etc.) or "Unknown" if none
- summary: a single concise sentence summarizing the event

Respond ONLY with valid JSON, no markdown fences."""


class ClassifierResult(BaseModel):
    event_type: str = "military"
    severity: int = Field(default=5, ge=1, le=10)
    location_name: str = "Unknown"
    summary: str = ""

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v):
        allowed = {"military", "diplomatic", "economic", "cyber"}
        return v if v in allowed else "military"

    @field_validator("severity")
    @classmethod
    def clamp_severity(cls, v):
        return max(1, min(10, v))


# Singleton client — avoids creating connection pools per message
_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def classify_message(raw_text: str) -> dict:
    """Call Claude API to classify a Telegram message. Returns structured dict."""
    if not settings.anthropic_api_key:
        logger.warning("No Anthropic API key — returning defaults")
        return {
            "event_type": "military",
            "severity": 5,
            "location_name": "Unknown",
            "summary": raw_text[:200],
        }

    client = _get_client()

    for attempt in range(3):
        try:
            response = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=300,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": raw_text[:2000]}],
            )
            text = response.content[0].text
            raw = json.loads(text)
            # Validate with Pydantic
            result = ClassifierResult(**raw)
            return result.model_dump()
        except anthropic.RateLimitError:
            wait = 2 ** (attempt + 1)
            logger.warning("Rate limited, retrying in %ds", wait)
            await asyncio.sleep(wait)
        except (json.JSONDecodeError, Exception) as e:
            logger.error("Classification error (attempt %d): %s", attempt + 1, e)
            if attempt == 2:
                break

    return {
        "event_type": "military",
        "severity": 5,
        "location_name": "Unknown",
        "summary": raw_text[:200],
    }
