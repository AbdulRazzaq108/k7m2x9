from contextlib import closing
import gzip
import json
import sqlite3

from scripts.fetch_data import create_index, normalize_time


def test_index_retains_real_revisions_collapses_exact_duplicates_and_rejects_invalid(tmp_path):
    record = {"dataset": "WINDFOR", "startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T22:30:00Z", "generation": 100}
    rows = [record, record, {**record, "generation": 110}, {**record, "generation": None}, {**record, "generation": True}, {**record, "generation": "NaN"}]
    raw_path = tmp_path / "forecast.json.gz"
    raw_path.write_bytes(gzip.compress(json.dumps(rows).encode()))
    counts = create_index(tmp_path, [{"dataset": "WINDFOR", "path": raw_path.name}])
    assert counts["indexed_records"]["WINDFOR"] == 2
    assert counts["rejected_records"]["WINDFOR"] == 3
    with closing(sqlite3.connect(tmp_path / "wind.sqlite3")) as connection:
        assert connection.execute("SELECT generation FROM forecasts ORDER BY generation").fetchall() == [(100,), (110,)]


def test_actual_index_filters_other_fuel_types(tmp_path):
    record = {"dataset": "FUELHH", "fuelType": "WIND", "startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-02T00:30:00Z", "generation": 80}
    raw_path = tmp_path / "actual.json.gz"
    raw_path.write_bytes(gzip.compress(json.dumps([record, {**record, "fuelType": "CCGT"}]).encode()))
    counts = create_index(tmp_path, [{"dataset": "FUELHH", "path": raw_path.name}])
    assert counts["indexed_records"]["FUELHH"] == 1


def test_source_timestamps_normalized_to_utc():
    assert normalize_time("2026-01-02T01:00:00+01:00") == "2026-01-02T00:00:00Z"
