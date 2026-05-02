from typing import Literal

from pydantic import BaseModel

from app.schemas.chat import ChatChart


class FinanceKpiResponse(BaseModel):
    label: str
    value: str
    delta: str
    status: str
    trend: list[float]


class FinancePriorityResponse(BaseModel):
    title: str
    detail: str
    severity: str


class FinanceRevenueMarginPointResponse(BaseModel):
    label: str
    revenue: float
    margin: float


class FinanceAgingPointResponse(BaseModel):
    label: str
    ar: float
    ap: float


class FinanceCashForecastPointResponse(BaseModel):
    label: str
    inflow: float
    outflow: float


class FinanceConfidenceResponse(BaseModel):
    lastSync: str
    health: str
    coverage: str
    confidence: str


class FinanceBriefingResponse(BaseModel):
    summary: str
    changed: str
    needsAttention: str
    improving: str
    next: str


class FinanceDashboardResponse(BaseModel):
    priorities: list[FinancePriorityResponse]
    kpis: list[FinanceKpiResponse]
    revenueMarginSeries: list[FinanceRevenueMarginPointResponse]
    agingSeries: list[FinanceAgingPointResponse]
    cashForecastSeries: list[FinanceCashForecastPointResponse]
    actions: list[str]
    confidence: FinanceConfidenceResponse
    briefing: FinanceBriefingResponse


class FinanceInsightSegmentResponse(BaseModel):
    label: str
    value: float
    tone: str


class FinanceInsightCardResponse(BaseModel):
    id: str
    metric: str
    delta: str
    deltaDirection: str
    status: str
    trend: list[float]
    segments: list[FinanceInsightSegmentResponse] | None = None
    runId: str | None = None
    computedAt: str | None = None
    modelName: str | None = None
    modelVersion: str | None = None
    confidence: float | None = None
    explanation: str | None = None
    evidence: dict | None = None


class FinanceOverviewResponse(BaseModel):
    generatedAt: str
    companyName: str | None = None
    dashboard: FinanceDashboardResponse
    insightCards: list[FinanceInsightCardResponse]


SavedChartSurface = Literal["dashboard"]


class SavedChartCreateRequest(BaseModel):
    surface: SavedChartSurface
    chart: ChatChart
    source_query_sql: str | None = None


class SavedChartResponse(BaseModel):
    id: int
    surface: SavedChartSurface
    chart: ChatChart
    source_query_sql: str
    row_count: int
    refreshed_at: str
    error: str | None = None


class SavedChartListResponse(BaseModel):
    charts: list[SavedChartResponse]
