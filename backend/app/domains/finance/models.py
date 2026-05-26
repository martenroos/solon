from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class FinancePeriodContext:
    company_id: Any
    fiscal_year: int
    fiscal_period: int
    previous_year: int
    previous_period: int
    yoy_year: int

    @classmethod
    def from_period_row(cls, row: dict[str, Any]) -> "FinancePeriodContext":
        fiscal_year = int(row["fiscal_year_number"])
        fiscal_period = int(row["fiscal_period_number"])
        return cls(
            company_id=row["company_id"],
            fiscal_year=fiscal_year,
            fiscal_period=fiscal_period,
            previous_year=fiscal_year if fiscal_period > 1 else fiscal_year - 1,
            previous_period=fiscal_period - 1 if fiscal_period > 1 else 12,
            yoy_year=fiscal_year - 1,
        )

    def query_params(self) -> dict[str, Any]:
        return {
            "company_id": self.company_id,
            "fiscal_year": self.fiscal_year,
            "fiscal_period": self.fiscal_period,
            "previous_year": self.previous_year,
            "previous_period": self.previous_period,
            "yoy_year": self.yoy_year,
        }


@dataclass(frozen=True)
class ProfitabilitySnapshot:
    revenue: float
    previous_revenue: float
    year_ago_revenue: float
    cost_of_sales: float
    previous_cost_of_sales: float
    year_ago_cost_of_sales: float
    operating_expenses: float
    previous_operating_expenses: float

    @property
    def gross_margin_pct(self) -> float:
        return ((self.revenue - self.cost_of_sales) / self.revenue * 100) if self.revenue else 0

    @property
    def previous_gross_margin_pct(self) -> float:
        if not self.previous_revenue:
            return self.gross_margin_pct
        return (self.previous_revenue - self.previous_cost_of_sales) / self.previous_revenue * 100

    @property
    def year_ago_gross_margin_pct(self) -> float:
        if not self.year_ago_revenue:
            return self.gross_margin_pct
        return (self.year_ago_revenue - self.year_ago_cost_of_sales) / self.year_ago_revenue * 100

    @property
    def net_profit(self) -> float:
        return self.revenue - self.cost_of_sales - self.operating_expenses

    @property
    def previous_net_profit(self) -> float:
        return self.previous_revenue - self.previous_cost_of_sales - self.previous_operating_expenses

    @property
    def net_profit_margin_pct(self) -> float:
        return (self.net_profit / self.revenue * 100) if self.revenue else 0

    @property
    def previous_net_profit_margin_pct(self) -> float:
        if not self.previous_revenue:
            return self.net_profit_margin_pct
        return self.previous_net_profit / self.previous_revenue * 100
