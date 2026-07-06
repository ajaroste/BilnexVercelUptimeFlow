"use client";

import { useMemo, useState } from "react";
import { HealthLog } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" for a given Date in local time */
function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type DayStatus = "up" | "down" | "partial" | "no-data";

interface DayData {
  dateKey: string;          // "YYYY-MM-DD"
  label: string;            // "6 Tem 2026"
  status: DayStatus;
  uptimePct: number | null; // null when no-data
  totalChecks: number;
  failedChecks: number;
}

function buildDays(logs: HealthLog[], dayCount: number): DayData[] {
  // Group logs by date key
  const byDay = new Map<string, HealthLog[]>();
  for (const log of logs) {
    const key = toDateKey(new Date(log.timestamp));
    const arr = byDay.get(key) ?? [];
    arr.push(log);
    byDay.set(key, arr);
  }

  const days: DayData[] = [];
  const today = new Date();

  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateKey = toDateKey(d);
    const label = d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
    const dayLogs = byDay.get(dateKey);

    if (!dayLogs || dayLogs.length === 0) {
      days.push({ dateKey, label, status: "no-data", uptimePct: null, totalChecks: 0, failedChecks: 0 });
    } else {
      const total = dayLogs.length;
      const failed = dayLogs.filter(l => !l.success).length;
      const uptimePct = Number((((total - failed) / total) * 100).toFixed(1));
      let status: DayStatus;
      if (failed === 0) status = "up";
      else if (failed === total) status = "down";
      else status = "partial";
      days.push({ dateKey, label, status, uptimePct, totalChecks: total, failedChecks: failed });
    }
  }
  return days;
}

// ── Sub-components ─────────────────────────────────────────────────────────

const BAR_COLOR: Record<DayStatus, string> = {
  "up":       "bg-emerald-500 hover:bg-emerald-400",
  "down":     "bg-rose-500 hover:bg-rose-400",
  "partial":  "bg-amber-400 hover:bg-amber-300",
  "no-data":  "bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600",
};

const STATUS_LABEL: Record<DayStatus, string> = {
  "up":      "Tüm checkler başarılı",
  "down":    "Tüm checkler başarısız",
  "partial": "Kısmi kesinti",
  "no-data": "Veri yok — izlenmemiş",
};

function DayBar({ day, height }: { day: DayData; height: "full" | "mini" }) {
  const [hovered, setHovered] = useState(false);
  const h = height === "full" ? "h-8" : "h-5";

  return (
    <div
      className="relative flex flex-1 flex-col items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`w-full rounded-sm ${h} ${BAR_COLOR[day.status]} cursor-default transition-colors duration-100`} />

      {/* Tooltip */}
      {hovered && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-soft dark:border-slate-700 dark:bg-slate-900">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{day.label}</p>
          <p className={`mt-0.5 text-[10px] font-medium ${
            day.status === "up" ? "text-emerald-600" :
            day.status === "down" ? "text-rose-500" :
            day.status === "partial" ? "text-amber-500" :
            "text-slate-400"
          }`}>{STATUS_LABEL[day.status]}</p>
          {day.uptimePct !== null && (
            <p className="mt-0.5 text-[10px] text-slate-400">
              Uptime: <span className="font-semibold text-slate-600 dark:text-slate-300">%{day.uptimePct}</span>
              {" · "}{day.totalChecks} check
              {day.failedChecks > 0 && <span className="text-rose-500"> · {day.failedChecks} hata</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── UptimeBar (90-day) ──────────────────────────────────────────────────────

export function UptimeBar90({ logs }: { logs: HealthLog[] }) {
  const days = useMemo(() => buildDays(logs, 90), [logs]);

  // Overall uptime % across days that have data
  const daysWithData = days.filter(d => d.uptimePct !== null);
  const overallUptime = daysWithData.length
    ? (daysWithData.reduce((sum, d) => sum + (d.uptimePct ?? 0), 0) / daysWithData.length).toFixed(2)
    : null;

  const noDataDays = days.filter(d => d.status === "no-data").length;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">90 günlük uptime</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {noDataDays > 0
              ? `${noDataDays} gün için veri yok (gri gösterilir)`
              : "Son 90 günün kesinti geçmişi"}
          </p>
        </div>
        {overallUptime !== null && (
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            Number(overallUptime) >= 99 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" :
            Number(overallUptime) >= 95 ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" :
            "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
          }`}>
            %{overallUptime} uptime
          </span>
        )}
      </div>

      {/* Bar grid */}
      <div className="mt-3 flex gap-0.5">
        {days.map(day => <DayBar key={day.dateKey} day={day} height="full" />)}
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
        <span>90 gün önce</span>
        <div className="flex items-center gap-3">
          <LegendItem color="bg-emerald-500" label="Operasyonel" />
          <LegendItem color="bg-amber-400" label="Kısmi" />
          <LegendItem color="bg-rose-500" label="Kesinti" />
          <LegendItem color="bg-slate-300 dark:bg-slate-600" label="Veri yok" />
        </div>
        <span>Bugün</span>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block size-2 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

// ── MiniUptimeBar (30-day, for service cards) ───────────────────────────────

export function MiniUptimeBar30({ logs }: { logs: HealthLog[] }) {
  const days = useMemo(() => buildDays(logs, 30), [logs]);
  return (
    <div className="flex gap-0.5" title="Son 30 günlük uptime">
      {days.map(day => <DayBar key={day.dateKey} day={day} height="mini" />)}
    </div>
  );
}
