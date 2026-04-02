"""
routes/regions.py — Manage active monitoring regions
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import json, os

router = APIRouter()
REGIONS_FILE = "/opt/apps/navytrack/backend/regions.json"

VALID_REGIONS = [
    "middle_east", "europe", "north_america",
    "south_america", "asia_pacific", "africa", "arctic"
]

class RegionsUpdate(BaseModel):
    regions: List[str]

@router.post("/regions")
async def update_regions(req: RegionsUpdate):
    try:
        clean = [r for r in req.regions if r in VALID_REGIONS]
        with open(REGIONS_FILE, 'w') as f:
            json.dump(clean, f)
        return {"status": "ok", "regions": clean}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@router.get("/regions")
async def get_regions():
    try:
        if os.path.exists(REGIONS_FILE):
            with open(REGIONS_FILE) as f:
                return {"regions": json.load(f)}
    except:
        pass
    return {"regions": ["middle_east"]}
