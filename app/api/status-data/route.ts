import { NextResponse } from "next/server";
import { HealthEndpoint, HealthLog, Incident, Service, ServiceStatus } from "@/types";
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

export async function GET() {
  try {
    const data = await realtimeRequest<{
      health_endpoints?: Record<string, Omit<HealthEndpoint, "id">>;
      health_logs?: Record<string, Omit<HealthLog, "id">>;
      incidents?: Record<string, Omit<Incident, "id">>;
    }>("/");

    const healthEndpoints = values<HealthEndpoint>(data?.health_endpoints).map((endpoint): HealthEndpoint => ({
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
      responseTime: endpoint.responseTime ?? null,
      statusCode: endpoint.statusCode ?? null,
      error: endpoint.error ?? null,
      uptime24h: Number(endpoint.uptime24h ?? 0),
      uptime7d: Number(endpoint.uptime7d ?? 0),
      uptime30d: Number(endpoint.uptime30d ?? 0),
      avgResponseTime: Number(endpoint.avgResponseTime ?? 0),
      tags: Array.isArray(endpoint.tags) ? endpoint.tags : [],
      createdAt: endpoint.createdAt ?? "",
    }));

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
      lastError: endpoint.error,
      uptime24h: endpoint.uptime24h,
      uptime7d: endpoint.uptime7d,
      uptime30d: endpoint.uptime30d,
      avgResponseTime: endpoint.avgResponseTime,
      tags: endpoint.tags,
      createdAt: endpoint.createdAt,
    }));

    const healthLogs = values<HealthLog>(data?.health_logs)
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
