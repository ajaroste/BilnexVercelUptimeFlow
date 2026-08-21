import { NextResponse } from "next/server";
import { Incident } from "@/types";
import { realtimeRequest } from "@/lib/firebase/realtime";

export const dynamic = "force-dynamic";

type StoredIncident = Record<string, Omit<Incident, "id">>;

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
    const status = url.searchParams.get("status") || "all";
    const requestedLimit = Number(url.searchParams.get("limit") || 500);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 500;

    const raw = await realtimeRequest<StoredIncident | null>(
      "incidents",
      undefined,
      {
        orderBy: "startTime",
        startAt: from,
        endAt: to,
        limitToLast: limit,
      },
    );

    const incidents = Object.entries(raw ?? {})
      .map(([id, value]) => ({ id, ...value }) as Incident)
      .filter((incident) => serviceId === "all" || incident.serviceId === serviceId)
      .filter((incident) => {
        if (status === "open") return !incident.endTime;
        if (status === "resolved") return Boolean(incident.endTime);
        return true;
      })
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    return NextResponse.json({ incidents, from, to, limit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kesinti kayıtları alınamadı." },
      { status: 502 },
    );
  }
}
