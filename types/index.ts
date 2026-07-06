export type ServiceStatus = "up" | "down" | "pending";

export interface Service {
  id: string;
  name: string;
  url: string;
  interval: 5 | 10;
  enabled: boolean;
  currentStatus: ServiceStatus;
  lastChecked: string | null;
  lastResponseTime: number | null;
  lastStatusCode: number | null;
  lastError: string | null;
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
  avgResponseTime: number;
  tags: string[];
  createdAt: string;
}

export interface HealthEndpoint {
  id: string;
  name: string;
  ipAddress: string;
  endpoint: string;
  port: number | null;
  protocol: "http" | "https" | "tcp";
  interval: 5 | 10;
  enabled: boolean;
  currentStatus: ServiceStatus;
  lastChecked: string | null;
  responseTime: number | null;
  statusCode: number | null;
  error: string | null;
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
  avgResponseTime: number;
  tags: string[];
  createdAt: string;
}

export interface HealthLog {
  id: string;
  serviceId: string;
  timestamp: string;
  success: boolean;
  statusCode: number | null;
  responseTime: number;
  response: string;
  error: string | null;
}

export interface Incident {
  id: string;
  serviceId: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  reason: string;
}
