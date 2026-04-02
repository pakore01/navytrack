"""
routes/alerts_history.py — Read alerts history
"""
from fastapi import APIRouter
import json, os

router = APIRouter()
ALERTS_FILE = "/opt/apps/navytrack/backend/alerts_history.json"

@router.get("/alerts-history")
async def get_alerts_history():
    try:
        if os.path.exists(ALERTS_FILE):
            with open(ALERTS_FILE) as f:
                return {"alerts": json.load(f)}
    except:
        pass
    return {"alerts": []}
