"use client";

import { useState } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Sidebar } from "@/components/sidebar";
import { useServices } from "@/components/service-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const { services, loading } = useServices();

  const enabled = services.filter(s => s.enabled);
  const down    = enabled.filter(s => s.currentStatus === "down").length;
  const operational = !loading && enabled.length > 0 && down === 0;

  return (
    <div className="min-h-screen overflow-x-hidden">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="min-w-0 lg:pl-56">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white/80 px-4 backdrop-blur-xl dark:bg-[#080d18]/80 sm:px-6">
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)}><Menu className="size-5" /></button>
          <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 lg:flex">
            <span className={`size-2 rounded-full ${operational ? "bg-brand-400 shadow-[0_0_0_4px_rgba(67,212,174,.15)]" : down > 0 ? "bg-rose-500 animate-pulse" : "bg-slate-400"}`} />
            {loading ? "Yükleniyor…" : operational ? "Tüm sistemler operasyonel" : down > 0 ? `${down} servis kapalı` : "İzleme aktif"}
          </div>
          <div className="ml-auto flex items-center">
            <button
              aria-label="Temayı değiştir"
              className="rounded-xl border bg-white p-2.5 text-slate-500 hover:text-slate-950 dark:bg-slate-900 dark:hover:text-white"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1320px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

