export type ServiceStatus = "up" | "down" | "pending";
export type LatencyStatus = "normal" | "slow" | "degraded" | "timeout" | "error";

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
  latencyStatus: LatencyStatus;
  lastError: string | null;
  lastErrorType: string | null;
  lastErrorCode: string | null;
  lastErrorDetail: string | null;
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
  latencyStatus?: LatencyStatus;
  error: string | null;
  errorType?: string | null;
  errorCode?: string | null;
  errorDetail?: string | null;
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
  latencyStatus?: LatencyStatus;
  response: string;
  error: string | null;
  errorType?: string | null;
  errorCode?: string | null;
  errorDetail?: string | null;
}

export interface Incident {
  id: string;
  serviceId: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  reason: string;
}
