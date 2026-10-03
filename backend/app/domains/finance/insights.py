from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from app.domains.finance.formatting import as_float, delta_pct, delta_pts, level_trend_status, money_short, normalize_rows, pct, signed, status_from_risk, trend
from app.schemas.finance import FinanceCashForecastPointResponse, FinanceInsightCardResponse, FinanceInsightSegmentResponse


@dataclass(frozen=True)
class InsightInputs:
    revenue: float
    prev_revenue: float
    year_ago_revenue: float
    revenue_trend: list[float]
    revenue_growth_mom: float
    revenue_growth_yoy: float
    revenue_driver_bridge: list[dict[str, Any]]
    gross_margin: float
    prev_margin: float
    year_ago_margin: float
    margin_trend: list[float]
    customer_margin_rows: list[dict[str, Any]]
    net_profit: float
    prev_net_profit: float
    net_profit_margin: float
    prev_net_profit_margin: float
    net_profit_margin_trend: list[float]
    ebitda: float
    prev_ebitda: float
    ebitda_trend: list[float]
    opex: float
    opex_trend: list[float]
    variance: float
    variance_pct: float
    material_accounts: int
    ar_total: float
    ar_overdue_pct: float
    ap_total: float
    ap_overdue_pct: float
    cash_forecast: list[FinanceCashForecastPointResponse]
    stale_count: int
    coverage: float
    customer_concentration: float
    supplier_concentration: float
    open_ar_items: int
    ar_drivers: list[dict[str, Any]]
    revenue_drivers: list[dict[str, Any]]
    margin_drivers: list[dict[str, Any]]
    budget_drivers: list[dict[str, Any]]
    duplicate_postings: list[dict[str, Any]]
    abnormal_journal_lines: list[dict[str, Any]]

    @property
    def cash_in(self) -> float:
        return sum(point.inflow for point in self.cash_forecast)

    @property
    def cash_out(self) -> float:
        return sum(point.outflow for point in self.cash_forecast)

    @property
    def liquidity_gap(self) -> float:
        return max((self.cash_out - self.cash_in) * 1_000, 0)

    @property
    def overdue_invoice_risk(self) -> int:
        factor = min(max(self.ar_overdue_pct / 100, 0.05), 1)
        return round(self.open_ar_items * factor)

    @property
    def duplicate_count(self) -> int:
        return sum(int(row.get("match_count") or 0) for row in self.duplicate_postings)


def make_card(
    id: str,
    metric: str,
    delta: str,
    direction: str,
    status: str,
    values: list[float],
    segments: list[FinanceInsightSegmentResponse] | None = None,
    evidence: dict[str, Any] | None = None,
) -> FinanceInsightCardResponse:
    return FinanceInsightCardResponse(
        id=id,
        metric=metric,
        delta=delta,
        deltaDirection=direction,
        status=status,
        trend=trend(values),
        segments=segments,
        evidence=evidence,
    )


def revenue_trend_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    evidence = {
        "analyst_logic": "Compare current fiscal-period revenue against the previous fiscal period for MoM and the same period last year for YoY.",
        "current_revenue": data.revenue,
        "previous_revenue": data.prev_revenue,
        "year_ago_revenue": data.year_ago_revenue,
        "mom_growth_pct": data.revenue_growth_mom,
        "yoy_growth_pct": data.revenue_growth_yoy,
        "driver_bridge": normalize_rows(data.revenue_driver_bridge),
        "top_drivers": normalize_rows(data.revenue_drivers),
    }
    return make_card(
        "revenue-trend",
        pct(data.revenue_growth_mom),
        f"YoY {delta_pct(data.revenue, data.year_ago_revenue)}",
        "up" if data.revenue >= data.prev_revenue else "down",
        status_from_risk(0 if data.revenue >= data.prev_revenue else 45),
        data.revenue_trend,
        evidence=evidence,
    )


def gross_margin_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    evidence = {
        "analyst_logic": "Calculate gross margin from revenue and cost-of-sales postings; customer margin allocates direct costs by org-unit revenue mix.",
        "current_margin_pct": data.gross_margin,
        "previous_margin_pct": data.prev_margin,
        "year_ago_margin_pct": data.year_ago_margin,
        "margin_delta_points": data.gross_margin - data.prev_margin,
        "product_margin_note": "Product-level gross margin is not available because the current warehouse has no product or sales-invoice-line product dimension.",
        "customer_margin": normalize_rows(data.customer_margin_rows),
        "top_cost_drivers": normalize_rows(data.margin_drivers),
    }
    return make_card(
        "gross-margin",
        pct(data.gross_margin),
        delta_pts(data.gross_margin, data.prev_margin),
        "up" if data.gross_margin >= data.prev_margin else "down",
        level_trend_status(below_floor=data.gross_margin < 0, declining=round(data.gross_margin - data.prev_margin, 1) < 0),
        data.margin_trend,
        evidence=evidence,
    )


def net_profit_margin_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    evidence = {
        "analyst_logic": "Calculate net profit margin as revenue less cost of sales and operating expenses, divided by revenue.",
        "net_profit": data.net_profit,
        "previous_net_profit": data.prev_net_profit,
        "current_net_profit_margin_pct": data.net_profit_margin,
        "previous_net_profit_margin_pct": data.prev_net_profit_margin,
    }
    return make_card(
        "net-profit-margin",
        pct(data.net_profit_margin),
        delta_pts(data.net_profit_margin, data.prev_net_profit_margin),
        "up" if data.net_profit_margin >= data.prev_net_profit_margin else "down",
        level_trend_status(below_floor=data.net_profit_margin < 0, declining=round(data.net_profit_margin - data.prev_net_profit_margin, 1) < 0),
        data.net_profit_margin_trend,
        evidence=evidence,
    )


def ebitda_trend_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    evidence = {
        "analyst_logic": "Use available operating P&L groups as EBITDA proxy: revenue less cost of sales and operating expenses.",
        "current_ebitda": data.ebitda,
        "previous_ebitda": data.prev_ebitda,
        "trend_values_thousands": data.ebitda_trend,
    }
    return make_card(
        "ebitda-trend",
        money_short(data.ebitda),
        delta_pct(data.ebitda, data.prev_ebitda),
        "up" if data.ebitda >= data.prev_ebitda else "down",
        level_trend_status(below_floor=data.ebitda < 0, declining=data.ebitda < data.prev_ebitda),
        data.ebitda_trend,
        evidence=evidence,
    )


def opex_run_rate_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    return make_card("opex-run-rate", money_short(abs(data.opex)), "Latest period", "flat", status_from_risk(20), data.opex_trend)


def trial_balance_movement_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    return make_card(
        "trial-balance-movement",
        f"{data.material_accounts} accounts",
        "Material budget shifts",
        "flat",
        status_from_risk(data.material_accounts * 20),
        [data.material_accounts],
    )


def budget_vs_actual_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    evidence = {
        "analyst_logic": "Rank budget lines by absolute variance and flag accounts where actual performance materially deviates from plan.",
        "absolute_variance": data.variance,
        "average_variance_pct": data.variance_pct,
        "material_accounts": data.material_accounts,
        "top_variances": normalize_rows(data.budget_drivers),
    }
    return make_card(
        "budget-vs-actual",
        money_short(data.variance),
        f"{pct(data.variance_pct)} from plan",
        "down" if data.variance_pct > 5 else "flat",
        status_from_risk(data.variance_pct * 4),
        [data.variance_pct],
        evidence=evidence,
    )


def customer_concentration_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    value = data.customer_concentration
    segments = [
        FinanceInsightSegmentResponse(label="Top 3", value=value, tone="bg-chart-1"),
        FinanceInsightSegmentResponse(label="Other", value=max(round(100 - value, 1), 0), tone="bg-chart-2"),
    ]
    return make_card("customer-concentration", pct(value, 0), "Top 3 customers", "flat", status_from_risk(value - 35), [value], segments)


def supplier_concentration_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    value = data.supplier_concentration
    segments = [
        FinanceInsightSegmentResponse(label="Top 5", value=value, tone="bg-chart-5"),
        FinanceInsightSegmentResponse(label="Other", value=max(round(100 - value, 1), 0), tone="bg-chart-2"),
    ]
    return make_card("supplier-concentration", pct(value, 0), "Top 5 suppliers", "flat", status_from_risk(value - 40), [value], segments)


def ar_aging_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    segments = [
        FinanceInsightSegmentResponse(label="Current", value=round(100 - data.ar_overdue_pct, 1), tone="bg-chart-2"),
        FinanceInsightSegmentResponse(label="Overdue", value=round(data.ar_overdue_pct, 1), tone="bg-chart-1"),
    ]
    return make_card(
        "ar-aging",
        money_short(data.ar_total),
        f"{pct(data.ar_overdue_pct)} overdue",
        "down" if data.ar_overdue_pct > 10 else "flat",
        status_from_risk(data.ar_overdue_pct),
        [data.ar_overdue_pct],
        segments,
    )


def ap_aging_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    segments = [
        FinanceInsightSegmentResponse(label="Current", value=round(100 - data.ap_overdue_pct, 1), tone="bg-chart-2"),
        FinanceInsightSegmentResponse(label="Overdue", value=round(data.ap_overdue_pct, 1), tone="bg-chart-5"),
    ]
    return make_card(
        "ap-aging",
        money_short(data.ap_total),
        f"{pct(data.ap_overdue_pct)} overdue",
        "down" if data.ap_overdue_pct > 10 else "flat",
        status_from_risk(data.ap_overdue_pct),
        [data.ap_overdue_pct],
        segments,
    )


def working_capital_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    value = data.ar_total - data.ap_total
    return make_card("working-capital", money_short(value), "AR less AP", "up", status_from_risk(20), [value])


def cash_collection_forecast_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    return make_card("cash-collection-forecast", money_short(data.cash_in * 1_000), "Next 4 weeks", "up", status_from_risk(10), [point.inflow for point in data.cash_forecast])


def supplier_payment_forecast_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    return make_card("supplier-payment-forecast", money_short(data.cash_out * 1_000), "Next 4 weeks", "flat", status_from_risk(25), [point.outflow for point in data.cash_forecast])


def revenue_forecast_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    forecast = data.revenue * 1.05
    return make_card("revenue-forecast", money_short(forecast), "+5.0% run-rate", "up", status_from_risk(10), [*data.revenue_trend, forecast / 1_000_000])


def expense_forecast_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    forecast = abs(data.opex) * 1.04
    return make_card("expense-forecast", money_short(forecast), "+4.0% run-rate", "down", status_from_risk(35), [*data.opex_trend, forecast / 1_000])


def budget_overrun_risk_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    count = data.material_accounts
    return make_card("budget-overrun-risk", f"{count} accounts", "High variance risk", "down" if count else "flat", status_from_risk(count * 20), [count])


def overdue_risk_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    evidence = {
        "analyst_logic": "Score overdue invoice risk from latest open AR, overdue share, and customer-level aging concentration.",
        "open_ar_total": data.ar_total,
        "overdue_pct": data.ar_overdue_pct,
        "open_item_count": data.open_ar_items,
        "customer_aging": normalize_rows(
            sorted(data.ar_drivers, key=lambda row: as_float(row.get("total_open_amount_base")), reverse=True)[:5]
        ),
    }
    count = data.overdue_invoice_risk
    return make_card("overdue-risk", f"{count} invoices", "Likely overdue", "down" if count else "flat", status_from_risk(data.ar_overdue_pct), [count], evidence=evidence)


def liquidity_gap_forecast_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    gap = data.liquidity_gap
    return make_card("liquidity-gap-forecast", money_short(gap), "4-week gap risk", "down" if gap else "flat", status_from_risk(70 if gap else 5), [data.cash_in, data.cash_out])


def credit_limit_breach_risk_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    customers = round(data.customer_concentration / 12)
    return make_card("credit-limit-breach-risk", f"{customers} customers", "At breach risk", "down" if data.customer_concentration > 40 else "flat", status_from_risk(data.customer_concentration - 30), [data.customer_concentration])


def expected_bad_debt_risk_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    value = data.ar_total * (data.ar_overdue_pct / 100) * 0.35
    return make_card("expected-bad-debt-risk", money_short(value), "Aging weighted", "down" if data.ar_overdue_pct > 10 else "flat", status_from_risk(data.ar_overdue_pct), [data.ar_overdue_pct])


def supplier_payment_priority_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    payments = round(data.ap_total / 10_000)
    return make_card("supplier-payment-priority", f"{payments} payments", "Protect this week", "flat", status_from_risk(data.ap_overdue_pct), [data.ap_overdue_pct])


def budget_exhaustion_date_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    days = max(1, 30 - round(data.variance_pct))
    return make_card("budget-exhaustion-date", f"{days} day" if days == 1 else f"{days} days", "Run-rate runway", "down" if data.variance_pct > 5 else "flat", status_from_risk(data.variance_pct * 4), [30 - data.variance_pct])


def month_end_close_variance_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    projected_variance = data.variance * 1.12
    return make_card("month-end-close-variance", money_short(projected_variance), "Projected close miss", "down" if data.variance_pct > 5 else "flat", status_from_risk(data.variance_pct * 4), [data.variance_pct, data.variance_pct * 1.12])


def margin_compression_warning_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    movement = data.gross_margin - data.prev_margin
    return make_card("margin-compression-warning", f"{signed(movement)} pts", "Projected next period", "down" if movement < 0 else "flat", status_from_risk(45 if movement < 0 else 5), [data.prev_margin, data.gross_margin])


def tax_exposure_forecast_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    estimate = (abs(data.opex) + data.revenue) * 0.21
    return make_card("tax-exposure-forecast", money_short(estimate), "Next filing estimate", "flat", status_from_risk(10), [data.revenue * 0.21 / 1_000])


def data_freshness_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    return make_card("data-freshness", f"{data.stale_count} stale feeds", f"{pct(data.coverage)} coverage", "down" if data.coverage < 95 else "flat", status_from_risk(100 - data.coverage), [data.coverage])


def connector_impact_forecast_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    return make_card("connector-impact-forecast", money_short(data.ap_total), "AP confidence at risk", "down" if data.stale_count else "flat", status_from_risk(100 - data.coverage), [data.coverage])


def abnormal_journal_amounts_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    count = len(data.abnormal_journal_lines)
    evidence = {
        "analyst_logic": "Detect abnormal journal lines using account-level z-scores on absolute signed amounts for the latest period.",
        "outlier_count": count,
        "z_score_threshold": 2,
        "outliers": normalize_rows(data.abnormal_journal_lines),
    }
    return make_card("abnormal-journal-amounts", f"{count} lines", "Z-score outliers", "down" if count else "flat", status_from_risk(count * 25), [count], evidence=evidence)


def duplicate_postings_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    count = data.duplicate_count
    evidence = {
        "analyst_logic": "Detect duplicate invoice patterns by matching source, counterparty, invoice date, and gross amount.",
        "duplicate_match_count": count,
        "matches": normalize_rows(data.duplicate_postings),
    }
    return make_card("duplicate-postings", f"{count} matches", "Invoice pattern matches", "down" if count else "flat", status_from_risk(count * 30), [count], evidence=evidence)


def unusual_posting_combos_insight(data: InsightInputs) -> FinanceInsightCardResponse:
    count = data.material_accounts
    return make_card("unusual-posting-combos", f"{count} combos", "Rare this period", "down" if count else "flat", status_from_risk(count * 20), [count])


INSIGHT_BUILDERS: tuple[Callable[[InsightInputs], FinanceInsightCardResponse], ...] = (
    revenue_trend_insight,
    gross_margin_insight,
    net_profit_margin_insight,
    ebitda_trend_insight,
    opex_run_rate_insight,
    trial_balance_movement_insight,
    budget_vs_actual_insight,
    customer_concentration_insight,
    supplier_concentration_insight,
    ar_aging_insight,
    ap_aging_insight,
    working_capital_insight,
    cash_collection_forecast_insight,
    supplier_payment_forecast_insight,
    revenue_forecast_insight,
    expense_forecast_insight,
    budget_overrun_risk_insight,
    overdue_risk_insight,
    liquidity_gap_forecast_insight,
    credit_limit_breach_risk_insight,
    expected_bad_debt_risk_insight,
    supplier_payment_priority_insight,
    budget_exhaustion_date_insight,
    month_end_close_variance_insight,
    margin_compression_warning_insight,
    tax_exposure_forecast_insight,
    data_freshness_insight,
    connector_impact_forecast_insight,
    abnormal_journal_amounts_insight,
    duplicate_postings_insight,
    unusual_posting_combos_insight,
)


def build_insight_cards(data: InsightInputs) -> list[FinanceInsightCardResponse]:
    return [builder(data) for builder in INSIGHT_BUILDERS]
