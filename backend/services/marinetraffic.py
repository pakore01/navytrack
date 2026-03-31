"""
services/marinetraffic.py
Fetch US Navy carrier vessel positions from MarineTraffic API.

MarineTraffic API docs:
  https://www.marinetraffic.com/en/ais-api-services

Endpoints used:
  PS07 — getVesselTrack (by MMSI)
  EV01 — getExpectedArrivals (optional)
  VI   — vesselinfo (by MMSI)

We query each known carrier MMSI and return live position data.
"""

import httpx
import asyncio
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import MARINE_BASE_URL, CARRIER_MMSIS, CARRIER_INFO, REQUEST_TIMEOUT, MIDDLE_EAST
from models import VesselData


def _in_or_near_middle_east(lat, lon, margin: float = 15.0) -> bool:
    """
    Check if vessel is in or near Middle East.
    Uses extended margin since carriers operate in adjacent waters too
    (Arabian Sea, Red Sea, Indian Ocean approaches).
    """
    if lat is None or lon is None:
        return False
    try:
        return (
            (MIDDLE_EAST["lat_min"] - margin) <= float(lat) <= (MIDDLE_EAST["lat_max"] + margin) and
            (MIDDLE_EAST["lon_min"] - margin) <= float(lon) <= (MIDDLE_EAST["lon_max"] + margin)
        )
    except (TypeError, ValueError):
        return False


def _parse_vessel(raw: dict, mmsi: str) -> VesselData | None:
    """Normalize a raw MarineTraffic vessel object into VesselData."""
    info = CARRIER_INFO.get(str(mmsi), {})

    lat_raw = raw.get("LAT") or raw.get("lat") or raw.get("LATITUDE")
    lon_raw = raw.get("LON") or raw.get("lon") or raw.get("LONGITUDE")

    try:
        lat = float(lat_raw) if lat_raw is not None else None
        lon = float(lon_raw) if lon_raw is not None else None
    except (TypeError, ValueError):
        lat = lon = None

    try:
        speed = float(raw.get("SPEED") or raw.get("speed") or 0)
    except (TypeError, ValueError):
        speed = None

    try:
        course = float(raw.get("COURSE") or raw.get("course") or raw.get("COG") or 0)
    except (TypeError, ValueError):
        course = None

    timestamp = (
        raw.get("TIMESTAMP") or raw.get("timestamp") or
        raw.get("TIME_UTC")  or raw.get("LAST_POS")
    )

    destination = (
        raw.get("DESTINATION") or raw.get("destination") or
        raw.get("NEXT_PORT_NAME") or "—"
    )

    last_port = raw.get("LAST_PORT") or raw.get("last_port") or raw.get("LAST_PORT_NAME") or "—"

    return VesselData(
        mmsi        = str(mmsi),
        name        = info.get("name") or raw.get("SHIPNAME") or raw.get("name") or "—",
        shipname    = info.get("name") or raw.get("SHIPNAME") or "—",
        type        = info.get("class") or "Aircraft Carrier",
        imo         = info.get("hull") or raw.get("IMO") or "—",
        destination = destination,
        last_port   = last_port,
        lat         = lat,
        lon         = lon,
        speed       = speed,
        course      = course,
        timestamp   = str(timestamp) if timestamp else None,
        source      = "MarineTraffic",
    )


async def _fetch_single_vessel(client: httpx.AsyncClient, api_key: str, mmsi: str) -> VesselData | None:
    """
    Fetch a single vessel by MMSI using MarineTraffic getVesselTrack (PS07).
    Returns None if not found or not in Middle East region.
    """
    # API v2 endpoint: single vessel position
    url = f"{MARINE_BASE_URL}/exportvessel/v:8/{api_key}/timespan:5/mmsi:{mmsi}/protocol:jsono/"

    try:
        resp = await client.get(url)

        if resp.status_code == 200:
            data = resp.json()

            # MarineTraffic returns a list even for single vessel
            vessels = data if isinstance(data, list) else data.get("data", [])

            if vessels:
                raw = vessels[0] if isinstance(vessels[0], dict) else {}
                vessel = _parse_vessel(raw, mmsi)
                return vessel  # Include all carriers regardless of region

        elif resp.status_code == 401:
            raise ValueError("Invalid MarineTraffic API key")

        elif resp.status_code == 402:
            raise ValueError("MarineTraffic API quota exceeded")

    except httpx.TimeoutException:
        print(f"[MarineTraffic] Timeout for MMSI {mmsi}")
    except httpx.RequestError as e:
        print(f"[MarineTraffic] Request error for MMSI {mmsi}: {e}")
    except Exception as e:
        print(f"[MarineTraffic] Error for MMSI {mmsi}: {e}")

    return None


async def fetch_carriers(api_key: str) -> list[VesselData]:
    """
    Fetch all known US Navy carriers concurrently.
    Returns vessels with valid position data.
    """
    results: list[VesselData] = []

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        # Fetch all carriers concurrently
        tasks = [
            _fetch_single_vessel(client, api_key, mmsi)
            for mmsi in CARRIER_MMSIS
        ]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        for resp in responses:
            if isinstance(resp, VesselData):
                results.append(resp)
            elif isinstance(resp, Exception):
                # Individual vessel errors don't fail the whole request
                print(f"[MarineTraffic] Vessel fetch exception: {resp}")

    return results
