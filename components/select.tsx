"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  placeholder?: string;
  className?: string;
}

export function Select({ value, onChange, options, label, placeholder = "Seçiniz", className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Esc ile kapat
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className={cn("flex flex-col gap-1", className)} ref={ref}>
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      )}
      <div className="relative">
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-xl border px-3 text-sm font-medium transition-all",
            "border-slate-200 bg-white text-slate-800",
            "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
            "hover:border-slate-300 dark:hover:border-slate-600",
            open && "border-brand-500 ring-2 ring-brand-500/15 dark:border-brand-500",
          )}
        >
          <span className="text-left leading-tight">{selected?.label ?? placeholder}</span>
          <ChevronDown className={cn("size-3.5 shrink-0 text-slate-400 transition-transform duration-150", open && "rotate-180")} />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className={cn(
            "absolute left-0 z-50 mt-1.5 min-w-full overflow-hidden rounded-xl border shadow-soft",
            "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
          )}>
            {options.map(option => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { onChange(option.value); setOpen(false); }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60",
                  )}
                >
                  <span className="text-left leading-tight">{option.label}</span>
                  {isSelected && <Check className="size-3.5 shrink-0 text-brand-500" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
