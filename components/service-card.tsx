"use client";

import { Clock3 } from "lucide-react";
import Link from "next/link";
import { Service, HealthLog } from "@/types";
import { formatRelativeDate } from "@/lib/utils";
import { MiniUptimeBar30 } from "@/components/uptime-bar";

/** Response time → text colour */
function responseColor(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 200) return "text-emerald-600 dark:text-emerald-400";
  if (ms < 500) return "text-amber-500 dark:text-amber-400";
  return "text-rose-500 dark:text-rose-400";
}

export function ServiceCard({ service, logs }: { service: Service; logs: HealthLog[] }) {
  const isUp = service.currentStatus === "up";
  const isDown = service.currentStatus === "down";
  return (
    <article className="card group overflow-hidden">
      <div className={`h-1 ${isUp ? "bg-brand-400" : isDown ? "bg-rose-500" : "bg-slate-300"}`} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className={`mt-1 size-2.5 shrink-0 rounded-full ${isUp ? "bg-brand-400 shadow-[0_0_0_5px_rgba(67,212,174,.12)]" : isDown ? "animate-pulse bg-rose-500 shadow-[0_0_0_5px_rgba(244,63,94,.12)]" : "bg-slate-300"}`} />
          <div className="min-w-0 flex-1">
            <Link href={`/services/${service.id}`} className="font-semibold hover:text-brand-600">{service.name}</Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-y py-3 text-center">
          <Metric
            value={service.lastResponseTime ? `${service.lastResponseTime} ms` : "—"}
            label="Yanıt"
            valueClass={responseColor(service.lastResponseTime)}
          />
          <Metric value={service.lastStatusCode ?? "—"} label="HTTP" />
          <Metric value={`%${service.uptime24h.toFixed(2)}`} label="24s uptime" accent={isDown ? "red" : "green"} />
        </div>

        {/* Mini 30-day uptime bar */}
        <div className="mt-3">
          <MiniUptimeBar30 logs={logs} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-400"><Clock3 className="size-3.5" />{formatRelativeDate(service.lastChecked)}</span>
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${service.enabled ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{service.enabled ? "İzleniyor" : "Pasif"}</span>
        </div>
      </div>
    </article>
  );
}

function Metric({ value, label, accent, valueClass }: { value: string | number; label: string; accent?: "red" | "green"; valueClass?: string }) {
  return (
    <div>
      <p className={`text-sm font-bold ${valueClass ?? (accent === "red" ? "text-rose-500" : accent === "green" ? "text-brand-600 dark:text-brand-400" : "")}`}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
