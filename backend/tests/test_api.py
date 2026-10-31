from fastapi.testclient import TestClient
import pytest

from backend.main import app

client = TestClient(app)


def test_health_and_overview():
    assert client.get("/api/health").json()["status"] == "ready"
    response = client.get("/api/overview")
    assert response.status_code == 200
    overview = response.json()
    assert len(overview["days"]) == 31
    assert overview["delivery_to"] == "2026-02-01"
    assert overview["metrics"]["count"] == sum(day["metrics"]["count"] for day in overview["days"])
    assert overview["coverage"]["matched"] == overview["metrics"]["count"]


@pytest.mark.parametrize("decision", ["2026-01-01", "2026-01-16", "2026-01-31"])
def test_day_has_exact_matching_observations_and_eligible_publications(decision):
    response = client.get(f"/api/decisions/{decision}")
    assert response.status_code == 200
    day = response.json()
    matched = [row for row in day["rows"] if row["status"] == "matched"]
    assert day["metrics"]["count"] == len(matched)
    for row in matched:
        assert row["publish_time"].startswith(decision)
        assert row["error"] == row["forecast"] - row["actual"]


@pytest.mark.parametrize("invalid", ["2025-12-31", "2026-02-01", "not-a-date"])
def test_invalid_decision_date(invalid):
    assert client.get(f"/api/decisions/{invalid}").status_code == 422


def test_unknown_api_path_is_not_frontend_html():
    response = client.get("/api/unknown")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
