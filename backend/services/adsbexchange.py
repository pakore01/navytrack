"""
services/adsbexchange.py
Fetch US military flights from airplanes.live (free, no key required).
"""

import httpx
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import MIDDLE_EAST, REQUEST_TIMEOUT
from models import FlightData

AIRPLANES_LIVE_BASE = "https://api.airplanes.live/v2"


def _in_middle_east(lat, lon) -> bool:
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
    alt_raw = ac.get("alt_baro") or ac.get("alt_geom")
    try:
        altitude = int(alt_raw) if alt_raw and alt_raw != "ground" else 0
    except (ValueError, TypeError):
        altitude = None

    on_ground = str(ac.get("alt_baro", "")).lower() == "ground"

    try:
        speed = round(float(ac.get("gs", 0))) if ac.get("gs") is not None else None
    except (ValueError, TypeError):
        speed = None

    try:
        heading = float(ac.get("track")) if ac.get("track") is not None else None
    except (ValueError, TypeError):
        heading = None

    return FlightData(
        icao         = (ac.get("hex") or "").upper(),
        callsign     = (ac.get("flight") or "").strip() or None,
        aircraft     = ac.get("desc") or ac.get("t") or None,
        registration = ac.get("r") or None,
        origin       = None,
        destination  = "Middle East",
        lat          = float(ac.get("lat")) if ac.get("lat") is not None else None,
        lon          = float(ac.get("lon")) if ac.get("lon") is not None else None,
        altitude     = altitude,
        speed        = float(speed) if speed is not None else None,
        heading      = heading,
        on_ground    = on_ground,
        squawk       = ac.get("squawk") or None,
        source       = "airplanes.live",
    )


async def fetch_navy_flights(api_key: str = None) -> list[FlightData]:
    """
    Fetch all military aircraft globally from airplanes.live
    and filter to Middle East bounding box.
    No API key required.
    """
    results: list[FlightData] = []

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            resp = await client.get(
                f"{AIRPLANES_LIVE_BASE}/mil",
                headers={"User-Agent": "NavyTrack/1.0"},
            )

            if resp.status_code == 200:
                data = resp.json()
                for ac in data.get("ac", []):
                    lat = ac.get("lat")
                    lon = ac.get("lon")
                    if _in_middle_east(lat, lon):
                        results.append(_parse_aircraft(ac))

        except httpx.TimeoutException:
            raise TimeoutError("airplanes.live request timed out")
        except httpx.RequestError as e:
            raise ConnectionError(f"airplanes.live connection error: {e}")

    return results
