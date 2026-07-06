import { NextResponse } from "next/server";
import { performHealthCheck } from "@/lib/health-check";
import { realtimeRequest } from "@/lib/firebase/realtime";
import { sendTelegramNotification } from "@/lib/telegram";
import { HealthEndpoint, Incident } from "@/types";

export const maxDuration = 60;
type Stored<T> = Record<string, Omit<T, "id">>;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const interval = Number(new URL(request.url).searchParams.get("interval"));
  if (![1, 10].includes(interval)) return NextResponse.json({ error: "Geçersiz interval" }, { status: 400 });

  try {
    const data = await realtimeRequest<{
      health_endpoints?: Stored<HealthEndpoint>;
      incidents?: Stored<Incident>;
    }>("/");
    const entries = Object.entries(data?.health_endpoints ?? {})
      .filter(([, endpoint]) => endpoint.enabled !== false && Number(endpoint.interval) === interval);
    const results = await Promise.allSettled(
      entries.map(([id, endpoint]) => checkEndpoint(id, endpoint, data.incidents ?? {})),
    );
    return NextResponse.json({
      checked: results.length,
      successful: results.filter(result => result.status === "fulfilled").length,
      interval,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cron başarısız" }, { status: 500 });
  }
}

async function checkEndpoint(
  endpointId: string,
  endpoint: Omit<HealthEndpoint, "id">,
  incidents: Stored<Incident>,
) {
  const result = await performHealthCheck(endpoint.endpoint);
  
  // ECONNRESET hatasını Firebase'e hiçbir şekilde yansıtma (Pas geç)
  if (result.error && result.error.includes("ECONNRESET")) {
    return result;
  }

  const currentStatus = result.success ? "up" : "down";
  const changed = endpoint.currentStatus !== currentStatus;
  const counters = endpoint as Omit<HealthEndpoint, "id"> & {
    totalChecks?: number;
    successfulChecks?: number;
    totalResponseTime?: number;
  };
  const totalChecks = Number(counters.totalChecks ?? 0) + 1;
  const successfulChecks = Number(counters.successfulChecks ?? 0) + (result.success ? 1 : 0);
  const totalResponseTime = Number(counters.totalResponseTime ?? 0) + result.responseTime;

  await realtimeRequest(`health_endpoints/${endpointId}`, {
    method: "PATCH",
    body: JSON.stringify({
      currentStatus,
      lastChecked: result.timestamp,
      responseTime: result.responseTime,
      statusCode: result.statusCode,
      error: result.error,
      totalChecks,
      successfulChecks,
      totalResponseTime,
      uptime24h: Number(((successfulChecks / totalChecks) * 100).toFixed(2)),
      avgResponseTime: Math.round(totalResponseTime / totalChecks),
    }),
  });

  // health_logs:
  // 1. Durum değiştiyse (UP->DOWN veya DOWN->UP) KESİNLİKLE anında yaz.
  // 2. Durum DOWN ise (200 harici, hata vs.) KESİNLİKLE anında yaz.
  // 3. Arka arkaya 200 (UP) geliyorsa log spamı yapmamak için her 20 denemede 1 yaz.
  // 4. EKLENTİ: Servis 200 dönse bile, eğer çok yavaş cevap verdiyse (>1000ms) anında grafiğe yansıt.
  const shouldLog = changed || currentStatus !== "up" || result.responseTime > 1000 || totalChecks % 20 === 0;
  if (shouldLog) {
    await realtimeRequest("health_logs", {
      method: "POST",
      body: JSON.stringify({
        serviceId: endpointId,
        ...result,
        transition: changed
          ? `${String(endpoint.currentStatus).toUpperCase()}_TO_${currentStatus.toUpperCase()}`
          : currentStatus.toUpperCase(),
      }),
    });
  }

  // Incident: sadece durum değişiminde işlem yap
  if (!changed) return result;

  if (currentStatus === "down") {
    await realtimeRequest("incidents", {
      method: "POST",
      body: JSON.stringify({
        serviceId: endpointId,
        startTime: result.timestamp,
        endTime: null,
        duration: null,
        reason: result.error ?? "Servis yanıt vermiyor",
      }),
    });
  } else {
    const openIncident = Object.entries(incidents)
      .find(([, incident]) => incident.serviceId === endpointId && !incident.endTime);
    if (openIncident) {
      const [incidentId, incident] = openIncident;
      await realtimeRequest(`incidents/${incidentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          endTime: result.timestamp,
          duration: Math.round((Date.now() - new Date(incident.startTime).getTime()) / 1000),
        }),
      });
    }
  }

  await sendTelegramNotification(currentStatus === "down"
    ? `🔴 <b>${endpoint.name} DOWN</b>\n${endpoint.endpoint}\n${result.error ?? "Bağlantı hatası"}`
    : `🟢 <b>${endpoint.name} tekrar UP</b>\n${endpoint.endpoint}\nYanıt: ${result.responseTime} ms`);
  return result;
}
