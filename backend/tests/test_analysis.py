from datetime import date
import math

import pytest

from backend.analysis import analyze_day, analyze_period, metrics, parse_time


def forecast(value=100, publish="2026-01-01T22:30:00Z", target="2026-01-02T00:00:00Z"):
    return {"start_time": target, "publish_time": publish, "generation": value}


def actual(value=80, target="2026-01-02T00:00:00Z"):
    return {"start_time": target, "publish_time": "2026-01-03T00:00:00Z", "generation": value}


def test_latest_preceding_day_and_no_future_leakage():
    day = analyze_day(date(2026, 1, 1), [forecast(90, "2026-01-01T08:00:00Z"), forecast(100), forecast(80, "2026-01-02T00:00:00Z")], [actual()])
    assert day["rows"][0]["forecast"] == 100
    assert day["metrics"] == {"mae": 20, "rmse": 20, "bias": 20, "count": 1}


def test_no_fallback_to_older_day():
    day = analyze_day(date(2026, 1, 1), [forecast(100, "2025-12-31T23:59:59Z")], [actual()])
    assert day["rows"][0]["forecast"] is None
    assert day["metrics"]["count"] == 0


def test_january_31_includes_february_delivery():
    day = analyze_day(date(2026, 1, 31), [forecast(130, "2026-01-31T23:00:00Z", "2026-02-01T23:00:00Z")], [actual(100, "2026-02-01T23:00:00Z")])
    assert day["delivery_date"] == "2026-02-01"
    assert day["metrics"]["bias"] == 30
    assert day["coverage"]["total_slots"] == 48


def test_duplicate_identical_values_are_collapsed():
    day = analyze_day(date(2026, 1, 1), [forecast(), forecast()], [actual(), actual()])
    assert day["metrics"]["count"] == 1
    assert day["coverage"]["conflicting_forecast"] == 0


def test_conflicting_latest_forecasts_excluded_without_older_fallback():
    day = analyze_day(date(2026, 1, 1), [forecast(90, "2026-01-01T08:00:00Z"), forecast(100), forecast(110)], [actual()])
    assert day["rows"][0]["issues"] == ["conflicting_forecast"]
    assert day["rows"][0]["forecast"] is None
    assert day["metrics"]["count"] == 0


def test_conflicting_old_forecasts_do_not_invalidate_latest():
    day = analyze_day(date(2026, 1, 1), [forecast(90, "2026-01-01T08:00:00Z"), forecast(91, "2026-01-01T08:00:00Z"), forecast(100)], [actual()])
    assert day["metrics"]["count"] == 1


def test_conflicting_actuals_excluded():
    day = analyze_day(date(2026, 1, 1), [forecast()], [actual(80), actual(90)])
    assert day["coverage"]["conflicting_actual"] == 1
    assert day["metrics"]["count"] == 0


def test_missing_values_are_not_zero_filled():
    day = analyze_day(date(2026, 1, 1), [forecast()], [])
    assert day["rows"][0]["actual"] is None
    assert day["metrics"]["mae"] is None


def test_hourly_forecasts_not_interpolated_to_half_hours():
    day = analyze_day(date(2026, 1, 1), [forecast()], [actual(), actual(90, "2026-01-02T00:30:00Z")])
    assert day["metrics"]["count"] == 1
    assert day["rows"][1]["forecast"] is None
    assert day["rows"][1]["actual"] == 90


def test_zero_generation_is_a_valid_observation():
    day = analyze_day(date(2026, 1, 1), [forecast(0)], [actual(0)])
    assert day["metrics"]["count"] == 1
    assert day["metrics"]["mae"] == 0


def test_metrics_and_negative_bias():
    result = metrics([-3, 4, -6])
    assert result["mae"] == pytest.approx(13 / 3)
    assert result["rmse"] == pytest.approx(math.sqrt(61 / 3))
    assert result["bias"] == pytest.approx(-5 / 3)


def test_whole_period_pools_observations_not_daily_averages():
    forecasts = [forecast(100), forecast(200, target="2026-01-02T01:00:00Z"), forecast(100, "2026-01-02T23:00:00Z", "2026-01-03T00:00:00Z")]
    actuals = [actual(100), actual(100, "2026-01-02T01:00:00Z"), actual(100, "2026-01-03T00:00:00Z")]
    period = analyze_period(forecasts, actuals)
    assert period["metrics"]["mae"] == pytest.approx(100 / 3)
    assert period["metrics"]["count"] == 3


def test_london_calendar_day_uses_aware_timestamps():
    # 01:00 +01:00 is midnight in London during January (GMT).
    day = analyze_day(date(2026, 1, 1), [forecast(100, "2026-01-02T00:30:00+01:00")], [actual()])
    assert day["metrics"]["count"] == 1
    assert day["rows"][0]["publish_time"] == "2026-01-01T23:30:00Z"


@pytest.mark.parametrize("decision", [date(2025, 12, 31), date(2026, 2, 1)])
def test_out_of_scope_dates_rejected(decision):
    with pytest.raises(ValueError):
        analyze_day(decision, [], [])


def test_naive_timestamps_rejected():
    with pytest.raises(ValueError):
        parse_time("2026-01-01T00:00:00")
