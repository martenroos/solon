import type { ComponentType } from "react";

export type InsightType = "insight" | "prediction" | "anomaly";
export type CardSize = "sm" | "lg";

export type InsightOption = {
  id: string;
  title: string;
  category: InsightType;
  summary: string;
  detail: string;
  dataSources: string[];
  value: string;
  actionLabel: string;
  size: CardSize;
  metric: string;
  delta: string;
  deltaDirection: "up" | "down" | "flat";
  status: "On track" | "Watch" | "Alert";
  trend: number[];
  segments?: { label: string; value: number; tone: string }[];
  icon: ComponentType<{ className?: string }>;
  runId?: string | null;
  computedAt?: string | null;
  modelName?: string | null;
  modelVersion?: string | null;
  confidence?: number | null;
  explanation?: string | null;
  evidence?: Record<string, unknown> | null;
};

export type TenantOption = { id: string; name: string; subtitle: string };
export type TenantState = {
  visibleIds: string[];
  expandedIds: string[];
  sizeById: Partial<Record<string, CardSize>>;
};
