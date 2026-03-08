"""Geocoding service — resolves location names to lat/lon coordinates.

Pipeline:
  1. LRU cache (in-memory, 500 entries)
  2. Hardcoded fallback table (~70 common Middle East locations)
  3. Nominatim / OpenStreetMap API (rate-limited to 1 req/sec per ToS)

The fallback table handles military bases, straits, and colloquial names
that Nominatim often can't resolve.
"""

import asyncio
import logging
from collections import OrderedDict

import httpx

logger = logging.getLogger(__name__)

# =========================================================================
# LRU CACHE
# =========================================================================

_cache: OrderedDict[str, tuple[float, float] | None] = OrderedDict()
_CACHE_MAX = 500


def _cache_get(key: str) -> tuple[float, float] | None | bool:
    """Returns coords, None (cached miss), or False (not in cache)."""
    normalized = key.strip().lower()
    if normalized in _cache:
        _cache.move_to_end(normalized)
        return _cache[normalized]
    return False


def _cache_set(key: str, value: tuple[float, float] | None):
    normalized = key.strip().lower()
    _cache[normalized] = value
    _cache.move_to_end(normalized)
    while len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)


# =========================================================================
# FALLBACK LOOKUP TABLE — accurate coordinates for common locations
# =========================================================================

KNOWN_LOCATIONS: dict[str, tuple[float, float]] = {
    # Iran
    "tehran": (35.6892, 51.3890),
    "isfahan": (32.6546, 51.6680),
    "esfahan": (32.6546, 51.6680),
    "bandar abbas": (27.1865, 56.2808),
    "bushehr": (28.9684, 50.8385),
    "natanz": (33.5130, 51.7270),
    "fordow": (34.8830, 51.2430),
    "kharg island": (29.2333, 50.3167),
    "chabahar": (25.2919, 60.6430),
    "tabriz": (38.0962, 46.2738),
    "shiraz": (29.5918, 52.5836),
    "qom": (34.6401, 50.8764),
    "parchin": (35.5167, 51.7667),
    "arak": (34.0954, 49.7013),
    "abadan": (30.3392, 48.2973),
    "dezful": (32.3811, 48.4018),
    "kermanshah": (34.3142, 47.0650),
    "mashhad": (36.2605, 59.6168),
    "jask": (25.6395, 57.7703),
    "qeshm island": (26.8500, 55.9000),
    "qeshm": (26.8500, 55.9000),
    "bandar lengeh": (26.5579, 54.8807),
    "khomeni": (35.6892, 51.3890),
    "khomeini": (35.6892, 51.3890),
    # Iraq
    "baghdad": (33.3128, 44.3615),
    "basra": (30.5085, 47.7804),
    "erbil": (36.1901, 44.0091),
    "kirkuk": (35.4681, 44.3953),
    "mosul": (36.3409, 43.1300),
    "al-asad airbase": (33.7856, 42.4411),
    "al asad": (33.7856, 42.4411),
    "ain al-assad": (33.7856, 42.4411),
    "taji": (33.5272, 44.2617),
    "balad airbase": (33.9402, 44.3616),
    "tikrit": (34.6119, 43.6767),
    # Syria
    "damascus": (33.5138, 36.2765),
    "aleppo": (36.2021, 37.1343),
    "latakia": (35.5317, 35.7918),
    "tartus": (34.8890, 35.8866),
    "deir ez-zor": (35.3359, 40.1408),
    "deir ezzor": (35.3359, 40.1408),
    "abu kamal": (34.4509, 40.9188),
    "homs": (34.7272, 36.7200),
    "t4 airbase": (34.5222, 37.6275),
    "t-4 airbase": (34.5222, 37.6275),
    "palmyra": (34.5600, 38.2700),
    "idlib": (35.9306, 36.6339),
    "raqqa": (35.9594, 39.0078),
    # Israel
    "tel aviv": (32.0853, 34.7818),
    "haifa": (32.7940, 34.9896),
    "dimona": (31.0666, 35.2083),
    "nevatim": (31.2083, 34.9390),
    "nevatim afb": (31.2083, 34.9390),
    "ramon airbase": (30.7761, 34.6668),
    "ramon afb": (30.7761, 34.6668),
    "eilat": (29.5577, 34.9519),
    "jerusalem": (31.7683, 35.2137),
    "beer sheva": (31.2518, 34.7913),
    "ashdod": (31.8014, 34.6503),
    "ashkelon": (31.6688, 34.5743),
    "sderot": (31.5251, 34.5960),
    "gaza": (31.5017, 34.4668),
    "rafah": (31.2969, 34.2455),
    "khan younis": (31.3462, 34.3061),
    "golan heights": (32.9500, 35.8000),
    # Lebanon
    "beirut": (33.8938, 35.5018),
    "dahieh": (33.8547, 35.5233),
    "baalbek": (34.0047, 36.2110),
    "tyre": (33.2705, 35.2038),
    "nabatieh": (33.3778, 35.4834),
    "sidon": (33.5633, 35.3697),
    "tripoli": (34.4333, 35.8333),
    # Yemen
    "sanaa": (15.3694, 44.1910),
    "hodeidah": (14.7979, 42.9545),
    "hodeida": (14.7979, 42.9545),
    "aden": (12.7855, 45.0187),
    "marib": (15.4543, 45.3220),
    "saada": (16.9400, 43.7600),
    # Waterways / Straits
    "strait of hormuz": (26.5667, 56.2500),
    "hormuz": (26.5667, 56.2500),
    "bab el-mandeb": (12.5833, 43.3333),
    "bab al-mandab": (12.5833, 43.3333),
    "suez canal": (30.4358, 32.3443),
    "red sea": (20.0, 38.0),
    "persian gulf": (26.5, 51.5),
    "gulf of oman": (24.5, 59.0),
    "gulf of aden": (12.5, 47.0),
    "mediterranean": (34.0, 33.0),
    # Other
    "riyadh": (24.7136, 46.6753),
    "doha": (25.2854, 51.5310),
    "muscat": (23.5880, 58.3829),
    "amman": (31.9454, 35.9284),
    "ankara": (39.9334, 32.8597),
    "cairo": (30.0444, 31.2357),
    "incirlik": (37.0024, 35.4259),
    "incirlik airbase": (37.0024, 35.4259),
    "al udeid": (25.1175, 51.3150),
    "al udeid airbase": (25.1175, 51.3150),
    "al dhafra": (24.2474, 54.5478),
    "al dhafra airbase": (24.2474, 54.5478),
    "diego garcia": (-7.3195, 72.4229),
}

# =========================================================================
# NOMINATIM CLIENT
# =========================================================================

_nominatim_semaphore = asyncio.Semaphore(1)  # enforce 1 req at a time
_last_nominatim_call = 0.0

# Middle East bounding box for viewbox bias
_VIEWBOX = "25,10,65,42"  # lon_min, lat_min, lon_max, lat_max


async def _query_nominatim(location_name: str) -> tuple[float, float] | None:
    """Query Nominatim with rate limiting (max 1 req/sec per ToS)."""
    global _last_nominatim_call

    async with _nominatim_semaphore:
        # Enforce 1.1s gap between requests
        import time
        now = time.monotonic()
        elapsed = now - _last_nominatim_call
        if elapsed < 1.1:
            await asyncio.sleep(1.1 - elapsed)

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={
                        "q": location_name,
                        "format": "json",
                        "limit": 1,
                        "viewbox": _VIEWBOX,
                        "bounded": 0,
                    },
                    headers={
                        "User-Agent": "ConflictMonitor/1.0 (https://github.com/troofevades-rgb/conflict-monitor)",
                    },
                )
                _last_nominatim_call = time.monotonic()

                if resp.status_code == 200:
                    results = resp.json()
                    if results:
                        lat = float(results[0]["lat"])
                        lon = float(results[0]["lon"])
                        logger.info("Nominatim resolved '%s' → (%s, %s)", location_name, lat, lon)
                        return (lat, lon)
                    else:
                        logger.debug("Nominatim: no results for '%s'", location_name)
                else:
                    logger.warning("Nominatim returned %d for '%s'", resp.status_code, location_name)
        except Exception as e:
            logger.error("Nominatim error for '%s': %s", location_name, e)

    return None


# =========================================================================
# PUBLIC API
# =========================================================================

async def geocode(location_name: str) -> tuple[float, float] | None:
    """Resolve a location name to (lat, lon) coordinates.

    Pipeline: cache → fallback table → Nominatim → None
    """
    if not location_name or location_name.strip().lower() in ("unknown", "n/a", ""):
        return None

    name = location_name.strip()

    # 1. Check cache
    cached = _cache_get(name)
    if cached is not False:
        return cached  # could be None (cached miss) or (lat, lon)

    # 2. Check fallback table
    normalized = name.lower()
    if normalized in KNOWN_LOCATIONS:
        coords = KNOWN_LOCATIONS[normalized]
        _cache_set(name, coords)
        logger.debug("Fallback table resolved '%s' → %s", name, coords)
        return coords

    # Also try partial matching — "near Tehran" → "tehran"
    for known_name, coords in KNOWN_LOCATIONS.items():
        if known_name in normalized:
            _cache_set(name, coords)
            logger.debug("Partial match '%s' → '%s' → %s", name, known_name, coords)
            return coords

    # 3. Query Nominatim
    result = await _query_nominatim(name)
    _cache_set(name, result)  # cache even None to avoid repeated failed lookups
    return result
