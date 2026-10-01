// Canonical ordered categorical palette for every chart in the app.
// Order matches the validated slot order in app/globals.css (--chart-1..5) —
// keep it in sync with that comment; don't reorder without re-validating.
//
// Recharts' own primitives fall back to hardcoded, non-theme-aware colors when
// no fill/stroke is given (Area/Line default to '#3182bd', Pie to '#808080') —
// every series color in this app should come from here instead, never from a
// Recharts default.
export const CHART_SERIES_COLORS = [
  "var(--color-chart-1)", // emerald
  "var(--color-chart-2)", // blue
  "var(--color-chart-3)", // teal
  "var(--color-chart-4)", // gold
  "var(--color-chart-5)", // berry
] as const;

export function chartSeriesColor(index: number): string {
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
}
