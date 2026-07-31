import type { AwardsData } from "@/lib/queries";
import { Trophy, Lock, Check } from "lucide-react";

// Marcos. value = limiar; label = rótulo curto.
const SALES_MILESTONES = [100, 1_000, 10_000, 50_000, 100_000, 500_000, 1_000_000];
const REVENUE_MILESTONES_CENTS = [
  1_000_00, 10_000_00, 100_000_00, 500_000_00, 1_000_000_00, 5_000_000_00, 10_000_000_00,
];

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}K`;
  return n.toLocaleString("pt-BR");
}
function compactBRL(cents: number): string {
  const r = cents / 100;
  if (r >= 1_000_000) return `R$ ${(r / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (r >= 1_000) return `R$ ${(r / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}K`;
  return `R$ ${r.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

export function AwardsBoard({ data }: { data: NonNullable<AwardsData> }) {
  return (
    <div className="space-y-6">
      <Track
        title="Vendas Trackeadas"
        subtitle="Toda venda que passou pelo seu rastreamento conta aqui."
        current={data.trackedSales}
        milestones={SALES_MILESTONES}
        fmt={compactNum}
        unit="vendas"
      />
      <Track
        title="Faturamento Rastreado"
        subtitle="Soma do faturamento das vendas aprovadas."
        current={data.trackedRevenueCents}
        milestones={REVENUE_MILESTONES_CENTS}
        fmt={compactBRL}
        unit=""
      />
    </div>
  );
}

function Track({
  title, subtitle, current, milestones, fmt, unit,
}: {
  title: string; subtitle: string; current: number; milestones: number[]; fmt: (n: number) => string; unit: string;
}) {
  const achievedCount = milestones.filter((m) => current >= m).length;
  const nextIdx = milestones.findIndex((m) => current < m);
  const next = nextIdx >= 0 ? milestones[nextIdx] : null;
  const prev = nextIdx > 0 ? milestones[nextIdx - 1] : 0;
  const progress = next ? Math.min(1, (current - prev) / (next - prev)) : 1;

  return (
    <div className="rounded-2xl border border-line bg-panel/70 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold">
            <Trophy size={18} className="text-warn" /> {title}
          </div>
          <p className="text-sm text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular text-accent">{fmt(current)}</div>
          <div className="text-xs text-faint">{achievedCount}/{milestones.length} conquistas</div>
        </div>
      </div>

      {/* Progresso pro próximo marco */}
      {next ? (
        <div>
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>Próxima meta: <span className="text-text font-medium">{fmt(next)} {unit}</span></span>
            <span className="tabular">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-panel-2 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-accent to-pos" style={{ width: `${Math.max(progress * 100, 2)}%` }} />
          </div>
          <div className="text-[11px] text-faint mt-1">
            Faltam {fmt(Math.max(next - current, 0))} {unit} pra desbloquear.
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-pos/10 text-pos text-sm px-3 py-2">🏆 Todos os marcos conquistados. Lendário.</div>
      )}

      {/* Medalhas */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {milestones.map((m) => {
          const achieved = current >= m;
          return (
            <div key={m}
              className={`rounded-xl border p-3 text-center ${achieved ? "border-warn/40 bg-warn/10" : "border-line bg-panel-2/40"}`}>
              <div className={`mx-auto size-9 rounded-full grid place-items-center ${achieved ? "bg-warn/20 text-warn" : "bg-panel-2 text-faint"}`}>
                {achieved ? <Check size={18} /> : <Lock size={15} />}
              </div>
              <div className={`mt-1.5 text-sm font-semibold tabular ${achieved ? "text-text" : "text-faint"}`}>{fmt(m)}</div>
              <div className="text-[10px] text-faint">{achieved ? "Conquistado" : "Bloqueado"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
