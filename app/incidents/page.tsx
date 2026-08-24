"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useServices } from "@/components/service-provider";
import { Select } from "@/components/select";
import { formatDuration } from "@/lib/utils";
import { Incident } from "@/types";

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startIso(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function endIso(value: string) {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

export default function IncidentsPage() {
  const { services, loading: servicesLoading, error: servicesError } = useServices();
  const today = useMemo(() => dateInput(new Date()), []);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const serviceOptions = [
    { value: "all", label: "Tüm Servisler" },
    ...services.map(s => ({ value: s.id, label: s.name })),
  ];

  const statusOptions = [
    { value: "all", label: "Tüm Durumlar" },
    { value: "open", label: "Devam Ediyor" },
    { value: "resolved", label: "Çözüldü" },
  ];

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          from: startIso(dateFrom),
          to: endIso(dateTo),
          serviceId: serviceFilter,
          status: statusFilter,
          limit: "500",
        });
        const response = await fetch(`/api/incidents?${params.toString()}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Kesinti kayıtları alınamadı.");
        setIncidents(data.incidents ?? []);
        setError(null);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "Kesinti kayıtları alınamadı.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [dateFrom, dateTo, serviceFilter, statusFilter]);

  function setPreset(kind: "today" | "yesterday" | "week") {
    const end = new Date();
    const start = new Date();
    if (kind === "yesterday") {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else if (kind === "week") {
      start.setDate(start.getDate() - 6);
    }
    setDateFrom(dateInput(start));
    setDateTo(dateInput(end));
  }

  function resetFilters() {
    setServiceFilter("all");
    setStatusFilter("all");
    setDateFrom(today);
    setDateTo(today);
  }

  const hasFilter = serviceFilter !== "all" || statusFilter !== "all" || dateFrom !== today || dateTo !== today;

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Kesinti Geçmişi</h1>
          <p className="mt-1 text-xs text-slate-400">İlk açılışta yalnızca bugünün kayıtları yüklenir.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{incidents.length} kayıt</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-secondary text-xs" onClick={() => setPreset("today")}>Bugün</button>
        <button className="btn-secondary text-xs" onClick={() => setPreset("yesterday")}>Dün</button>
        <button className="btn-secondary text-xs" onClick={() => setPreset("week")}>Son 7 gün</button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Select label="Servis" value={serviceFilter} onChange={setServiceFilter} options={serviceOptions} className="min-w-[190px] flex-1 sm:flex-none" />
        <Select label="Durum" value={statusFilter} onChange={setStatusFilter} options={statusOptions} className="min-w-[160px] flex-1 sm:flex-none" />

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tarih Aralığı</span>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]" />
            <span className="text-xs text-slate-400">–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]" />
          </div>
        </div>

        {hasFilter && (
          <button onClick={resetFilters} className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700">
            <X className="size-3.5" />Temizle
          </button>
        )}
      </div>

      {(error || servicesError) && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error ?? servicesError}</div>}

      {(loading || servicesLoading) ? (
        <div className="card mt-5 grid min-h-48 place-items-center"><RefreshCw className="size-6 animate-spin text-brand-500" /></div>
      ) : incidents.length > 0 ? (
        <div className="card mt-5 overflow-hidden">
          {incidents.map((incident, index) => {
            const service = services.find(item => item.id === incident.serviceId);
            const open = !incident.endTime;
            return (
              <div key={incident.id} className={`flex gap-4 px-5 py-4 ${index ? "border-t" : ""}`}>
                <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${open ? "bg-rose-50 text-rose-500 dark:bg-rose-500/10" : "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10"}`}>
                  {open ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><span className="text-sm font-semibold">{service?.name ?? incident.serviceId}</span>{service && <span className="ml-2 text-[10px] text-slate-400">{service.url}</span>}</div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${open ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>{open ? "DEVAM EDİYOR" : "ÇÖZÜLDÜ"}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{incident.reason}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><Clock3 className="size-3" />{new Date(incident.startTime).toLocaleString("tr-TR")}</span>
                    {incident.endTime && <span className="flex items-center gap-1"><CheckCircle2 className="size-3 text-emerald-500" />{new Date(incident.endTime).toLocaleString("tr-TR")}</span>}
                    <span className="font-medium text-slate-500">{formatDuration(incident.duration)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card mt-5 grid place-items-center py-16 text-center">
          <CheckCircle2 className="size-8 text-emerald-400" />
          <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Seçilen tarih aralığında kesinti kaydı bulunmuyor</p>
        </div>
      )}
    </AppShell>
  );
}
