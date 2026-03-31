"""
routes/flights.py — Flight data endpoint (ADS-B Exchange proxy)
"""

from fastapi import APIRouter, HTTPException
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models import FlightRequest, FlightsResponse
from services.adsbexchange import fetch_navy_flights

router = APIRouter()


@router.post("/flights", response_model=FlightsResponse)
async def get_flights(req: FlightRequest):
    """
    Fetch US Navy military flights in the Middle East region via ADS-B Exchange.
    The API key is passed by the client and used only for this request.
    """
    if not req.api_key or len(req.api_key) < 4:
        raise HTTPException(status_code=400, detail="Invalid API key")

    try:
        flights = await fetch_navy_flights(req.api_key)
        return FlightsResponse(
            flights=flights,
            count=len(flights),
            source="ADS-B Exchange",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream API error: {str(e)}")
