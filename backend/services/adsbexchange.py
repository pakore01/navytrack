"""
services/adsbexchange.py
Fetch US Navy military flights from ADS-B Exchange API.

ADS-B Exchange API v2 docs:
  https://www.adsbexchange.com/data/

Endpoint used:
  GET /api/aircraft/v2/lat/{lat}/lon/{lon}/dist/{dist}/
  or
  GET /api/aircraft/v2/mil/          ← military-only endpoint (requires API key)

We query the military endpoint and filter to Middle East bounding box.
"""

import httpx
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import ADSB_BASE_URL, MIDDLE_EAST, REQUEST_TIMEOUT
from models import FlightData


def _in_middle_east(lat, lon) -> bool:
    """Check if coordinates fall within Middle East bounding box."""
    if lat is None or lon is None:
        return False
    try:
        return (
            MIDDLE_EAST["lat_min"] <= float(lat) <= MIDDLE_EAST["lat_max"] and
            MIDDLE_EAST["lon_min"] <= float(lon) <= MIDDLE_EAST["lon_max"]
        )
    except (TypeError, ValueError):
        return False


def _parse_aircraft(ac: dict) -> FlightData:
    """Normalize a raw ADS-B Exchange aircraft object into FlightData."""
    lat = ac.get("lat")
    lon = ac.get("lon")

    # Altitude: prefer barometric, fallback to geometric
    alt_raw = ac.get("alt_baro") or ac.get("alt_geom")
    try:
        altitude = int(alt_raw) if alt_raw and alt_raw != "ground" else 0
    except (ValueError, TypeError):
        altitude = None

    on_ground = str(ac.get("alt_baro", "")).lower() == "ground" or bool(ac.get("on_ground"))

    # Speed: ground speed in knots
    try:
        speed = round(float(ac.get("gs", 0))) if ac.get("gs") is not None else None
    except (ValueError, TypeError):
        speed = None

    # Heading / track
    try:
        heading = float(ac.get("track")) if ac.get("track") is not None else None
    except (ValueError, TypeError):
        heading = None

    return FlightData(
        icao         = (ac.get("hex") or ac.get("icao") or "").upper(),
        callsign     = (ac.get("flight") or ac.get("callsign") or "").strip() or None,
        aircraft     = ac.get("t") or ac.get("type") or None,
        registration = ac.get("r") or None,
        origin       = ac.get("orig") or ac.get("dep") or None,
        destination  = ac.get("dest") or ac.get("dst") or "Middle East",
        lat          = float(lat) if lat is not None else None,
        lon          = float(lon) if lon is not None else None,
        altitude     = altitude,
        speed        = float(speed) if speed is not None else None,
        heading      = heading,
        on_ground    = on_ground,
        squawk       = ac.get("squawk") or None,
        source       = "ADS-B Exchange",
    )


async def fetch_navy_flights(api_key: str) -> list[FlightData]:
    """
    Fetch military aircraft from ADS-B Exchange and filter to Middle East.

    ADS-B Exchange API key must be passed in the header:
      'api-auth': <your_key>
    or as query param depending on plan tier.

    The /mil/ endpoint returns all military-flagged aircraft globally.
    We filter client-side to Middle East bounding box.
    """

    headers = {
        "api-auth": api_key,
        "User-Agent": "NavyTrack/1.0",
        "Accept": "application/json",
    }

    results: list[FlightData] = []

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            # Primary: military-only endpoint
            url = f"{ADSB_BASE_URL}/mil/"
            resp = await client.get(url, headers=headers)

            if resp.status_code == 200:
                data = resp.json()
                aircraft_list = data.get("ac", [])

                for ac in aircraft_list:
                    lat = ac.get("lat")
                    lon = ac.get("lon")

                    # Filter: must be in Middle East region
                    if not _in_middle_east(lat, lon):
                        continue

                    results.append(_parse_aircraft(ac))

            elif resp.status_code == 401:
                raise ValueError("Invalid ADS-B Exchange API key (401 Unauthorized)")

            elif resp.status_code == 429:
                raise ValueError("ADS-B Exchange rate limit exceeded (429). Wait before retrying.")

            else:
                # Fallback: try bounding-box endpoint centered on Persian Gulf
                # Center: 26°N 54°E, radius 1500nm covers Middle East
                fallback_url = f"{ADSB_BASE_URL}/lat/26.0/lon/54.0/dist/1500/"
                resp2 = await client.get(fallback_url, headers=headers)

                if resp2.status_code == 200:
                    data2 = resp2.json()
                    for ac in data2.get("ac", []):
                        # Filter US military only (hex range heuristic)
                        hex_code = (ac.get("hex") or "").upper()
                        is_mil = ac.get("mil") or hex_code.startswith(("AE", "ADF"))
                        if is_mil:
                            results.append(_parse_aircraft(ac))

        except httpx.TimeoutException:
            raise TimeoutError("ADS-B Exchange request timed out")
        except httpx.RequestError as e:
            raise ConnectionError(f"ADS-B Exchange connection error: {e}")

    return results
