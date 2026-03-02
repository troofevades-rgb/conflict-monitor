import asyncio
import json
import logging

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an intelligence analyst classifying messages from Telegram channels covering the Israel/US & Iran conflict.

Given a raw message, extract the following fields as JSON:
- event_type: one of "military", "diplomatic", "economic", "cyber"
- severity: integer 1-10 (1=routine, 10=major escalation)
- location_name: the place mentioned (or "Unknown")
- lat: latitude as float (or null if unknown)
- lon: longitude as float (or null if unknown)
- summary: a single concise sentence summarizing the event

Respond ONLY with valid JSON, no markdown fences."""


async def classify_message(raw_text: str) -> dict:
    """Call Claude API to classify a Telegram message. Returns structured dict."""
    if not settings.anthropic_api_key:
        logger.warning("No Anthropic API key — returning defaults")
        return {
            "event_type": "military",
            "severity": 5,
            "location_name": "Unknown",
            "lat": None,
            "lon": None,
            "summary": raw_text[:200],
        }

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    for attempt in range(3):
        try:
            response = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=300,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": raw_text[:2000]}],
            )
            text = response.content[0].text
            return json.loads(text)
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
        "lat": None,
        "lon": None,
        "summary": raw_text[:200],
    }
