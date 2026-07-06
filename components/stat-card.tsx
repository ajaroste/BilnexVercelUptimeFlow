import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";

export function StatCard({ label, value, hint, icon: Icon, tone = "slate", trend }: {
  label: string; value: string | number; hint: string; icon: LucideIcon;
  tone?: "green" | "red" | "blue" | "slate"; trend?: "up" | "down";
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10",
    red: "bg-rose-50 text-rose-600 dark:bg-rose-500/10",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800",
  };
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p></div>
        <span className={`rounded-xl p-2 ${tones[tone]}`}><Icon className="size-4" /></span>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
        {trend === "up" && <ArrowUpRight className="size-3.5 text-emerald-500" />}
        {trend === "down" && <ArrowDownRight className="size-3.5 text-rose-500" />}
        {hint}
      </p>
    </div>
  );
}
