"""
services/openskynet.py
Supplementary flight data from OpenSky Network (free, no key required for basic).
Used as fallback / cross-reference source.

OpenSky API docs:
  https://opensky-network.org/apidoc/

State vector fields (by index):
  0: icao24     1: callsign    2: origin_country  3: time_position
  4: last_contact  5: longitude  6: latitude      7: baro_altitude (m)
  8: on_ground  9: velocity (m/s)  10: true_track  11: vertical_rate
  12: sensors   13: geo_altitude   14: squawk      15: spi
  16: position_source
"""

import httpx
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import OPENSKY_BASE_URL, MIDDLE_EAST, REQUEST_TIMEOUT
from models import FlightData


def _mps_to_kts(mps) -> float | None:
    """Convert meters per second to knots."""
    if mps is None:
        return None
    try:
        return round(float(mps) * 1.94384, 1)
    except (TypeError, ValueError):
        return None


def _m_to_ft(m) -> int | None:
    """Convert meters to feet."""
    if m is None:
        return None
    try:
        return round(float(m) * 3.28084)
    except (TypeError, ValueError):
        return None


def _parse_state(s: list) -> FlightData | None:
    """Parse a single OpenSky state vector (list of 17 values)."""
    if not s or len(s) < 17:
        return None

    lat = s[6]
    lon = s[5]
    if lat is None or lon is None:
        return None

    return FlightData(
        icao         = (s[0] or "").upper(),
        callsign     = (s[1] or "").strip() or None,
        aircraft     = None,   # OpenSky free tier has no aircraft type
        registration = None,
        origin       = s[2] or None,   # origin country
        destination  = None,
        lat          = float(lat),
        lon          = float(lon),
        altitude     = _m_to_ft(s[7]),
        speed        = _mps_to_kts(s[9]),
        heading      = float(s[10]) if s[10] is not None else None,
        on_ground    = bool(s[8]),
        squawk       = s[14] or None,
        source       = "OpenSky Network",
    )


async def fetch_us_flights_middle_east(
    username: str | None = None,
    password: str | None = None,
) -> list[FlightData]:
    """
    Fetch US-origin flights in Middle East bounding box from OpenSky.
    Authentication is optional but increases rate limits.
    """
    b = MIDDLE_EAST
    url = (
        f"{OPENSKY_BASE_URL}/states/all"
        f"?lamin={b['lat_min']}&lomin={b['lon_min']}"
        f"&lamax={b['lat_max']}&lomax={b['lon_max']}"
    )

    headers: dict = {"User-Agent": "NavyTrack/1.0"}
    auth = None
    if username and password:
        auth = (username, password)

    results: list[FlightData] = []

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            resp = await client.get(url, headers=headers, auth=auth)

            if resp.status_code == 200:
                data = resp.json()
                states = data.get("states") or []

                for s in states:
                    # Filter: US origin only
                    if len(s) > 2 and s[2] == "United States":
                        parsed = _parse_state(s)
                        if parsed:
                            results.append(parsed)

            elif resp.status_code == 401:
                raise ValueError("Invalid OpenSky credentials")

            elif resp.status_code == 429:
                print("[OpenSky] Rate limit hit — skipping")

        except httpx.TimeoutException:
            print("[OpenSky] Request timed out")
        except httpx.RequestError as e:
            print(f"[OpenSky] Request error: {e}")

    return results
