from datetime import UTC, datetime, timedelta

import pytest

from app.domains.finance.formatting import delta_pct, delta_pts, is_stale, level_trend_status, signed


@pytest.mark.parametrize(
    ("value", "expected"),
    [(1.26, "+1.3"), (-1.26, "-1.3"), (0.0, "0.0"), (-0.01, "0.0"), (0.04, "0.0")],
)
def test_signed_never_shows_negative_zero(value: float, expected: str) -> None:
    assert signed(value) == expected


def test_delta_pts() -> None:
    assert delta_pts(81.9, 81.92) == "0.0 pts"
    assert delta_pts(-26.4, -27.0) == "+0.6 pts"


@pytest.mark.parametrize(
    ("current", "previous", "expected"),
    [
        (110, 100, "+10.0%"),
        (90, 100, "-10.0%"),
        # Negative baselines: a smaller loss is an improvement, a bigger loss is not.
        (-10_000, -12_000, "+16.7%"),
        (-12_000, -10_000, "-20.0%"),
        (100, 0, "n/a"),
    ],
)
def test_delta_pct(current: float, previous: float, expected: str) -> None:
    assert delta_pct(current, previous) == expected


@pytest.mark.parametrize(
    ("below_floor", "declining", "expected"),
    [(False, False, "On track"), (False, True, "Watch"), (True, False, "Watch"), (True, True, "Alert")],
)
def test_negative_kpis_are_never_on_track(below_floor: bool, declining: bool, expected: str) -> None:
    assert level_trend_status(below_floor=below_floor, declining=declining) == expected


def test_is_stale_uses_daily_window() -> None:
    now = datetime.now(UTC)
    assert not is_stale(now - timedelta(hours=23))
    assert is_stale(now - timedelta(hours=25))
    assert is_stale(None)
