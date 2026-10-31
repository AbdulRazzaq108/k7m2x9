from datetime import date
import sqlite3

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.store import ROOT, load_snapshot

app = FastAPI(title="Wind generation forecast accuracy", version="1.0.0")


def snapshot() -> dict:
    try:
        return load_snapshot()
    except (FileNotFoundError, sqlite3.Error):
        raise HTTPException(status_code=503, detail="Historical snapshot is unavailable. Run python -m scripts.fetch_data and restart the server.")


@app.get("/api/health")
def health():
    data = snapshot()
    return {"status": "ready", "decision_days": len(data["days"]), "source": "Elexon"}


@app.get("/api/overview")
def overview():
    data = snapshot()
    manifest = data["manifest"]
    return {
        "decision_from": "2026-01-01", "decision_to": "2026-01-31",
        "delivery_from": "2026-01-02", "delivery_to": "2026-02-01",
        "timezone": "Europe/London", "units": "MW",
        "metrics": data["metrics"], "coverage": data["coverage"],
        "days": [{key: day[key] for key in ("decision_date", "delivery_date", "metrics", "coverage")} for day in data["days"].values()],
        "source": {key: manifest[key] for key in ("source", "fetched_at", "indexed_records", "rejected_records")},
    }


@app.get("/api/decisions/{decision_date}")
def decision_day(decision_date: date):
    if not date(2026, 1, 1) <= decision_date <= date(2026, 1, 31):
        raise HTTPException(status_code=422, detail="Choose a purchasing decision date from 1 to 31 January 2026.")
    return snapshot()["days"][str(decision_date)]


DIST = ROOT / "frontend" / "dist"
if (DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/favicon.svg", include_in_schema=False)
def favicon():
    source = DIST / "favicon.svg"
    if not source.exists():
        source = ROOT / "frontend" / "public" / "favicon.svg"
    return FileResponse(source, media_type="image/svg+xml")


@app.get("/", include_in_schema=False)
def frontend():
    if (DIST / "index.html").is_file():
        return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-cache"})
    return JSONResponse(status_code=503, content={"detail": "Frontend is not built. Run npm ci and npm run build in frontend, or use the Vite development server on port 5173."})
