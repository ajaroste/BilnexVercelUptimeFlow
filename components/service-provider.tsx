"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { HealthLog, Incident, Service } from "@/types";

type ContextValue = {
  services: Service[];
  healthLogs: HealthLog[];
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const ServiceContext = createContext<ContextValue | null>(null);

export function ServiceProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<Service[]>([]);
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const response = await fetch("/api/status-data", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Firebase verileri alınamadı.");
      setServices(data.services ?? []);
      setHealthLogs(data.healthLogs ?? []);
      setIncidents(data.incidents ?? []);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Veriler alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
    const timer = window.setInterval(() => void refetch(), 30_000);
    return () => window.clearInterval(timer);
  }, [refetch]);

  const value = useMemo(() => ({ services, healthLogs, incidents, loading, error, refetch }), [services, healthLogs, incidents, loading, error, refetch]);
  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>;
}

export function useServices() {
  const context = useContext(ServiceContext);
  if (!context) throw new Error("useServices must be used within ServiceProvider");
  return context;
}
