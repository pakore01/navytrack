"""
routes/bases.py — Military base lookup by coordinates
"""

from fastapi import APIRouter
from pydantic import BaseModel
import json, os, math

router = APIRouter()
BASES_FILE = "/opt/apps/navytrack/backend/military_bases.json"


class BaseQuery(BaseModel):
    lat: float
    lon: float
    radius_km: float = 80.0


def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


@router.post("/bases/nearest")
async def nearest_base(req: BaseQuery):
    try:
        with open(BASES_FILE) as f:
            bases = json.load(f)

        nearest = None
        min_dist = float('inf')

        for base in bases:
            dist = haversine(req.lat, req.lon, base['lat'], base['lon'])
            if dist < min_dist:
                min_dist = dist
                nearest = base

        if nearest and min_dist <= req.radius_km:
            return {
                "found": True,
                "name": nearest["name"],
                "country": nearest["country"],
                "flag": nearest["flag"],
                "distance_km": round(min_dist, 1)
            }
        return {"found": False}

    except Exception as e:
        return {"found": False, "error": str(e)}
