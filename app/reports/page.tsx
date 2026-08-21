"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ResponseChart } from "@/components/response-chart";
import { useServices } from "@/components/service-provider";
import { formatDuration, formatRelativeDate } from "@/lib/utils";
import { HealthLog, Incident } from "@/types";

export default function ReportsPage() {
  const { services, loading: servicesLoading, error: servicesError } = useServices();
  const [selectedId, setSelectedId] = useState("");
  const [range, setRange] = useState<"day" | "week" | "month">("day");
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serviceId = selectedId || services[0]?.id || "";
  const service = services.find(item => item.id === serviceId);

  useEffect(() => {
    if (!serviceId) return;
    const controller = new AbortController();
    const to = new Date();
    const duration = range === "day" ? 24 * 60 * 60_000 : range === "week" ? 7 * 24 * 60 * 60_000 : 30 * 24 * 60 * 60_000;
    const from = new Date(to.getTime() - duration);
    const logLimit = range === "day" ? 500 : range === "week" ? 1000 : 2000;

    async function load() {
      setLoading(true);
      try {
        const common = { serviceId, from: from.toISOString(), to: to.toISOString() };
        const [logsResponse, incidentsResponse] = await Promise.all([
          fetch(`/api/health-logs?${new URLSearchParams({ ...common, limit: String(logLimit) })}`, { cache: "no-store", signal: controller.signal }),
          fetch(`/api/incidents?${new URLSearchParams({ ...common, limit: "500" })}`, { cache: "no-store", signal: controller.signal }),
        ]);
        const [logsData, incidentsData] = await Promise.all([logsResponse.json(), incidentsResponse.json()]);
        if (!logsResponse.ok) throw new Error(logsData.error ?? "Health log kayıtları alınamadı.");
        if (!incidentsResponse.ok) throw new Error(incidentsData.error ?? "Kesinti kayıtları alınamadı.");
        setHealthLogs(logsData.healthLogs ?? []);
        setIncidents(incidentsData.incidents ?? []);
        setError(null);
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "Rapor verileri alınamadı.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [serviceId, range]);

  const chartLogs = useMemo(() => healthLogs.slice().reverse(), [healthLogs]);
  const totalDowntime = incidents.reduce((sum, incident) => sum + (incident.duration ?? 0), 0);
  const averageResponse = healthLogs.length
    ? Math.round(healthLogs.reduce((sum, log) => sum + log.responseTime, 0) / healthLogs.length)
    : service?.avgResponseTime ?? 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Raporlar</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Servis raporu</h1>
          <p className="mt-1 text-sm text-slate-500">Yalnızca seçtiğiniz servis ve tarih aralığının verileri Firebase'den yüklenir.</p>
        </div>
        {services.length > 1 && (
          <select aria-label="Rapor servisi" className="input w-full sm:w-64" value={serviceId} onChange={event => setSelectedId(event.target.value)}>
            {services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        )}
      </div>

      {(error || servicesError) && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error ?? servicesError}</div>}
      {(servicesLoading || loading) && <div className="card mt-6 grid min-h-48 place-items-center"><RefreshCw className="size-6 animate-spin text-brand-500" /></div>}

      {!servicesLoading && service && (
        <>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className={`size-2.5 rounded-full ${service.currentStatus === "up" ? "bg-brand-400" : service.currentStatus === "down" ? "bg-rose-500" : "bg-slate-400"}`} />
              <h2 className="text-lg font-bold">{service.name}</h2>
              <span className="text-xs text-slate-400">Son kontrol: {formatRelativeDate(service.lastChecked)}</span>
            </div>
            <div className="inline-flex self-start rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {([["day", "Gün"], ["week", "Hafta"], ["month", "Ay"]] as const).map(([value, label]) => (
                <button key={value} onClick={() => setRange(value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${range === value ? "bg-indigo-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>{label}</button>
              ))}
            </div>
          </div>

          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ReportMetric icon={ShieldCheck} label="24 saat uptime" value={`%${service.uptime24h.toFixed(2)}`} />
            <ReportMetric icon={BarChart3} label="30 gün uptime" value={`%${service.uptime30d.toFixed(2)}`} />
            <ReportMetric icon={Activity} label="Seçili dönem ort. yanıt" value={averageResponse ? `${averageResponse} ms` : "—"} />
            <ReportMetric icon={AlertTriangle} label="Seçili dönem kesinti" value={formatDuration(totalDowntime)} />
          </section>

          {chartLogs.length > 1 && (
            <section className="card mt-5 min-w-0 p-4 sm:p-5">
              <div className="flex items-center justify-between border-b pb-2 dark:border-slate-700"><h3 className="font-bold">API yanıt süresi</h3><span className="text-lg font-bold">{averageResponse} ms</span></div>
              <div className="mt-3 min-w-0 overflow-hidden"><ResponseChart logs={chartLogs} color="#6366f1" height={230} /></div>
            </section>
          )}

          {incidents.length > 0 && (
            <section className="card mt-5 overflow-hidden">
              <div className="border-b px-4 py-3"><h3 className="font-bold">Kesinti kayıtları</h3></div>
              <div className="divide-y">
                {incidents.map(incident => (
                  <div key={incident.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{incident.reason}</p><p className="mt-1 text-xs text-slate-400">{new Date(incident.startTime).toLocaleString("tr-TR")}</p></div>
                    <span className="shrink-0 text-xs font-semibold text-slate-500"><Clock3 className="mr-1 inline size-3.5" />{formatDuration(incident.duration)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}

function ReportMetric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return <div className="card flex items-center gap-3 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon className="size-4" /></span><div className="min-w-0"><p className="text-[11px] text-slate-400">{label}</p><p className="mt-0.5 truncate text-lg font-bold">{value}</p></div></div>;
}
