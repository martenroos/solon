from __future__ import annotations

from typing import Any

from app.domains.finance.formatting import as_float
from app.schemas.finance import FinanceRevenueMarginPointResponse


def aggregate_period(rows: list[dict[str, Any]], year: int, period: int) -> dict[str, float]:
    result: dict[str, float] = {}
    for row in rows:
        if int(row["fiscal_year_number"]) == year and int(row["fiscal_period_number"]) == period:
            key = row["reporting_group_lvl1"]
            result[key] = result.get(key, 0) + as_float(row["amount"])
    return result


def build_revenue_margin_series(rows: list[dict[str, Any]]) -> list[FinanceRevenueMarginPointResponse]:
    by_period = aggregate_pl_by_period(rows)
    result = []
    month_labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for (_, period), values in sorted(by_period.items())[-6:]:
        revenue = abs(values.get("Revenue", 0))
        cost = values.get("Cost of Sales", 0)
        margin = ((revenue - cost) / revenue * 100) if revenue else 0
        result.append(
            FinanceRevenueMarginPointResponse(
                label=month_labels[period - 1],
                revenue=round(revenue / 1_000_000, 3),
                margin=round(margin, 1),
            )
        )
    return result


def build_profitability_series(rows: list[dict[str, Any]]) -> list[dict[str, float]]:
    result = []
    for _, values in sorted(aggregate_pl_by_period(rows).items())[-6:]:
        revenue = abs(values.get("Revenue", 0))
        cost = values.get("Cost of Sales", 0)
        opex = values.get("Operating Expenses", 0)
        ebitda = revenue - cost - opex
        result.append(
            {
                "ebitda": round(ebitda, 2),
                "net_profit_margin": round((ebitda / revenue * 100) if revenue else 0, 1),
            }
        )
    return result


def aggregate_pl_by_period(rows: list[dict[str, Any]]) -> dict[tuple[int, int], dict[str, float]]:
    by_period: dict[tuple[int, int], dict[str, float]] = {}
    for row in rows:
        key = (int(row["fiscal_year_number"]), int(row["fiscal_period_number"]))
        by_period.setdefault(key, {})
        group = row["reporting_group_lvl1"]
        by_period[key][group] = by_period[key].get(group, 0) + as_float(row["amount"])
    return by_period


def aging_totals(row: dict[str, Any]) -> tuple[float, float, float]:
    total = as_float(row.get("total_open_amount_base"))
    current = as_float(row.get("current_amount"))
    overdue = total - current
    return total, max(overdue, 0), current


def aggregate_aging_rows(rows: list[dict[str, Any]]) -> dict[str, float]:
    keys = [
        "total_open_amount_base",
        "current_amount",
        "overdue_1_30",
        "overdue_31_60",
        "overdue_61_90",
        "overdue_90_plus",
    ]
    return {key: sum(as_float(row.get(key)) for row in rows) for key in keys}


def aging_pct(row: dict[str, Any], key: str, total: float) -> float:
    return round(as_float(row.get(key)) / total * 100, 1) if total else 0


def top_concentration(rows: list[dict[str, Any]], count: int) -> float:
    amounts = sorted((as_float(row.get("total_open_amount_base")) for row in rows), reverse=True)
    total = sum(amounts)
    return round((sum(amounts[:count]) / total) * 100, 1) if total else 0
