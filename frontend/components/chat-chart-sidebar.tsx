"use client";

import { LayoutDashboard } from "lucide-react";

import { formatSqlPreview, formatValue } from "@/components/charts/chart-format";
import { renderChart, renderChartValues } from "@/components/charts/chat-chart-render";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendChatChart, BackendChatQueryResult, BackendSavedChartSurface } from "@/lib/backend";

type ChatChartSidebarProps = {
  charts: BackendChatChart[];
  onAddToSurface?: (chart: BackendChatChart, surface: BackendSavedChartSurface) => void;
  getSourceQuerySql?: (chart: BackendChatChart) => string | null;
  pendingChartAction?: string | null;
  addedChartAction?: string | null;
};

type ChatQueryResultListProps = {
  queryResults: BackendChatQueryResult[];
};

export function ChatChartList({
  charts,
  onAddToSurface,
  getSourceQuerySql,
  pendingChartAction,
  addedChartAction,
}: ChatChartSidebarProps) {
  const orderedCharts = [...charts].reverse();

  return (
    <div className="space-y-4">
      {orderedCharts.map((chart) => (
        <div
          key={chart.id}
          className="rounded-2xl border border-border/70 bg-background/75 p-3"
        >
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">{chart.title}</h3>
            {chart.description ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{chart.description}</p>
            ) : null}
          </div>
          {renderChart(chart)}
          {renderChartValues(chart)}
          {onAddToSurface ? (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["dashboard"] as const).map((surface) => {
                  const actionKey = `${chart.id}:${surface}`;
                  const sourceQuerySql = getSourceQuerySql?.(chart) ?? chart.source_query_sql ?? null;
                  const disabled = !sourceQuerySql || pendingChartAction === actionKey;
                  return (
                    <Button
                      key={surface}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      disabled={disabled}
                      title={sourceQuerySql ? undefined : "This chart does not include a source SQL query."}
                      onClick={() => onAddToSurface({ ...chart, source_query_sql: sourceQuerySql }, surface)}
                    >
                      <LayoutDashboard className="size-4" />
                      {addedChartAction === actionKey ? "Added" : `Add to ${surface}`}
                    </Button>
                  );
                })}
              </div>
              {!(getSourceQuerySql?.(chart) ?? chart.source_query_sql) ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  This chart needs a source query before it can be saved as live data.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ))}
      {orderedCharts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/55 px-4 py-6 text-sm text-muted-foreground">
          Ask for a chart and the agent can add one to this sidebar.
        </div>
      ) : null}
    </div>
  );
}

export function ChatQueryResultList({ queryResults }: ChatQueryResultListProps) {
  const orderedResults = [...queryResults].reverse();

  return (
    <div className="space-y-4">
      {orderedResults.map((result) => {
        const visibleColumns = result.columns.slice(0, 6);
        const visibleRows = result.rows.slice(0, 8);

        return (
          <div
            key={result.id}
            className="rounded-2xl border border-border/70 bg-background/75 p-3"
          >
            <div className="mb-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">Query result</h3>
                <span className="shrink-0 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                  {result.row_count} rows
                </span>
              </div>
              <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
                {formatSqlPreview(result.sql)}
              </p>
            </div>

            {visibleColumns.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/70">
                <table className="min-w-full border-separate border-spacing-0 text-left text-[11px]">
                  <thead>
                    <tr>
                      {visibleColumns.map((column) => (
                        <th
                          key={column}
                          className="border-b border-border/70 bg-muted/40 px-2 py-2 font-medium text-foreground"
                        >
                          <span className="block max-w-32 truncate">{column}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, rowIndex) => (
                      <tr key={`${result.id}-row-${rowIndex}`}>
                        {visibleColumns.map((column) => (
                          <td
                            key={column}
                            className="border-b border-border/50 px-2 py-2 text-muted-foreground last:border-b-0"
                          >
                            <span className="block max-w-36 truncate">{formatValue(row[column])}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-background/55 px-3 py-4 text-sm text-muted-foreground">
                The query returned no rows.
              </div>
            )}

            {result.rows.length > visibleRows.length || result.columns.length > visibleColumns.length || result.truncated ? (
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                Showing {visibleRows.length} of {result.row_count} returned rows
                {result.truncated ? `, capped at ${result.max_rows}` : ""}
                {result.columns.length > visibleColumns.length ? ` and ${visibleColumns.length} of ${result.columns.length} columns` : ""}.
              </p>
            ) : null}
          </div>
        );
      })}
      {orderedResults.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/55 px-4 py-6 text-sm text-muted-foreground">
          Query results from the finance database will appear here.
        </div>
      ) : null}
    </div>
  );
}

export function ChatChartSidebar({ charts }: ChatChartSidebarProps) {
  return (
    <aside className="w-full shrink-0 xl:w-[22rem]">
      <Card className="flex h-full min-h-0 flex-col overflow-hidden">
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle className="text-base">Charts</CardTitle>
          <CardDescription>
            Visuals created during the conversation appear here.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-4">
          <ChatChartList charts={charts} />
        </CardContent>
      </Card>
    </aside>
  );
}
