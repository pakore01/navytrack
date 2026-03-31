"""
config.py — Backend constants and geographic filters
"""

# ── MIDDLE EAST BOUNDING BOX ──
MIDDLE_EAST = {
    "lat_min": 12.0,
    "lat_max": 42.0,
    "lon_min": 25.0,
    "lon_max": 65.0,
}

# ── ADS-B EXCHANGE ──
ADSB_BASE_URL = "https://adsbexchange.com/api/aircraft/v2"

# ── OPENSKY NETWORK ──
OPENSKY_BASE_URL = "https://opensky-network.org/api"

# ── MARINETRAFFIC ──
MARINE_BASE_URL = "https://services.marinetraffic.com/api"

# ── US NAVY CARRIER MMSIs ──
# Public MMSI numbers for US Navy aircraft carriers
CARRIER_MMSIS = [
    "338335808",  # USS Gerald R. Ford     CVN-78
    "338708532",  # USS George Washington  CVN-73
    "338334431",  # USS Abraham Lincoln    CVN-72
    "338228814",  # USS Harry S. Truman    CVN-75
    "338335765",  # USS Ronald Reagan      CVN-76
    "338225562",  # USS Dwight D. Eisenhower CVN-69
    "338225563",  # USS Carl Vinson        CVN-70
    "338335784",  # USS John C. Stennis    CVN-74
    "338225564",  # USS Theodore Roosevelt CVN-71
    "338225561",  # USS Nimitz             CVN-68
    "338335809",  # USS John F. Kennedy    CVN-79
]

CARRIER_INFO = {
    "338335808": {"name": "USS Gerald R. Ford",        "hull": "CVN-78", "class": "Ford-class"},
    "338708532": {"name": "USS George Washington",     "hull": "CVN-73", "class": "Nimitz-class"},
    "338334431": {"name": "USS Abraham Lincoln",       "hull": "CVN-72", "class": "Nimitz-class"},
    "338228814": {"name": "USS Harry S. Truman",       "hull": "CVN-75", "class": "Nimitz-class"},
    "338335765": {"name": "USS Ronald Reagan",         "hull": "CVN-76", "class": "Nimitz-class"},
    "338225562": {"name": "USS Dwight D. Eisenhower",  "hull": "CVN-69", "class": "Nimitz-class"},
    "338225563": {"name": "USS Carl Vinson",           "hull": "CVN-70", "class": "Nimitz-class"},
    "338335784": {"name": "USS John C. Stennis",       "hull": "CVN-74", "class": "Nimitz-class"},
    "338225564": {"name": "USS Theodore Roosevelt",    "hull": "CVN-71", "class": "Nimitz-class"},
    "338225561": {"name": "USS Nimitz",                "hull": "CVN-68", "class": "Nimitz-class"},
    "338335809": {"name": "USS John F. Kennedy",       "hull": "CVN-79", "class": "Ford-class"},
}

# ── US MILITARY ICAO HEX RANGES ──
# US military aircraft use hex codes in range ADF7C5–AFFFFF
# These prefixes are a heuristic for client-side filtering
US_MILITARY_HEX_PREFIXES = ["AE", "ADF"]

# ── REQUEST TIMEOUT (seconds) ──
REQUEST_TIMEOUT = 12
