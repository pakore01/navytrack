# NavyTrack — US Navy Flight & Carrier Monitor

> Real-time tracker for US Navy military flights and aircraft carrier positions in the Middle East region.

![NavyTrack](https://img.shields.io/badge/NavyTrack-v1.0-0057FF?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-ready-0D9E5B?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)

---

## What it does

NavyTrack is a modular Progressive Web App (PWA) that aggregates data from multiple aviation and maritime APIs to provide a unified view of:

- **US Navy military flights** — P-8 Poseidon, E-2 Hawkeye, EA-18G Growler, E-6 Mercury, C-130, KC-135, and more
- **US Navy aircraft carriers** — All Nimitz-class and Ford-class carriers (CVN-68 through CVN-79)
- **Region filter** — Focused on Middle East (Persian Gulf, Red Sea, Arabian Sea, Eastern Mediterranean)

Data is displayed in a clean, filterable, sortable table with a detail panel for each entry.

---

## Data sources

| Source | Used for | Auth |
|---|---|---|
| [ADS-B Exchange](https://www.adsbexchange.com/data/) | Military flights (primary) | API key required |
| [OpenSky Network](https://opensky-network.org) | US flights (supplementary) | Optional (free account) |
| [MarineTraffic](https://www.marinetraffic.com/en/ais-api-services) | Carrier vessel positions | API key required |

> **Important:** Military flights are only visible if the aircraft is broadcasting ADS-B. Classified operations, combat sorties, and intentionally untracked aircraft will not appear. Carrier AIS positions are not always transmitted for operational security reasons.

---

## Architecture

```
navytrack/
├── frontend/               # PWA — HTML + CSS + JS (no framework)
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js               # Service worker
│   ├── css/
│   │   ├── base.css        # Variables, typography, reset
│   │   ├── layout.css      # Structural layout
│   │   ├── components.css  # UI components
│   │   └── responsive.css  # Media queries
│   └── js/
│       ├── config.js       # Constants and STATE
│       ├── utils.js        # Shared helpers
│       ├── apikey.js       # Key input and storage
│       ├── api.js          # Data fetching
│       ├── table.js        # Table rendering
│       ├── filters.js      # Filter logic
│       └── app.js          # Bootstrap and lifecycle
│
├── backend/                # FastAPI — Python proxy server
│   ├── main.py
│   ├── models.py           # Pydantic schemas
│   ├── config.py           # Constants and MMSI database
│   ├── routes/
│   │   ├── flights.py      # POST /api/flights
│   │   └── vessels.py      # POST /api/carriers
│   └── services/
│       ├── adsbexchange.py # ADS-B Exchange integration
│       ├── marinetraffic.py# MarineTraffic integration
│       └── openskynet.py   # OpenSky Network integration
│
├── requirements.txt
├── .gitignore
└── README.md
```

---

## Quick start

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/navytrack.git
cd navytrack
```

### 2. Start the backend

```bash
cd backend
pip install -r ../requirements.txt
python main.py
```

Backend runs at `http://localhost:8000`
API docs available at `http://localhost:8000/docs`

### 3. Open the frontend

Option A — Directly in browser:
```bash
open frontend/index.html
```

Option B — With a local server (recommended for PWA):
```bash
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```

### 4. Enter your API keys

Click the **⚙ settings button** (top right) and enter your API keys:

- **ADS-B Exchange** key → [Get one here](https://www.adsbexchange.com/data/)
- **OpenSky** credentials → [Free account](https://opensky-network.org) (optional)
- **MarineTraffic** key → [Get one here](https://www.marinetraffic.com/en/ais-api-services)

Keys are stored in `localStorage` and sent only to your own backend proxy. They are never exposed in source code.

---

## Deployment

### Frontend → GitHub Pages

1. Push the `frontend/` folder to your repo
2. Go to **Settings → Pages → Source → Deploy from branch**
3. Select `main` branch, `/frontend` folder
4. Update `BACKEND_URL` in `frontend/js/config.js` to your deployed backend URL

### Backend → Any Python host

Works on: **Railway**, **Render**, **Fly.io**, **VPS**, **Heroku**

```bash
# Example: Render
# Start command:
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Update CORS `allow_origins` in `backend/main.py` to your GitHub Pages URL in production.

---

## Features

- **Live data** from ADS-B Exchange + OpenSky + MarineTraffic
- **Filterable table** — by type (flight/carrier), aircraft model, status (airborne/ground)
- **Search** — callsign, ICAO hex, vessel name, origin, destination
- **Sortable columns** — click any column header
- **Detail panel** — click any row for full data including coordinates, squawk, heading
- **CSV export** — download current filtered results
- **Auto-refresh** — configurable 30s / 1min / 2min intervals
- **PWA** — installable, works offline with last cached data
- **Secure** — API keys stored locally, backend acts as proxy

---

## Known limitations

- ADS-B Exchange free tier has rate limits and may not include all military traffic
- MarineTraffic paid API required for real-time carrier positions
- Classified military flights will not appear (by design — only public ADS-B broadcasts)
- Some carriers disable AIS for operational security

---

## License

MIT License — see [LICENSE](LICENSE) file.

---

## Disclaimer

This project uses only publicly available ADS-B and AIS data. No classified information is accessed or displayed. All data sources are publicly accessible and legal to use for non-commercial monitoring purposes.
