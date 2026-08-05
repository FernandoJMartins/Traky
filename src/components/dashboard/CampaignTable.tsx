import { money, multiple, percent } from "@/lib/format";

type Row = {
  id: string;
  name: string;
  status: string;
  pending: number;
  sales: number;
  spendCents: number;
  revenueCents: number;
  profitCents: number;
  roi: number | null;
  roas: number | null;
  cpaCents: number | null;
};

export function CampaignTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[820px]">
        <thead>
          <tr className="text-left text-xs text-muted border-b border-line">
            <th className="py-2.5 pl-1 font-medium">Campanha</th>
            <th className="py-2.5 px-3 font-medium text-right">Pend.</th>
            <th className="py-2.5 px-3 font-medium text-right">Vendas</th>
            <th className="py-2.5 px-3 font-medium text-right">Gasto</th>
            <th className="py-2.5 px-3 font-medium text-right">Faturamento</th>
            <th className="py-2.5 px-3 font-medium text-right w-[140px]">Lucro</th>
            <th className="py-2.5 px-3 font-medium text-right">ROI</th>
            <th className="py-2.5 px-3 font-medium text-right">ROAS</th>
            <th className="py-2.5 px-3 font-medium text-right">CPA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const positive = r.profitCents >= 0;
            return (
              <tr
                key={r.id}
                className="border-b border-line/60 hover:bg-panel-2/50 transition-colors"
              >
                <td className="py-2.5 pl-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-1.5 rounded-full ${
                        r.status === "active" ? "bg-pos" : "bg-faint"
                      }`}
                      title={r.status === "active" ? "Ativa" : "Pausada"}
                    />
                    <span className="truncate max-w-[220px]">{r.name}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right tabular text-muted">{r.pending}</td>
                <td className="py-2.5 px-3 text-right tabular">{r.sales}</td>
                <td className="py-2.5 px-3 text-right tabular text-muted">{money(r.spendCents)}</td>
                <td className="py-2.5 px-3 text-right tabular">{money(r.revenueCents)}</td>
                <td
                  className={`py-2.5 px-3 text-right tabular font-medium whitespace-nowrap w-[140px] ${
                    positive ? "text-pos" : "text-neg"
                  }`}
                >
                  {money(r.profitCents)}
                </td>
                <td
                  className={`py-2.5 px-3 text-right tabular ${
                    r.roi !== null && r.roi < 0 ? "text-neg" : "text-muted"
                  }`}
                >
                  {r.roi !== null ? percent(r.roi) : "N/A"}
                </td>
                <td className="py-2.5 px-3 text-right tabular text-muted">{multiple(r.roas)}</td>
                <td className="py-2.5 px-3 text-right tabular text-muted">
                  {r.cpaCents !== null ? money(r.cpaCents) : "N/A"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
