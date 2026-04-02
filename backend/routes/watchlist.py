"""
routes/watchlist.py — Sync watchlist from frontend to server
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import json, os

router = APIRouter()
WATCHLIST_FILE = "/opt/apps/navytrack/backend/watchlist.json"


class WatchlistUpdate(BaseModel):
    items: List[str]


@router.post("/watchlist")
async def update_watchlist(req: WatchlistUpdate):
    try:
        clean = [w.strip().upper() for w in req.items if w.strip()]
        with open(WATCHLIST_FILE, 'w') as f:
            json.dump(clean, f)
        return {"status": "ok", "count": len(clean)}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.get("/watchlist")
async def get_watchlist():
    try:
        if os.path.exists(WATCHLIST_FILE):
            with open(WATCHLIST_FILE) as f:
                return {"items": json.load(f)}
    except:
        pass
    return {"items": []}
