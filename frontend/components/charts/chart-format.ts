import type { BackendChatChart } from "@/lib/backend";

export function coerceNumericValue(value: string | number | boolean | null | undefined) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) {
    return value;
  }

  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}

export function formatValue(value: string | number | boolean | null | undefined) {
  if (typeof value === "number") {
    return Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }
  return value == null ? "" : String(value);
}

export function formatSqlPreview(sql: string | null | undefined) {
  if (!sql) {
    return "Finance warehouse query";
  }

  const normalized = sql.replace(/\s+/g, " ").trim();
  return normalized.length > 150 ? `${normalized.slice(0, 147).trimEnd()}...` : normalized;
}

export function normalizeChart(chart: BackendChatChart) {
  const numericKeys = new Set<string>();

  for (const series of chart.series) {
    numericKeys.add(series.key);
  }

  if (chart.value_key) {
    numericKeys.add(chart.value_key);
  }

  const data = chart.data.map((entry) => {
    const nextEntry: Record<string, string | number | boolean | null> = { ...entry };
    for (const key of numericKeys) {
      const normalizedValue = coerceNumericValue(nextEntry[key]);
      nextEntry[key] = normalizedValue === undefined ? null : normalizedValue;
    }
    return nextEntry;
  });

  return {
    ...chart,
    data,
  };
}
