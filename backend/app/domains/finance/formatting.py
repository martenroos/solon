from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any


def as_float(value: Any) -> float:
    if value is None:
        return 0.0
    return float(value)


def money_short(value: float) -> str:
    sign = "-" if value < 0 else ""
    absolute = abs(value)
    if absolute >= 1_000_000:
        return f"{sign}EUR {absolute / 1_000_000:.2f}M"
    if absolute >= 1_000:
        return f"{sign}EUR {absolute / 1_000:.0f}k"
    return f"{sign}EUR {absolute:.0f}"


def pct(value: float, digits: int = 1) -> str:
    return f"{value:.{digits}f}%"


def delta_pct(current: float, previous: float) -> str:
    if previous == 0:
        return "+0.0%"
    return f"{((current - previous) / previous) * 100:+.1f}%"


def status_from_risk(score: float) -> str:
    if score >= 66:
        return "Alert"
    if score >= 33:
        return "Watch"
    return "On track"


def trend(values: list[float], fallback: float = 0) -> list[float]:
    cleaned = [round(as_float(value), 2) for value in values if value is not None]
    if not cleaned:
        return [fallback] * 7
    if len(cleaned) >= 7:
        return cleaned[-7:]
    return [cleaned[0]] * (7 - len(cleaned)) + cleaned


def is_stale(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, datetime):
        return (datetime.now(UTC) - value).total_seconds() > 3600
    return False


def format_sync(value: Any) -> str:
    if isinstance(value, datetime):
        return value.astimezone(UTC).strftime("%H:%M UTC")
    return "No sync"


def normalize_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{key: normalize_value(value) for key, value in row.items()} for row in rows]


def normalize_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [normalize_value(item) for item in value]
    return value
