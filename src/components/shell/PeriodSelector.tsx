"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronDown, Check } from "lucide-react";

type PeriodKey =
  | "today" | "yesterday" | "7d" | "14d" | "30d" | "this_month" | "max" | "custom";

const OPTIONS: { key: Exclude<PeriodKey, "custom">; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "14d", label: "Últimos 14 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "this_month", label: "Este mês" },
  { key: "max", label: "Máximo" },
];

function fmt(s?: string) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function PeriodSelector({
  current,
  fromStr,
  toStr,
}: {
  current: PeriodKey;
  fromStr?: string;
  toStr?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(fromStr ?? "");
  const [to, setTo] = useState(toStr ?? "");
  const ref = useRef<HTMLDivElement>(null);

  const label =
    current === "custom"
      ? `${fmt(fromStr)} – ${fmt(toStr)}`
      : OPTIONS.find((o) => o.key === current)?.label ?? "Hoje";

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function pick(key: string, extra?: { from: string; to: string }) {
    setBusy(true);
    await fetch("/api/period", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: key, ...extra }),
    });
    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-muted hover:bg-panel-2"
      >
        <Calendar size={15} />
        <span className="max-w-[160px] truncate">{label}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-82 rounded-xl border border-line bg-panel shadow-xl overflow-hidden z-30">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => pick(o.key)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-panel-2 text-left"
            >
              <span className="flex-1">{o.label}</span>
              {o.key === current && <Check size={15} className="text-pos" />}
            </button>
          ))}
          <div className="border-t border-line p-3 space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-faint flex items-center gap-1">
              Período personalizado {current === "custom" && <Check size={12} className="text-pos" />}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="flex-1 rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="text-faint text-xs">até</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="flex-1 rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <button
              onClick={() => from && to && pick("custom", { from, to })}
              disabled={!from || !to || busy}
              className="w-full rounded-lg bg-accent text-bg text-sm py-1.5 font-medium disabled:opacity-40"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
