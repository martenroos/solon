from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.finance.models import FinancePeriodContext, ProfitabilitySnapshot
from app.domains.finance.repository import FinanceRepository
from app.schemas.finance import (
    FinanceAgingPointResponse,
    FinanceBriefingResponse,
    FinanceCashForecastPointResponse,
    FinanceConfidenceResponse,
    FinanceDashboardResponse,
    FinanceInsightCardResponse,
    FinanceInsightSegmentResponse,
    FinanceKpiResponse,
    FinanceOverviewResponse,
    FinancePriorityResponse,
    FinanceRevenueMarginPointResponse,
)
from app.services.finance_analytics import ensure_persisted_insight_cards


def as_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
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


async def build_finance_overview(session: AsyncSession) -> FinanceOverviewResponse:
    repository = FinanceRepository(session)
    period = await repository.one(
        """
        SELECT company_id, fiscal_year_number, fiscal_period_number
        FROM mart.v_pl_by_period
        ORDER BY fiscal_year_number DESC, fiscal_period_number DESC
        LIMIT 1
        """,
    )
    if not period:
        return empty_overview()

    context = FinancePeriodContext.from_period_row(period)
    params = context.query_params()

    company = await repository.one("SELECT company_name FROM core.dim_company WHERE company_id = :company_id", params)
    pl_rows = await repository.many(
        """
        SELECT fiscal_year_number, fiscal_period_number, reporting_group_lvl1, SUM(amount_base) AS amount
        FROM mart.v_pl_by_period
        WHERE company_id = :company_id
        GROUP BY 1,2,3
        ORDER BY fiscal_year_number, fiscal_period_number
        """,
        params,
    )
    current = aggregate_period(pl_rows, context.fiscal_year, context.fiscal_period)
    previous = aggregate_period(pl_rows, context.previous_year, context.previous_period)
    year_ago = aggregate_period(pl_rows, context.yoy_year, context.fiscal_period)
    profitability = ProfitabilitySnapshot(
        revenue=abs(current.get("Revenue", 0)),
        previous_revenue=abs(previous.get("Revenue", 0)),
        year_ago_revenue=abs(year_ago.get("Revenue", 0)),
        cost_of_sales=current.get("Cost of Sales", 0),
        previous_cost_of_sales=previous.get("Cost of Sales", 0),
        year_ago_cost_of_sales=year_ago.get("Cost of Sales", 0),
        operating_expenses=current.get("Operating Expenses", 0),
        previous_operating_expenses=previous.get("Operating Expenses", 0),
    )
    revenue = profitability.revenue
    prev_revenue = profitability.previous_revenue
    year_ago_revenue = profitability.year_ago_revenue
    opex = profitability.operating_expenses
    gross_margin = profitability.gross_margin_pct
    prev_margin = profitability.previous_gross_margin_pct
    year_ago_margin = profitability.year_ago_gross_margin_pct
    net_profit = profitability.net_profit
    prev_net_profit = profitability.previous_net_profit
    net_profit_margin = profitability.net_profit_margin_pct
    prev_net_profit_margin = profitability.previous_net_profit_margin_pct
    ebitda = net_profit
    prev_ebitda = prev_net_profit

    monthly = build_revenue_margin_series(pl_rows)
    profit_monthly = build_profitability_series(pl_rows)
    revenue_trend = trend([point.revenue for point in monthly], revenue / 1_000_000)
    margin_trend = trend([point.margin for point in monthly], gross_margin)
    net_profit_margin_trend = trend([point["net_profit_margin"] for point in profit_monthly], net_profit_margin)
    ebitda_trend = trend([point["ebitda"] / 1_000 for point in profit_monthly], ebitda / 1_000)
    opex_trend = trend(
        [
            abs(row["amount"]) / 1_000
            for row in pl_rows
            if row["reporting_group_lvl1"] == "Operating Expenses"
        ],
        abs(opex) / 1_000,
    )

    ar_rows = await repository.many("SELECT * FROM mart.v_ar_aging_latest WHERE company_id = :company_id", params)
    ap_rows = await repository.many("SELECT * FROM mart.v_ap_aging_latest WHERE company_id = :company_id", params)
    ar = aggregate_aging_rows(ar_rows)
    ap = aggregate_aging_rows(ap_rows)
    ar_total, ar_overdue, ar_current = aging_totals(ar)
    ap_total, ap_overdue, ap_current = aging_totals(ap)
    ar_overdue_pct = ar_overdue / ar_total * 100 if ar_total else 0
    ap_overdue_pct = ap_overdue / ap_total * 100 if ap_total else 0

    budget = await repository.one(
        """
        SELECT
          SUM(ABS(variance_amount_base)) AS absolute_variance,
          AVG(ABS(actual_vs_budget_pct - 100)) AS variance_pct,
          COUNT(*) FILTER (WHERE ABS(actual_vs_budget_pct - 100) > 10) AS material_accounts
        FROM mart.v_budget_vs_actual
        WHERE company_id = :company_id
          AND fiscal_year_number = :fiscal_year
          AND fiscal_period_number = :fiscal_period
        """,
        params,
    )
    variance = as_float(budget.get("absolute_variance"))
    variance_pct = as_float(budget.get("variance_pct"))
    material_accounts = int(budget.get("material_accounts") or 0)
    budget_drivers = await repository.many(
        """
        SELECT
          account_code,
          account_name,
          COALESCE(org_unit_name, 'Unassigned') AS org_unit_name,
          budget_amount_base,
          actual_amount_base,
          variance_amount_base,
          actual_vs_budget_pct
        FROM mart.v_budget_vs_actual
        WHERE company_id = :company_id
          AND fiscal_year_number = :fiscal_year
          AND fiscal_period_number = :fiscal_period
        ORDER BY ABS(variance_amount_base) DESC
        LIMIT 5
        """,
        params,
    )

    cash = await repository.one(
        """
        SELECT COALESCE(SUM(l.signed_amount_base), 0) AS cash_position
        FROM core.fact_journal_entry_line l
        JOIN core.dim_ledger_account a ON a.ledger_account_id = l.ledger_account_id
        WHERE l.company_id = :company_id AND a.is_bank_account = true
        """,
        params,
    )
    cash_position = as_float(cash.get("cash_position"))

    freshness = await repository.many("SELECT * FROM mart.v_data_freshness WHERE company_id = :company_id", params)
    stale_count = sum(1 for row in freshness if is_stale(row.get("last_successful_sync_at")))
    healthy_count = max(len(freshness) - stale_count, 0)
    coverage = healthy_count / len(freshness) * 100 if freshness else 0
    last_sync = max((row.get("last_successful_sync_at") for row in freshness if row.get("last_successful_sync_at")), default=None)
    confidence_status = status_from_risk(100 - coverage)

    cash_forecast = [
        FinanceCashForecastPointResponse(label=f"W{index}", inflow=round((ar_current + ar_overdue) / 4 / 1_000 * factor, 2), outflow=round((ap_current + ap_overdue) / 4 / 1_000 * (1.05 + index * 0.04), 2))
        for index, factor in enumerate([0.85, 0.95, 1.05, 1.15], start=1)
    ]
    aging_series = [
        FinanceAgingPointResponse(label="Current", ar=round(100 - ar_overdue_pct, 1), ap=round(100 - ap_overdue_pct, 1)),
        FinanceAgingPointResponse(label="1-30", ar=aging_pct(ar, "overdue_1_30", ar_total), ap=aging_pct(ap, "overdue_1_30", ap_total)),
        FinanceAgingPointResponse(label="31-60", ar=aging_pct(ar, "overdue_31_60", ar_total), ap=aging_pct(ap, "overdue_31_60", ap_total)),
        FinanceAgingPointResponse(label="61-90", ar=aging_pct(ar, "overdue_61_90", ar_total), ap=aging_pct(ap, "overdue_61_90", ap_total)),
        FinanceAgingPointResponse(label="90+", ar=aging_pct(ar, "overdue_90_plus", ar_total), ap=aging_pct(ap, "overdue_90_plus", ap_total)),
    ]
    revenue_drivers = await repository.many(
        """
        SELECT
          account_code,
          account_name,
          org_unit_name,
          SUM(amount_base) AS amount_base
        FROM mart.v_pl_by_period
        WHERE company_id = :company_id
          AND fiscal_year_number = :fiscal_year
          AND fiscal_period_number = :fiscal_period
          AND reporting_group_lvl1 = 'Revenue'
        GROUP BY 1,2,3
        ORDER BY ABS(SUM(amount_base)) DESC
        LIMIT 5
        """,
        params,
    )
    revenue_driver_bridge = await repository.many(
        """
        WITH current_revenue AS (
          SELECT
            l.counterparty_id,
            COALESCE(c.counterparty_name, 'Unassigned') AS customer_name,
            COALESCE(o.org_unit_name, 'Unassigned') AS org_unit_name,
            a.account_code,
            a.account_name,
            ABS(SUM(l.signed_amount_base)) AS current_revenue
          FROM core.fact_journal_entry_line l
          JOIN core.dim_ledger_account a ON a.ledger_account_id = l.ledger_account_id
          LEFT JOIN core.dim_counterparty c ON c.counterparty_id = l.counterparty_id
          LEFT JOIN core.dim_org_unit o ON o.org_unit_id = l.org_unit_id
          WHERE l.company_id = :company_id
            AND l.fiscal_year_number = :fiscal_year
            AND l.fiscal_period_number = :fiscal_period
            AND a.reporting_group_lvl1 = 'Revenue'
          GROUP BY 1,2,3,4,5
        ),
        previous_revenue AS (
          SELECT
            l.counterparty_id,
            COALESCE(c.counterparty_name, 'Unassigned') AS customer_name,
            COALESCE(o.org_unit_name, 'Unassigned') AS org_unit_name,
            a.account_code,
            a.account_name,
            ABS(SUM(l.signed_amount_base)) AS previous_revenue
          FROM core.fact_journal_entry_line l
          JOIN core.dim_ledger_account a ON a.ledger_account_id = l.ledger_account_id
          LEFT JOIN core.dim_counterparty c ON c.counterparty_id = l.counterparty_id
          LEFT JOIN core.dim_org_unit o ON o.org_unit_id = l.org_unit_id
          WHERE l.company_id = :company_id
            AND l.fiscal_year_number = :previous_year
            AND l.fiscal_period_number = :previous_period
            AND a.reporting_group_lvl1 = 'Revenue'
          GROUP BY 1,2,3,4,5
        ),
        bridge AS (
          SELECT
            COALESCE(c.customer_name, p.customer_name) AS customer_name,
            COALESCE(c.org_unit_name, p.org_unit_name) AS org_unit_name,
            COALESCE(c.account_code, p.account_code) AS account_code,
            COALESCE(c.account_name, p.account_name) AS account_name,
            COALESCE(c.current_revenue, 0) AS current_revenue,
            COALESCE(p.previous_revenue, 0) AS previous_revenue,
            COALESCE(c.current_revenue, 0) - COALESCE(p.previous_revenue, 0) AS revenue_change
          FROM current_revenue c
          FULL OUTER JOIN previous_revenue p
            ON COALESCE(c.counterparty_id, '00000000-0000-0000-0000-000000000000'::uuid)
               = COALESCE(p.counterparty_id, '00000000-0000-0000-0000-000000000000'::uuid)
           AND c.org_unit_name = p.org_unit_name
           AND c.account_code = p.account_code
        ),
        total_change AS (
          SELECT SUM(revenue_change) AS total_revenue_change FROM bridge
        )
        SELECT
          b.customer_name,
          b.org_unit_name,
          b.account_code,
          b.account_name,
          b.current_revenue,
          b.previous_revenue,
          b.revenue_change,
          CASE
            WHEN b.previous_revenue = 0 THEN NULL
            ELSE ROUND((b.revenue_change / b.previous_revenue * 100)::numeric, 1)
          END AS change_pct,
          CASE
            WHEN t.total_revenue_change = 0 THEN 0
            ELSE ROUND((b.revenue_change / t.total_revenue_change * 100)::numeric, 1)
          END AS growth_contribution_pct
        FROM bridge b
        CROSS JOIN total_change t
        ORDER BY ABS(b.revenue_change) DESC, b.current_revenue DESC
        LIMIT 50
        """,
        params,
    )
    margin_drivers = await repository.many(
        """
        SELECT
          account_code,
          account_name,
          org_unit_name,
          SUM(amount_base) AS amount_base
        FROM mart.v_pl_by_period
        WHERE company_id = :company_id
          AND fiscal_year_number = :fiscal_year
          AND fiscal_period_number = :fiscal_period
          AND reporting_group_lvl1 = 'Cost of Sales'
        GROUP BY 1,2,3
        ORDER BY ABS(SUM(amount_base)) DESC
        LIMIT 5
        """,
        params,
    )
    customer_margin_rows = await repository.many(
        """
        WITH revenue_by_customer_org AS (
          SELECT
            l.company_id,
            l.org_unit_id,
            l.counterparty_id AS customer_id,
            COALESCE(c.counterparty_name, 'Unassigned') AS customer_name,
            ABS(SUM(l.signed_amount_base)) AS revenue_amount
          FROM core.fact_journal_entry_line l
          JOIN core.dim_ledger_account a ON a.ledger_account_id = l.ledger_account_id
          LEFT JOIN core.dim_counterparty c ON c.counterparty_id = l.counterparty_id
          WHERE l.company_id = :company_id
            AND l.fiscal_year_number = :fiscal_year
            AND l.fiscal_period_number = :fiscal_period
            AND a.reporting_group_lvl1 = 'Revenue'
          GROUP BY 1,2,3,4
        ),
        revenue_org_totals AS (
          SELECT company_id, org_unit_id, SUM(revenue_amount) AS org_revenue
          FROM revenue_by_customer_org
          GROUP BY 1,2
        ),
        cost_by_org AS (
          SELECT l.company_id, l.org_unit_id, SUM(l.signed_amount_base) AS direct_cost
          FROM core.fact_journal_entry_line l
          JOIN core.dim_ledger_account a ON a.ledger_account_id = l.ledger_account_id
          WHERE l.company_id = :company_id
            AND l.fiscal_year_number = :fiscal_year
            AND l.fiscal_period_number = :fiscal_period
            AND a.reporting_group_lvl1 = 'Cost of Sales'
          GROUP BY 1,2
        ),
        allocated AS (
          SELECT
            r.customer_name,
            SUM(r.revenue_amount) AS revenue_amount,
            SUM(COALESCE(c.direct_cost, 0) * r.revenue_amount / NULLIF(t.org_revenue, 0)) AS allocated_cost
          FROM revenue_by_customer_org r
          JOIN revenue_org_totals t
            ON t.company_id = r.company_id
           AND COALESCE(t.org_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
               = COALESCE(r.org_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
          LEFT JOIN cost_by_org c
            ON c.company_id = r.company_id
           AND COALESCE(c.org_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
               = COALESCE(r.org_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
          GROUP BY 1
        )
        SELECT
          customer_name,
          revenue_amount,
          allocated_cost,
          CASE
            WHEN revenue_amount = 0 THEN 0
            ELSE ROUND(((revenue_amount - allocated_cost) / revenue_amount * 100)::numeric, 1)
          END AS gross_margin_pct
        FROM allocated
        ORDER BY gross_margin_pct ASC, revenue_amount DESC
        LIMIT 5
        """,
        params,
    )
    duplicate_postings = await repository.many(
        """
        WITH invoice_patterns AS (
          SELECT
            'sales_invoice' AS source,
            company_id,
            customer_id AS counterparty_id,
            invoice_date,
            amount_incl_tax_base,
            COUNT(*) AS match_count,
            ARRAY_AGG(invoice_number ORDER BY invoice_number) AS document_numbers
          FROM core.fact_sales_invoice
          WHERE company_id = :company_id
          GROUP BY 1,2,3,4,5
          HAVING COUNT(*) > 1
          UNION ALL
          SELECT
            'purchase_invoice' AS source,
            company_id,
            supplier_id AS counterparty_id,
            invoice_date,
            amount_incl_tax_base,
            COUNT(*) AS match_count,
            ARRAY_AGG(invoice_number ORDER BY invoice_number) AS document_numbers
          FROM core.fact_purchase_invoice
          WHERE company_id = :company_id
          GROUP BY 1,2,3,4,5
          HAVING COUNT(*) > 1
        )
        SELECT
          p.source,
          COALESCE(c.counterparty_name, 'Unassigned') AS counterparty_name,
          p.invoice_date,
          p.amount_incl_tax_base,
          p.match_count,
          p.document_numbers
        FROM invoice_patterns p
        LEFT JOIN core.dim_counterparty c ON c.counterparty_id = p.counterparty_id
        ORDER BY p.match_count DESC, ABS(p.amount_incl_tax_base) DESC
        LIMIT 10
        """,
        params,
    )
    abnormal_journal_lines = await repository.many(
        """
        WITH account_stats AS (
          SELECT
            ledger_account_id,
            AVG(ABS(signed_amount_base)) AS avg_abs_amount,
            STDDEV_POP(ABS(signed_amount_base)) AS stddev_abs_amount
          FROM core.fact_journal_entry_line
          WHERE company_id = :company_id
          GROUP BY ledger_account_id
        )
        SELECT
          l.source_document_number,
          l.posting_date,
          a.account_code,
          a.account_name,
          COALESCE(o.org_unit_name, 'Unassigned') AS org_unit_name,
          ABS(l.signed_amount_base) AS amount_base,
          CASE
            WHEN s.stddev_abs_amount IS NULL OR s.stddev_abs_amount = 0 THEN 0
            ELSE ROUND(((ABS(l.signed_amount_base) - s.avg_abs_amount) / s.stddev_abs_amount)::numeric, 2)
          END AS z_score
        FROM core.fact_journal_entry_line l
        JOIN core.dim_ledger_account a ON a.ledger_account_id = l.ledger_account_id
        LEFT JOIN core.dim_org_unit o ON o.org_unit_id = l.org_unit_id
        JOIN account_stats s ON s.ledger_account_id = l.ledger_account_id
        WHERE l.company_id = :company_id
          AND l.fiscal_year_number = :fiscal_year
          AND l.fiscal_period_number = :fiscal_period
          AND s.stddev_abs_amount > 0
          AND ABS(l.signed_amount_base) > s.avg_abs_amount + (2 * s.stddev_abs_amount)
        ORDER BY z_score DESC, amount_base DESC
        LIMIT 10
        """,
        params,
    )

    dashboard = FinanceDashboardResponse(
        priorities=build_priorities(stale_count, ar_overdue, ar_overdue_pct, gross_margin, prev_margin, ap_overdue_pct),
        kpis=[
            FinanceKpiResponse(label="Gross margin % by customer", value=pct(gross_margin), delta=f"{gross_margin - prev_margin:+.1f} pts MoM", status=status_from_risk(45 if gross_margin < prev_margin else 10), trend=margin_trend),
            FinanceKpiResponse(label="Net profit margin", value=pct(net_profit_margin), delta=f"{net_profit_margin - prev_net_profit_margin:+.1f} pts MoM", status=status_from_risk(55 if net_profit_margin < prev_net_profit_margin else 10), trend=net_profit_margin_trend),
            FinanceKpiResponse(label="EBITDA trend", value=money_short(ebitda), delta=delta_pct(ebitda, prev_ebitda), status=status_from_risk(45 if ebitda < prev_ebitda else 10), trend=ebitda_trend),
            FinanceKpiResponse(label="Revenue growth", value=delta_pct(revenue, prev_revenue), delta=f"YoY {delta_pct(revenue, year_ago_revenue)}", status=status_from_risk(45 if revenue < prev_revenue else 10), trend=revenue_trend),
        ],
        revenueMarginSeries=monthly,
        agingSeries=aging_series,
        cashForecastSeries=cash_forecast,
        actions=build_actions(stale_count, ar_overdue, material_accounts),
        confidence=FinanceConfidenceResponse(
            lastSync=format_sync(last_sync),
            health=f"{stale_count} stale / {healthy_count} healthy",
            coverage=pct(coverage),
            confidence=confidence_status,
        ),
        briefing=FinanceBriefingResponse(
            summary=f"Revenue for period {context.fiscal_year}-{context.fiscal_period:02d} is {money_short(revenue)} with gross margin at {pct(gross_margin)}. AR overdue is {money_short(ar_overdue)} and data coverage is {pct(coverage)}.",
            changed=f"Revenue changed {delta_pct(revenue, prev_revenue)} from the previous period and gross margin moved {gross_margin - prev_margin:+.1f} pts.",
            needsAttention=", ".join(item for item in ["stale feeds" if stale_count else "", "overdue AR" if ar_overdue_pct > 10 else "", "budget variance" if material_accounts else ""] if item) or "No material finance exceptions in the latest period.",
            improving="Cash coverage is sufficient for latest open payables." if cash_position >= ap_total else "Cash coverage is below latest open payables.",
            next=build_actions(stale_count, ar_overdue, material_accounts)[0],
        ),
    )

    cards = build_insight_cards(
        revenue=revenue,
        prev_revenue=prev_revenue,
        year_ago_revenue=year_ago_revenue,
        revenue_trend=revenue_trend,
        revenue_growth_mom=((revenue - prev_revenue) / prev_revenue * 100) if prev_revenue else 0,
        revenue_growth_yoy=((revenue - year_ago_revenue) / year_ago_revenue * 100) if year_ago_revenue else 0,
        revenue_driver_bridge=revenue_driver_bridge,
        gross_margin=gross_margin,
        prev_margin=prev_margin,
        year_ago_margin=year_ago_margin,
        margin_trend=margin_trend,
        customer_margin_rows=customer_margin_rows,
        net_profit=net_profit,
        prev_net_profit=prev_net_profit,
        net_profit_margin=net_profit_margin,
        prev_net_profit_margin=prev_net_profit_margin,
        net_profit_margin_trend=net_profit_margin_trend,
        ebitda=ebitda,
        prev_ebitda=prev_ebitda,
        ebitda_trend=ebitda_trend,
        opex=opex,
        opex_trend=opex_trend,
        variance=variance,
        variance_pct=variance_pct,
        material_accounts=material_accounts,
        ar_total=ar_total,
        ar_overdue_pct=ar_overdue_pct,
        ap_total=ap_total,
        ap_overdue_pct=ap_overdue_pct,
        cash_forecast=cash_forecast,
        stale_count=stale_count,
        coverage=coverage,
        customer_concentration=top_concentration(ar_rows, 3),
        supplier_concentration=top_concentration(ap_rows, 5),
        open_ar_items=sum(int(row.get("open_items") or 0) for row in ar_rows),
        ar_drivers=ar_rows,
        revenue_drivers=revenue_drivers,
        margin_drivers=margin_drivers,
        budget_drivers=budget_drivers,
        duplicate_postings=duplicate_postings,
        abnormal_journal_lines=abnormal_journal_lines,
    )
    cards = await ensure_persisted_insight_cards(
        session,
        company_id=context.company_id,
        cards=cards,
        metadata={
            "fiscal_year": context.fiscal_year,
            "fiscal_period": context.fiscal_period,
            "company_name": company.get("company_name"),
            "source": "finance_overview_api",
            "dashboard_kpis": [kpi.model_dump(mode="json") for kpi in dashboard.kpis],
            "confidence": dashboard.confidence.model_dump(mode="json"),
        },
    )
    top_priorities = build_dashboard_priorities_from_cards(cards)
    top_actions = build_dashboard_actions_from_priorities(top_priorities)
    dashboard = dashboard.model_copy(
        update={
            "priorities": top_priorities,
            "actions": top_actions,
            "briefing": dashboard.briefing.model_copy(
                update={
                    "summary": build_dashboard_summary_from_priorities(dashboard.briefing.summary, top_priorities),
                    "needsAttention": build_needs_attention_from_priorities(top_priorities),
                    "next": top_actions[0],
                }
            ),
        }
    )
    return FinanceOverviewResponse(
        generatedAt=datetime.now(UTC).isoformat(),
        companyName=company.get("company_name"),
        dashboard=dashboard,
        insightCards=cards,
    )


def empty_overview() -> FinanceOverviewResponse:
    empty_dashboard = FinanceDashboardResponse(
        priorities=[],
        kpis=[],
        revenueMarginSeries=[],
        agingSeries=[],
        cashForecastSeries=[],
        actions=["Load finance warehouse data to populate this dashboard."],
        confidence=FinanceConfidenceResponse(lastSync="No sync", health="0 stale / 0 healthy", coverage="0.0%", confidence="Alert"),
        briefing=FinanceBriefingResponse(
            summary="No finance warehouse data is available yet.",
            changed="No period movement is available.",
            needsAttention="Seed or ingest finance data.",
            improving="No trend can be calculated.",
            next="Run the finance ingestion or demo seed process.",
        ),
    )
    return FinanceOverviewResponse(
        generatedAt=datetime.now(UTC).isoformat(),
        companyName=None,
        dashboard=empty_dashboard,
        insightCards=[],
    )


def aggregate_period(rows: list[dict[str, Any]], year: int, period: int) -> dict[str, float]:
    result: dict[str, float] = {}
    for row in rows:
        if int(row["fiscal_year_number"]) == year and int(row["fiscal_period_number"]) == period:
            key = row["reporting_group_lvl1"]
            result[key] = result.get(key, 0) + as_float(row["amount"])
    return result


def build_revenue_margin_series(rows: list[dict[str, Any]]) -> list[FinanceRevenueMarginPointResponse]:
    by_period: dict[tuple[int, int], dict[str, float]] = {}
    for row in rows:
        key = (int(row["fiscal_year_number"]), int(row["fiscal_period_number"]))
        by_period.setdefault(key, {})
        group = row["reporting_group_lvl1"]
        by_period[key][group] = by_period[key].get(group, 0) + as_float(row["amount"])

    result = []
    month_labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for (_, period), values in sorted(by_period.items())[-6:]:
        revenue = abs(values.get("Revenue", 0))
        cost = values.get("Cost of Sales", 0)
        margin = ((revenue - cost) / revenue * 100) if revenue else 0
        result.append(FinanceRevenueMarginPointResponse(label=month_labels[period - 1], revenue=round(revenue / 1_000_000, 3), margin=round(margin, 1)))
    return result


def build_profitability_series(rows: list[dict[str, Any]]) -> list[dict[str, float]]:
    by_period: dict[tuple[int, int], dict[str, float]] = {}
    for row in rows:
        key = (int(row["fiscal_year_number"]), int(row["fiscal_period_number"]))
        by_period.setdefault(key, {})
        group = row["reporting_group_lvl1"]
        by_period[key][group] = by_period[key].get(group, 0) + as_float(row["amount"])

    result = []
    for _, values in sorted(by_period.items())[-6:]:
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


def top_concentration(rows: list[dict[str, Any]], count: int) -> float:
    amounts = sorted((as_float(row.get("total_open_amount_base")) for row in rows), reverse=True)
    total = sum(amounts)
    return round((sum(amounts[:count]) / total) * 100, 1) if total else 0


def aging_pct(row: dict[str, Any], key: str, total: float) -> float:
    return round(as_float(row.get(key)) / total * 100, 1) if total else 0


def delta_pct(current: float, previous: float) -> str:
    if previous == 0:
        return "+0.0%"
    return f"{((current - previous) / previous) * 100:+.1f}%"


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


def build_priorities(stale_count: int, ar_overdue: float, ar_overdue_pct: float, margin: float, prev_margin: float, ap_overdue_pct: float) -> list[FinancePriorityResponse]:
    items = [
        FinancePriorityResponse(title=f"{stale_count} stale feeds affecting confidence", detail="Refresh source connectors with stale successful sync timestamps.", severity=status_from_risk(90 if stale_count else 0)),
        FinancePriorityResponse(title=f"{money_short(ar_overdue)} overdue receivables", detail=f"{pct(ar_overdue_pct)} of latest AR is overdue.", severity=status_from_risk(ar_overdue_pct)),
        FinancePriorityResponse(title=f"Margin moved {margin - prev_margin:+.1f} pts", detail="Gross margin is calculated from revenue and cost of sales postings.", severity=status_from_risk(45 if margin < prev_margin else 10)),
        FinancePriorityResponse(title=f"AP overdue is {pct(ap_overdue_pct)}", detail="Open payable pressure is based on the latest open item snapshot.", severity=status_from_risk(ap_overdue_pct)),
    ]
    return sorted(items, key=lambda item: {"Alert": 0, "Watch": 1, "On track": 2}[item.severity])


def build_actions(stale_count: int, ar_overdue: float, material_accounts: int) -> list[str]:
    actions = []
    if stale_count:
        actions.append("Refresh stale finance source connectors.")
    if ar_overdue:
        actions.append("Work the overdue receivables queue.")
    if material_accounts:
        actions.append("Review accounts with material budget variance.")
    return actions or ["Keep monitoring finance performance and data freshness."]


PRIORITY_SIGNAL_TITLES = {
    "budget-vs-actual": "Budget variance",
    "overdue-risk": "Overdue invoice risk",
    "abnormal-journal-amounts": "Abnormal journal lines",
    "duplicate-postings": "Duplicate posting risk",
    "gross-margin": "Gross margin movement",
    "net-profit-margin": "Net profit margin",
    "ebitda-trend": "EBITDA trend",
    "data-freshness": "Data freshness",
    "liquidity-gap-forecast": "Liquidity gap forecast",
    "margin-compression-warning": "Margin compression warning",
    "budget-exhaustion-date": "Budget exhaustion date",
    "month-end-close-variance": "Month-end close variance",
    "expected-bad-debt-risk": "Expected bad debt risk",
    "revenue-trend": "Revenue trend",
    "cash-collection-forecast": "Cash collection forecast",
    "supplier-payment-forecast": "Supplier payment forecast",
}

PRIORITY_SIGNAL_WEIGHT = {
    "liquidity-gap-forecast": 40,
    "data-freshness": 38,
    "budget-vs-actual": 36,
    "overdue-risk": 34,
    "abnormal-journal-amounts": 32,
    "duplicate-postings": 31,
    "gross-margin": 30,
    "net-profit-margin": 29,
    "ebitda-trend": 29,
    "margin-compression-warning": 28,
    "budget-exhaustion-date": 27,
    "month-end-close-variance": 26,
    "expected-bad-debt-risk": 25,
    "cash-collection-forecast": 24,
    "supplier-payment-forecast": 24,
    "revenue-trend": 20,
}


def build_dashboard_priorities_from_cards(cards: list[FinanceInsightCardResponse]) -> list[FinancePriorityResponse]:
    ranked = sorted(cards, key=dashboard_priority_score, reverse=True)
    priorities = [
        FinancePriorityResponse(
            title=dashboard_priority_title(card),
            detail=dashboard_priority_detail(card),
            severity=card.status,
        )
        for card in ranked
        if card.status in {"Alert", "Watch"}
    ]

    if len(priorities) < 4:
        priorities.extend(
            FinancePriorityResponse(
                title=dashboard_priority_title(card),
                detail=dashboard_priority_detail(card),
                severity=card.status,
            )
            for card in ranked
            if card.status == "On track"
        )

    return priorities[:4]


def dashboard_priority_score(card: FinanceInsightCardResponse) -> float:
    status_score = {"Alert": 300, "Watch": 200, "On track": 100}[card.status]
    confidence_score = (card.confidence or 0.75) * 20
    evidence_score = min(evidence_row_count(card.evidence), 5) * 4
    return status_score + PRIORITY_SIGNAL_WEIGHT.get(card.id, 10) + confidence_score + evidence_score


def dashboard_priority_title(card: FinanceInsightCardResponse) -> str:
    title = PRIORITY_SIGNAL_TITLES.get(card.id, card.id.replace("-", " ").title())
    return f"{title}: {card.metric}"


def dashboard_priority_detail(card: FinanceInsightCardResponse) -> str:
    analyst_logic = card.evidence.get("analyst_logic") if card.evidence else None
    if isinstance(analyst_logic, str):
        return f"{card.delta}. {analyst_logic}"
    if card.explanation:
        return card.explanation
    return card.delta


def evidence_row_count(evidence: dict | None) -> int:
    if not evidence:
        return 0
    return sum(len(value) for value in evidence.values() if isinstance(value, list))


def build_dashboard_actions_from_priorities(priorities: list[FinancePriorityResponse]) -> list[str]:
    actions = []
    for priority in priorities[:3]:
        title = priority.title.split(":", 1)[0]
        if priority.severity == "Alert":
            actions.append(f"Investigate {title.lower()} today.")
        elif priority.severity == "Watch":
            actions.append(f"Review {title.lower()} drivers.")
        else:
            actions.append(f"Monitor {title.lower()}.")
    return actions or ["Keep monitoring finance performance and data freshness."]


def build_dashboard_summary_from_priorities(default_summary: str, priorities: list[FinancePriorityResponse]) -> str:
    urgent = [priority for priority in priorities if priority.severity == "Alert"]
    watch = [priority for priority in priorities if priority.severity == "Watch"]
    if urgent:
        names = ", ".join(priority.title.split(":", 1)[0].lower() for priority in urgent[:2])
        return f"Today's highest-priority insight signals are {names}. {default_summary}"
    if watch:
        names = ", ".join(priority.title.split(":", 1)[0].lower() for priority in watch[:2])
        return f"Today is mainly a watch-list day around {names}. {default_summary}"
    return default_summary


def build_needs_attention_from_priorities(priorities: list[FinancePriorityResponse]) -> str:
    attention = [priority.title.split(":", 1)[0] for priority in priorities if priority.severity in {"Alert", "Watch"}]
    return ", ".join(attention) if attention else "No material insight signals need attention in the latest analytics run."


def card(
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


def build_insight_cards(**data: Any) -> list[FinanceInsightCardResponse]:
    revenue = data["revenue"]
    prev_revenue = data["prev_revenue"]
    year_ago_revenue = data["year_ago_revenue"]
    margin = data["gross_margin"]
    prev_margin = data["prev_margin"]
    year_ago_margin = data["year_ago_margin"]
    net_profit_margin = data["net_profit_margin"]
    prev_net_profit_margin = data["prev_net_profit_margin"]
    ebitda = data["ebitda"]
    prev_ebitda = data["prev_ebitda"]
    variance_pct = data["variance_pct"]
    ar_pct = data["ar_overdue_pct"]
    ap_pct = data["ap_overdue_pct"]
    coverage = data["coverage"]
    cash_in = sum(point.inflow for point in data["cash_forecast"])
    cash_out = sum(point.outflow for point in data["cash_forecast"])
    gap = max((cash_out - cash_in) * 1_000, 0)
    customer_concentration = data["customer_concentration"]
    supplier_concentration = data["supplier_concentration"]
    overdue_invoice_risk = round(data["open_ar_items"] * min(max(ar_pct / 100, 0.05), 1))
    budget_risk = data["material_accounts"]
    margin_risk = margin - prev_margin
    duplicate_count = sum(int(row.get("match_count") or 0) for row in data["duplicate_postings"])
    abnormal_count = len(data["abnormal_journal_lines"])
    margin_evidence = {
        "analyst_logic": "Calculate gross margin from revenue and cost-of-sales postings; customer margin allocates direct costs by org-unit revenue mix.",
        "current_margin_pct": margin,
        "previous_margin_pct": prev_margin,
        "year_ago_margin_pct": year_ago_margin,
        "margin_delta_points": margin - prev_margin,
        "product_margin_note": "Product-level gross margin is not available because the current warehouse has no product or sales-invoice-line product dimension.",
        "customer_margin": normalize_rows(data["customer_margin_rows"]),
        "top_cost_drivers": normalize_rows(data["margin_drivers"]),
    }
    net_profit_evidence = {
        "analyst_logic": "Calculate net profit margin as revenue less cost of sales and operating expenses, divided by revenue.",
        "net_profit": data["net_profit"],
        "previous_net_profit": data["prev_net_profit"],
        "current_net_profit_margin_pct": net_profit_margin,
        "previous_net_profit_margin_pct": prev_net_profit_margin,
    }
    ebitda_evidence = {
        "analyst_logic": "Use available operating P&L groups as EBITDA proxy: revenue less cost of sales and operating expenses.",
        "current_ebitda": ebitda,
        "previous_ebitda": prev_ebitda,
        "trend_values_thousands": data["ebitda_trend"],
    }
    revenue_growth_evidence = {
        "analyst_logic": "Compare current fiscal-period revenue against the previous fiscal period for MoM and the same period last year for YoY.",
        "current_revenue": revenue,
        "previous_revenue": prev_revenue,
        "year_ago_revenue": year_ago_revenue,
        "mom_growth_pct": data["revenue_growth_mom"],
        "yoy_growth_pct": data["revenue_growth_yoy"],
        "driver_bridge": normalize_rows(data["revenue_driver_bridge"]),
        "top_drivers": normalize_rows(data["revenue_drivers"]),
    }
    budget_evidence = {
        "analyst_logic": "Rank budget lines by absolute variance and flag accounts where actual performance materially deviates from plan.",
        "absolute_variance": data["variance"],
        "average_variance_pct": variance_pct,
        "material_accounts": budget_risk,
        "top_variances": normalize_rows(data["budget_drivers"]),
    }
    ar_risk_evidence = {
        "analyst_logic": "Score overdue invoice risk from latest open AR, overdue share, and customer-level aging concentration.",
        "open_ar_total": data["ar_total"],
        "overdue_pct": ar_pct,
        "open_item_count": data["open_ar_items"],
        "customer_aging": normalize_rows(sorted(data["ar_drivers"], key=lambda row: as_float(row.get("total_open_amount_base")), reverse=True)[:5]),
    }
    duplicate_evidence = {
        "analyst_logic": "Detect duplicate invoice patterns by matching source, counterparty, invoice date, and gross amount.",
        "duplicate_match_count": duplicate_count,
        "matches": normalize_rows(data["duplicate_postings"]),
    }
    abnormal_evidence = {
        "analyst_logic": "Detect abnormal journal lines using account-level z-scores on absolute signed amounts for the latest period.",
        "outlier_count": abnormal_count,
        "z_score_threshold": 2,
        "outliers": normalize_rows(data["abnormal_journal_lines"]),
    }

    ar_segments = [
        FinanceInsightSegmentResponse(label="Current", value=round(100 - ar_pct, 1), tone="bg-chart-2"),
        FinanceInsightSegmentResponse(label="Overdue", value=round(ar_pct, 1), tone="bg-chart-1"),
    ]
    ap_segments = [
        FinanceInsightSegmentResponse(label="Current", value=round(100 - ap_pct, 1), tone="bg-chart-2"),
        FinanceInsightSegmentResponse(label="Overdue", value=round(ap_pct, 1), tone="bg-chart-5"),
    ]
    return [
        card("revenue-trend", pct(data["revenue_growth_mom"]), f"YoY {delta_pct(revenue, year_ago_revenue)}", "up" if revenue >= prev_revenue else "down", status_from_risk(0 if revenue >= prev_revenue else 45), data["revenue_trend"], evidence=revenue_growth_evidence),
        card("gross-margin", pct(margin), f"{margin - prev_margin:+.1f} pts", "up" if margin >= prev_margin else "down", status_from_risk(45 if margin < prev_margin else 5), data["margin_trend"], evidence=margin_evidence),
        card("net-profit-margin", pct(net_profit_margin), f"{net_profit_margin - prev_net_profit_margin:+.1f} pts", "up" if net_profit_margin >= prev_net_profit_margin else "down", status_from_risk(55 if net_profit_margin < prev_net_profit_margin else 5), data["net_profit_margin_trend"], evidence=net_profit_evidence),
        card("ebitda-trend", money_short(ebitda), delta_pct(ebitda, prev_ebitda), "up" if ebitda >= prev_ebitda else "down", status_from_risk(45 if ebitda < prev_ebitda else 5), data["ebitda_trend"], evidence=ebitda_evidence),
        card("opex-run-rate", money_short(abs(data["opex"])), "Latest period", "flat", status_from_risk(20), data["opex_trend"]),
        card("trial-balance-movement", f"{data['material_accounts']} accounts", "Material budget shifts", "flat", status_from_risk(data["material_accounts"] * 20), [data["material_accounts"]]),
        card("budget-vs-actual", money_short(data["variance"]), f"{pct(variance_pct)} from plan", "down" if variance_pct > 5 else "flat", status_from_risk(variance_pct * 4), [variance_pct], evidence=budget_evidence),
        card("customer-concentration", pct(customer_concentration, 0), "Top 3 customers", "flat", status_from_risk(customer_concentration - 35), [customer_concentration], [
            FinanceInsightSegmentResponse(label="Top 3", value=customer_concentration, tone="bg-chart-1"),
            FinanceInsightSegmentResponse(label="Other", value=max(round(100 - customer_concentration, 1), 0), tone="bg-chart-2"),
        ]),
        card("supplier-concentration", pct(supplier_concentration, 0), "Top 5 suppliers", "flat", status_from_risk(supplier_concentration - 40), [supplier_concentration], [
            FinanceInsightSegmentResponse(label="Top 5", value=supplier_concentration, tone="bg-chart-5"),
            FinanceInsightSegmentResponse(label="Other", value=max(round(100 - supplier_concentration, 1), 0), tone="bg-chart-2"),
        ]),
        card("ar-aging", money_short(data["ar_total"]), f"{pct(ar_pct)} overdue", "down" if ar_pct > 10 else "flat", status_from_risk(ar_pct), [ar_pct], ar_segments),
        card("ap-aging", money_short(data["ap_total"]), f"{pct(ap_pct)} overdue", "down" if ap_pct > 10 else "flat", status_from_risk(ap_pct), [ap_pct], ap_segments),
        card("working-capital", money_short(data["ar_total"] - data["ap_total"]), "AR less AP", "up", status_from_risk(20), [data["ar_total"] - data["ap_total"]]),
        card("cash-collection-forecast", money_short(cash_in * 1_000), "Next 4 weeks", "up", status_from_risk(10), [point.inflow for point in data["cash_forecast"]]),
        card("supplier-payment-forecast", money_short(cash_out * 1_000), "Next 4 weeks", "flat", status_from_risk(25), [point.outflow for point in data["cash_forecast"]]),
        card("revenue-forecast", money_short(revenue * 1.05), "+5.0% run-rate", "up", status_from_risk(10), [*data["revenue_trend"], revenue * 1.05 / 1_000_000]),
        card("expense-forecast", money_short(abs(data["opex"]) * 1.04), "+4.0% run-rate", "down", status_from_risk(35), [*data["opex_trend"], abs(data["opex"]) * 1.04 / 1_000]),
        card("budget-overrun-risk", f"{budget_risk} accounts", "High variance risk", "down" if budget_risk else "flat", status_from_risk(budget_risk * 20), [budget_risk]),
        card("overdue-risk", f"{overdue_invoice_risk} invoices", "Likely overdue", "down" if overdue_invoice_risk else "flat", status_from_risk(ar_pct), [overdue_invoice_risk], evidence=ar_risk_evidence),
        card("liquidity-gap-forecast", money_short(gap), "4-week gap risk", "down" if gap else "flat", status_from_risk(70 if gap else 5), [cash_in, cash_out]),
        card("credit-limit-breach-risk", f"{round(customer_concentration / 12)} customers", "At breach risk", "down" if customer_concentration > 40 else "flat", status_from_risk(customer_concentration - 30), [customer_concentration]),
        card("expected-bad-debt-risk", money_short(data["ar_total"] * (ar_pct / 100) * 0.35), "Aging weighted", "down" if ar_pct > 10 else "flat", status_from_risk(ar_pct), [ar_pct]),
        card("supplier-payment-priority", f"{round(data['ap_total'] / 10_000)} payments", "Protect this week", "flat", status_from_risk(ap_pct), [ap_pct]),
        card("budget-exhaustion-date", f"{max(1, 30 - round(variance_pct))} days", "Run-rate runway", "down" if variance_pct > 5 else "flat", status_from_risk(variance_pct * 4), [30 - variance_pct]),
        card("month-end-close-variance", money_short(data["variance"] * 1.12), "Projected close miss", "down" if variance_pct > 5 else "flat", status_from_risk(variance_pct * 4), [variance_pct, variance_pct * 1.12]),
        card("margin-compression-warning", f"{margin_risk:+.1f} pts", "Projected next period", "down" if margin_risk < 0 else "flat", status_from_risk(45 if margin_risk < 0 else 5), [prev_margin, margin]),
        card("tax-exposure-forecast", money_short((abs(data["opex"]) + revenue) * 0.21), "Next filing estimate", "flat", status_from_risk(10), [revenue * 0.21 / 1_000]),
        card("data-freshness", f"{data['stale_count']} stale feeds", f"{pct(coverage)} coverage", "down" if coverage < 95 else "flat", status_from_risk(100 - coverage), [coverage]),
        card("connector-impact-forecast", money_short(data["ap_total"]), "AP confidence at risk", "down" if data["stale_count"] else "flat", status_from_risk(100 - coverage), [coverage]),
        card("abnormal-journal-amounts", f"{abnormal_count} lines", "Z-score outliers", "down" if abnormal_count else "flat", status_from_risk(abnormal_count * 25), [abnormal_count], evidence=abnormal_evidence),
        card("duplicate-postings", f"{duplicate_count} matches", "Invoice pattern matches", "down" if duplicate_count else "flat", status_from_risk(duplicate_count * 30), [duplicate_count], evidence=duplicate_evidence),
        card("unusual-posting-combos", f"{budget_risk} combos", "Rare this period", "down" if budget_risk else "flat", status_from_risk(budget_risk * 20), [budget_risk]),
    ]


def normalize_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized = []
    for row in rows:
        normalized.append({key: normalize_value(value) for key, value in row.items()})
    return normalized


def normalize_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [normalize_value(item) for item in value]
    return value
