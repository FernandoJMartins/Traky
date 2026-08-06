"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CampaignsData, CampaignRow } from "@/lib/queries";
import { money, percent, multiple, num, ratio } from "@/lib/format";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import {
  Search, SlidersHorizontal, ArrowUpDown, Check, TrendingUp, Trophy, BarChart3,
  MoreVertical, Pin, Copy, Play, Pause, CopyPlus, DollarSign, Gauge, Trash2, Filter, X, Pencil, AlertTriangle,
  Building2,
  Layers3,
  Mouse,
  MousePointerClick,
  FolderKanban,
  LucideIcon,
} from "lucide-react";

type Col = {
  key: string;
  label: string;
  numeric?: boolean;
  render: (r: CampaignRow) => React.ReactNode;
  value: (r: CampaignRow) => number | string;
};

type Level = "account" | "campaign" | "adset" | "ad";
const LEVELS: { k: Level; label: string; icon: LucideIcon }[] = [
  { k: "account", label: "Contas", icon: Building2 },
  { k: "campaign", label: "Campanhas", icon: FolderKanban },
  { k: "adset", label: "Conjuntos", icon: Layers3 },
  { k: "ad", label: "Anúncios", icon: MousePointerClick },
];
const PARENT_LABEL: Record<Level, string> = { account: "—", campaign: "—", adset: "Campanha", ad: "Conjunto" };

const STATUS_LABEL: Record<string, string> = { active: "Ativo", paused: "Pausado", restricted: "Com restrições" };
const STATUS_CLS: Record<string, string> = {
  active: "bg-pos/15 text-pos", paused: "bg-panel-2 text-faint", restricted: "bg-warn/15 text-warn",
};

// Orçamento: N/A quando 0 (conta = sempre N/A; campanha sem CBO = N/A; conjunto em campanha CBO = N/A).
const budgetCell = (cents: number) => (cents > 0 ? money(cents) : "N/A");

// Veiculação (effective_status da Meta) → rótulo + cor.
const DELIVERY_LABELS: Record<string, string> = {
  ACTIVE: "Ativo", PAUSED: "Pausado", DELETED: "Excluído", ARCHIVED: "Arquivado",
  PENDING_REVIEW: "Em análise", DISAPPROVED: "Reprovado", PREAPPROVED: "Pré-aprovado",
  PENDING_BILLING_INFO: "Pgto pendente", CAMPAIGN_PAUSED: "Campanha pausada",
  ADSET_PAUSED: "Conjunto pausado", IN_PROCESS: "Em processo", WITH_ISSUES: "Com problemas",
  RESTRICTED: "Com restrições",
  DISABLED: "Desativada", UNSETTLED: "Pendência financeira",
};
const DELIVERY_CLS: Record<string, string> = {
  ACTIVE: "bg-pos/15 text-pos",
  DISAPPROVED: "bg-neg/15 text-neg", WITH_ISSUES: "bg-neg/15 text-neg", DISABLED: "bg-neg/15 text-neg",
  PENDING_REVIEW: "bg-warn/15 text-warn", IN_PROCESS: "bg-warn/15 text-warn",
  PENDING_BILLING_INFO: "bg-warn/15 text-warn", UNSETTLED: "bg-warn/15 text-warn",
};
function DeliveryCell({ status, reason }: { status: string | null; reason: string | null }) {
  if (!status) return <span className="text-faint">—</span>;
  const label = DELIVERY_LABELS[status] ?? status;
  const cls = DELIVERY_CLS[status] ?? "bg-panel-2 text-faint";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap ${cls}`}>{label}</span>
      {reason && (
        <span title={reason} className="cursor-help">
          <AlertTriangle size={12} className="text-neg shrink-0" />
        </span>
      )}
    </span>
  );
}

const COLUMNS: Col[] = [
  { key: "status", label: "Status", render: (r) => <span className={`text-[11px] px-1.5 py-0.5 rounded ${STATUS_CLS[r.status]}`}>{STATUS_LABEL[r.status]}</span>, value: (r) => r.status },
  { key: "delivery", label: "Veiculação", render: (r) => <DeliveryCell status={r.effectiveStatus} reason={r.issueReason} />, value: (r) => r.effectiveStatus ?? "" },
  { key: "parent", label: "Pai", render: (r) => r.parentName ?? "—", value: (r) => r.parentName ?? "" },
  { key: "accountName", label: "Conta", render: (r) => r.accountName, value: (r) => r.accountName },
  { key: "product", label: "Produto", render: (r) => r.product ?? "—", value: (r) => r.product ?? "" },
  { key: "pending", label: "Vendas Pend.", numeric: true, render: (r) => num(r.pending), value: (r) => r.pending },
  { key: "sales", label: "Vendas", numeric: true, render: (r) => num(r.sales), value: (r) => r.sales },
  { key: "spendCents", label: "Gastos", numeric: true, render: (r) => money(r.spendCents), value: (r) => r.spendCents },
  { key: "revenueCents", label: "Faturamento", numeric: true, render: (r) => money(r.revenueCents), value: (r) => r.revenueCents },
  { key: "profitCents", label: "Lucro", numeric: true, render: (r) => <span className={`whitespace-nowrap ${r.profitCents >= 0 ? "text-pos" : "text-neg"}`}>{money(r.profitCents)}</span>, value: (r) => r.profitCents },
  { key: "budgetCents", label: "Orçamento", numeric: true, render: (r) => budgetCell(r.budgetCents), value: (r) => r.budgetCents },
  { key: "bidCents", label: "Bid Cap", numeric: true, render: (r) => (r.bidCents != null ? money(r.bidCents) : "—"), value: (r) => r.bidCents ?? -Infinity },
  { key: "roi", label: "ROI", numeric: true, render: (r) => ratio(r.roi), value: (r) => r.roi ?? -Infinity },
  { key: "roas", label: "ROAS", numeric: true, render: (r) => multiple(r.roas), value: (r) => r.roas ?? -Infinity },
  { key: "margin", label: "Margem", numeric: true, render: (r) => percent(r.margin), value: (r) => r.margin ?? -Infinity },
  { key: "cpaCents", label: "CPA", numeric: true, render: (r) => (r.cpaCents !== null ? money(r.cpaCents) : "N/A"), value: (r) => r.cpaCents ?? Infinity },
  { key: "ctr", label: "CTR", numeric: true, render: (r) => percent(r.ctr), value: (r) => r.ctr ?? -Infinity },
  { key: "cpcCents", label: "Custo/clique", numeric: true, render: (r) => (r.cpcCents !== null ? money(r.cpcCents) : "N/A"), value: (r) => r.cpcCents ?? Infinity },
  { key: "cpmCents", label: "CPM", numeric: true, render: (r) => (r.cpmCents !== null ? money(r.cpmCents) : "N/A"), value: (r) => r.cpmCents ?? Infinity },
  { key: "impressions", label: "Impressões", numeric: true, render: (r) => num(r.impressions), value: (r) => r.impressions },
  { key: "clicks", label: "Cliques", numeric: true, render: (r) => num(r.clicks), value: (r) => r.clicks },
  { key: "pageViews", label: "Vis. página", numeric: true, render: (r) => num(r.pageViews), value: (r) => r.pageViews },
  { key: "cpvCents", label: "CPV", numeric: true, render: (r) => (r.cpvCents !== null ? money(r.cpvCents) : "N/A"), value: (r) => r.cpvCents ?? Infinity },
  { key: "createdAt", label: "Criação", render: (r) => new Date(r.createdAt).toLocaleDateString("pt-BR"), value: (r) => r.createdAt },
];

const LINE_COLORS = ["#6c8cff", "#26d07c", "#f5b74e", "#a78bfa", "#f0616d", "#22d3ee"];
const TREND_LABEL = { profit: "Lucro", revenue: "Faturamento", spend: "Gasto" } as const;

const DEFAULT_COLS = ["status", "delivery", "sales", "pending", "spendCents", "revenueCents", "profitCents", "budgetCents", "roi", "cpaCents", "ctr", "cpcCents", "cpmCents", "impressions", "pageViews", "createdAt"];
const LS_COLS = "campaignColumns";
const LS_PINS = "campaignPins";
const LS_CHARTS = "campaignShowCharts";

type ModalState =
  | null
  | { type: "budget" | "bidcap"; ids: string[]; names: string[] }
  | { type: "duplicate"; ids: string[]; names: string[] };

const ACTION_MAP: Record<string, string> = {
  ativar: "activate", pausar: "pause", "orçamento": "budget", bidcap: "bidcap", duplicar: "duplicate", excluir: "delete",
};

export function CampaignsView({
  data,
  currentPeriodKey,
  currentPeriodFrom,
  currentPeriodTo,
  initialLevel,
  initialSelectedAccounts,
  initialSelectedCampaigns,
  initialSelectedAdsets,
  initialSelectedAds,
  initialCampaignScope,
  initialAdsetScope,
}: {
  data: NonNullable<CampaignsData>;
  currentPeriodKey: string;
  currentPeriodFrom: string | null;
  currentPeriodTo: string | null;
  initialLevel: Level;
  initialSelectedAccounts: string[];
  initialSelectedCampaigns: string[];
  initialSelectedAdsets: string[];
  initialSelectedAds: string[];
  initialCampaignScope: string[];
  initialAdsetScope: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [product, setProduct] = useState("all");
  const [campaignScope, setCampaignScope] = useState<string[]>(initialCampaignScope);
  const [adsetScope, setAdsetScope] = useState<string[]>(initialAdsetScope);
  const [level, setLevel] = useState<Level>(initialLevel);
  const [sortKey, setSortKey] = useState("revenueCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [visible, setVisible] = useState<string[]>(DEFAULT_COLS);
  const [showCols, setShowCols] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(initialSelectedAccounts);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>(initialSelectedCampaigns);
  const [selectedAdsets, setSelectedAdsets] = useState<string[]>(initialSelectedAdsets);
  const [selectedAds, setSelectedAds] = useState<string[]>(initialSelectedAds);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [onlySelected, setOnlySelected] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [trendMetric, setTrendMetric] = useState<"profit" | "revenue" | "spend">("profit");
  const [page, setPage] = useState(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState(false);
  const PAGE_SIZE = 100;
  const lastAutoSyncRef = useRef<string | null>(null);

  function unique(values: string[]) {
    return [...new Set(values.filter(Boolean))];
  }

  function csv(values: string[]) {
    return unique(values).join(",");
  }

  const activeSelected =
    level === "account"
      ? selectedAccounts
      : level === "campaign"
        ? selectedCampaigns
        : level === "adset"
          ? selectedAdsets
          : selectedAds;
  const activeSelectedSet = useMemo(() => new Set(activeSelected), [activeSelected]);

  useEffect(() => {
    const c = localStorage.getItem(LS_COLS);
    if (c) try { setVisible(JSON.parse(c)); } catch {}
    const p = localStorage.getItem(LS_PINS);
    if (p) try { setPinned(new Set(JSON.parse(p))); } catch {}
    const ch = localStorage.getItem(LS_CHARTS);
    if (ch !== null) setShowCharts(ch === "1");
  }, []);

  function toggleCharts() {
    setShowCharts((v) => {
      const n = !v;
      localStorage.setItem(LS_CHARTS, n ? "1" : "0");
      return n;
    });
  }

  // Trocar de nível preserva a seleção no nível anterior; só limpa o filtro "só selecionadas".
  useEffect(() => { setOnlySelected(false); }, [level]);

  useEffect(() => {
    if (level === "campaign") {
      setCampaignScope([]);
      setAdsetScope([]);
      return;
    }
    if (level === "adset") {
      setAdsetScope([]);
    }
  }, [level]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("level", level);
    if (campaignScope.length) params.set("scopeCampaigns", csv(campaignScope));
    if (adsetScope.length) params.set("scopeAdsets", csv(adsetScope));
    if (selectedAccounts.length) params.set("selAccounts", csv(selectedAccounts));
    if (selectedCampaigns.length) params.set("selCampaigns", csv(selectedCampaigns));
    if (selectedAdsets.length) params.set("selAdsets", csv(selectedAdsets));
    if (selectedAds.length) params.set("selAds", csv(selectedAds));
    const nextUrl = `${pathname}?${params.toString()}`;
    if (typeof window !== "undefined" && window.location.pathname + window.location.search !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [pathname, level, campaignScope, adsetScope, selectedAccounts, selectedCampaigns, selectedAdsets, selectedAds]);

  useEffect(() => {
    if (level === "campaign") return;
    const syncKey = `${currentPeriodKey}:${currentPeriodFrom ?? ""}:${currentPeriodTo ?? ""}:${level}`;
    if (lastAutoSyncRef.current === syncKey) return;
    lastAutoSyncRef.current = syncKey;
    let alive = true;
    setSyncing(true);
    (async () => {
      try {
        const body = currentPeriodFrom && currentPeriodTo
          ? { from: currentPeriodFrom, to: currentPeriodTo }
          : { days: currentPeriodKey === "today" ? 1 : currentPeriodKey === "yesterday" ? 1 : currentPeriodKey === "7d" ? 7 : currentPeriodKey === "14d" ? 14 : currentPeriodKey === "30d" ? 30 : currentPeriodKey === "this_month" ? 31 : 90 };
        const res = await fetch("/api/campaigns/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.message ?? "Falha");
        if (alive) router.refresh();
      } catch {
        if (alive) lastAutoSyncRef.current = null;
      } finally {
        if (alive) setSyncing(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [currentPeriodKey, currentPeriodFrom, currentPeriodTo, level, router]);

  function saveCols(next: string[]) {
    localStorage.setItem(LS_COLS, JSON.stringify(next));
    return next;
  }
  function toggleCol(key: string) {
    setVisible((prev) => saveCols(prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }
  function moveCol(key: string, dir: -1 | 1) {
    setVisible((prev) => {
      const i = prev.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return saveCols(next);
    });
  }
  function resetCols() {
    setVisible(saveCols([...DEFAULT_COLS]));
  }
  function togglePin(id: string) {
    setPinned((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(LS_PINS, JSON.stringify([...next]));
      return next;
    });
    setMenuId(null);
  }

  const levelRows: CampaignRow[] = useMemo(() => {
    if (level === "account") return data.accountRows ?? [];
    if (level === "adset") return data.adsetRows ?? [];
    if (level === "ad") return data.adRows ?? [];
    return data.rows;
  }, [level, data]);

  const campaignOptions = useMemo(
    () => [...data.rows].sort((a, b) => a.name.localeCompare(b.name)),
    [data.rows],
  );
  const adsetOptions = useMemo(() => {
    const rows = data.adsetRows.filter((r) => {
      if (campaignScope.length === 0) return true;
      return r.campaignId !== null && campaignScope.includes(r.campaignId);
    });
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.adsetRows, campaignScope]);
  const adOptions = useMemo(() => {
    const rows = data.adRows.filter((r) => {
      if (campaignScope.length > 0 && (r.campaignId === null || !campaignScope.includes(r.campaignId))) {
        return false;
      }
      if (adsetScope.length > 0 && (r.parentId === null || !adsetScope.includes(r.parentId))) {
        return false;
      }
      return true;
    });
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.adRows, campaignScope, adsetScope]);

  const canWrite = level === "campaign" || level === "adset";
  const fullActions = level === "campaign";
  const isCampaign = level === "campaign";

  const filtered = useMemo(() => {
    let rows = levelRows.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (status !== "all" && r.status !== status) return false;
      if (accountId !== "all" && r.accountId !== accountId) return false;
      if (product !== "all" && !r.products.includes(product)) return false;
      if ((level === "adset" || level === "ad") && campaignScope.length > 0) {
        const campaignRowId = r.campaignId;
        if (!campaignRowId || !campaignScope.includes(campaignRowId)) return false;
      }
      if (level === "ad" && adsetScope.length > 0) {
        const parentRowId = r.parentId;
        if (!parentRowId || !adsetScope.includes(parentRowId)) return false;
      }
      if (onlySelected && !activeSelectedSet.has(r.id)) return false;
      return true;
    });
    const col = COLUMNS.find((c) => c.key === sortKey);
    rows = [...rows].sort((a, b) => {
      const pa = pinned.has(a.id) ? 1 : 0;
      const pb = pinned.has(b.id) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      if (!col) return 0;
      const va = col.value(a), vb = col.value(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [levelRows, search, status, accountId, product, campaignScope, adsetScope, level, sortKey, sortDir, pinned, onlySelected, activeSelectedSet]);

  // Paginação (100/página). Reseta ao mudar nível/filtros.
  useEffect(() => { setPage(1); }, [search, status, accountId, product, campaignScope, adsetScope, level, onlySelected]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  const topRoi = useMemo(() => [...filtered].filter((r) => r.roi !== null).sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0)).slice(0, 5), [filtered]);
  const topProfit = useMemo(() => [...filtered].sort((a, b) => b.profitCents - a.profitCents).slice(0, 5), [filtered]);

  const compareRows = useMemo(() => {
    const base = activeSelectedSet.size > 0 ? filtered.filter((r) => activeSelectedSet.has(r.id)) : filtered;
    return [...base].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 8).map((r) => ({
      name: r.name.length > 14 ? r.name.slice(0, 13) + "…" : r.name,
      Faturamento: r.revenueCents / 100,
      Gasto: r.spendCents / 100,
      Lucro: r.profitCents / 100,
    }));
  }, [filtered, activeSelectedSet]);

  const trendCampaigns = useMemo(() => {
    const base = activeSelectedSet.size > 0 ? filtered.filter((r) => activeSelectedSet.has(r.id)) : filtered;
    return [...base].sort((a, b) => b.profitCents - a.profitCents).slice(0, 6);
  }, [filtered, activeSelectedSet]);

  const trendData = useMemo(() => {
    return data.series.dates.map((date, i) => {
      const o: Record<string, string | number> = { date };
      for (const c of trendCampaigns) {
        const name = c.name.length > 16 ? c.name.slice(0, 15) + "…" : c.name;
        o[name] = data.series.daily[c.id]?.[trendMetric]?.[i] ?? 0;
      }
      return o;
    });
  }, [data.series, trendCampaigns, trendMetric]);

  const activeCols = visible
    .map((k) => COLUMNS.find((c) => c.key === k))
    .filter((c): c is Col => Boolean(c));
  const hiddenCols = COLUMNS.filter((c) => !visible.includes(c.key));

  function sortBy(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }
  function toggleSelect(id: string) {
    if (level === "account") setSelectedAccounts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    else if (level === "campaign") setSelectedCampaigns((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    else if (level === "adset") setSelectedAdsets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    else setSelectedAds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectedRowsFor(levelName: Level) {
    const source = levelName === "account" ? data.accountRows ?? [] : levelName === "adset" ? data.adsetRows : levelName === "ad" ? data.adRows : data.rows;
    const ids = levelName === "account" ? selectedAccounts : levelName === "campaign" ? selectedCampaigns : levelName === "adset" ? selectedAdsets : selectedAds;
    return source.filter((r) => ids.includes(r.id));
  }

  function goToLevel(next: Level) {
    const picked = selectedRowsFor(level);
    if (next === "campaign") {
      setCampaignScope([]);
      setAdsetScope([]);
    } else if (level === "campaign" && (next === "adset" || next === "ad")) {
      const campaignIds = picked.length > 0 ? picked.map((r) => r.id) : campaignScope;
      setCampaignScope(campaignIds);
      setAdsetScope([]);
    } else if (level === "adset" && next === "ad") {
      const adsetIds = picked.length > 0 ? picked.map((r) => r.id) : adsetScope;
      const parentCampaignIds = picked.length > 0 ? [...new Set(picked.map((r) => r.campaignId).filter(Boolean))] as string[] : campaignScope;
      setCampaignScope(parentCampaignIds);
      setAdsetScope(adsetIds);
    }
    setLevel(next);
  }
  function selectAll() {
    const ids = filtered.map((r) => r.id);
    if (level === "account") setSelectedAccounts((prev) => (prev.length === ids.length ? [] : ids));
    else if (level === "campaign") setSelectedCampaigns((prev) => (prev.length === ids.length ? [] : ids));
    else if (level === "adset") setSelectedAdsets((prev) => (prev.length === ids.length ? [] : ids));
    else setSelectedAds((prev) => (prev.length === ids.length ? [] : ids));
  }
  async function copyId(id: string) {
    await navigator.clipboard.writeText(id);
    setMenuId(null);
  }

  // Ações que ESCREVEM na Meta. Envia o nível atual (campanha ou conjunto).
  async function metaWrite(action: string, ids: string[], extra?: Record<string, unknown>) {
    setMenuId(null);
    if (action === "bidcap" && level !== "adset") {
      alert("Bid cap fica no conjunto — edite no nível Conjuntos.");
      setModal(null);
      return;
    }
    const apiAction = ACTION_MAP[action];
    if (!apiAction) return;
    setBusy(true);
    try {
      const res = await fetch("/api/campaigns/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: apiAction, level, campaignIds: ids, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Falha");
      const fails = (data.results ?? []).filter((r: { ok: boolean }) => !r.ok);
      alert(
        `${data.okCount}/${data.total} concluída(s).` +
        (fails.length ? "\n\nNão aplicadas:\n" + fails.map((f: { name: string; message: string }) => `• ${f.name}: ${f.message}`).join("\n") : ""),
      );
      router.refresh();
    } catch (e) {
      alert(`Erro: ${e instanceof Error ? e.message : "desconhecido"}`);
    } finally {
      setBusy(false);
      setModal(null);
    }
  }
  // Toggle inline ligar/desligar (sem alerta de sucesso; erro mostra).
  async function quickToggle(r: CampaignRow) {
    if (!canWrite || togglingId) return;
    const action = r.status === "active" ? "pause" : "activate";
    setTogglingId(r.id);
    try {
      const res = await fetch("/api/campaigns/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, level, campaignIds: [r.id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Falha");
      const fail = (data.results ?? []).find((x: { ok: boolean }) => !x.ok);
      if (fail) throw new Error(fail.message ?? "Não aplicada");
      router.refresh();
    } catch (e) {
      alert(`Não consegui alterar: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setTogglingId(null);
    }
  }

  function askDelete(ids: string[]) {
    const names = filtered.filter((r) => ids.includes(r.id)).map((r) => r.name);
    if (confirm(`Apagar ${ids.length} campanha(s)?\n${names.slice(0, 5).join("\n")}\n\nIsso não pode ser desfeito.`)) {
      metaWrite("excluir", ids);
    }
    setMenuId(null);
  }

  const syncedLabel = data.syncedAt
    ? `Conjuntos/anúncios sincronizados em ${new Date(data.syncedAt).toLocaleString("pt-BR")}`
    : "Conjuntos/anúncios ainda não sincronizados — clique em Sincronizar.";

  return (
    <div className="space-y-4">
      {/* Nível (Sincronizar agora é global, na navbar) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="grid w-full grid-cols-4 gap-2 rounded-xl border border-line bg-panel p-1 sm:grid-cols-4">
          {LEVELS.map((l) => (
            <button
              key={l.k}
              onClick={() => goToLevel(l.k)}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${level === l.k ? "bg-accent text-bg font-medium shadow-sm" : "text-muted hover:bg-panel-2 hover:text-text"}`}
            >
              <l.icon size={16} />
              <span className="hidden sm:inline truncate">{l.label}</span>
              {((l.k === "account" && selectedAccounts.length > 0) ||
                (l.k === "campaign" && selectedCampaigns.length > 0) ||
                (l.k === "adset" && selectedAdsets.length > 0) ||
                (l.k === "ad" && selectedAds.length > 0)) && (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-black text-white px-2 py-0.5 text-xs font-semibold tabular-nums text-bg">
                  {l.k === "account"
                    ? selectedAccounts.length
                    : l.k === "campaign"
                      ? selectedCampaigns.length
                      : l.k === "adset"
                        ? selectedAdsets.length
                        : selectedAds.length}
                </span>
              )}
            </button>
          ))}
        </div>
        {syncing && (
          <span className="text-[11px] text-faint">Sincronizando dados da Meta...</span>
        )}
        {isCampaign && (
          <label className="flex items-center gap-1.5 text-sm text-muted cursor-pointer select-none">
            <input type="checkbox" checked={showCharts} onChange={toggleCharts} className="accent-[var(--color-accent)]" />
            Mostrar gráficos
          </label>
        )}
        <p className="text-[11px] text-faint ml-auto">{syncedLabel}</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Buscar ${LEVELS.find((l) => l.k === level)?.label.toLowerCase()}...`}
            className="w-full rounded-lg border border-line bg-panel-2 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
        </div>
        <Select value={status} onChange={setStatus} options={[{ v: "all", l: "Todos os status" }, { v: "active", l: "Ativo" }, { v: "paused", l: "Pausado" }, { v: "restricted", l: "Com restrições" }]} />
        <Select value={accountId} onChange={setAccountId} options={[{ v: "all", l: "Todas as contas" }, ...data.accounts.map((a) => ({ v: a.id, l: a.name }))]} />
        <Select value={product} onChange={setProduct} options={[{ v: "all", l: "Todos os produtos" }, ...data.products.map((p) => ({ v: p, l: p }))]} />
        {(level === "adset" || level === "ad") && (
          <Select
            value={campaignScope[0] ?? "all"}
            onChange={(v) => {
              setCampaignScope(v === "all" ? [] : [v]);
              setAdsetScope([]);
            }}
            options={[{ v: "all", l: "Todas as campanhas" }, ...campaignOptions.map((c) => ({ v: c.id, l: c.name }))]}
          />
        )}
        {level === "ad" && (
          <Select
            value={adsetScope[0] ?? "all"}
            onChange={(v) => setAdsetScope(v === "all" ? [] : [v])}
            options={[{ v: "all", l: "Todos os conjuntos" }, ...adsetOptions.map((a) => ({ v: a.id, l: a.name }))]}
          />
        )}
        <div className="relative">
          <button onClick={() => setShowCols((s) => !s)} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm hover:bg-panel-2">
            <SlidersHorizontal size={15} /> Colunas
          </button>
          {showCols && (
            <div className="absolute right-0 top-full mt-1.5 w-72 max-h-96 overflow-y-auto rounded-xl border border-line bg-panel shadow-xl z-30 p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[11px] uppercase tracking-wide text-faint">Visíveis (ordene)</span>
                <button onClick={resetCols} className="text-[11px] text-accent hover:underline">Restaurar padrão</button>
              </div>
              {activeCols.map((c, i) => (
                <div key={c.key} className="w-full flex items-center gap-1 px-2 py-1 text-sm rounded-lg hover:bg-panel-2">
                  <button onClick={() => toggleCol(c.key)} className="flex items-center gap-2 flex-1 text-left">
                    <span className="size-4 rounded border grid place-items-center shrink-0 bg-accent border-accent"><Check size={12} className="text-bg" /></span>
                    {c.label}
                  </button>
                  <button onClick={() => moveCol(c.key, -1)} disabled={i === 0} className="text-faint hover:text-text disabled:opacity-25 px-1">▲</button>
                  <button onClick={() => moveCol(c.key, 1)} disabled={i === activeCols.length - 1} className="text-faint hover:text-text disabled:opacity-25 px-1">▼</button>
                </div>
              ))}
              {hiddenCols.length > 0 && (
                <>
                  <div className="text-[11px] uppercase tracking-wide text-faint px-2 py-1 mt-1 border-t border-line">Ocultas</div>
                  {hiddenCols.map((c) => (
                    <button key={c.key} onClick={() => toggleCol(c.key)} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-panel-2 rounded-lg text-left">
                      <span className="size-4 rounded border border-line shrink-0" />
                      {c.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Destaques + comparativo (só nível campanha, se gráficos ligados) */}
      {isCampaign && showCharts && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopList title="Maiores ROI" icon={<TrendingUp size={15} className="text-pos" />} rows={topRoi} metric={(r) => ratio(r.roi)} bar={(r) => r.roi ?? 0} />
        <TopList title="Maiores Lucros" icon={<Trophy size={15} className="text-warn" />} rows={topProfit} metric={(r) => money(r.profitCents)} bar={(r) => r.profitCents} />
        <div className="rounded-xl border border-line bg-panel/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <BarChart3 size={15} className="text-accent" /> Comparativo {activeSelected.length > 0 ? `(${activeSelected.length} selec.)` : "(top 8)"}
          </div>
          {compareRows.length === 0 ? <p className="text-sm text-faint py-4 text-center">Sem dados.</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={compareRows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222c38" vertical={false} />
                <XAxis dataKey="name" stroke="#8b98a9" fontSize={9} tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={40} />
                <YAxis stroke="#8b98a9" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#121821", border: "1px solid #222c38", borderRadius: 10, fontSize: 12 }} formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Faturamento" fill="#6c8cff" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Gasto" fill="#f5b74e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Lucro" fill="#26d07c" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      )}

      {/* Evolução diária (7 dias) — só nível campanha, se gráficos ligados */}
      {isCampaign && showCharts && (
      <div className="rounded-xl border border-line bg-panel/70 p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="text-sm font-medium">
            Evolução — últimos 7 dias{" "}
            <span className="text-faint font-normal">
              ({activeSelected.length > 0 ? `${trendCampaigns.length} selec.` : "top 6"})
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-panel p-0.5">
            {(["profit", "revenue", "spend"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setTrendMetric(m)}
                className={`px-2.5 py-1 text-xs rounded-md ${trendMetric === m ? "bg-accent text-bg font-medium" : "text-muted hover:text-text"}`}
              >
                {TREND_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        {trendCampaigns.length === 0 ? (
          <p className="text-sm text-faint py-8 text-center">Sem campanhas pra exibir.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222c38" vertical={false} />
              <XAxis dataKey="date" stroke="#8b98a9" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#8b98a9" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} width={56} />
              <ReferenceLine y={0} stroke="#5b6675" strokeDasharray="2 2" />
              <Tooltip
                contentStyle={{ background: "#121821", border: "1px solid #222c38", borderRadius: 10, fontSize: 12 }}
                formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {trendCampaigns.map((c, idx) => {
                const name = c.name.length > 16 ? c.name.slice(0, 15) + "…" : c.name;
                return <Line key={c.id} type="monotone" dataKey={name} stroke={LINE_COLORS[idx % LINE_COLORS.length]} strokeWidth={2} dot={{ r: 2 }} />;
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      )}

      {/* Barra de ações em massa */}
      {activeSelected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          <span className="font-medium">{activeSelected.length} selecionada(s)</span>
          <button onClick={() => setOnlySelected((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${onlySelected ? "bg-accent text-bg" : "hover:bg-panel-2"}`}>
            <Filter size={14} /> {onlySelected ? "Ver todas" : "Ver só selecionadas"}
          </button>
          {canWrite && (
            <div className="ml-auto flex flex-wrap gap-2">
              <BulkBtn onClick={() => metaWrite("ativar", [...activeSelected])} cls="bg-pos/20 text-pos hover:bg-pos/30" icon={<Play size={14} />}>Ativar</BulkBtn>
              <BulkBtn onClick={() => metaWrite("pausar", [...activeSelected])} cls="bg-warn/20 text-warn hover:bg-warn/30" icon={<Pause size={14} />}>Pausar</BulkBtn>
              {fullActions && <BulkBtn onClick={() => setModal({ type: "duplicate", ids: [...activeSelected], names: [] })} cls="bg-panel-2 hover:bg-panel" icon={<CopyPlus size={14} />}>Duplicar</BulkBtn>}
              <BulkBtn onClick={() => setModal({ type: "budget", ids: [...activeSelected], names: [] })} cls="bg-panel-2 hover:bg-panel" icon={<DollarSign size={14} />}>Orçamento</BulkBtn>
              {level === "adset" && <BulkBtn onClick={() => setModal({ type: "bidcap", ids: [...activeSelected], names: [] })} cls="bg-panel-2 hover:bg-panel" icon={<Gauge size={14} />}>Bid Cap</BulkBtn>}
              {fullActions && <BulkBtn onClick={() => askDelete([...activeSelected])} cls="bg-neg/20 text-neg hover:bg-neg/30" icon={<Trash2 size={14} />}>Excluir</BulkBtn>}
            </div>
          )}
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-xl border border-line bg-panel/70 overflow-x-auto">
        <table className="w-full pb-64 text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-line">
              <th className="py-2.5 pl-3 w-8"><input type="checkbox" checked={activeSelected.length > 0 && activeSelected.length === filtered.length} onChange={selectAll} className="accent-[var(--color-accent)]" /></th>
              {canWrite && <th className="py-2.5 px-2 w-12 font-medium text-center">On/Off</th>}
              <th className="py-2.5 px-3 font-medium">
                <button onClick={() => sortBy("name")} className="flex items-center gap-1 hover:text-text">{LEVELS.find((l) => l.k === level)?.label.replace(/s$/, "")} <ArrowUpDown size={12} /></button>
              </th>
              {activeCols.map((c) => (
                <th key={c.key} className={`py-2.5 px-3 font-medium ${c.numeric ? "text-right" : ""}`}>
                  <button onClick={() => sortBy(c.key)} className={`flex items-center gap-1 hover:text-text ${c.numeric ? "ml-auto" : ""}`}>{c.key === "parent" ? PARENT_LABEL[level] : c.label} <ArrowUpDown size={12} /></button>
                </th>
              ))}
              <th className="py-2.5 px-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr key={r.id} className="border-b border-line/60 hover:bg-panel-2/50">
                <td className="py-2.5 pl-3"><input type="checkbox" checked={activeSelectedSet.has(r.id)} onChange={() => toggleSelect(r.id)} className="accent-[var(--color-accent)]" /></td>
                {canWrite && (
                  <td className="py-2.5 px-2 text-center">
                    <StatusToggle active={r.status === "active"} busy={togglingId === r.id} onToggle={() => quickToggle(r)} />
                  </td>
                )}
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    {pinned.has(r.id) && <Pin size={12} className="text-accent shrink-0" fill="currentColor" />}
                    <span className={`size-1.5 rounded-full shrink-0 ${r.status === "active" ? "bg-pos" : r.status === "restricted" ? "bg-warn" : "bg-faint"}`} />
                    <span className="truncate max-w-[200px]">{r.name}</span>
                  </div>
                </td>
                {activeCols.map((c) => {
                  let content: React.ReactNode = c.render(r);
                  if (c.key === "budgetCents" && canWrite && r.budgetCents > 0)
                    content = <EditableCell value={budgetCell(r.budgetCents)} onEdit={() => setModal({ type: "budget", ids: [r.id], names: [r.name] })} />;
                  else if (c.key === "bidCents" && level === "adset" && r.bidCents != null)
                    content = <EditableCell value={money(r.bidCents)} onEdit={() => setModal({ type: "bidcap", ids: [r.id], names: [r.name] })} />;
                  return <td key={c.key} className={`py-2.5 px-3 tabular ${c.numeric ? "text-right" : ""}`}>{content}</td>;
                })}
                <td className="py-2.5 px-2 relative">
                  <button onClick={() => setMenuId(menuId === r.id ? null : r.id)} className="grid place-items-center size-7 rounded-lg hover:bg-panel-2 text-muted"><MoreVertical size={16} /></button>
                  {menuId === r.id && (
                    <RowMenu
                      pinned={pinned.has(r.id)}
                      canWrite={canWrite}
                      fullActions={fullActions}
                      showBidcap={level === "adset"}
                      onClose={() => setMenuId(null)}
                      onCopyId={() => copyId(r.metaCampaignId)}
                      onPin={() => togglePin(r.id)}
                      onActivate={() => metaWrite("ativar", [r.id])}
                      onPause={() => metaWrite("pausar", [r.id])}
                      onDuplicate={() => { setModal({ type: "duplicate", ids: [r.id], names: [r.name] }); setMenuId(null); }}
                      onBudget={() => { setModal({ type: "budget", ids: [r.id], names: [r.name] }); setMenuId(null); }}
                      onBidcap={() => { setModal({ type: "bidcap", ids: [r.id], names: [r.name] }); setMenuId(null); }}
                      onDelete={() => askDelete([r.id])}
                    />
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={activeCols.length + 3 + (canWrite ? 1 : 0)} className="py-10 text-center text-faint">
                {level === "adset" || level === "ad"
                  ? "Nada aqui. Clique em Sincronizar pra puxar da Meta."
                  : "Nenhum resultado com esses filtros."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-faint">
        <span>
          {filtered.length} {LEVELS.find((l) => l.k === level)?.label.toLowerCase()} · período e dashboard atuais {busy && "· processando..."}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 ml-auto">
            <span>
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length}
            </span>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-line bg-panel px-2.5 py-1 hover:bg-panel-2 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="tabular">
              Página {safePage} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border border-line bg-panel px-2.5 py-1 hover:bg-panel-2 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        )}
      </div>

      {modal && (
        <ActionModal
          modal={modal}
          level={level}
          accounts={data.accounts}
          refBudgetCents={medianBudget(filtered.filter((r) => modal.ids.includes(r.id)))}
          onClose={() => setModal(null)}
          onConfirm={metaWrite}
        />
      )}
    </div>
  );
}

function StatusToggle({ active, busy, onToggle }: { active: boolean; busy: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={busy}
      title={active ? "Ativo — clique para pausar" : "Pausado — clique para ativar"}
      aria-pressed={active}
      className={`relative h-5 w-9 rounded-full align-middle transition-colors disabled:opacity-50 ${active ? "bg-pos" : "bg-panel-2 border border-line"}`}
    >
      <span className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white transition-transform ${busy ? "animate-pulse" : ""} ${active ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

function EditableCell({ value, onEdit }: { value: React.ReactNode; onEdit: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 justify-end group/edit">
      {value}
      <button onClick={onEdit} title="Editar" className="text-faint hover:text-accent opacity-60 group-hover/edit:opacity-100">
        <Pencil size={12} />
      </button>
    </span>
  );
}

function BulkBtn({ children, onClick, cls, icon }: { children: React.ReactNode; onClick: () => void; cls: string; icon: React.ReactNode }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${cls}`}>{icon}{children}</button>;
}

function RowMenu(props: {
  pinned: boolean; canWrite: boolean; fullActions: boolean; showBidcap: boolean; onClose: () => void;
  onCopyId: () => void; onPin: () => void; onActivate: () => void; onPause: () => void;
  onDuplicate: () => void; onBudget: () => void; onBidcap: () => void; onDelete: () => void;
}) {
  const items = [
    { icon: <Copy size={14} />, label: "Copiar ID", onClick: props.onCopyId },
    { icon: <Pin size={14} />, label: props.pinned ? "Desafixar" : "Fixar", onClick: props.onPin },
    ...(props.canWrite
      ? [
          { sep: true },
          { icon: <Play size={14} />, label: "Ativar", onClick: props.onActivate },
          { icon: <Pause size={14} />, label: "Desativar", onClick: props.onPause },
          ...(props.fullActions ? [{ icon: <CopyPlus size={14} />, label: "Duplicar", onClick: props.onDuplicate }] : []),
          { icon: <DollarSign size={14} />, label: "Alterar orçamento", onClick: props.onBudget },
          ...(props.showBidcap ? [{ icon: <Gauge size={14} />, label: "Alterar bid cap", onClick: props.onBidcap }] : []),
          ...(props.fullActions
            ? [{ sep: true }, { icon: <Trash2 size={14} />, label: "Excluir", onClick: props.onDelete, danger: true }]
            : []),
        ]
      : []),
  ] as { icon?: React.ReactNode; label?: string; onClick?: () => void; sep?: boolean; danger?: boolean }[];
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={props.onClose} />
      <div className="absolute right-2 top-9 w-48 rounded-xl border border-line bg-panel shadow-xl z-30 py-1">
        {items.map((it, i) =>
          it.sep ? <div key={i} className="my-1 border-t border-line" /> : (
            <button key={i} onClick={it.onClick} className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left hover:bg-panel-2 ${it.danger ? "text-neg" : ""}`}>
              {it.icon} {it.label}
            </button>
          ),
        )}
      </div>
    </>
  );
}

function ActionModal({ modal, level, accounts, refBudgetCents, onClose, onConfirm }: {
  modal: NonNullable<ModalState>;
  level: Level;
  accounts: { id: string; name: string; currency: string }[];
  refBudgetCents: number;
  onClose: () => void;
  onConfirm: (action: string, ids: string[], extra?: Record<string, unknown>) => void;
}) {
  const [value, setValue] = useState("");
  const [copies, setCopies] = useState(1);
  const [targetAccount, setTargetAccount] = useState("same");
  const [err, setErr] = useState<string | null>(null);

  const noun = level === "adset" ? "conjunto(s)" : "campanha(s)";
  const title = modal.type === "budget" ? "Alterar orçamento" : modal.type === "bidcap" ? "Alterar bid cap" : "Duplicar campanha(s)";
  const refBRL = refBudgetCents / 100;

  function parseBRL(v: string): number | null {
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    return isFinite(n) ? n : null;
  }

  function confirmMoney() {
    const n = parseBRL(value);
    if (n === null) return setErr("Digite um valor válido.");
    if (n < 1) return setErr("O valor mínimo é R$ 1,00.");
    const ref = refBRL > 0 ? refBRL : 30;
    if (n > Math.max(ref * 20, 500)) {
      const ok = window.confirm(
        `R$ ${n.toLocaleString("pt-BR")} está MUITO acima do usual (~R$ ${ref.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}).\n\nTem certeza?`,
      );
      if (!ok) return;
    }
    onConfirm(modal.type === "budget" ? "orçamento" : "bidcap", modal.ids, { valueBRL: value });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={18} /></button>
        </div>
        <p className="text-xs text-muted">{modal.ids.length} {noun} selecionado(s).</p>

        {(modal.type === "budget" || modal.type === "bidcap") && (
          <div className="space-y-2">
            <label className="text-sm">Novo valor (R$)</label>
            <input
              type="text" inputMode="decimal" value={value}
              onChange={(e) => { setValue(e.target.value); setErr(null); }}
              placeholder="Ex: 30,00"
              className={`w-full rounded-lg border bg-panel-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 ${err ? "border-neg focus:ring-neg" : "border-line focus:ring-accent"}`}
            />
            {err && <p className="text-[11px] text-neg">{err}</p>}
            {refBRL > 0 && <p className="text-[11px] text-faint">Orçamento típico: ~R$ {refBRL.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>}
            <p className="text-[11px] text-warn">
              ⚠️ Contas em outra moeda recebem o equivalente convertido — a Meta trabalha na moeda da conta.
              {level === "campaign" && modal.type === "budget" && " Se a campanha não usa CBO, o orçamento fica no conjunto — edite lá."}
            </p>
          </div>
        )}

        {modal.type === "duplicate" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm">Conta de destino</label>
              <select value={targetAccount} onChange={(e) => setTargetAccount(e.target.value)}
                className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent">
                <option value="same">Mesma conta</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm">Quantidade de cópias</label>
              <input type="number" min={1} max={50} value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-panel-2">Cancelar</button>
          <button
            onClick={() =>
              modal.type === "duplicate"
                ? onConfirm("duplicar", modal.ids, { targetAccount, copies })
                : confirmMoney()
            }
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// Mediana do orçamento (pra detectar valor "fora do comum").
function medianBudget(rows: CampaignRow[]): number {
  const b = rows.map((r) => r.budgetCents).filter((x) => x > 0).sort((a, z) => a - z);
  if (!b.length) return 0;
  return b[Math.floor(b.length / 2)];
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent max-w-[180px]">
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function TopList({ title, icon, rows, metric, bar }: { title: string; icon: React.ReactNode; rows: CampaignRow[]; metric: (r: CampaignRow) => string; bar: (r: CampaignRow) => number }) {
  const max = Math.max(...rows.map((r) => Math.abs(bar(r))), 1);
  return (
    <div className="rounded-xl border border-line bg-panel/70 p-4">
      <div className="flex items-center gap-2 text-sm font-medium mb-3">{icon} {title}</div>
      {rows.length === 0 ? <p className="text-sm text-faint py-4 text-center">Sem dados no período.</p> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="flex items-baseline justify-between text-sm"><span className="truncate pr-2">{r.name}</span><span className="tabular text-muted shrink-0">{metric(r)}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-panel-2 overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ width: `${(Math.abs(bar(r)) / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
