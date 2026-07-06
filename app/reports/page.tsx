"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ResponseChart } from "@/components/response-chart";
import { useServices } from "@/components/service-provider";
import { formatDuration, formatRelativeDate } from "@/lib/utils";

export default function ReportsPage() {
  const { services, healthLogs, incidents, loading, error } = useServices();
  const [selectedId, setSelectedId] = useState("");
  const [range, setRange] = useState<"day" | "week" | "month">("day");
  const serviceId = selectedId || services[0]?.id || "";
  const service = services.find(item => item.id === serviceId);
  const logs = useMemo(
    () => healthLogs.filter(log => log.serviceId === serviceId).slice().reverse(),
    [healthLogs, serviceId],
  );
  const filteredLogs = useMemo(() => {
    const duration = range === "day" ? 24 * 60 * 60_000 : range === "week" ? 7 * 24 * 60 * 60_000 : 30 * 24 * 60 * 60_000;
    const threshold = Date.now() - duration;
    return logs.filter(log => new Date(log.timestamp).getTime() >= threshold);
  }, [logs, range]);
  const serviceIncidents = useMemo(
    () => incidents.filter(incident => incident.serviceId === serviceId),
    [incidents, serviceId],
  );
  const totalDowntime = serviceIncidents.reduce((sum, incident) => sum + (incident.duration ?? 0), 0);
  const averageResponse = filteredLogs.length
    ? Math.round(filteredLogs.reduce((sum, log) => sum + log.responseTime, 0) / filteredLogs.length)
    : service?.avgResponseTime ?? 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Raporlar</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Servis raporu</h1>
          <p className="mt-1 text-sm text-slate-500">Servis metriklerini ve performans geçmişini inceleyin.</p>
        </div>
        {services.length > 1 && (
          <select aria-label="Rapor servisi" className="input w-full sm:w-64" value={serviceId} onChange={event => setSelectedId(event.target.value)}>
            {services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        )}
      </div>

      {error && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
      {loading && <div className="card mt-6 grid min-h-48 place-items-center"><RefreshCw className="size-6 animate-spin text-brand-500" /></div>}

      {!loading && service && (
        <>
          <div className="mt-6 flex items-center gap-3">
            <span className={`size-2.5 rounded-full ${service.currentStatus === "up" ? "bg-brand-400" : service.currentStatus === "down" ? "bg-rose-500" : "bg-slate-400"}`} />
            <h2 className="text-lg font-bold">{service.name}</h2>
            <span className="text-xs text-slate-400">Son kontrol: {formatRelativeDate(service.lastChecked)}</span>
          </div>
          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ReportMetric icon={ShieldCheck} label="24 saat uptime" value={`%${service.uptime24h.toFixed(2)}`} />
            <ReportMetric icon={BarChart3} label="30 gün uptime" value={`%${service.uptime30d.toFixed(2)}`} />
            <ReportMetric icon={Activity} label="Ortalama yanıt" value={service.avgResponseTime ? `${service.avgResponseTime} ms` : "—"} />
            <ReportMetric icon={AlertTriangle} label="Toplam kesinti" value={formatDuration(totalDowntime)} />
          </section>

          {logs.length > 1 && (
            <section className="card mt-5 min-w-0 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Sistem metrikleri</p>
                <div className="inline-flex self-start rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  {([["day", "Gün"], ["week", "Hafta"], ["month", "Ay"]] as const).map(([value, label]) => (
                    <button key={value} onClick={() => setRange(value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${range === value ? "bg-indigo-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-b pb-2 dark:border-slate-700">
                <h3 className="font-bold">API yanıt süresi</h3>
                {filteredLogs.length > 1 && <span className="text-lg font-bold">{averageResponse} ms</span>}
              </div>

              {filteredLogs.length > 1 && <div className="mt-3 min-w-0 overflow-hidden"><ResponseChart logs={filteredLogs} color="#6366f1" height={230} /></div>}
            </section>
          )}

          <UptimeTimeline incidents={serviceIncidents} currentStatus={service.currentStatus} uptime={service.uptime30d} />

          {serviceIncidents.length > 0 && (
            <section className="card mt-5 overflow-hidden">
              <div className="border-b px-4 py-3"><h3 className="font-bold">Kesinti kayıtları</h3></div>
              <div className="divide-y">
                {serviceIncidents.map(incident => (
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

function UptimeTimeline({ incidents, currentStatus, uptime }: {
  incidents: ReturnType<typeof useServices>["incidents"];
  currentStatus: "up" | "down" | "pending";
  uptime: number;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const days = useMemo(() => Array.from({ length: 90 }, (_, index) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (89 - index));
    const end = new Date(start.getTime() + 24 * 60 * 60_000);
    const matchedIncident = incidents.find(incident => {
      const incidentStart = new Date(incident.startTime).getTime();
      const incidentEnd = incident.endTime ? new Date(incident.endTime).getTime() : Date.now();
      return incidentStart < end.getTime() && incidentEnd >= start.getTime();
    });
    const isTodayDown = index === 89 && currentStatus === "down";
    return {
      date: start,
      state: isTodayDown ? "down" : matchedIncident ? "incident" : "up",
      incident: matchedIncident,
    };
  }), [incidents, currentStatus]);

  const hovered = hoveredIndex !== null ? days[hoveredIndex] : null;
  const tooltipAlign = hoveredIndex === null ? "center" : hoveredIndex > 65 ? "right" : hoveredIndex < 8 ? "left" : "center";

  return (
    <section className="card mt-5 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div><h3 className="font-bold">90 günlük uptime</h3><p className="mt-1 text-xs text-slate-400">Son 90 günün kesinti geçmişi</p></div>
        <span className={`shrink-0 text-xs font-semibold ${currentStatus === "up" ? "text-emerald-500" : currentStatus === "down" ? "text-rose-500" : "text-slate-400"}`}>{currentStatus === "up" ? "Operasyonel" : currentStatus === "down" ? "Kesinti var" : "Bekliyor"}</span>
      </div>

      <div className="relative mt-4">
        <div className="grid h-9 items-stretch gap-[2px]" style={{ gridTemplateColumns: "repeat(90, minmax(2px, 1fr))" }}>
          {days.map((day, index) => (
            <span
              key={day.date.toISOString()}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(current => (current === index ? null : current))}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(current => (current === index ? null : current))}
              tabIndex={0}
              className={`cursor-pointer rounded-[2px] outline-none transition-opacity ${
                day.state === "up" ? "bg-emerald-500" : day.state === "down" ? "bg-rose-500" : "bg-amber-400"
              } ${hoveredIndex !== null && hoveredIndex !== index ? "opacity-50" : ""}`}
            />
          ))}
        </div>

        {hovered && (
          <div
            className="absolute z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            style={{
              top: "100%",
              left: tooltipAlign === "left" ? 0 : tooltipAlign === "right" ? "auto" : `${(hoveredIndex! / 89) * 100}%`,
              right: tooltipAlign === "right" ? 0 : "auto",
              transform: tooltipAlign === "center" ? "translateX(-50%)" : "none",
            }}
          >
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {hovered.date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
            </p>

            {hovered.incident ? (
              <>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-2.5 py-2 dark:bg-amber-500/10">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="size-3.5" /> Kısmi kesinti
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                    {formatDuration(hovered.incident.duration)}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">İlgili</p>
                <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">{hovered.incident.reason}</p>
              </>
            ) : (
              <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">Kesinti kaydı yok</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400"><span>90 gün önce</span><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /><strong className="font-semibold text-slate-500 dark:text-slate-300">%{uptime.toFixed(2)} uptime</strong><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /><span>Bugün</span></div>
    </section>
  );
}

function ReportMetric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon className="size-4" /></span>
      <div className="min-w-0"><p className="text-[11px] text-slate-400">{label}</p><p className="mt-0.5 truncate text-lg font-bold">{value}</p></div>
    </div>
  );
}