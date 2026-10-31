"""Fetch an auditable Elexon snapshot. Run from the repository root.

Raw stream responses are retained losslessly as gzip JSON; a SQLite index
serves the application without making any third-party calls at request time.
"""
from __future__ import annotations

import argparse
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path
import sqlite3
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"


def download(dataset: str, day: date, output: Path, refresh: bool) -> dict:
    raw_path = output / "raw" / f"{dataset}-{day}.json.gz"
    if dataset == "WINDFOR":
        params = {
            "publishDateTimeFrom": f"{day}T00:00:00Z",
            "publishDateTimeTo": f"{day + timedelta(days=1)}T00:00:00Z",
        }
    else:
        params = {"settlementDateFrom": str(day), "settlementDateTo": str(day), "fuelType": "WIND"}
    url = f"{BASE_URL}/{dataset}/stream?{urlencode(params)}"
    if refresh or not raw_path.exists():
        for attempt in range(4):
            try:
                request = Request(url, headers={"Accept": "application/json", "User-Agent": "WindChallenge/1.0"})
                with urlopen(request, timeout=90) as response:
                    payload = response.read()
                records = json.loads(payload)
                if not isinstance(records, list):
                    raise ValueError(f"Unexpected {dataset} stream response")
                # Validate before replacing a previously usable snapshot chunk.
                raw_path.parent.mkdir(parents=True, exist_ok=True)
                raw_path.write_bytes(gzip.compress(payload, mtime=0))
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)
    payload = gzip.decompress(raw_path.read_bytes())
    records = json.loads(payload)
    return {
        "dataset": dataset, "day": str(day), "url": url,
        "path": str(raw_path.relative_to(output)).replace("\\", "/"),
        "sha256": hashlib.sha256(payload).hexdigest(), "records": len(records),
        "retrieved_at": datetime.fromtimestamp(raw_path.stat().st_mtime, timezone.utc).isoformat(),
    }


def normalize_time(value: str) -> str:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Source timestamp has no time zone")
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def create_index(output: Path, chunks: list[dict]) -> dict:
    temporary = output / "wind.building.sqlite3"
    temporary.unlink(missing_ok=True)
    inserted = {"WINDFOR": 0, "FUELHH": 0}
    rejected = {"WINDFOR": 0, "FUELHH": 0}
    with closing(sqlite3.connect(temporary)) as connection:
        connection.executescript("""
            CREATE TABLE forecasts (id TEXT PRIMARY KEY, start_time TEXT NOT NULL,
                publish_time TEXT NOT NULL, generation REAL NOT NULL);
            CREATE TABLE actuals (id TEXT PRIMARY KEY, start_time TEXT NOT NULL,
                publish_time TEXT NOT NULL, generation REAL NOT NULL);
            CREATE INDEX forecast_target ON forecasts(start_time, publish_time);
            CREATE INDEX actual_target ON actuals(start_time);
        """)
        for chunk in chunks:
            records = json.loads(gzip.decompress((output / chunk["path"]).read_bytes()))
            for record in records:
                dataset = chunk["dataset"]
                if dataset == "FUELHH" and record.get("fuelType") != "WIND":
                    continue
                try:
                    start = normalize_time(record["startTime"])
                    publish = normalize_time(record["publishTime"])
                    raw_generation = record["generation"]
                    if isinstance(raw_generation, bool):
                        raise ValueError("Boolean is not a generation value")
                    generation = float(raw_generation)
                    if not math.isfinite(generation):
                        raise ValueError("Non-finite generation")
                except (KeyError, TypeError, ValueError):
                    rejected[dataset] += 1
                    continue
                fingerprint = hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
                table = "forecasts" if dataset == "WINDFOR" else "actuals"
                result = connection.execute(
                    f"INSERT OR IGNORE INTO {table} VALUES (?, ?, ?, ?)",
                    (fingerprint, start, publish, generation),
                )
                inserted[dataset] += result.rowcount
        connection.commit()
    temporary.replace(output / "wind.sqlite3")
    return {"indexed_records": inserted, "rejected_records": rejected}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data")
    parser.add_argument("--refresh", action="store_true", help="Re-fetch cached chunks")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    days = [date(2026, 1, 1) + timedelta(days=i) for i in range(31)]
    jobs = [("WINDFOR", day) for day in days] + [("FUELHH", day + timedelta(days=1)) for day in days]
    chunks = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(download, dataset, day, args.output, args.refresh) for dataset, day in jobs]
        for future in as_completed(futures):
            chunk = future.result()
            chunks.append(chunk)
            print(f"{len(chunks):02}/{len(jobs)} {chunk['dataset']} {chunk['day']}: {chunk['records']} records", flush=True)
    chunks.sort(key=lambda chunk: (chunk["dataset"], chunk["day"]))
    manifest = {
        "source": "Elexon Insights Solution", "fetched_at": max(chunk["retrieved_at"] for chunk in chunks),
        "indexed_at": datetime.now(timezone.utc).isoformat(),
        "decision_from": "2026-01-01", "decision_to": "2026-01-31",
        "delivery_from": "2026-01-02", "delivery_to": "2026-02-01",
        "timezone": "Europe/London", "units": "MW", "chunks": chunks,
        **create_index(args.output, chunks),
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in manifest.items() if key != "chunks"}, indent=2))


if __name__ == "__main__":
    main()
