"use client";

import { use } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Gauge, ShieldCheck, TrendingUp } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useServices } from "@/components/service-provider";
import { ResponseChart } from "@/components/response-chart";
import { UptimeBar90 } from "@/components/uptime-bar";
import { formatRelativeDate } from "@/lib/utils";

/** Response time → colour */
function responseColor(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 200) return "text-emerald-600 dark:text-emerald-400";
  if (ms < 500) return "text-amber-500 dark:text-amber-400";
  return "text-rose-500 dark:text-rose-400";
}

/** Uptime % → badge colour */
function uptimeBadge(pct: number) {
  if (pct >= 99) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
  if (pct >= 95) return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
  return "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400";
}

export default function ServiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { services, healthLogs, loading } = useServices();
  const service = services.find(s => s.id === id);
  if (loading) return <AppShell><div className="card grid min-h-64 place-items-center text-sm text-slate-500">Veriler yükleniyor…</div></AppShell>;
  if (!service) notFound();
  const logs = healthLogs.filter(log => log.serviceId === id);

  return (
    <AppShell>
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-950 dark:hover:text-white">
        <ArrowLeft className="size-4" />Dashboard
      </Link>

      {/* Header */}
      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span className={`mt-2 size-3 rounded-full ${service.currentStatus === "up" ? "bg-brand-400 shadow-[0_0_0_6px_rgba(67,212,174,.12)]" : "bg-rose-500 shadow-[0_0_0_6px_rgba(244,63,94,.12)]"}`} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{service.name}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${service.currentStatus === "up" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : service.currentStatus === "down" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                {service.currentStatus === "up" ? "AKTİF" : service.currentStatus === "down" ? "KAPALI" : "BEKLİYOR"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 break-all">{service.url}</p>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat icon={ShieldCheck} label="24 saat uptime" value={`%${service.uptime24h.toFixed(2)}`} />
        <MiniStat icon={Gauge} label="Ortalama yanıt" value={`${service.avgResponseTime} ms`} valueClass={responseColor(service.avgResponseTime)} />
        <MiniStat icon={CheckCircle2} label="Son HTTP kodu" value={service.lastStatusCode ?? "—"} />
        <MiniStat icon={Clock3} label="Son kontrol" value={formatRelativeDate(service.lastChecked)} />
      </div>

      {/* Uptime badges — 7d / 30d / 90d */}
      <div className="mt-4 flex flex-wrap gap-2">
        <UptimeBadge label="7 günlük" value={service.uptime7d} />
        <UptimeBadge label="30 günlük" value={service.uptime30d} />
        <UptimeBadge label="Genel" value={service.uptime24h} icon={TrendingUp} />
      </div>

      {/* 90-day uptime bar */}
      <div className="mt-5">
        <UptimeBar90 logs={logs} />
      </div>

      {/* Response time chart */}
      {logs.length > 1 && (
        <section className="card mt-5 min-w-0 p-4">
          <div>
            <h2 className="font-bold">Yanıt süresi</h2>
            <p className="mt-1 text-xs text-slate-400">Yanıt süresi geçmişi · milisaniye</p>
          </div>
          <div className="mt-2 min-w-0 overflow-hidden">
            <ResponseChart logs={logs.slice().reverse()} />
          </div>
        </section>
      )}

      {/* Last checks table */}
      {logs.length > 0 && (
        <section className="card mt-6 overflow-hidden">
          <div className="border-b p-4">
            <h2 className="font-bold">Son kontroller</h2>
            <p className="mt-1 text-xs text-slate-400">Health check sonuçları</p>
          </div>

          {/* Mobile */}
          <div className="divide-y sm:hidden">
            {logs.slice(0, 6).map(log => (
              <div key={log.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={`inline-flex items-center gap-2 text-sm font-medium ${log.success ? "text-emerald-600" : "text-rose-600"}`}>
                    <span className={`size-2 rounded-full ${log.success ? "bg-emerald-500" : "bg-rose-500"}`} />
                    {log.success ? "Başarılı" : "Hata"}
                  </span>
                  <span className={`text-xs font-semibold ${responseColor(log.responseTime)}`}>{log.responseTime} ms</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{new Date(log.timestamp).toLocaleString("tr-TR")} · HTTP {log.statusCode ?? "—"}</p>
                {(log.error || log.response) && <p className="mt-2 truncate text-xs text-slate-500">{log.error ?? log.response}</p>}
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden overflow-hidden sm:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400 dark:bg-slate-900">
                <tr>
                  <th className="w-[18%] px-4 py-3">Durum</th>
                  <th className="w-[25%] px-4 py-3">Zaman</th>
                  <th className="w-[12%] px-4 py-3">HTTP</th>
                  <th className="w-[15%] px-4 py-3">Yanıt</th>
                  <th className="px-4 py-3">Sonuç</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 6).map(log => (
                  <tr key={log.id} className="border-t">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-2 font-medium ${log.success ? "text-emerald-600" : "text-rose-600"}`}>
                        <span className={`size-2 rounded-full ${log.success ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {log.success ? "Başarılı" : "Hata"}
                      </span>
                    </td>
                    <td className="truncate px-4 py-3 text-slate-500">{new Date(log.timestamp).toLocaleString("tr-TR")}</td>
                    <td className="px-4 py-3 font-mono">{log.statusCode}</td>
                    <td className={`px-4 py-3 font-semibold ${responseColor(log.responseTime)}`}>{log.responseTime} ms</td>
                    <td className="truncate px-4 py-3 text-slate-500">{log.error ?? log.response}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}

function MiniStat({ icon: Icon, label, value, valueClass }: { icon: typeof Gauge; label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="card flex min-w-0 items-center gap-3 p-4">
      <span className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400">{label}</p>
        <p className={`mt-0.5 truncate font-bold ${valueClass ?? ""}`}>{value}</p>
      </div>
    </div>
  );
}

function UptimeBadge({ label, value, icon: Icon }: { label: string; value: number; icon?: typeof TrendingUp }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${uptimeBadge(value)}`}>
      {Icon && <Icon className="size-3" />}
      {label}: %{value.toFixed(2)}
    </span>
  );
}
