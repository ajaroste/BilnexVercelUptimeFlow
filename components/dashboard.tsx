"use client";

import { useMemo, useState } from "react";
import { Activity, CircleOff, RefreshCw, Server, ShieldCheck, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { ServiceCard } from "@/components/service-card";
import { Select } from "@/components/select";
import { useServices } from "@/components/service-provider";

export function Dashboard() {
  const { services, healthLogs, loading, error, refetch } = useServices();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const enabled = services.filter((s) => s.enabled);
  const up = enabled.filter((s) => s.currentStatus === "up").length;
  const down = enabled.filter((s) => s.currentStatus === "down").length;
  const average = enabled.length ? enabled.reduce((sum, s) => sum + s.uptime24h, 0) / enabled.length : 0;

  const filtered = useMemo(() => services.filter((service) => {
    const matchesQuery = `${service.name} ${service.url} ${service.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "all" || (status === "disabled" ? !service.enabled : service.currentStatus === status);
    return matchesQuery && matchesStatus;
  }), [services, query, status]);

  async function handleTrigger() {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await fetch("/api/check/trigger", { method: "POST" });
      const data = await res.json() as { checked?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Hata");
      setTriggerMsg({ text: `${data.checked ?? 0} servis kontrol edildi`, ok: true });
      await refetch();
    } catch (e) {
      setTriggerMsg({ text: e instanceof Error ? e.message : "Kontrol başarısız", ok: false });
    } finally {
      setTriggering(false);
      setTimeout(() => setTriggerMsg(null), 4000);
    }
  }

  const allOperational = enabled.length > 0 && down === 0;

  return (
    <AppShell>
      {/* ── Başlık ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">İzleme Paneli</h1>
          <p className="mt-0.5 text-xs text-slate-400">{new Date().toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Manuel Kontrol: yalnızca geliştirme ortamında görünür */}
          {process.env.NODE_ENV === "development" && (
            <div className="relative">
              <button
                id="manual-trigger-btn"
                className="btn-secondary"
                onClick={() => void handleTrigger()}
                disabled={triggering}
              >
                <Zap className={`size-4 ${triggering ? "animate-pulse text-amber-500" : ""}`} />
                {triggering ? "Kontrol ediliyor…" : "Manuel Kontrol"}
              </button>
              {triggerMsg && (
                <div className={`absolute right-0 top-full z-10 mt-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold shadow-soft ${triggerMsg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400"}`}>
                  {triggerMsg.text}
                </div>
              )}
            </div>
          )}
          <button className="btn-secondary" onClick={() => void refetch()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Durum Banner ── */}
      {!loading && enabled.length > 0 && (
        <div className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${allOperational ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"}`}>
          <span className={`size-2 rounded-full ${allOperational ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
          {allOperational ? `Tüm ${enabled.length} sistem operasyonel` : `${down} servis kapalı · ${up} servis aktif`}
        </div>
      )}

      {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}

      {/* ── İstatistik Kartları ── */}
      {services.length > 0 && <>
        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Toplam Servis"    value={services.length}        hint={`${enabled.length} aktif`}      icon={Server}      tone="blue"  />
          <StatCard label="Aktif"            value={up}                     hint="UP"                              icon={Activity}    tone="green" trend="up"                          />
          <StatCard label="Kapalı"           value={down}                   hint={down ? "Müdahale gerekli" : "Kesinti yok"} icon={CircleOff} tone="red" trend={down ? "down" : undefined} />
          <StatCard label="Ort. Uptime (24s)" value={`%${average.toFixed(2)}`} hint="Son 24 saat"                icon={ShieldCheck}  tone="slate" />
        </section>

        {/* ── Servis Listesi ── */}
        <section className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Servisler</h2>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ara</span>
                <input
                  aria-label="Servis ara"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="input h-9 w-full text-sm sm:w-52"
                  placeholder="Ada veya etikete göre…"
                />
              </div>
              <Select
                label="Durum"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all",      label: "Tümü" },
                  { value: "up",       label: "Aktif" },
                  { value: "down",     label: "Kapalı" },
                  { value: "disabled", label: "Pasif" },
                ]}
                className="min-w-[130px]"
              />
            </div>
          </div>

          {filtered.length
            ? <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map(service => (
                  <ServiceCard key={service.id} service={service} logs={healthLogs.filter(l => l.serviceId === service.id)} />
                ))}
              </div>
            : <div className="card mt-4 grid place-items-center py-14 text-center">
                <p className="text-sm font-semibold text-slate-400">Eşleşen servis bulunamadı</p>
              </div>
          }
        </section>
      </>}

      {loading && <div className="card mt-7 grid place-items-center py-16"><RefreshCw className="size-6 animate-spin text-brand-500" /></div>}
    </AppShell>
  );
}
