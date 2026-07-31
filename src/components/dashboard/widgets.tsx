import { money, percent } from "@/lib/format";

// ---- Funil de conversão (Meta Ads) — formato de funil de verdade ----
const FUNNEL_COLORS = ["#6c8cff", "#7c7bf0", "#9370e6", "#a86fd8", "#a78bfa"];
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  // Largura relativa ao MAIOR passo (evita estouro quando o topo é 0 e passos
  // seguintes são maiores — ex: sem dados da Meta, só vendas do nosso banco).
  const top = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className="flex flex-col items-center gap-1 py-1 w-full overflow-hidden">
      {steps.map((s, i) => {
        const w = Math.min(Math.max((s.value / top) * 100, 6), 100);
        const prev = i > 0 ? steps[i - 1].value : s.value;
        const stepRate = prev > 0 ? s.value / prev : 0;
        return (
          <div key={s.label} className="w-full flex flex-col items-center">
            <div
              className="h-11 rounded-md flex items-center justify-center transition-all"
              style={{ width: `${w}%`, background: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }}
            >
              <span className="text-sm font-semibold text-bg tabular">
                {s.value.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted mt-0.5 mb-0.5">
              <span>{s.label}</span>
              {i > 0 && <span className="text-faint">· {percent(stepRate)}</span>}
            </div>
          </div>
        );
      })}
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
