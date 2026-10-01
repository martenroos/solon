export function getEvidenceNumber(
  evidence: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = evidence?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getEvidenceRows(
  evidence: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = evidence?.[key];
  return Array.isArray(value) ? value.filter(isEvidenceRow) : [];
}

export function isEvidenceRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function formatMoneyValue(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatShortMoney(value: number | null) {
  if (value === null) return "-";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1_000_000) return `${sign}EUR ${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}EUR ${Math.round(absolute / 1_000)}k`;
  return `${sign}EUR ${Math.round(absolute)}`;
}

export function formatPercentValue(value: number | null) {
  if (value === null) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
