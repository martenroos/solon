"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { CardSelector } from "@/components/insights/card-selector";
import { TENANTS } from "@/components/insights/catalog";
import { DashboardToolbar } from "@/components/insights/dashboard-toolbar";
import {
  applyBackendCards,
  configureVisibleCards,
  countByType,
  getDefaultTenantState,
  getFocusedTenantState,
  getInitialTenantState,
  reorderCards,
  storeTenantStates,
  toggleCardVisibility,
  toggleFilter,
} from "@/components/insights/dashboard-state";
import { InsightCard } from "@/components/insights/insight-card";
import { InsightDetailModal } from "@/components/insights/insight-detail-modal";
import type { InsightOption, InsightType, TenantState } from "@/components/insights/types";
import { Card, CardContent } from "@/components/ui/card";
import type { BackendFinanceInsightCard } from "@/lib/backend";
import { cn } from "@/lib/utils";

export type { CardSize, InsightOption, InsightType } from "@/components/insights/types";

type StatusFilter = InsightOption["status"];

export function InsightsDashboard({ cards = [] }: { cards?: BackendFinanceInsightCard[] }) {
  const [selectedTenantId, setSelectedTenantId] = useState(TENANTS[0].id);
  const [tenantState, setTenantState] = useState<Record<string, TenantState>>(getInitialTenantState);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [typeFilters, setTypeFilters] = useState<InsightType[]>([]);
  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>([]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dropTargetCardId, setDropTargetCardId] = useState<string | null>(null);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);

  useEffect(() => {
    storeTenantStates(tenantState);
  }, [tenantState]);

  useEffect(() => {
    if (!selectedInsightId) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedInsightId(null);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedInsightId]);

  const activeState = tenantState[selectedTenantId] ?? getDefaultTenantState();
  const options = useMemo(() => applyBackendCards(cards), [cards]);
  const configuredCards = useMemo(
    () => configureVisibleCards(options, activeState),
    [activeState, options],
  );
  const visibleCards = configuredCards.filter(
    (item) =>
      (!typeFilters.length || typeFilters.includes(item.category)) &&
      (!statusFilters.length || statusFilters.includes(item.status)),
  );
  const selectedInsight = configuredCards.find((item) => item.id === selectedInsightId) ?? null;
  const counts = countByType(configuredCards);
  const selectedTenant = TENANTS.find((tenant) => tenant.id === selectedTenantId) ?? TENANTS[0];

  function updateState(updater: (current: TenantState) => TenantState) {
    startTransition(() => {
      setTenantState((current) => ({
        ...current,
        [selectedTenantId]: updater(current[selectedTenantId] ?? getDefaultTenantState()),
      }));
    });
  }

  function toggleVisibility(id: string) {
    updateState((current) => toggleCardVisibility(current, id));
  }

  function moveCard(sourceId: string, targetId: string) {
    updateState((current) => reorderCards(current, sourceId, targetId));
  }

  return (
    <div className="space-y-6">
      <section
        className={cn(
          "grid gap-6",
          isSelectorOpen ? "xl:grid-cols-[0.9fr_2.1fr]" : "grid-cols-1",
        )}
      >
        {isSelectorOpen ? (
          <CardSelector
            tenantName={selectedTenant.name}
            activeCount={visibleCards.length}
            options={options}
            visibleIds={activeState.visibleIds}
            onClose={() => setIsSelectorOpen(false)}
            onToggle={toggleVisibility}
          />
        ) : null}

        <div className="space-y-4">
          <DashboardToolbar
            selectedTenantId={selectedTenantId}
            selectedTenantName={selectedTenant.name}
            activeCount={visibleCards.length}
            totalCount={options.length}
            counts={counts}
            selectorOpen={isSelectorOpen}
            typeFilters={typeFilters}
            statusFilters={statusFilters}
            onTenantChange={setSelectedTenantId}
            onOpenSelector={() => setIsSelectorOpen(true)}
            onTypeToggle={(value) => setTypeFilters((current) => toggleFilter(current, value))}
            onStatusToggle={(value) => setStatusFilters((current) => toggleFilter(current, value))}
            onClear={() => {
              setTypeFilters([]);
              setStatusFilters([]);
            }}
            onFocus={() => updateState(() => getFocusedTenantState())}
            onShowAll={() => updateState(() => getDefaultTenantState())}
          />

          {!visibleCards.length ? <EmptyFilterState /> : null}

          <div className="grid auto-rows-[minmax(210px,_auto)] grid-flow-row-dense gap-4 md:grid-cols-2 xl:grid-cols-4">
            {visibleCards.map((item) => (
              <InsightCard
                key={item.id}
                item={item}
                dragging={draggingCardId === item.id}
                dropTarget={dropTargetCardId === item.id}
                onOpen={() => setSelectedInsightId(item.id)}
                onHide={() => toggleVisibility(item.id)}
                onSize={(size) => {
                  updateState((current) => ({
                    ...current,
                    sizeById: { ...current.sizeById, [item.id]: size },
                  }));
                }}
                onDragStart={() => setDraggingCardId(item.id)}
                onDragEnd={() => {
                  setDraggingCardId(null);
                  setDropTargetCardId(null);
                }}
                onDragOver={() => {
                  if (draggingCardId && draggingCardId !== item.id) {
                    setDropTargetCardId(item.id);
                  }
                }}
                onDrop={(sourceId) => {
                  if (sourceId) moveCard(sourceId, item.id);
                  setDraggingCardId(null);
                  setDropTargetCardId(null);
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {selectedInsight ? (
        <InsightDetailModal item={selectedInsight} onClose={() => setSelectedInsightId(null)} />
      ) : null}
    </div>
  );
}

function EmptyFilterState() {
  return (
    <Card>
      <CardContent className="p-8">
        <p className="text-lg font-semibold">No cards match the current filters.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Clear the filters or change the selected card set to show more modules.
        </p>
      </CardContent>
    </Card>
  );
}
