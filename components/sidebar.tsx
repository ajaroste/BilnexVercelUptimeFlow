"use client";

import { BarChart3, LayoutDashboard, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Genel Bakış", href: "/", icon: LayoutDashboard },
  { name: "Olaylar", href: "/incidents", icon: ShieldCheck },
  { name: "Raporlar", href: "/reports", icon: BarChart3 },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {open && <button aria-label="Menüyü kapat" className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r bg-white px-3 py-4 transition-transform dark:bg-[#0b111e] lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex min-w-0 items-center" onClick={onClose}>
            <Image src="/bilnex.png" alt="Bilnex" width={160} height={48} priority className="h-11 w-auto max-w-[165px] object-contain object-left" />
          </Link>
          <button className="rounded-lg p-1.5 text-slate-500 lg:hidden" onClick={onClose}><X className="size-5" /></button>
        </div>
        <div className="mt-6 px-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Modüller</div>
        <nav className="mt-3 space-y-1">
          {navigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} onClick={onClose} className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                active ? "bg-slate-950 text-white dark:bg-slate-800" : "text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-900 dark:hover:text-white"
              )}>
                <item.icon className="size-[18px]" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
