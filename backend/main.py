"""
NavyTrack — FastAPI Backend
Proxy server for ADS-B Exchange and MarineTraffic APIs.
API keys are passed per-request from the frontend; never stored server-side.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from routes.flights  import router as flights_router
from routes.vessels  import router as vessels_router
from routes.watchlist import router as watchlist_router
from routes.regions  import router as regions_router
from routes.bases    import router as bases_router

app = FastAPI(
    title="NavyTrack API",
    description="Proxy backend for US Navy flight and carrier vessel tracking",
    version="1.0.0",
)

# ── CORS ──
# In production: restrict origins to your GitHub Pages URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Tighten in production
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# ── ROUTERS ──
app.include_router(flights_router, prefix="/api")
app.include_router(vessels_router, prefix="/api")
app.include_router(watchlist_router, prefix="/api")
app.include_router(regions_router,  prefix="/api")
app.include_router(bases_router,    prefix="/api")


@app.get("/")
async def root():
    return {
        "app":     "NavyTrack",
        "version": "1.0.0",
        "status":  "running",
        "docs":    "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
