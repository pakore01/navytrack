"""
telegram_bot.py — NavyTrack Telegram Bot with region sectors
"""

import httpx
import asyncio
import json
import os
from datetime import datetime

TELEGRAM_TOKEN   = "8779133526:AAGV54lTa2f0RjwTTyvy9o60rE8mVaXVRYI"
TELEGRAM_CHAT_ID = "7478551004"
WATCHLIST_FILE   = "/opt/apps/navytrack/backend/watchlist.json"
REGIONS_FILE     = "/opt/apps/navytrack/backend/regions.json"
POLL_INTERVAL    = 60

REGIONS = {
    "middle_east": {
        "name": "Middle East",
        "lat_min": 12.0, "lat_max": 42.0,
        "lon_min": 25.0, "lon_max": 65.0,
    },
    "europe": {
        "name": "Europe",
        "lat_min": 35.0, "lat_max": 72.0,
        "lon_min": -25.0, "lon_max": 45.0,
    },
    "north_america": {
        "name": "North America",
        "lat_min": 15.0, "lat_max": 75.0,
        "lon_min": -170.0, "lon_max": -50.0,
    },
    "south_america": {
        "name": "South America",
        "lat_min": -60.0, "lat_max": 15.0,
        "lon_min": -85.0, "lon_max": -30.0,
    },
    "asia_pacific": {
        "name": "Asia Pacific",
        "lat_min": -50.0, "lat_max": 50.0,
        "lon_min": 65.0,  "lon_max": 180.0,
    },
    "africa": {
        "name": "Africa",
        "lat_min": -35.0, "lat_max": 38.0,
        "lon_min": -20.0, "lon_max": 52.0,
    },
    "arctic": {
        "name": "Arctic / North Atlantic",
        "lat_min": 60.0, "lat_max": 90.0,
        "lon_min": -180.0, "lon_max": 180.0,
    },
}

triggered = set()


def load_watchlist():
    try:
        if os.path.exists(WATCHLIST_FILE):
            with open(WATCHLIST_FILE) as f:
                return json.load(f)
    except:
        pass
    return []


def load_active_regions():
    try:
        if os.path.exists(REGIONS_FILE):
            with open(REGIONS_FILE) as f:
                return json.load(f)
    except:
        pass
    # Default: Middle East only
    return ["middle_east"]


def get_region(lat, lon):
    """Returns the region name if coordinates fall within any active region."""
    try:
        active = load_active_regions()
        for key in active:
            r = REGIONS.get(key)
            if not r:
                continue
            if (r["lat_min"] <= float(lat) <= r["lat_max"] and
                r["lon_min"] <= float(lon) <= r["lon_max"]):
                return r["name"]
    except:
        pass
    return None


async def send_telegram(message: str):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            await client.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            })
        except Exception as e:
            print(f"[Telegram] Error: {e}")


async def fetch_military():
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(
                "https://api.airplanes.live/v2/mil",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if resp.status_code == 200:
                return resp.json().get("ac", [])
        except Exception as e:
            print(f"[Fetch] Error: {e}")
    return []


async def check_alerts(aircraft):
    watchlist = load_watchlist()
    active_keys = set()

    for ac in aircraft:
        lat = ac.get("lat")
        lon = ac.get("lon")
        if lat is None or lon is None:
            continue

        region = get_region(lat, lon)
        if not region:
            continue

        callsign = (ac.get("flight") or "").strip().upper()
        icao     = (ac.get("hex")    or "").strip().upper()
        key      = callsign + icao

        active_keys.add(key)

        # Check watchlist if configured
        if watchlist:
            matched = next((w for w in watchlist if w in callsign or w in icao), None)
            if not matched:
                continue
        else:
            # No watchlist — alert all aircraft in active regions
            matched = region

        if key not in triggered:
            triggered.add(key)

            aircraft_type = ac.get("desc") or ac.get("t") or "Military"
            altitude = ac.get("alt_baro") or ac.get("alt_geom") or "—"
            speed    = round(float(ac.get("gs", 0))) if ac.get("gs") else "—"
            heading  = round(float(ac.get("track", 0))) if ac.get("track") else "—"
            reg      = ac.get("r") or "—"
            maps_url = f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}&zoom=7"

            label = f'matched "<code>{matched}</code>"' if watchlist else f"detected in <b>{region}</b>"

            message = (
                f"🚨 <b>NavyTrack Alert</b>\n\n"
                f"✈ <b>{callsign or icao}</b> {label}\n\n"
                f"🌍 <b>Region:</b> {region}\n"
                f"📋 <b>Type:</b> {aircraft_type}\n"
                f"🔢 <b>ICAO:</b> <code>{icao}</code>\n"
                f"📝 <b>Registration:</b> {reg}\n"
                f"📍 <b>Position:</b> {float(lat):.4f}°N {float(lon):.4f}°E\n"
                f"🏔 <b>Altitude:</b> {altitude} ft\n"
                f"💨 <b>Speed:</b> {speed} kts\n"
                f"🧭 <b>Heading:</b> {heading}°\n"
                f"🕐 <b>Time:</b> {datetime.utcnow().strftime('%H:%M:%S UTC')}\n\n"
                f"🗺 <a href=\"{maps_url}\">View on map</a>"
            )

            await send_telegram(message)
            print(f"[Alert] {callsign or icao} — {region} — matched {matched}")

    for key in list(triggered):
        if key not in active_keys:
            triggered.discard(key)


async def main():
    active = load_active_regions()
    region_names = [REGIONS[r]["name"] for r in active if r in REGIONS]

    print(f"[NavyTrack Bot] Starting — polling every {POLL_INTERVAL}s")
    print(f"[Regions] Active: {', '.join(region_names)}")

    await send_telegram(
        f"✅ <b>NavyTrack Bot started</b>\n"
        f"📡 Monitoring: <b>{', '.join(region_names)}</b>\n"
        f"⏱ Poll interval: {POLL_INTERVAL}s"
    )

    while True:
        try:
            aircraft = await fetch_military()
            print(f"[Poll] {len(aircraft)} military aircraft globally")
            await check_alerts(aircraft)
        except Exception as e:
            print(f"[Error] {e}")
        await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
