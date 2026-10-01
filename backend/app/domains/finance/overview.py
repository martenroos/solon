from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.finance.calculations import (
    aggregate_aging_rows,
    aggregate_period,
    aging_pct,
    aging_totals,
    build_profitability_series,
    build_revenue_margin_series,
    top_concentration,
)
from app.domains.finance.dashboard import (
    build_dashboard_actions_from_priorities,
    build_dashboard_priorities_from_cards,
    build_dashboard_summary_from_priorities,
    build_needs_attention_from_priorities,
)
from app.domains.finance.formatting import as_float, delta_pct, format_sync, is_stale, money_short, pct, status_from_risk, trend
from app.domains.finance.insights import InsightInputs, build_insight_cards
from app.domains.finance.models import FinancePeriodContext, ProfitabilitySnapshot
from app.domains.finance.repository import FinanceRepository
from app.schemas.finance import (
    FinanceAgingPointResponse,
    FinanceBriefingResponse,
    FinanceCashForecastPointResponse,
    FinanceConfidenceResponse,
    FinanceDashboardResponse,
    FinanceKpiResponse,
    FinanceOverviewResponse,
)
from app.services.finance_analytics import ensure_persisted_insight_cards


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

    default_summary = f"Revenue for period {context.fiscal_year}-{context.fiscal_period:02d} is {money_short(revenue)} with gross margin at {pct(gross_margin)}. AR overdue is {money_short(ar_overdue)} and data coverage is {pct(coverage)}."
    # priorities/actions/needsAttention/next are placeholders here; they are
    # replaced below with card-derived values once insight cards are built.
    dashboard = FinanceDashboardResponse(
        priorities=[],
        kpis=[
            FinanceKpiResponse(label="Gross margin % by customer", value=pct(gross_margin), delta=f"{gross_margin - prev_margin:+.1f} pts MoM", status=status_from_risk(45 if gross_margin < prev_margin else 10), trend=margin_trend),
            FinanceKpiResponse(label="Net profit margin", value=pct(net_profit_margin), delta=f"{net_profit_margin - prev_net_profit_margin:+.1f} pts MoM", status=status_from_risk(55 if net_profit_margin < prev_net_profit_margin else 10), trend=net_profit_margin_trend),
            FinanceKpiResponse(label="EBITDA trend", value=money_short(ebitda), delta=delta_pct(ebitda, prev_ebitda), status=status_from_risk(45 if ebitda < prev_ebitda else 10), trend=ebitda_trend),
            FinanceKpiResponse(label="Revenue growth", value=delta_pct(revenue, prev_revenue), delta=f"YoY {delta_pct(revenue, year_ago_revenue)}", status=status_from_risk(45 if revenue < prev_revenue else 10), trend=revenue_trend),
        ],
        revenueMarginSeries=monthly,
        agingSeries=aging_series,
        cashForecastSeries=cash_forecast,
        actions=[],
        confidence=FinanceConfidenceResponse(
            lastSync=format_sync(last_sync),
            health=f"{stale_count} stale / {healthy_count} healthy",
            coverage=pct(coverage),
            confidence=confidence_status,
        ),
        briefing=FinanceBriefingResponse(
            summary=default_summary,
            changed=f"Revenue changed {delta_pct(revenue, prev_revenue)} from the previous period and gross margin moved {gross_margin - prev_margin:+.1f} pts.",
            needsAttention="",
            improving="Cash coverage is sufficient for latest open payables." if cash_position >= ap_total else "Cash coverage is below latest open payables.",
            next="",
        ),
    )

    cards = build_insight_cards(InsightInputs(
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
    ))
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
                    "summary": build_dashboard_summary_from_priorities(default_summary, top_priorities),
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
