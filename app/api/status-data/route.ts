import { NextResponse } from "next/server";
import { HealthEndpoint, HealthLog, Incident, LatencyStatus, Service, ServiceStatus } from "@/types";
import { realtimeRequest } from "@/lib/firebase/realtime";

export const dynamic = "force-dynamic";

function values<T>(input: Record<string, Omit<T, "id">> | null | undefined): T[] {
  if (!input) return [];
  return Object.entries(input).map(([id, value]) => ({ id, ...value }) as T);
}

function status(value: unknown): ServiceStatus {
  const normalized = String(value ?? "pending").toLowerCase();
  return normalized === "up" || normalized === "down" ? normalized : "pending";
}

function latencyStatus(value: unknown, responseTime: number | null, hasNetworkError: boolean): LatencyStatus {
  const normalized = String(value ?? "").toLowerCase();
  if (["normal", "slow", "degraded", "timeout", "error"].includes(normalized)) {
    return normalized as LatencyStatus;
  }
  if (hasNetworkError) return "error";
  if (responseTime === null) return "normal";
  if (responseTime >= 20_000) return "timeout";
  if (responseTime >= 10_000) return "degraded";
  if (responseTime >= 3_000) return "slow";
  return "normal";
}

export async function GET() {
  try {
    const data = await realtimeRequest<{
      health_endpoints?: Record<string, Omit<HealthEndpoint, "id">>;
      health_logs?: Record<string, Omit<HealthLog, "id">>;
      incidents?: Record<string, Omit<Incident, "id">>;
    }>("/");

    const healthEndpoints = values<HealthEndpoint>(data?.health_endpoints).map((endpoint): HealthEndpoint => {
      const responseTime = endpoint.responseTime ?? null;
      const networkError = Boolean(endpoint.error && endpoint.statusCode == null);
      return {
        ...endpoint,
        name: endpoint.name ?? "Health endpoint",
        ipAddress: endpoint.ipAddress ?? "—",
        endpoint: endpoint.endpoint ?? "",
        port: endpoint.port ? Number(endpoint.port) : null,
        protocol: ["http", "https", "tcp"].includes(endpoint.protocol) ? endpoint.protocol : "https",
        interval: endpoint.interval === 10 ? 10 : 5,
        enabled: endpoint.enabled !== false,
        currentStatus: status(endpoint.currentStatus),
        lastChecked: endpoint.lastChecked ?? null,
        responseTime,
        statusCode: endpoint.statusCode ?? null,
        latencyStatus: latencyStatus(endpoint.latencyStatus, responseTime, networkError),
        error: endpoint.error ?? null,
        errorType: endpoint.errorType ?? null,
        errorCode: endpoint.errorCode ?? null,
        errorDetail: endpoint.errorDetail ?? null,
        uptime24h: Number(endpoint.uptime24h ?? 0),
        uptime7d: Number(endpoint.uptime7d ?? 0),
        uptime30d: Number(endpoint.uptime30d ?? 0),
        avgResponseTime: Number(endpoint.avgResponseTime ?? 0),
        tags: Array.isArray(endpoint.tags) ? endpoint.tags : [],
        createdAt: endpoint.createdAt ?? "",
      };
    });

    const services: Service[] = healthEndpoints.map((endpoint) => ({
      id: endpoint.id,
      name: endpoint.name,
      url: endpoint.endpoint,
      interval: endpoint.interval,
      enabled: endpoint.enabled,
      currentStatus: endpoint.currentStatus,
      lastChecked: endpoint.lastChecked,
      lastResponseTime: endpoint.responseTime,
      lastStatusCode: endpoint.statusCode,
      latencyStatus: endpoint.latencyStatus ?? "normal",
      lastError: endpoint.error,
      lastErrorType: endpoint.errorType ?? null,
      lastErrorCode: endpoint.errorCode ?? null,
      lastErrorDetail: endpoint.errorDetail ?? null,
      uptime24h: endpoint.uptime24h,
      uptime7d: endpoint.uptime7d,
      uptime30d: endpoint.uptime30d,
      avgResponseTime: endpoint.avgResponseTime,
      tags: endpoint.tags,
      createdAt: endpoint.createdAt,
    }));

    const healthLogs = values<HealthLog>(data?.health_logs)
      .map(log => ({
        ...log,
        latencyStatus: latencyStatus(log.latencyStatus, log.responseTime ?? null, Boolean(log.error && log.statusCode == null)),
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const incidents = values<Incident>(data?.incidents)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    return NextResponse.json({ services, healthLogs, incidents, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Firebase verileri alınamadı." },
      { status: 502 },
    );
  }
}
