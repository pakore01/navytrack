"""
routes/vessels.py — Carrier vessel endpoint (MarineTraffic proxy)
"""

from fastapi import APIRouter, HTTPException
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models import CarrierRequest, VesselsResponse
from services.marinetraffic import fetch_carriers

router = APIRouter()


@router.post("/carriers", response_model=VesselsResponse)
async def get_carriers(req: CarrierRequest):
    """
    Fetch US Navy carrier vessel positions via MarineTraffic.
    The API key is passed by the client and used only for this request.
    """
    if not req.api_key or len(req.api_key) < 4:
        raise HTTPException(status_code=400, detail="Invalid API key")

    try:
        vessels = await fetch_carriers(req.api_key)
        return VesselsResponse(
            vessels=vessels,
            count=len(vessels),
            source="MarineTraffic",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream API error: {str(e)}")
