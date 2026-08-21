import { NextResponse } from "next/server";
import { HealthEndpoint, Service, ServiceStatus } from "@/types";
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
    // Dashboard yalnızca küçük health_endpoints düğümünü okur.
    // health_logs ve incidents ilgili ekranlar açılana kadar indirilmez.
    const raw = await realtimeRequest<Record<string, Omit<HealthEndpoint, "id">> | null>("health_endpoints");

    const healthEndpoints = values<HealthEndpoint>(raw).map((endpoint): HealthEndpoint => ({
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

    return NextResponse.json({ services, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Firebase verileri alınamadı." },
      { status: 502 },
    );
  }
}
