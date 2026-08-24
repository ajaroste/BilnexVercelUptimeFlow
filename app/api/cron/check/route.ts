import { NextResponse } from "next/server";
import { performHealthCheck } from "@/lib/health-check";
import { performDnsCheck, performMultiLocationChecks, performSslCheck } from "@/lib/monitoring-extras";
import { realtimeRequest } from "@/lib/firebase/realtime";
import { sendTelegramNotification } from "@/lib/telegram";
import { HealthEndpoint, Incident } from "@/types";

export const maxDuration = 60;
type Stored<T> = Record<string, Omit<T, "id">>;

type FirebasePostResult = { name: string };

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const requestedInterval = Number(new URL(request.url).searchParams.get("interval"));
  if (![1, 5, 10].includes(requestedInterval)) return NextResponse.json({ error: "Geçersiz interval" }, { status: 400 });
  const endpointInterval = requestedInterval === 1 ? 5 : requestedInterval;

  try {
    const endpoints = await realtimeRequest<Stored<HealthEndpoint> | null>("health_endpoints");
    const entries = Object.entries(endpoints ?? {})
      .filter(([, endpoint]) => endpoint.enabled !== false && Number(endpoint.interval) === endpointInterval);

    const results = await Promise.allSettled(entries.map(([id, endpoint]) => checkEndpoint(id, endpoint)));

    return NextResponse.json({
      checked: results.length,
      successful: results.filter(result => result.status === "fulfilled").length,
      interval: endpointInterval,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cron başarısız" }, { status: 500 });
  }
}

async function checkEndpoint(endpointId: string, endpoint: Omit<HealthEndpoint, "id">) {
  const primaryResult = await performHealthCheck(endpoint.endpoint);
  const remoteOnly = endpoint.multiLocationMonitoring?.enabled === true && endpoint.multiLocationMonitoring.includePrimaryLocation === false;

  if (primaryResult.error?.includes("ECONNRESET") && !remoteOnly) return primaryResult;

  const [dns, ssl, locations] = await Promise.all([
    performDnsCheck(endpoint.endpoint, endpoint.dnsMonitoring),
    performSslCheck(endpoint.endpoint, endpoint.sslMonitoring),
    performMultiLocationChecks(endpoint.endpoint, endpoint.multiLocationMonitoring, primaryResult),
  ]);

  const effectiveResult = remoteOnly && locations.enabled
    ? locationAggregateResult(locations, primaryResult.timestamp)
    : primaryResult;

  let success = effectiveResult.success;
  const errors: string[] = [];
  if (effectiveResult.error) errors.push(effectiveResult.error);

  if (endpoint.dnsMonitoring?.enabled && endpoint.dnsMonitoring.affectsStatus && !dns.success) {
    success = false;
    if (dns.error) errors.push(`DNS: ${dns.error}`);
  }
  if (endpoint.sslMonitoring?.enabled && endpoint.sslMonitoring.affectsStatus && !ssl.success) {
    success = false;
    if (ssl.error) errors.push(`SSL: ${ssl.error}`);
  }
  if (!remoteOnly && endpoint.multiLocationMonitoring?.enabled && endpoint.multiLocationMonitoring.affectsStatus && !locations.success) {
    success = false;
    if (locations.error) errors.push(`Konum: ${locations.error}`);
  }

  const result = {
    ...effectiveResult,
    success,
    error: errors.length ? errors.join(" | ") : null,
  };

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

  const dnsStatus = !endpoint.dnsMonitoring?.enabled ? "disabled" : dns.success ? "ok" : "error";
  const sslStatus = !endpoint.sslMonitoring?.enabled ? "disabled" : !ssl.success ? "error" : ssl.warning ? "warning" : "ok";
  const locationStatus = !endpoint.multiLocationMonitoring?.enabled ? "disabled" : locations.success ? "ok" : "error";

  const patch: Record<string, unknown> = {
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
    dnsStatus,
    dnsAddresses: dns.addresses,
    dnsError: dns.error,
    sslStatus,
    sslDaysRemaining: ssl.daysRemaining,
    sslValidTo: ssl.validTo,
    sslError: ssl.error,
    locationStatus,
    locationResults: locations.results,
  };

  const telegram = endpoint.telegram;
  const telegramEnabled = telegram?.enabled !== false;
  const today = new Date().toISOString().slice(0, 10);

  if (telegramEnabled && endpoint.dnsMonitoring?.enabled && telegram?.notifyOnDns !== false) {
    const dnsState = dns.success ? "ok" : "error";
    if (endpoint.lastDnsNotificationState !== dnsState) {
      await sendTelegramNotification(dns.success
        ? `🟢 <b>${endpoint.name} DNS tekrar normal</b>\n${dns.addresses.join(", ")}`
        : `🟠 <b>${endpoint.name} DNS sorunu</b>\n${dns.error ?? "DNS çözümlenemedi"}`);
      patch.lastDnsNotificationState = dnsState;
    }
  }

  if (telegramEnabled && endpoint.sslMonitoring?.enabled && telegram?.notifyOnSsl !== false) {
    if (!ssl.success) {
      if (endpoint.lastSslNotificationDate !== today) {
        await sendTelegramNotification(`🔐 <b>${endpoint.name} SSL HATASI</b>\n${ssl.error ?? "Sertifika doğrulanamadı"}`);
        patch.lastSslNotificationDate = today;
      }
    } else if (ssl.warning && endpoint.lastSslNotificationDate !== today) {
      await sendTelegramNotification(`⚠️ <b>${endpoint.name} SSL süresi yaklaşıyor</b>\nKalan: ${ssl.daysRemaining} gün\nBitiş: ${ssl.validTo ?? "—"}`);
      patch.lastSslNotificationDate = today;
    }
  }

  if (telegramEnabled && endpoint.multiLocationMonitoring?.enabled && telegram?.notifyOnLocation !== false) {
    const locationState = locations.success ? "ok" : "error";
    if (endpoint.lastLocationNotificationState !== locationState) {
      const summary = locations.results.map(item => `${item.success ? "✅" : "❌"} ${item.name}${item.responseTime !== null ? ` (${item.responseTime} ms)` : ""}`).join("\n");
      await sendTelegramNotification(locations.success
        ? `🌍 <b>${endpoint.name} konum kontrolleri normal</b>\n${summary}`
        : `🌍 <b>${endpoint.name} konum problemi</b>\n${summary}`);
      patch.lastLocationNotificationState = locationState;
    }
  }

  await realtimeRequest(`health_endpoints/${endpointId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

  const shouldLog = changed || currentStatus !== "up" || result.responseTime > 1000 || totalChecks % 20 === 0;
  if (shouldLog) {
    const logPayload = {
      serviceId: endpointId,
      ...result,
      dnsStatus,
      sslStatus,
      sslDaysRemaining: ssl.daysRemaining,
      locationStatus,
      transition: changed
        ? `${String(endpoint.currentStatus).toUpperCase()}_TO_${currentStatus.toUpperCase()}`
        : currentStatus.toUpperCase(),
    };

    await Promise.all([
      realtimeRequest("health_logs", { method: "POST", body: JSON.stringify(logPayload) }),
      realtimeRequest(`health_logs_by_service/${endpointId}`, { method: "POST", body: JSON.stringify(logPayload) }),
    ]);
  }

  if (changed) {
    if (currentStatus === "down") {
      const incidentPayload = {
        serviceId: endpointId,
        startTime: result.timestamp,
        endTime: null,
        duration: null,
        reason: result.error ?? "Servis yanıt vermiyor",
      };

      // Global listeyi korurken aynı incident ID ile servis-özel path'e de yaz.
      const created = await realtimeRequest<FirebasePostResult>("incidents", {
        method: "POST",
        body: JSON.stringify(incidentPayload),
      });
      await realtimeRequest(`incidents_by_service/${endpointId}/${created.name}`, {
        method: "PUT",
        body: JSON.stringify(incidentPayload),
      });
    } else {
      // Önce küçük servis-özel path'e bak. Geçiş öncesi açık incident varsa yalnızca
      // recovery anında indexli global serviceId sorgusuna geri düş.
      let incidents = await realtimeRequest<Stored<Incident> | null>(
        `incidents_by_service/${endpointId}`,
        undefined,
        { orderBy: "startTime", limitToLast: 20 },
      );
      let fromLegacy = false;

      if (!incidents || Object.keys(incidents).length === 0) {
        incidents = await realtimeRequest<Stored<Incident> | null>(
          "incidents",
          undefined,
          { orderBy: "serviceId", equalTo: endpointId, limitToLast: 20 },
        );
        fromLegacy = true;
      }

      const openIncident = Object.entries(incidents ?? {})
        .sort(([, a], [, b]) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .find(([, incident]) => !incident.endTime);

      if (openIncident) {
        const [incidentId, incident] = openIncident;
        const closePatch = {
          endTime: result.timestamp,
          duration: Math.round((Date.now() - new Date(incident.startTime).getTime()) / 1000),
        };

        await Promise.all([
          realtimeRequest(`incidents/${incidentId}`, {
            method: "PATCH",
            body: JSON.stringify(closePatch),
          }),
          realtimeRequest(`incidents_by_service/${endpointId}/${incidentId}`, {
            method: fromLegacy ? "PUT" : "PATCH",
            body: JSON.stringify(fromLegacy ? { ...incident, ...closePatch } : closePatch),
          }),
        ]);
      }
    }

    if (telegramEnabled) {
      if (currentStatus === "down" && telegram?.notifyOnDown !== false) {
        await sendTelegramNotification(`🔴 <b>${endpoint.name} DOWN</b>\n${endpoint.endpoint}\n${result.error ?? "Bağlantı hatası"}`);
      }
      if (currentStatus === "up" && telegram?.notifyOnRecovery !== false) {
        await sendTelegramNotification(`🟢 <b>${endpoint.name} tekrar UP</b>\n${endpoint.endpoint}\nYanıt: ${result.responseTime} ms`);
      }
    }
  }

  return { result, dns, ssl, locations };
}

function locationAggregateResult(
  locations: Awaited<ReturnType<typeof performMultiLocationChecks>>,
  timestamp: string,
) {
  const successful = locations.results.filter(item => item.success);
  const responseTime = successful.length
    ? Math.round(successful.reduce((sum, item) => sum + (item.responseTime ?? 0), 0) / successful.length)
    : Math.max(0, ...locations.results.map(item => item.responseTime ?? 0));
  const first = successful[0] ?? locations.results[0];
  return {
    success: locations.success,
    statusCode: first?.statusCode ?? null,
    responseTime,
    response: "",
    error: locations.error,
    timestamp,
  };
}
