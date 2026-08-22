import { NextResponse } from "next/server";
import { realtimeRequest } from "@/lib/firebase/realtime";
import { DnsMonitoringConfig, MultiLocationMonitoringConfig, SslMonitoringConfig, TelegramNotificationConfig } from "@/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || id.includes("/") || id.includes("..")) {
      return NextResponse.json({ error: "Geçersiz servis kimliği" }, { status: 400 });
    }

    const body = await request.json() as {
      dnsMonitoring?: DnsMonitoringConfig;
      sslMonitoring?: SslMonitoringConfig;
      multiLocationMonitoring?: MultiLocationMonitoringConfig;
      telegram?: TelegramNotificationConfig;
    };

    const dnsMonitoring = normalizeDns(body.dnsMonitoring);
    const sslMonitoring = normalizeSsl(body.sslMonitoring);
    const multiLocationMonitoring = normalizeLocations(body.multiLocationMonitoring);
    const telegram = normalizeTelegram(body.telegram);

    await realtimeRequest(`health_endpoints/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ dnsMonitoring, sslMonitoring, multiLocationMonitoring, telegram }),
    });

    return NextResponse.json({ ok: true, dnsMonitoring, sslMonitoring, multiLocationMonitoring, telegram });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "İzleme ayarları kaydedilemedi." },
      { status: 400 },
    );
  }
}

function normalizeDns(config?: DnsMonitoringConfig): DnsMonitoringConfig {
  return {
    enabled: config?.enabled === true,
    affectsStatus: config?.affectsStatus === true,
    expectedAddresses: Array.isArray(config?.expectedAddresses)
      ? config.expectedAddresses.map(value => String(value).trim()).filter(Boolean).slice(0, 20)
      : [],
    requireAllExpected: config?.requireAllExpected === true,
  };
}

function normalizeSsl(config?: SslMonitoringConfig): SslMonitoringConfig {
  const warnDays = Number(config?.warnDays ?? 14);
  return {
    enabled: config?.enabled === true,
    affectsStatus: config?.affectsStatus === true,
    warnDays: Number.isFinite(warnDays) ? Math.min(90, Math.max(1, Math.round(warnDays))) : 14,
  };
}

function normalizeLocations(config?: MultiLocationMonitoringConfig): MultiLocationMonitoringConfig {
  const probes = Array.isArray(config?.probes) ? config.probes.slice(0, 10).map((probe, index) => {
    const url = new URL(String(probe.url));
    if (url.protocol !== "https:") throw new Error("Probe URL'leri HTTPS olmalıdır.");
    return {
      id: String(probe.id || `probe-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 50),
      name: String(probe.name || `Probe ${index + 1}`).slice(0, 80),
      url: url.toString(),
      enabled: probe.enabled !== false,
    };
  }) : [];

  const minimum = Number(config?.minimumSuccessfulLocations ?? 1);
  return {
    enabled: config?.enabled === true,
    affectsStatus: config?.affectsStatus !== false,
    includePrimaryLocation: config?.includePrimaryLocation !== false,
    minimumSuccessfulLocations: Number.isFinite(minimum) ? Math.max(1, Math.min(11, Math.round(minimum))) : 1,
    probes,
  };
}

function normalizeTelegram(config?: TelegramNotificationConfig): TelegramNotificationConfig {
  return {
    enabled: config?.enabled !== false,
    notifyOnDown: config?.notifyOnDown !== false,
    notifyOnRecovery: config?.notifyOnRecovery !== false,
    notifyOnDns: config?.notifyOnDns !== false,
    notifyOnSsl: config?.notifyOnSsl !== false,
    notifyOnLocation: config?.notifyOnLocation !== false,
  };
}
