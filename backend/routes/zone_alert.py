"""
routes/zone_alert.py — Send zone entry alerts to Telegram
"""
from fastapi import APIRouter
from pydantic import BaseModel
import httpx, os
from datetime import datetime

router = APIRouter()

TELEGRAM_TOKEN   = "8779133526:AAGV54lTa2f0RjwTTyvy9o60rE8mVaXVRYI"
TELEGRAM_CHAT_ID = "7478551004"


class ZoneAlertRequest(BaseModel):
    zone:     str
    icao:     str
    callsign: str
    aircraft: str
    lat:      float
    lon:      float
    dist_km:  int


@router.post("/zone-alert")
async def send_zone_alert(req: ZoneAlertRequest):
    maps_url = f"https://www.openstreetmap.org/?mlat={req.lat}&mlon={req.lon}&zoom=8"
    message = (
        f"🔴 <b>ZONE ALERT</b>\n\n"
        f"✈ <b>{req.callsign}</b> entered zone <b>{req.zone}</b>\n"
        f"📍 Distance from center: <b>{req.dist_km} km</b>\n\n"
        f"📋 <b>Aircraft:</b> {req.aircraft}\n"
        f"🔢 <b>ICAO:</b> <code>{req.icao}</code>\n"
        f"📍 <b>Position:</b> {req.lat:.4f}°N {req.lon:.4f}°E\n"
        f"🕐 <b>Time:</b> {datetime.utcnow().strftime('%H:%M:%S UTC')}\n\n"
        f"🗺 <a href='{maps_url}'>View on map</a>"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                json={"chat_id": TELEGRAM_CHAT_ID, "text": message,
                      "parse_mode": "HTML", "disable_web_page_preview": True}
            )
        return {"status": "sent"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
