export type ServiceStatus = "up" | "down" | "pending";

export interface MonitoringProbe {
  id: string;
  name: string;
  url: string;
  enabled?: boolean;
}

export interface DnsMonitoringConfig {
  enabled: boolean;
  affectsStatus?: boolean;
  expectedAddresses?: string[];
  requireAllExpected?: boolean;
}

export interface SslMonitoringConfig {
  enabled: boolean;
  affectsStatus?: boolean;
  warnDays?: number;
}

export interface MultiLocationMonitoringConfig {
  enabled: boolean;
  affectsStatus?: boolean;
  includePrimaryLocation?: boolean;
  minimumSuccessfulLocations?: number;
  probes?: MonitoringProbe[];
}

export interface TelegramNotificationConfig {
  enabled?: boolean;
  notifyOnDown?: boolean;
  notifyOnRecovery?: boolean;
  notifyOnDns?: boolean;
  notifyOnSsl?: boolean;
  notifyOnLocation?: boolean;
}

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
  dnsMonitoring?: DnsMonitoringConfig;
  sslMonitoring?: SslMonitoringConfig;
  multiLocationMonitoring?: MultiLocationMonitoringConfig;
  telegram?: TelegramNotificationConfig;
  dnsStatus?: "ok" | "error" | "disabled";
  sslStatus?: "ok" | "warning" | "error" | "disabled";
  sslDaysRemaining?: number | null;
  locationStatus?: "ok" | "error" | "disabled";
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
  dnsMonitoring?: DnsMonitoringConfig;
  sslMonitoring?: SslMonitoringConfig;
  multiLocationMonitoring?: MultiLocationMonitoringConfig;
  telegram?: TelegramNotificationConfig;
  dnsStatus?: "ok" | "error" | "disabled";
  dnsAddresses?: string[];
  dnsError?: string | null;
  sslStatus?: "ok" | "warning" | "error" | "disabled";
  sslDaysRemaining?: number | null;
  sslValidTo?: string | null;
  sslError?: string | null;
  locationStatus?: "ok" | "error" | "disabled";
  locationResults?: Array<{
    id: string;
    name: string;
    success: boolean;
    responseTime: number | null;
    statusCode: number | null;
    error: string | null;
  }>;
  lastSslNotificationDate?: string | null;
  lastDnsNotificationState?: string | null;
  lastLocationNotificationState?: string | null;
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
