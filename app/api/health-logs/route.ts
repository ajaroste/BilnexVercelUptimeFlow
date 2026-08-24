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

async function queryLogs(path: string, from: string, to: string, limit: number) {
  return realtimeRequest<StoredLog | null>(
    path,
    undefined,
    {
      orderBy: "timestamp",
      startAt: from,
      endAt: to,
      limitToLast: limit,
    },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from") || startOfTodayIso();
    const to = url.searchParams.get("to") || endOfTodayIso();
    const serviceId = url.searchParams.get("serviceId") || "all";
    const requestedLimit = Number(url.searchParams.get("limit") || 500);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 2000) : 500;

    let raw: StoredLog | null;

    if (serviceId !== "all") {
      // Servis detayları doğrudan servis-özel path'i sorgular. Boş sonuç normaldir;
      // otomatik global fallback yapmak, veri olmayan her açılışta global health_logs indirirdi.
      raw = await queryLogs(`health_logs_by_service/${serviceId}`, from, to, limit);

      // Eski kayıtlar gerekiyorsa geçici olarak env ile legacy fallback açılabilir.
      if ((!raw || Object.keys(raw).length === 0) && process.env.ENABLE_LEGACY_HEALTH_LOG_FALLBACK === "true") {
        const legacy = await queryLogs("health_logs", from, to, limit);
        raw = Object.fromEntries(
          Object.entries(legacy ?? {}).filter(([, log]) => log.serviceId === serviceId),
        );
      }
    } else {
      // Tüm servis logları yalnızca kullanıcı gerçekten "all" istediğinde okunur.
      raw = await queryLogs("health_logs", from, to, limit);
    }

    const healthLogs = Object.entries(raw ?? {})
      .map(([id, value]) => ({ id, ...value }) as HealthLog)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ healthLogs, from, to, limit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Health log kayıtları alınamadı." },
      { status: 502 },
    );
  }
}
