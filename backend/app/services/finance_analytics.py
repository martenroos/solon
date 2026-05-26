from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.finance import FinanceInsightCardResponse, FinanceInsightSegmentResponse


MODEL_VERSION = "finance-analytics-v1.0.0"
RUN_TYPE = "finance_overview"
MAX_RUN_AGE_MINUTES = 15

SIGNAL_METADATA: dict[str, tuple[str, str, str]] = {
    "revenue-trend": ("metric", "period_revenue_trend", "period-over-period revenue aggregation"),
    "gross-margin": ("metric", "gross_margin_monitor", "revenue less cost of sales margin calculation"),
    "net-profit-margin": ("metric", "net_profit_margin_monitor", "revenue less cost of sales and operating expenses margin calculation"),
    "ebitda-trend": ("metric", "ebitda_trend_monitor", "operating profitability trend calculation"),
    "opex-run-rate": ("metric", "opex_run_rate", "operating expense run-rate aggregation"),
    "trial-balance-movement": ("anomaly", "trial_balance_movement_detector", "material account movement thresholding"),
    "budget-vs-actual": ("anomaly", "budget_variance_detector", "budget variance thresholding"),
    "customer-concentration": ("anomaly", "customer_concentration_detector", "top counterparty concentration analysis"),
    "supplier-concentration": ("anomaly", "supplier_concentration_detector", "top counterparty concentration analysis"),
    "ar-aging": ("metric", "ar_aging_snapshot", "latest open receivables snapshot aggregation"),
    "ap-aging": ("metric", "ap_aging_snapshot", "latest open payables snapshot aggregation"),
    "working-capital": ("metric", "working_capital_monitor", "AR less AP working-capital calculation"),
    "cash-collection-forecast": ("prediction", "cash_collection_forecast", "open receivable weighted 4-week projection"),
    "supplier-payment-forecast": ("prediction", "supplier_payment_forecast", "open payable weighted 4-week projection"),
    "revenue-forecast": ("prediction", "revenue_run_rate_forecast", "recent revenue run-rate projection"),
    "expense-forecast": ("prediction", "expense_run_rate_forecast", "recent expense run-rate projection"),
    "budget-overrun-risk": ("prediction", "budget_overrun_risk", "budget variance risk scoring"),
    "overdue-risk": ("prediction", "overdue_invoice_risk", "aging-weighted open invoice risk scoring"),
    "liquidity-gap-forecast": ("prediction", "liquidity_gap_forecast", "projected cash-in versus cash-out gap"),
    "credit-limit-breach-risk": ("prediction", "credit_limit_breach_risk", "customer concentration exposure scoring"),
    "expected-bad-debt-risk": ("prediction", "expected_bad_debt_risk", "aging-weighted expected loss estimate"),
    "supplier-payment-priority": ("prediction", "supplier_payment_priority", "open payable urgency scoring"),
    "budget-exhaustion-date": ("prediction", "budget_exhaustion_date", "variance run-rate runway estimate"),
    "month-end-close-variance": ("prediction", "month_end_close_variance", "projected close variance estimate"),
    "margin-compression-warning": ("prediction", "margin_compression_warning", "gross-margin movement warning"),
    "tax-exposure-forecast": ("prediction", "tax_exposure_forecast", "transaction-volume tax exposure estimate"),
    "connector-impact-forecast": ("prediction", "connector_impact_forecast", "freshness coverage impact scoring"),
    "abnormal-journal-amounts": ("anomaly", "abnormal_amount_detector", "variance outlier proxy scoring"),
    "duplicate-postings": ("anomaly", "duplicate_posting_detector", "source freshness and duplicate-risk scoring"),
    "unusual-posting-combos": ("anomaly", "posting_combination_detector", "rare posting combination proxy scoring"),
    "data-freshness": ("anomaly", "data_freshness_detector", "source sync freshness thresholding"),
}


def analytics_fingerprint(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, default=to_json).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def to_json(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return str(value)


async def ensure_persisted_insight_cards(
    session: AsyncSession,
    *,
    company_id: Any,
    cards: list[FinanceInsightCardResponse],
    metadata: dict[str, Any],
) -> list[FinanceInsightCardResponse]:
    fingerprint = analytics_fingerprint(
        {
            "metadata": metadata,
            "cards": [card.model_dump(mode="json") for card in cards],
        }
    )
    latest = await latest_completed_run(session, company_id)
    now = datetime.now(UTC)

    if latest:
        completed_at = latest["completed_at"]
        is_fresh = isinstance(completed_at, datetime) and completed_at >= now - timedelta(minutes=MAX_RUN_AGE_MINUTES)
        if is_fresh and latest.get("input_fingerprint") == fingerprint:
            stored = await load_latest_insight_cards(session, company_id)
            if stored:
                return stored

    run_id = await create_run(session, company_id, fingerprint, metadata)
    try:
        for card in cards:
            await insert_signal(session, run_id, company_id, card)
        await complete_run(session, run_id)
        await session.commit()
    except Exception as exc:
        await fail_run(session, run_id, str(exc))
        await session.commit()
        raise

    return await load_latest_insight_cards(session, company_id)


async def latest_completed_run(session: AsyncSession, company_id: Any) -> dict[str, Any] | None:
    row = (
        await session.execute(
            text(
                """
                SELECT analytics_run_id, completed_at, input_fingerprint
                FROM mart.analytics_run
                WHERE company_id = :company_id
                  AND run_type = :run_type
                  AND status = 'completed'
                ORDER BY completed_at DESC
                LIMIT 1
                """
            ),
            {"company_id": company_id, "run_type": RUN_TYPE},
        )
    ).mappings().first()
    return dict(row) if row else None


async def create_run(session: AsyncSession, company_id: Any, fingerprint: str, metadata: dict[str, Any]) -> Any:
    return (
        await session.execute(
            text(
                """
                INSERT INTO mart.analytics_run (
                    company_id, run_type, status, model_version, input_fingerprint, metadata_json
                )
                VALUES (
                    :company_id, :run_type, 'running', :model_version, :fingerprint, CAST(:metadata AS jsonb)
                )
                RETURNING analytics_run_id
                """
            ),
            {
                "company_id": company_id,
                "run_type": RUN_TYPE,
                "model_version": MODEL_VERSION,
                "fingerprint": fingerprint,
                "metadata": json.dumps(metadata, default=to_json),
            },
        )
    ).scalar_one()


async def complete_run(session: AsyncSession, run_id: Any) -> None:
    await session.execute(
        text(
            """
            UPDATE mart.analytics_run
            SET status = 'completed', completed_at = now()
            WHERE analytics_run_id = :run_id
            """
        ),
        {"run_id": run_id},
    )


async def fail_run(session: AsyncSession, run_id: Any, error: str) -> None:
    await session.execute(
        text(
            """
            UPDATE mart.analytics_run
            SET status = 'failed', completed_at = now(), error_message = :error
            WHERE analytics_run_id = :run_id
            """
        ),
        {"run_id": run_id, "error": error[:4000]},
    )


async def insert_signal(session: AsyncSession, run_id: Any, company_id: Any, card: FinanceInsightCardResponse) -> None:
    signal_type, model_name, method = SIGNAL_METADATA.get(
        card.id,
        ("metric", f"{card.id}_model", "configured finance signal calculation"),
    )
    risk_score = risk_from_status(card.status)
    confidence = confidence_from_card(card)
    await session.execute(
        text(
            """
            INSERT INTO mart.insight_signal (
                analytics_run_id, company_id, signal_id, signal_type, model_name, model_version,
                method, status, risk_score, confidence_score, metric_label, metric_value,
                metric_text, delta_text, delta_direction, explanation, evidence_json,
                trend_json, segments_json
            )
            VALUES (
                :run_id, :company_id, :signal_id, :signal_type, :model_name, :model_version,
                :method, :status, :risk_score, :confidence_score, :metric_label, :metric_value,
                :metric_text, :delta_text, :delta_direction, :explanation, CAST(:evidence AS jsonb),
                CAST(:trend AS jsonb), CAST(:segments AS jsonb)
            )
            """
        ),
        {
            "run_id": run_id,
            "company_id": company_id,
            "signal_id": card.id,
            "signal_type": signal_type,
            "model_name": model_name,
            "model_version": MODEL_VERSION,
            "method": method,
            "status": card.status,
            "risk_score": risk_score,
            "confidence_score": confidence,
            "metric_label": card.id,
            "metric_value": numeric_metric(card.metric),
            "metric_text": card.metric,
            "delta_text": card.delta,
            "delta_direction": card.deltaDirection,
            "explanation": explanation_for(card, signal_type, method),
            "evidence": json.dumps(
                {
                    "metric": card.metric,
                    "delta": card.delta,
                    "status": card.status,
                    "risk_score": risk_score,
                    "confidence_score": confidence,
                    **(card.evidence or {}),
                },
                default=to_json,
            ),
            "trend": json.dumps(card.trend),
            "segments": json.dumps([segment.model_dump(mode="json") for segment in card.segments]) if card.segments else None,
        },
    )


async def load_latest_insight_cards(session: AsyncSession, company_id: Any) -> list[FinanceInsightCardResponse]:
    rows = (
        await session.execute(
            text(
                """
                SELECT
                    s.signal_id,
                    s.metric_text,
                    s.delta_text,
                    s.delta_direction,
                    s.status,
                    s.trend_json,
                    s.segments_json,
                    s.model_name,
                    s.model_version,
                    s.confidence_score,
                    s.explanation,
                    s.evidence_json,
                    r.analytics_run_id,
                    r.completed_at
                FROM mart.analytics_run r
                JOIN mart.insight_signal s
                  ON s.analytics_run_id = r.analytics_run_id
                WHERE r.company_id = :company_id
                  AND r.run_type = :run_type
                  AND r.status = 'completed'
                  AND r.completed_at = (
                    SELECT MAX(completed_at)
                    FROM mart.analytics_run
                    WHERE company_id = :company_id
                      AND run_type = :run_type
                      AND status = 'completed'
                  )
                ORDER BY s.created_at, s.signal_id
                """
            ),
            {"company_id": company_id, "run_type": RUN_TYPE},
        )
    ).mappings().all()

    return [card_from_signal(dict(row)) for row in rows]


def card_from_signal(row: dict[str, Any]) -> FinanceInsightCardResponse:
    segments = row.get("segments_json")
    return FinanceInsightCardResponse(
        id=row["signal_id"],
        metric=row["metric_text"],
        delta=row["delta_text"],
        deltaDirection=row["delta_direction"],
        status=row["status"],
        trend=[float(value) for value in (row.get("trend_json") or [])],
        segments=[
            FinanceInsightSegmentResponse(
                label=segment["label"],
                value=float(segment["value"]),
                tone=segment["tone"],
            )
            for segment in (segments or [])
        ]
        or None,
        runId=str(row["analytics_run_id"]),
        computedAt=row["completed_at"].isoformat() if isinstance(row.get("completed_at"), datetime) else None,
        modelName=row["model_name"],
        modelVersion=row["model_version"],
        confidence=float(row["confidence_score"]) if row.get("confidence_score") is not None else None,
        explanation=row["explanation"],
        evidence=row.get("evidence_json"),
    )


def risk_from_status(status: str) -> float:
    if status == "Alert":
        return 85.0
    if status == "Watch":
        return 50.0
    return 15.0


def confidence_from_card(card: FinanceInsightCardResponse) -> float:
    evidence_points = len(card.trend) + (len(card.segments or []) * 2)
    base = 0.72 + min(evidence_points, 12) * 0.015
    if card.status == "Alert":
        base -= 0.03
    return round(max(min(base, 0.94), 0.55), 4)


def numeric_metric(value: str) -> float | None:
    cleaned = (
        value.replace("EUR", "")
        .replace("%", "")
        .replace("pts", "")
        .replace("days", "")
        .replace("accounts", "")
        .replace("invoices", "")
        .replace("payments", "")
        .replace("feeds", "")
        .strip()
    )
    multiplier = 1.0
    if cleaned.endswith("M"):
        multiplier = 1_000_000
        cleaned = cleaned[:-1]
    elif cleaned.endswith("k"):
        multiplier = 1_000
        cleaned = cleaned[:-1]
    try:
        return float(cleaned.strip()) * multiplier
    except ValueError:
        return None


def explanation_for(card: FinanceInsightCardResponse, signal_type: str, method: str) -> str:
    prefix = {
        "metric": "Metric",
        "prediction": "Prediction",
        "anomaly": "Anomaly",
    }[signal_type]
    return f"{prefix} generated by {method}. Current value is {card.metric}; movement is {card.delta}; status is {card.status}."
