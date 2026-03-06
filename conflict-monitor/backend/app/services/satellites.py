"""CelesTrak satellite TLE fetching service.

Fetches Two-Line Element sets from CelesTrak for military satellites
and caches them. TLE data is refreshed every 6 hours.
"""

import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php"
TLE_GROUPS = ["military"]
REFRESH_INTERVAL = 6 * 3600  # 6 hours

_tle_cache: list[dict] = []


async def start_tle_fetcher():
    """Background task that fetches TLE data from CelesTrak."""
    async with httpx.AsyncClient(
        timeout=60,
        headers={"User-Agent": "ConflictMonitor/1.0"},
    ) as client:
        while True:
            try:
                all_tles: list[dict] = []
                for group in TLE_GROUPS:
                    resp = await client.get(
                        CELESTRAK_URL,
                        params={"GROUP": group, "FORMAT": "tle"},
                    )
                    if resp.status_code == 200:
                        lines = resp.text.strip().split("\n")
                        count = 0
                        for i in range(0, len(lines) - 2, 3):
                            name = lines[i].strip()
                            line1 = lines[i + 1].strip()
                            line2 = lines[i + 2].strip()
                            if line1.startswith("1 ") and line2.startswith("2 "):
                                all_tles.append(
                                    {"name": name, "line1": line1, "line2": line2}
                                )
                                count += 1
                        logger.info("CelesTrak [%s]: %d satellites", group, count)
                    else:
                        logger.warning(
                            "CelesTrak %s returned %d", group, resp.status_code
                        )

                _tle_cache.clear()
                _tle_cache.extend(all_tles)
                logger.info("Total TLEs cached: %d", len(_tle_cache))
            except Exception as e:
                logger.error("CelesTrak fetch error: %s", e)

            await asyncio.sleep(REFRESH_INTERVAL)


def get_tles() -> list[dict]:
    return _tle_cache
