"""Read the bundled snapshot without mutating server or deployment files."""
from functools import lru_cache
from contextlib import closing
import json
import os
from pathlib import Path
import sqlite3

from backend.analysis import analyze_period

ROOT = Path(__file__).resolve().parents[1]


@lru_cache(maxsize=1)
def load_snapshot() -> dict:
    directory = Path(os.environ.get("WIND_DATA_DIR", ROOT / "data")).resolve()
    database = directory / "wind.sqlite3"
    if not database.is_file() or not (directory / "manifest.json").is_file():
        raise FileNotFoundError("Historical data is not installed. Run python -m scripts.fetch_data first.")
    with closing(sqlite3.connect(database.as_uri() + "?mode=ro", uri=True)) as connection:
        connection.row_factory = sqlite3.Row
        forecasts = [dict(row) for row in connection.execute("SELECT start_time, publish_time, generation FROM forecasts")]
        actuals = [dict(row) for row in connection.execute("SELECT start_time, publish_time, generation FROM actuals")]
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    return {**analyze_period(forecasts, actuals), "manifest": manifest}
