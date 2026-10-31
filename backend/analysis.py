"""Pure, independently testable forecast selection and accuracy calculations."""
from __future__ import annotations

from collections import defaultdict, Counter
from datetime import date, datetime, time, timedelta, timezone
import math
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")
FIRST_DECISION = date(2026, 1, 1)
LAST_DECISION = date(2026, 1, 31)


def parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Timestamp must include a time zone")
    return parsed.astimezone(timezone.utc)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def metrics(errors: list[float]) -> dict:
    if not errors:
        return {"mae": None, "rmse": None, "bias": None, "count": 0}
    count = len(errors)
    return {
        "mae": math.fsum(abs(value) for value in errors) / count,
        "rmse": math.sqrt(math.fsum(value * value for value in errors) / count),
        "bias": math.fsum(errors) / count,
        "count": count,
    }


def analyze_day(decision: date, forecasts: list[dict], actuals: list[dict]) -> dict:
    if not FIRST_DECISION <= decision <= LAST_DECISION:
        raise ValueError("Decision date must be in January 2026")
    delivery = decision + timedelta(days=1)
    forecast_groups: dict[datetime, list[tuple[datetime, float]]] = defaultdict(list)
    actual_groups: dict[datetime, list[float]] = defaultdict(list)
    for record in forecasts:
        target = parse_time(record["start_time"])
        publish = parse_time(record["publish_time"])
        if target.astimezone(LONDON).date() == delivery and publish.astimezone(LONDON).date() == decision:
            forecast_groups[target].append((publish, record["generation"]))
    for record in actuals:
        target = parse_time(record["start_time"])
        if target.astimezone(LONDON).date() == delivery:
            actual_groups[target].append(record["generation"])

    start = datetime.combine(delivery, time.min, LONDON).astimezone(timezone.utc)
    end = datetime.combine(delivery + timedelta(days=1), time.min, LONDON).astimezone(timezone.utc)
    targets = set(forecast_groups) | set(actual_groups)
    current = start
    while current < end:
        targets.add(current)
        current += timedelta(minutes=30)

    rows = []
    errors = []
    for target in sorted(targets):
        candidates = forecast_groups.get(target, [])
        latest_publish = max((publish for publish, _ in candidates), default=None)
        latest_values = {value for publish, value in candidates if publish == latest_publish}
        actual_values = set(actual_groups.get(target, []))
        forecast_conflict = len(latest_values) > 1
        actual_conflict = len(actual_values) > 1
        forecast = next(iter(latest_values)) if len(latest_values) == 1 else None
        actual = next(iter(actual_values)) if len(actual_values) == 1 else None
        issues = []
        if forecast_conflict:
            issues.append("conflicting_forecast")
        elif forecast is None:
            issues.append("missing_forecast")
        if actual_conflict:
            issues.append("conflicting_actual")
        elif actual is None:
            issues.append("missing_actual")
        error = forecast - actual if forecast is not None and actual is not None else None
        if error is not None:
            errors.append(error)
        rows.append({
            "start_time": iso(target), "time": target.astimezone(LONDON).strftime("%H:%M"),
            "publish_time": iso(latest_publish) if latest_publish else None,
            "forecast": forecast, "actual": actual, "error": error,
            "status": "matched" if not issues else issues[0], "issues": issues,
        })
    issue_counts = Counter(issue for row in rows for issue in row["issues"])
    publication_times = sorted({row["publish_time"] for row in rows if row["forecast"] is not None})
    return {
        "decision_date": str(decision), "delivery_date": str(delivery), "timezone": "Europe/London",
        "units": "MW", "metrics": metrics(errors), "rows": rows,
        "coverage": {
            "total_slots": len(rows), "matched": len(errors),
            "forecast_available": sum(row["forecast"] is not None for row in rows),
            "actual_available": sum(row["actual"] is not None for row in rows),
            "missing_forecast": issue_counts["missing_forecast"], "missing_actual": issue_counts["missing_actual"],
            "conflicting_forecast": issue_counts["conflicting_forecast"], "conflicting_actual": issue_counts["conflicting_actual"],
        },
        "publication_times": publication_times,
    }


def analyze_period(forecasts: list[dict], actuals: list[dict]) -> dict:
    # Bucket by target day once, keeping the month analysis linear in raw rows.
    forecast_days: dict[date, list[dict]] = defaultdict(list)
    actual_days: dict[date, list[dict]] = defaultdict(list)
    for record in forecasts:
        forecast_days[parse_time(record["start_time"]).astimezone(LONDON).date()].append(record)
    for record in actuals:
        actual_days[parse_time(record["start_time"]).astimezone(LONDON).date()].append(record)
    days = {}
    for offset in range(31):
        decision = FIRST_DECISION + timedelta(days=offset)
        delivery = decision + timedelta(days=1)
        days[str(decision)] = analyze_day(decision, forecast_days[delivery], actual_days[delivery])
    all_errors = [row["error"] for day in days.values() for row in day["rows"] if row["error"] is not None]
    coverage = {key: sum(day["coverage"][key] for day in days.values()) for key in next(iter(days.values()))["coverage"]}
    return {"days": days, "metrics": metrics(all_errors), "coverage": coverage}
