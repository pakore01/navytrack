"""
models.py — Pydantic schemas for request/response validation
"""

from pydantic import BaseModel
from typing import Optional, List


class FlightRequest(BaseModel):
    api_key: Optional[str] = None


class CarrierRequest(BaseModel):
    api_key: Optional[str] = None


class FlightData(BaseModel):
    icao:         str
    callsign:     Optional[str]  = None
    aircraft:     Optional[str]  = None
    registration: Optional[str]  = None
    origin:       Optional[str]  = None
    destination:  Optional[str]  = None
    lat:          Optional[float]= None
    lon:          Optional[float]= None
    altitude:     Optional[int]  = None
    speed:        Optional[float]= None
    heading:      Optional[float]= None
    on_ground:    bool           = False
    squawk:       Optional[str]  = None
    source:       str            = "airplanes.live"


class FlightsResponse(BaseModel):
    flights: List[FlightData]
    count:   int
    source:  str


class VesselData(BaseModel):
    mmsi:        str
    name:        Optional[str]  = None
    shipname:    Optional[str]  = None
    type:        Optional[str]  = None
    imo:         Optional[str]  = None
    destination: Optional[str]  = None
    last_port:   Optional[str]  = None
    lat:         Optional[float]= None
    lon:         Optional[float]= None
    speed:       Optional[float]= None
    course:      Optional[float]= None
    timestamp:   Optional[str]  = None
    source:      str            = "MarineTraffic"


class VesselsResponse(BaseModel):
    vessels: List[VesselData]
    count:   int
    source:  str
