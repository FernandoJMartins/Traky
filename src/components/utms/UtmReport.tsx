"use client";

import { useMemo, useState } from "react";
import type { UtmData, UtmDim } from "@/lib/queries";
import { money, num, percent } from "@/lib/format";
import { Search, ArrowUpDown, Link2 } from "lucide-react";

const DIM_TABS: { k: UtmDim; label: string }[] = [
  { k: "utm_source", label: "Source" },
  { k: "utm_campaign", label: "Campaign" },
  { k: "utm_medium", label: "Medium" },
  { k: "utm_content", label: "Content" },
  { k: "utm_term", label: "Term" },
];

type Group = NonNullable<UtmData>["dimensions"]["utm_source"][number];
type SortKey = "value" | "approved" | "pending" | "revenueCents" | "pendingRevenueCents" | "avgTicket" | "share";

export function UtmReport({ data }: { data: NonNullable<UtmData> }) {
  const [dim, setDim] = useState<UtmDim>("utm_source");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("revenueCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const totalRev = data.totals.revenueCents || 1;
  const rows = data.dimensions[dim];

  const derived = useMemo(() => {
    const withCalc = rows.map((g) => ({
      ...g,
      avgTicket: g.approved > 0 ? g.revenueCents / g.approved : 0,
      share: g.revenueCents / totalRev,
    }));
    const filtered = withCalc.filter((g) => !search || g.value.toLowerCase().includes(search.toLowerCase()));
    return filtered.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, sortKey, sortDir, totalRev]);

  function sortBy(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }

  const COLS: { key: SortKey; label: string; render: (g: Group & { avgTicket: number; share: number }) => React.ReactNode }[] = [
    { key: "approved", label: "Vendas", render: (g) => num(g.approved) },
    { key: "pending", label: "Pendentes", render: (g) => num(g.pending) },
    { key: "revenueCents", label: "Faturamento", render: (g) => money(g.revenueCents) },
    { key: "pendingRevenueCents", label: "Fat. Pendente", render: (g) => <span className="text-warn">{money(g.pendingRevenueCents)}</span> },
    { key: "avgTicket", label: "Ticket Médio", render: (g) => money(g.avgTicket) },
    { key: "share", label: "% do Fat.", render: (g) => percent(g.share) },
  ];

  return (
    <div className="space-y-4">
      {/* Dimensão */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-panel p-1 w-fit">
          {DIM_TABS.map((t) => (
            <button key={t.k} onClick={() => setDim(t.k)}
              className={`px-3 py-1.5 text-sm rounded-md ${dim === t.k ? "bg-accent text-bg font-medium" : "text-muted hover:text-text"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Buscar ${dim}...`}
            className="w-full rounded-lg border border-line bg-panel-2 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Vendas Aprovadas" value={num(data.totals.approved)} tone="pos" />
        <Stat label="Vendas Pendentes" value={num(data.totals.pending)} tone="warn" />
        <Stat label="Faturamento" value={money(data.totals.revenueCents)} />
        <Stat label="Faturamento Pendente" value={money(data.totals.pendingRevenueCents)} tone="warn" />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-line bg-panel/70 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-line">
              <th className="py-2.5 px-3 font-medium">
                <button onClick={() => sortBy("value")} className="flex items-center gap-1 hover:text-text">
                  <Link2 size={13} /> {DIM_TABS.find((t) => t.k === dim)?.label} <ArrowUpDown size={12} />
                </button>
              </th>
              {COLS.map((c) => (
                <th key={c.key} className="py-2.5 px-3 font-medium text-right">
                  <button onClick={() => sortBy(c.key)} className="flex items-center gap-1 hover:text-text ml-auto">{c.label} <ArrowUpDown size={12} /></button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {derived.map((g) => (
              <tr key={g.value} className="border-b border-line/60 hover:bg-panel-2/50">
                <td className="py-2.5 px-3">
                  <span className={`truncate max-w-[280px] inline-block align-bottom ${g.value === "(não definido)" ? "text-faint italic" : ""}`}>{g.value}</span>
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className="py-2.5 px-3 tabular text-right">{c.render(g)}</td>
                ))}
              </tr>
            ))}
            {derived.length === 0 && (
              <tr><td colSpan={COLS.length + 1} className="py-10 text-center text-faint">Nenhuma venda com esse UTM no período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-faint">
        {derived.length} valor(es) de {DIM_TABS.find((t) => t.k === dim)?.label} · dados das suas vendas (nosso banco), período e dashboard atuais.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "warn" }) {
  const cls = tone === "pos" ? "text-pos" : tone === "warn" ? "text-warn" : "text-text";
  return (
    <div className="rounded-xl border border-line bg-panel/70 px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular ${cls}`}>{value}</div>
    </div>
  );
}
