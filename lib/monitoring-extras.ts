import { resolve4, resolve6 } from "node:dns/promises";
import tls from "node:tls";
import { DnsMonitoringConfig, MonitoringProbe, MultiLocationMonitoringConfig, SslMonitoringConfig } from "@/types";

export type BasicCheckResult = {
  success: boolean;
  statusCode: number | null;
  responseTime: number;
  response: string;
  error: string | null;
  timestamp: string;
};

export async function performDnsCheck(target: string, config?: DnsMonitoringConfig) {
  if (!config?.enabled) return { enabled: false as const, success: true, addresses: [] as string[], error: null as string | null };
  try {
    const hostname = new URL(target).hostname;
    const [v4, v6] = await Promise.all([
      resolve4(hostname).catch(() => [] as string[]),
      resolve6(hostname).catch(() => [] as string[]),
    ]);
    const addresses = [...v4, ...v6];
    if (!addresses.length) throw new Error("DNS kaydı çözümlenemedi");

    const expected = config.expectedAddresses?.filter(Boolean) ?? [];
    if (expected.length) {
      const matches = expected.map(ip => addresses.includes(ip));
      const ok = config.requireAllExpected ? matches.every(Boolean) : matches.some(Boolean);
      if (!ok) throw new Error(`Beklenen DNS adresi bulunamadı. Dönen: ${addresses.join(", ")}`);
    }

    return { enabled: true as const, success: true, addresses, error: null as string | null };
  } catch (error) {
    return {
      enabled: true as const,
      success: false,
      addresses: [] as string[],
      error: error instanceof Error ? error.message : "DNS kontrolü başarısız",
    };
  }
}

export async function performSslCheck(target: string, config?: SslMonitoringConfig) {
  if (!config?.enabled) return { enabled: false as const, success: true, warning: false, daysRemaining: null as number | null, validTo: null as string | null, error: null as string | null };

  const url = new URL(target);
  if (url.protocol !== "https:") {
    return { enabled: true as const, success: false, warning: false, daysRemaining: null, validTo: null, error: "SSL kontrolü yalnızca HTTPS servislerde kullanılabilir" };
  }

  const port = Number(url.port || 443);
  return new Promise(resolve => {
    const socket = tls.connect({ host: url.hostname, port, servername: url.hostname, rejectUnauthorized: true });
    const finish = (result: ReturnType<typeof sslResult>) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(10_000, () => finish(sslResult(false, false, null, null, "SSL bağlantısı 10 saniye içinde kurulamadı")));
    socket.once("error", error => finish(sslResult(false, false, null, null, error.message)));
    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      if (!cert?.valid_to) return finish(sslResult(false, false, null, null, "SSL sertifika bitiş tarihi okunamadı"));
      const validToDate = new Date(cert.valid_to);
      const daysRemaining = Math.ceil((validToDate.getTime() - Date.now()) / 86_400_000);
      if (!Number.isFinite(daysRemaining) || daysRemaining < 0) {
        return finish(sslResult(false, false, daysRemaining, validToDate.toISOString(), "SSL sertifikasının süresi dolmuş"));
      }
      const warnDays = Math.max(1, Number(config.warnDays ?? 14));
      finish(sslResult(true, daysRemaining <= warnDays, daysRemaining, validToDate.toISOString(), null));
    });
  });
}

function sslResult(success: boolean, warning: boolean, daysRemaining: number | null, validTo: string | null, error: string | null) {
  return { enabled: true as const, success, warning, daysRemaining, validTo, error };
}

export async function performMultiLocationChecks(target: string, config?: MultiLocationMonitoringConfig, primaryResult?: BasicCheckResult) {
  if (!config?.enabled) {
    return { enabled: false as const, success: true, results: [] as LocationResult[], successfulLocations: 0, requiredLocations: 0, error: null as string | null };
  }

  const enabledProbes = (config.probes ?? []).filter(probe => probe.enabled !== false && probe.url);
  const results: LocationResult[] = [];

  if (config.includePrimaryLocation !== false && primaryResult) {
    results.push({
      id: "primary",
      name: "Vercel Primary",
      success: primaryResult.success,
      responseTime: primaryResult.responseTime,
      statusCode: primaryResult.statusCode,
      error: primaryResult.error,
    });
  }

  const remoteResults = await Promise.all(enabledProbes.map(probe => runProbe(probe, target)));
  results.push(...remoteResults);

  if (!results.length) {
    return { enabled: true as const, success: false, results, successfulLocations: 0, requiredLocations: 1, error: "Multi-location açık ancak aktif probe tanımlı değil" };
  }

  const successfulLocations = results.filter(item => item.success).length;
  const configuredMinimum = Number(config.minimumSuccessfulLocations ?? results.length);
  const requiredLocations = Math.min(results.length, Math.max(1, configuredMinimum));
  const success = successfulLocations >= requiredLocations;
  const failedNames = results.filter(item => !item.success).map(item => item.name);

  return {
    enabled: true as const,
    success,
    results,
    successfulLocations,
    requiredLocations,
    error: success ? null : `Başarısız konumlar: ${failedNames.join(", ")}`,
  };
}

export type LocationResult = {
  id: string;
  name: string;
  success: boolean;
  responseTime: number | null;
  statusCode: number | null;
  error: string | null;
};

async function runProbe(probe: MonitoringProbe, target: string): Promise<LocationResult> {
  const started = Date.now();
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const secret = process.env.MULTI_LOCATION_PROBE_SECRET;
    if (secret) headers.Authorization = `Bearer ${secret}`;

    const response = await fetch(probe.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ target }),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    const body = await response.json() as Partial<BasicCheckResult> & { error?: string | null };
    return {
      id: probe.id,
      name: probe.name,
      success: response.ok && body.success === true,
      responseTime: typeof body.responseTime === "number" ? body.responseTime : Date.now() - started,
      statusCode: typeof body.statusCode === "number" ? body.statusCode : null,
      error: response.ok ? body.error ?? null : `Probe HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      id: probe.id,
      name: probe.name,
      success: false,
      responseTime: Date.now() - started,
      statusCode: null,
      error: error instanceof Error ? error.message : "Probe isteği başarısız",
    };
  }
}
