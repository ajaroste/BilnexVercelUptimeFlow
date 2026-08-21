"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Service } from "@/types";

type ContextValue = {
  services: Service[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const ServiceContext = createContext<ContextValue | null>(null);

export function ServiceProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const response = await fetch("/api/status-data", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Firebase verileri alınamadı.");
      setServices(data.services ?? []);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Veriler alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
    // Sadece küçük servis durum verisi periyodik yenilenir.
    // health_logs / incidents ilgili ekran açıldığında ayrıca sorgulanır.
    const timer = window.setInterval(() => void refetch(), 60_000);
    return () => window.clearInterval(timer);
  }, [refetch]);

  const value = useMemo(() => ({ services, loading, error, refetch }), [services, loading, error, refetch]);
  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>;
}

export function useServices() {
  const context = useContext(ServiceContext);
  if (!context) throw new Error("useServices must be used within ServiceProvider");
  return context;
}
