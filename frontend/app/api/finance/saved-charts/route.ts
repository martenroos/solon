import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  createSavedChart,
  getSavedCharts,
  type BackendSavedChartSurface,
} from "@/lib/backend";

function isSavedChartSurface(value: string | null): value is BackendSavedChartSurface {
  return value === "dashboard";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ detail: "Unauthorized." }, { status: 401 });
  }

  const surface = new URL(request.url).searchParams.get("surface");
  if (!isSavedChartSurface(surface)) {
    return NextResponse.json({ detail: "Invalid saved chart surface." }, { status: 400 });
  }

  try {
    const charts = await getSavedCharts(
      { email: session.user.email, provider: session.user.provider },
      surface,
    );
    return NextResponse.json({ charts });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to load saved charts.";
    return NextResponse.json({ detail }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ detail: "Unauthorized." }, { status: 401 });
  }

  let payload: Parameters<typeof createSavedChart>[1];
  try {
    payload = (await request.json()) as Parameters<typeof createSavedChart>[1];
  } catch {
    return NextResponse.json({ detail: "Invalid request body." }, { status: 400 });
  }

  try {
    const chart = await createSavedChart(
      { email: session.user.email, provider: session.user.provider },
      payload,
    );
    return NextResponse.json(chart, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to save chart.";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
