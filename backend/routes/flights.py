"""
routes/flights.py — Flight data endpoint (airplanes.live, no key required)
"""

from fastapi import APIRouter
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models import FlightsResponse
from services.adsbexchange import fetch_navy_flights

router = APIRouter()


@router.post("/flights")
async def get_flights(req: dict = {}):
    try:
        flights = await fetch_navy_flights()
        return FlightsResponse(
            flights=flights,
            count=len(flights),
            source="airplanes.live",
        )
    except Exception as e:
        return FlightsResponse(flights=[], count=0, source=f"error: {str(e)}")
