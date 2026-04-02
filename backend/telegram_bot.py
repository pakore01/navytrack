"""
telegram_bot.py — AirForceTrack Telegram Bot
Enhanced with commands, smart alerts, grouping and daily summary
"""

import httpx
import asyncio
import json
import os
from datetime import datetime, timezone

TELEGRAM_TOKEN   = "8779133526:AAGV54lTa2f0RjwTTyvy9o60rE8mVaXVRYI"
TELEGRAM_CHAT_ID = "7478551004"
WATCHLIST_FILE   = "/opt/apps/navytrack/backend/watchlist.json"
REGIONS_FILE     = "/opt/apps/navytrack/backend/regions.json"
ALERTS_FILE      = "/opt/apps/navytrack/backend/alerts_history.json"
BASES_FILE       = "/opt/apps/navytrack/backend/military_bases.json"
POLL_INTERVAL    = 60

REGIONS = {
    "middle_east":   {"name": "Middle East",   "lat_min": 12.0,  "lat_max": 42.0,  "lon_min": 25.0,   "lon_max": 65.0},
    "europe":        {"name": "Europe",         "lat_min": 35.0,  "lat_max": 72.0,  "lon_min": -25.0,  "lon_max": 45.0},
    "north_america": {"name": "North America",  "lat_min": 15.0,  "lat_max": 75.0,  "lon_min": -170.0, "lon_max": -50.0},
    "south_america": {"name": "South America",  "lat_min": -60.0, "lat_max": 15.0,  "lon_min": -85.0,  "lon_max": -30.0},
    "asia_pacific":  {"name": "Asia Pacific",   "lat_min": -50.0, "lat_max": 50.0,  "lon_min": 65.0,   "lon_max": 180.0},
    "africa":        {"name": "Africa",         "lat_min": -35.0, "lat_max": 38.0,  "lon_min": -20.0,  "lon_max": 52.0},
    "arctic":        {"name": "Arctic",         "lat_min": 60.0,  "lat_max": 90.0,  "lon_min": -180.0, "lon_max": 180.0},
}

MISSION_TYPES = {
    'KC-135': 'AERIAL REFUELING', 'KC-10': 'AERIAL REFUELING',
    'P-8': 'MARITIME PATROL', 'P-3': 'MARITIME PATROL',
    'E-2': 'AEW&C', 'E-3': 'AEW&C',
    'EA-18': 'ELECTRONIC WARFARE', 'RC-135': 'RECONNAISSANCE',
    'C-130': 'TRANSPORT', 'C-17': 'TRANSPORT', 'C-5': 'TRANSPORT',
    'E-6': 'COMMAND & CONTROL', 'B-52': 'STRATEGIC BOMBER',
    'B-2': 'STEALTH BOMBER', 'F-35': 'FIGHTER', 'F-16': 'FIGHTER',
}

triggered = {}
alert_queue = []
session_stats = {"total_detected": 0, "alerts_sent": 0, "start_time": datetime.now(timezone.utc)}
last_update_id = 0


def load_json(path, default):
    try:
        if os.path.exists(path):
            with open(path) as f:
                return json.load(f)
    except:
        pass
    return default


def save_json(path, data):
    try:
        with open(path, 'w') as f:
            json.dump(data, f, indent=2, default=str)
    except:
        pass


def get_mission(aircraft):
    if not aircraft:
        return 'MILITARY OPS'
    a = aircraft.upper()
    for key, label in MISSION_TYPES.items():
        if key in a:
            return label
    return 'MILITARY OPS'


def haversine(lat1, lon1, lat2, lon2):
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def get_nearest_base(lat, lon, radius=300):
    bases = load_json(BASES_FILE, [])
    nearest = None
    min_dist = float('inf')
    for base in bases:
        dist = haversine(lat, lon, base['lat'], base['lon'])
        if dist < min_dist:
            min_dist = dist
            nearest = base
    if nearest and min_dist <= radius:
        return nearest, round(min_dist)
    return None, None


def get_region(lat, lon):
    active = load_json(REGIONS_FILE, ["middle_east"])
    for key in active:
        r = REGIONS.get(key)
        if r and r["lat_min"] <= float(lat) <= r["lat_max"] and r["lon_min"] <= float(lon) <= r["lon_max"]:
            return r["name"]
    return None


async def send_telegram(message, parse_mode="HTML"):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            await client.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": parse_mode,
                "disable_web_page_preview": True,
            })
        except Exception as e:
            print(f"[Telegram] Error: {e}")


async def send_photo_alert(photo_url, caption):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            await client.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "photo": photo_url,
                "caption": caption,
                "parse_mode": "HTML",
            })
            return True
        except:
            return False


async def get_aircraft_photo(icao):
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            res = await client.get(f"https://api.planespotters.net/pub/photos/hex/{icao}")
            if res.status_code == 200:
                data = res.json()
                photo = data.get("photos", [None])[0]
                if photo:
                    return photo.get("thumbnail_large", {}).get("src") or photo.get("thumbnail", {}).get("src")
    except:
        pass
    return None


async def fetch_military():
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get("https://api.airplanes.live/v2/mil", headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200:
                return resp.json().get("ac", [])
        except Exception as e:
            print(f"[Fetch] Error: {e}")
    return []


async def handle_command(text):
    text = text.strip().lower()

    if text in ["/help", "/start"]:
        msg = (
            "✈ <b>AirForceTrack Bot</b>\n\n"
            "<b>Commands:</b>\n"
            "/status — Active flights now\n"
            "/zones — Active alert zones\n"
            "/watchlist — Monitored callsigns\n"
            "/regions — Active regions\n"
            "/summary — Session statistics\n"
            "/help — Show this message\n\n"
            "🌐 <a href='https://airforcetrack.live'>airforcetrack.live</a>"
        )
        await send_telegram(msg)

    elif text == "/status":
        aircraft = await fetch_military()
        in_region = [ac for ac in aircraft if ac.get("lat") and ac.get("lon") and get_region(ac["lat"], ac["lon"])]
        if not in_region:
            await send_telegram("📡 No military flights in active regions right now.")
            return
        msg = f"📡 <b>{len(in_region)} active flights</b>\n\n"
        for ac in in_region[:10]:
            call = (ac.get("flight") or ac.get("hex") or "—").strip()
            atype = ac.get("desc") or ac.get("t") or "Military"
            alt = ac.get("alt_baro") or "—"
            spd = round(float(ac.get("gs", 0))) if ac.get("gs") else "—"
            region = get_region(ac["lat"], ac["lon"])
            msg += f"✈ <b>{call}</b> — {atype}\n   {region} | {alt} ft | {spd} kts\n\n"
        if len(in_region) > 10:
            msg += f"<i>+{len(in_region)-10} more</i>\n"
        msg += f"🌐 <a href='https://airforcetrack.live'>airforcetrack.live</a>"
        await send_telegram(msg)

    elif text == "/watchlist":
        wl = load_json(WATCHLIST_FILE, [])
        if not wl:
            await send_telegram("👁 Watchlist empty. Add at airforcetrack.live")
            return
        await send_telegram("👁 <b>Watchlist:</b> " + " | ".join([f"<code>{w}</code>" for w in wl]))

    elif text == "/regions":
        active = load_json(REGIONS_FILE, ["middle_east"])
        names = [REGIONS[r]["name"] for r in active if r in REGIONS]
        await send_telegram("🌍 <b>Active Regions:</b>\n" + "\n".join([f"• {n}" for n in names]))

    elif text == "/summary":
        uptime = datetime.now(timezone.utc) - session_stats["start_time"]
        h = int(uptime.total_seconds() // 3600)
        m = int((uptime.total_seconds() % 3600) // 60)
        await send_telegram(
            f"📊 <b>Session Summary</b>\n\n"
            f"⏱ Uptime: {h}h {m}m\n"
            f"✈ Detected: {session_stats['total_detected']}\n"
            f"🚨 Alerts: {session_stats['alerts_sent']}\n"
            f"🌐 <a href='https://airforcetrack.live'>airforcetrack.live</a>"
        )


async def poll_commands():
    global last_update_id
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getUpdates",
                params={"offset": last_update_id + 1, "timeout": 5}
            )
            if resp.status_code == 200:
                for update in resp.json().get("result", []):
                    last_update_id = update["update_id"]
                    text = update.get("message", {}).get("text", "")
                    if text.startswith("/"):
                        await handle_command(text)
        except:
            pass


async def process_alerts():
    global alert_queue
    if not alert_queue:
        return

    if len(alert_queue) == 1:
        ac, matched, region = alert_queue[0]
        await send_single_alert(ac, matched, region)
    else:
        msg = f"🚨 <b>{len(alert_queue)} aircraft detected</b>\n\n"
        for ac, matched, region in alert_queue[:8]:
            call = (ac.get("flight") or ac.get("hex") or "—").strip()
            atype = ac.get("desc") or ac.get("t") or "Military"
            msg += f"✈ <b>{call}</b> — {atype} | {region}\n"
        if len(alert_queue) > 8:
            msg += f"\n<i>+{len(alert_queue)-8} more</i>"
        msg += f"\n\n🌐 <a href='https://airforcetrack.live'>airforcetrack.live</a>"
        await send_telegram(msg)

    session_stats["alerts_sent"] += len(alert_queue)

    history = load_json(ALERTS_FILE, [])
    for ac, matched, region in alert_queue:
        history.insert(0, {
            "icao": ac.get("hex", ""), "callsign": (ac.get("flight") or "").strip(),
            "aircraft": ac.get("desc") or ac.get("t") or "", "region": region,
            "matched": matched, "lat": ac.get("lat"), "lon": ac.get("lon"),
            "time": datetime.now(timezone.utc).isoformat(),
        })
    save_json(ALERTS_FILE, history[:200])
    alert_queue = []


async def send_single_alert(ac, matched, region):
    icao     = (ac.get("hex") or "").upper()
    callsign = (ac.get("flight") or icao).strip()
    atype    = ac.get("desc") or ac.get("t") or "Military"
    lat, lon = ac.get("lat"), ac.get("lon")
    alt      = ac.get("alt_baro") or "—"
    speed    = round(float(ac.get("gs", 0))) if ac.get("gs") else "—"
    heading  = round(float(ac.get("track", 0))) if ac.get("track") else "—"
    mission  = get_mission(atype)
    maps_url = f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}&zoom=7"

    squawk = ac.get("squawk", "")
    emergency = ""
    if squawk == "7700": emergency = "\n🆘 <b>EMERGENCY — SQUAWK 7700</b>"
    elif squawk == "7600": emergency = "\n📻 <b>RADIO FAILURE — SQUAWK 7600</b>"
    elif squawk == "7500": emergency = "\n⚠️ <b>HIJACK — SQUAWK 7500</b>"

    base_str = ""
    if lat and lon:
        base, dist = get_nearest_base(lat, lon)
        if base:
            base_str = f"\n🏛 <b>Base:</b> {base['flag']} {base['name']} ({dist} km)"

    caption = (
        f"🚨 <b>AirForceTrack Alert</b>{emergency}\n\n"
        f"✈ <b>{callsign}</b> — <code>{matched}</code>\n\n"
        f"🌍 {region} | 🎯 {mission}\n"
        f"📋 {atype} | 🔢 <code>{icao}</code>\n"
        f"📍 {float(lat):.4f}°N {float(lon):.4f}°E\n"
        f"🏔 {alt} ft | 💨 {speed} kts | 🧭 {heading}°"
        f"{base_str}\n"
        f"🕐 {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}\n\n"
        f"🗺 <a href='{maps_url}'>Map</a> | "
        f"<a href='https://airforcetrack.live'>AirForceTrack</a>"
    )

    photo_url = await get_aircraft_photo(icao)
    if photo_url:
        sent = await send_photo_alert(photo_url, caption)
        if sent:
            return
    await send_telegram(caption)


async def check_alerts(aircraft):
    global alert_queue, triggered
    watchlist = load_json(WATCHLIST_FILE, [])
    active_keys = set()

    for ac in aircraft:
        lat, lon = ac.get("lat"), ac.get("lon")
        if lat is None or lon is None:
            continue
        region = get_region(lat, lon)
        if not region:
            continue

        callsign = (ac.get("flight") or "").strip().upper()
        icao     = (ac.get("hex") or "").strip().upper()
        key      = icao
        active_keys.add(key)
        session_stats["total_detected"] = max(session_stats["total_detected"], len(aircraft))

        squawk = ac.get("squawk", "")
        if squawk in ["7700", "7600", "7500"] and key not in triggered:
            triggered[key] = datetime.now(timezone.utc).isoformat()
            alert_queue.append((ac, f"SQUAWK {squawk}", region))
            continue

        if watchlist:
            matched = next((w for w in watchlist if w in callsign or w in icao), None)
            if matched and key not in triggered:
                triggered[key] = datetime.now(timezone.utc).isoformat()
                alert_queue.append((ac, matched, region))

    for key in list(triggered.keys()):
        if key not in active_keys:
            del triggered[key]


async def main():
    print("[AirForceTrack Bot] Starting...")
    active = load_json(REGIONS_FILE, ["middle_east"])
    region_names = [REGIONS[r]["name"] for r in active if r in REGIONS]
    await send_telegram(
        f"✅ <b>AirForceTrack Bot started</b>\n"
        f"📡 Monitoring: <b>{', '.join(region_names)}</b>\n"
        f"💬 /help for commands\n"
        f"🌐 <a href='https://airforcetrack.live'>airforcetrack.live</a>"
    )

    while True:
        try:
            await poll_commands()
            aircraft = await fetch_military()
            print(f"[Poll] {len(aircraft)} military aircraft")
            await check_alerts(aircraft)
            if alert_queue:
                await asyncio.sleep(5)
                await process_alerts()
        except Exception as e:
            print(f"[Error] {e}")
        await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
