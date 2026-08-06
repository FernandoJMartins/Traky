import { money, percent } from "@/lib/format";

// ---- Funil de conversão (Meta Ads) — trapézios conectados = funil de verdade ----
const FUNNEL_COLORS = ["#6c8cff", "#7c7bf0", "#9370e6", "#a86fd8", "#a78bfa"];
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  // Largura relativa ao MAIOR passo (evita estouro quando o topo é 0).
  const max = Math.max(...steps.map((s) => s.value), 1);
  const frac = (v: number) => Math.max((v / max) * 100, 10); // mín 10% p/ visibilidade
  const widths = steps.map((s) => frac(s.value));

  return (
    <div>
      {/* Corpo do funil: cada faixa é um trapézio que conecta na largura da faixa seguinte */}
      <div className="w-full">
        {steps.map((s, i) => {
          const topW = widths[i];
          const topValue = steps[0]?.value || 1;
          // Cada passo do funil no máximo 100% (nunca "sobe" acima do topo).
          const percentage = Math.min((s.value / topValue) * 100, 100);
          const botW = widths[i + 1] ?? topW * 0.7; // última faixa afunila até a "boca"
          const tl = (100 - topW) / 2, tr = (100 + topW) / 2;
          const bl = (100 - botW) / 2, br = (100 + botW) / 2;
          return (
            <div
              key={s.label}
              className="h-12 flex items-center justify-center text-sm font-semibold text-bg tabular transition-all"
              style={{
                background: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                clipPath: `polygon(${tl}% 0, ${tr}% 0, ${br}% 100%, ${bl}% 100%)`,
              }}
              title={`${s.label}: ${s.value.toLocaleString("pt-BR")}`}
            >
              {percentage.toFixed(1)}%
            </div>
          );
        })}
      </div>

      {/* Legenda: nome, valor e taxa de conversão do passo anterior */}
      <ul className="mt-3 space-y-1.5">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].value : s.value;
          const rate = prev > 0 ? Math.min(s.value / prev, 1) : 0;
          return (
            <li key={s.label} className="flex items-center gap-2 text-xs">
              <span className="size-2.5 rounded-full shrink-0" style={{ background: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
              <span className="text-muted">{s.label}</span>
              <span className="ml-auto tabular font-medium">{s.value.toLocaleString("pt-BR")}</span>
              <span className="text-faint tabular w-14 text-right">{i > 0 ? percent(rate) : "—"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---- Lista com barra (por fonte / produto) ----
export function BarList({
  items,
  empty = "Nenhuma venda por aqui",
}: {
  items: { label: string; valor: number }[];
  empty?: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-faint py-6 text-center">{empty}</p>;
  }
  const max = Math.max(...items.map((i) => i.valor), 1);
  return (
    <ul className="space-y-2.5">
      {items.slice(0, 6).map((it) => (
        <li key={it.label}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="truncate pr-2">{it.label}</span>
            <span className="tabular text-muted shrink-0">R$ {it.valor.toLocaleString("pt-BR")}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-panel-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-violet"
              style={{ width: `${(it.valor / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---- Taxa de aprovação por método ----
export function ApprovalRates({
  rows,
}: {
  rows: { method: string; rate: number | null; total: number; approved: number }[];
}) {
  const label: Record<string, string> = { card: "Cartão", pix: "Pix", boleto: "Boleto" };
  return (
    <div className="grid grid-cols-3 gap-3">
      {rows.map((r) => (
        <div key={r.method} className="rounded-lg bg-panel-2 p-3 text-center">
          <div className="text-xs text-muted">{label[r.method]}</div>
          <div className="mt-1 text-lg font-semibold tabular text-pos">{percent(r.rate)}</div>
          <div className="text-[11px] text-faint">
            {r.approved}/{r.total}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Total de taxas / pequenos KPIs de rodapé ----
export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-panel-2 px-3 py-2.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="tabular font-medium">{value}</span>
    </div>
  );
}

export { money };
