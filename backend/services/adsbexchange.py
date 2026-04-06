"""
services/adsbexchange.py
Fetch US military flights from airplanes.live + adsb.fi (free, no key required).
Both sources are queried in parallel and merged by ICAO hex.
"""

import httpx
import asyncio
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import MIDDLE_EAST, REQUEST_TIMEOUT
from models import FlightData

AIRPLANES_LIVE_BASE = "https://api.airplanes.live/v2"
ADSBFI_BASE         = "https://api.adsb.fi/v1"

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

def _parse_aircraft(ac: dict, source: str = "airplanes.live") -> FlightData:
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
        source       = source,
    )

async def _fetch_airplanes_live(client: httpx.AsyncClient) -> list[FlightData]:
    """Fetch military aircraft from airplanes.live"""
    results = []
    try:
        resp = await client.get(
            f"{AIRPLANES_LIVE_BASE}/mil",
            headers={"User-Agent": "AirForceTrack/1.0"},
        )
        if resp.status_code == 200:
            data = resp.json()
            for ac in data.get("ac", []):
                lat = ac.get("lat")
                lon = ac.get("lon")
                if _in_middle_east(lat, lon):
                    results.append(_parse_aircraft(ac, "airplanes.live"))
    except Exception as e:
        print(f"[airplanes.live] Error: {e}")
    return results

async def _fetch_adsbfi(client: httpx.AsyncClient) -> list[FlightData]:
    """Fetch military aircraft from adsb.fi"""
    results = []
    try:
        resp = await client.get(
            f"{ADSBFI_BASE}/military",
            headers={"User-Agent": "AirForceTrack/1.0"},
        )
        if resp.status_code == 200:
            data = resp.json()
            for ac in data.get("ac", []):
                lat = ac.get("lat")
                lon = ac.get("lon")
                if _in_middle_east(lat, lon):
                    results.append(_parse_aircraft(ac, "adsb.fi"))
    except Exception as e:
        print(f"[adsb.fi] Error: {e}")
    return results

async def fetch_navy_flights(api_key: str = None) -> list[FlightData]:
    """
    Fetch military aircraft from airplanes.live AND adsb.fi in parallel.
    Merge by ICAO hex — airplanes.live takes priority on duplicates.
    No API key required for either source.
    """
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        # Fetch both sources in parallel
        results_live, results_fi = await asyncio.gather(
            _fetch_airplanes_live(client),
            _fetch_adsbfi(client),
            return_exceptions=True
        )

    # Handle exceptions from gather
    if isinstance(results_live, Exception):
        print(f"[airplanes.live] Failed: {results_live}")
        results_live = []
    if isinstance(results_fi, Exception):
        print(f"[adsb.fi] Failed: {results_fi}")
        results_fi = []

    # Merge — airplanes.live takes priority on duplicate ICAOs
    merged: dict[str, FlightData] = {}

    # Add adsb.fi first (lower priority)
    for flight in results_fi:
        if flight.icao:
            merged[flight.icao] = flight

    # Add airplanes.live second (overwrites duplicates)
    for flight in results_live:
        if flight.icao:
            merged[flight.icao] = flight

    print(f"[fetch] airplanes.live: {len(results_live)} | adsb.fi: {len(results_fi)} | merged: {len(merged)}")

    return list(merged.values())
