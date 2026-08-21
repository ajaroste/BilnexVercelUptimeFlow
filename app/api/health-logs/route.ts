import { NextResponse } from "next/server";
import { HealthLog } from "@/types";
import { realtimeRequest } from "@/lib/firebase/realtime";

export const dynamic = "force-dynamic";

type StoredLog = Record<string, Omit<HealthLog, "id">>;

function startOfTodayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function endOfTodayIso() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now.toISOString();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from") || startOfTodayIso();
    const to = url.searchParams.get("to") || endOfTodayIso();
    const serviceId = url.searchParams.get("serviceId") || "all";
    const requestedLimit = Number(url.searchParams.get("limit") || 500);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 2000) : 500;

    const raw = await realtimeRequest<StoredLog | null>(
      "health_logs",
      undefined,
      {
        orderBy: "timestamp",
        startAt: from,
        endAt: to,
        limitToLast: limit,
      },
    );

    const healthLogs = Object.entries(raw ?? {})
      .map(([id, value]) => ({ id, ...value }) as HealthLog)
      .filter((log) => serviceId === "all" || log.serviceId === serviceId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ healthLogs, from, to, limit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Health log kayıtları alınamadı." },
      { status: 502 },
    );
  }
}
