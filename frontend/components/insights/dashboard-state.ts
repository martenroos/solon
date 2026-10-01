import { ALL_CARD_IDS, INSIGHT_OPTIONS, REQUIRED_VISIBLE_IDS, TENANTS } from "@/components/insights/catalog";
import type { CardSize, InsightOption, InsightType, TenantState } from "@/components/insights/types";
import type { BackendFinanceInsightCard } from "@/lib/backend";

function getStorageKey(tenantId: string) {
  return `solon-insights-layout:${tenantId}`;
}

export function getDefaultTenantState(): TenantState {
  return { visibleIds: ALL_CARD_IDS, expandedIds: [], sizeById: {} };
}

export function getFocusedTenantState(): TenantState {
  return {
    visibleIds: [
      "revenue-trend",
      "budget-vs-actual",
      "working-capital",
      "cash-collection-forecast",
      "liquidity-gap-forecast",
      "budget-overrun-risk",
      "budget-exhaustion-date",
      "data-freshness",
      ...REQUIRED_VISIBLE_IDS,
    ],
    expandedIds: [],
    sizeById: {
      "revenue-trend": "lg",
      "liquidity-gap-forecast": "lg",
    },
  };
}

export function getInitialTenantState(): Record<string, TenantState> {
  if (typeof window === "undefined") {
    return Object.fromEntries(TENANTS.map((tenant) => [tenant.id, getDefaultTenantState()]));
  }

  return Object.fromEntries(
    TENANTS.map((tenant) => {
      const stored = window.localStorage.getItem(getStorageKey(tenant.id));
      if (!stored) return [tenant.id, getDefaultTenantState()];

      try {
        return [tenant.id, normalizeTenantState(JSON.parse(stored) as Partial<TenantState>)];
      } catch {
        return [tenant.id, getDefaultTenantState()];
      }
    }),
  );
}

function normalizeTenantState(value?: Partial<TenantState>): TenantState {
  const visibleIds = Array.isArray(value?.visibleIds)
    ? value.visibleIds.filter((id) => ALL_CARD_IDS.includes(id))
    : ALL_CARD_IDS;
  const visibleWithRequired = Array.from(new Set([...visibleIds, ...REQUIRED_VISIBLE_IDS]));
  const sizeById = Object.fromEntries(
    Object.entries(value?.sizeById ?? {}).flatMap(([id, size]) => {
      if (!ALL_CARD_IDS.includes(id)) return [];
      if (size === "sm" || size === "lg") return [[id, size]];
      if (size === "md") return [[id, "sm"]];
      return [];
    }),
  ) as Partial<Record<string, CardSize>>;

  return {
    visibleIds: visibleWithRequired.length ? visibleWithRequired : ALL_CARD_IDS,
    expandedIds: Array.isArray(value?.expandedIds)
      ? value.expandedIds.filter((id) => visibleWithRequired.includes(id))
      : [],
    sizeById,
  };
}

export function storeTenantStates(states: Record<string, TenantState>) {
  Object.entries(states).forEach(([tenantId, state]) => {
    window.localStorage.setItem(getStorageKey(tenantId), JSON.stringify(state));
  });
}

export function applyBackendCards(cards: BackendFinanceInsightCard[]): InsightOption[] {
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  return INSIGHT_OPTIONS.map((option) => {
    const card = cardsById.get(option.id);
    if (!card) return option;

    return {
      ...option,
      metric: card.metric,
      delta: card.delta,
      deltaDirection: card.deltaDirection,
      status: card.status,
      trend: card.trend,
      segments: card.segments ?? option.segments,
      runId: card.runId,
      computedAt: card.computedAt,
      modelName: card.modelName,
      modelVersion: card.modelVersion,
      confidence: card.confidence,
      explanation: card.explanation,
      evidence: card.evidence,
    };
  });
}

export function configureVisibleCards(options: InsightOption[], state: TenantState): InsightOption[] {
  const byId = new Map(options.map((item) => [item.id, item]));
  return state.visibleIds
    .map((id) => byId.get(id))
    .filter((item): item is InsightOption => Boolean(item))
    .map((item) => ({ ...item, size: state.sizeById[item.id] ?? item.size }));
}

export function countByType(cards: InsightOption[]): Record<InsightType, number> {
  return cards.reduce(
    (counts, item) => ({ ...counts, [item.category]: counts[item.category] + 1 }),
    { insight: 0, prediction: 0, anomaly: 0 },
  );
}

export function toggleFilter<T>(current: T[], value: T): T[] {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

export function toggleCardVisibility(current: TenantState, id: string): TenantState {
  if (current.visibleIds.includes(id) && current.visibleIds.length === 1) return current;

  const visibleIds = current.visibleIds.includes(id)
    ? current.visibleIds.filter((value) => value !== id)
    : [...current.visibleIds, id];

  return {
    ...current,
    visibleIds,
    expandedIds: current.expandedIds.filter((value) => visibleIds.includes(value)),
  };
}

export function reorderCards(current: TenantState, sourceId: string, targetId: string): TenantState {
  const sourceIndex = current.visibleIds.indexOf(sourceId);
  const targetIndex = current.visibleIds.indexOf(targetId);
  if (sourceId === targetId || sourceIndex < 0 || targetIndex < 0) return current;

  const visibleIds = [...current.visibleIds];
  const [movedCard] = visibleIds.splice(sourceIndex, 1);
  visibleIds.splice(targetIndex, 0, movedCard);

  return { ...current, visibleIds };
}
