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


REGIONS = {
    "middle_east":   {"lat_min": 12.0, "lat_max": 42.0, "lon_min": 25.0,   "lon_max": 65.0},
    "europe":        {"lat_min": 35.0, "lat_max": 72.0, "lon_min": -25.0,  "lon_max": 45.0},
    "north_america": {"lat_min": 15.0, "lat_max": 75.0, "lon_min": -170.0, "lon_max": -50.0},
    "south_america": {"lat_min": -60.0,"lat_max": 15.0, "lon_min": -85.0,  "lon_max": -30.0},
    "asia_pacific":  {"lat_min": -50.0,"lat_max": 50.0, "lon_min": 65.0,   "lon_max": 180.0},
    "africa":        {"lat_min": -35.0,"lat_max": 38.0, "lon_min": -20.0,  "lon_max": 52.0},
    "arctic":        {"lat_min": 60.0, "lat_max": 90.0, "lon_min": -180.0, "lon_max": 180.0},
}

def _load_active_regions():
    import json, os
    try:
        f = "/opt/apps/navytrack/backend/regions.json"
        if os.path.exists(f):
            with open(f) as fp:
                return json.load(fp)
    except:
        pass
    return ["middle_east"]

def _in_active_region(lat, lon) -> bool:
    if lat is None or lon is None:
        return False
    try:
        active = _load_active_regions()
        for key in active:
            r = REGIONS.get(key)
            if not r:
                continue
            if (r["lat_min"] <= float(lat) <= r["lat_max"] and
                r["lon_min"] <= float(lon) <= r["lon_max"]):
                return True
    except:
        pass
    return False

def _in_middle_east(lat, lon) -> bool:
    return _in_active_region(lat, lon)


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
        destination  = None,
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
