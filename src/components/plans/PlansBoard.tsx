"use client";

import { Check, Zap, Star } from "lucide-react";
import type { Plan } from "@/lib/plans";

function priceLabel(cents: number): string {
  if (cents === 0) return "Grátis";
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PlansBoard({ plans, current }: { plans: Plan[]; current: string }) {
  function subscribe(name: string) {
    alert(`Assinatura do plano ${name} — integração de pagamento em breve. 🙂`);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {plans.map((p) => {
        const isCurrent = p.id === current;
        return (
          <div key={p.id}
            className={`relative rounded-2xl border p-5 flex flex-col bg-panel/70 ${p.highlight ? "border-accent" : "border-line"} ${isCurrent ? "ring-1 ring-accent" : ""}`}>
            {p.highlight && (
              <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-bg">
                <Star size={11} /> Popular
              </span>
            )}
            <div className="font-semibold text-lg">{p.name}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold">{priceLabel(p.priceCents)}</span>
              {p.priceCents > 0 && <span className="text-sm text-faint">/mês</span>}
            </div>
            <ul className="mt-4 space-y-2 flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm">
                  <Check size={15} className="text-pos mt-0.5 shrink-0" /> <span className="text-muted">{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              {isCurrent ? (
                <div className="rounded-lg bg-panel-2 text-center py-2 text-sm text-muted">Plano atual</div>
              ) : (
                <button onClick={() => subscribe(p.name)}
                  className={`w-full rounded-lg py-2 text-sm font-medium inline-flex items-center justify-center gap-1.5 ${p.highlight ? "bg-accent text-bg hover:opacity-90" : "border border-line hover:bg-panel-2"}`}>
                  <Zap size={14} /> {p.priceCents === 0 ? "Começar" : "Assinar"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
