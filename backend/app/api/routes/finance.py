from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_internal_api_key, require_verified_user
from app.domains.finance.overview import build_finance_overview
from app.llm.tools import _validate_read_only_sql, run_finance_query
from app.models.chat import SavedChartWidget
from app.models.user import User
from app.schemas.chat import ChatChart
from app.schemas.finance import (
    FinanceOverviewResponse,
    SavedChartCreateRequest,
    SavedChartListResponse,
    SavedChartResponse,
    SavedChartSurface,
)

router = APIRouter(dependencies=[Depends(require_internal_api_key)])

CHART_REFRESH_LIMIT = 200


async def run_saved_chart_query(session: AsyncSession, source_query_sql: str) -> list[dict[str, Any]]:
    query_result = await run_finance_query(source_query_sql, CHART_REFRESH_LIMIT)
    return list(query_result["rows"])


async def saved_chart_response(session: AsyncSession, widget: SavedChartWidget) -> SavedChartResponse:
    refreshed_at = datetime.now(UTC).isoformat()
    chart_config = dict(widget.chart_config)
    try:
        rows = await run_saved_chart_query(session, widget.source_query_sql)
        chart_config["data"] = rows
        chart_config["source_query_sql"] = widget.source_query_sql
        chart = ChatChart.model_validate(chart_config)
        return SavedChartResponse(
            id=widget.id,
            surface=widget.surface,
            chart=chart,
            source_query_sql=widget.source_query_sql,
            row_count=len(rows),
            refreshed_at=refreshed_at,
        )
    except Exception as exc:  # noqa: BLE001
        chart_config["source_query_sql"] = widget.source_query_sql
        chart = ChatChart.model_validate(chart_config)
        return SavedChartResponse(
            id=widget.id,
            surface=widget.surface,
            chart=chart,
            source_query_sql=widget.source_query_sql,
            row_count=len(chart.data),
            refreshed_at=refreshed_at,
            error=str(exc) or "Unable to refresh saved chart.",
        )


@router.get("/saved-charts", response_model=SavedChartListResponse)
async def list_saved_charts(
    surface: SavedChartSurface = Query(...),
    user: User = Depends(require_verified_user),
    session: AsyncSession = Depends(get_session),
) -> SavedChartListResponse:
    result = await session.execute(
        select(SavedChartWidget)
        .where(SavedChartWidget.user_id == user.id, SavedChartWidget.surface == surface)
        .order_by(SavedChartWidget.created_at.desc(), SavedChartWidget.id.desc())
    )
    widgets = list(result.scalars().all())
    return SavedChartListResponse(charts=[await saved_chart_response(session, widget) for widget in widgets])


@router.post("/saved-charts", response_model=SavedChartResponse, status_code=status.HTTP_201_CREATED)
async def create_saved_chart(
    payload: SavedChartCreateRequest,
    user: User = Depends(require_verified_user),
    session: AsyncSession = Depends(get_session),
) -> SavedChartResponse:
    source_query_sql = payload.source_query_sql or payload.chart.source_query_sql
    if not source_query_sql:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A source_query_sql value is required to save a live chart.",
        )
    source_query_sql = _validate_read_only_sql(source_query_sql)
    chart = payload.chart.model_copy(update={"source_query_sql": source_query_sql})
    chart_config = chart.model_dump(mode="json")

    existing = (
        await session.execute(
            select(SavedChartWidget).where(
                SavedChartWidget.user_id == user.id,
                SavedChartWidget.chart_id == chart.id,
                SavedChartWidget.surface == payload.surface,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        widget = SavedChartWidget(
            user_id=user.id,
            surface=payload.surface,
            chart_id=chart.id,
            title=chart.title,
            description=chart.description,
            chart_type=chart.type,
            source_query_sql=source_query_sql,
            chart_config=chart_config,
        )
        session.add(widget)
    else:
        widget = existing
        widget.title = chart.title
        widget.description = chart.description
        widget.chart_type = chart.type
        widget.source_query_sql = source_query_sql
        widget.chart_config = chart_config

    await session.flush()
    response = await saved_chart_response(session, widget)
    await session.commit()
    return response


@router.get("/overview", response_model=FinanceOverviewResponse)
async def get_finance_overview(
    _: User = Depends(require_verified_user),
    session: AsyncSession = Depends(get_session),
) -> FinanceOverviewResponse:
    return await build_finance_overview(session)
