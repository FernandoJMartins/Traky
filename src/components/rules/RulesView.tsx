"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, X, Zap, Play, Pause, DollarSign, Trash2, Pencil, Loader2, Filter, PlayCircle, History,
  CheckCircle2, AlertTriangle,
} from "lucide-react";

// ---------- Rótulos (pt-BR) ----------
const APPLY_TO = {
  ActiveCampaigns: "Campanhas Ativas", ActiveAdsets: "Conjuntos Ativos", ActiveAds: "Anúncios Ativos",
  PausedCampaigns: "Campanhas Pausadas", PausedAdsets: "Conjuntos Pausados", PausedAds: "Anúncios Pausados",
} as const;
const ACTIONS = {
  activate: "Ativar", pause: "Pausar", increase_budget: "Aumentar orçamento",
  decrease_budget: "Diminuir orçamento", set_budget: "Definir orçamento",
} as const;
const FIELDS = {
  spend: "Gasto", cpa: "CPA", roi: "ROI", roas: "ROAS", profit: "Lucro", profitMargin: "Margem de Lucro",
  cpc: "CPC", budget: "Orçamento", cpi: "CPI", approvedSales: "Vendas", initiatedCheckouts: "ICs",
  ctr: "CTR", cpm: "CPM", clicks: "Cliques", conversations: "Conversas", costPerConversation: "Custo por Conversa",
  costPerLead: "CPL", cpv: "CPV", pv: "Vis. de Pág",
} as const;
const OPERATORS = { gt: "maior que", lt: "menor que", gte: "maior ou igual a", lte: "menor ou igual a" } as const;
const FREQUENCIES: { v: number; l: string }[] = [
  { v: 10, l: "a cada 10 min" }, { v: 15, l: "a cada 15 min" }, { v: 30, l: "a cada 30 min" },
  { v: 60, l: "a cada hora" }, { v: 120, l: "a cada 2 horas" }, { v: 180, l: "a cada 3 horas" },
  { v: 360, l: "a cada 6 horas" }, { v: 1440, l: "uma vez por dia" },
];

type Cond = { field: string; operator: string; value: number };
type Rule = {
  id: string; name: string; platform: string; adAccountId: string | null; applyTo: string; action: string;
  amount: number; amountIsPercent: boolean; maxBudgetCents: number; frequencyMinutes: number;
  calcPeriod: string; execWindowStart: string | null; execWindowEnd: string | null; dailyLimit: number;
  enabled: boolean; lastRunAt?: string | null; conditions: Cond[];
};
type Execution = {
  id: string; ranAt: string; matchedCount: number; actedCount: number; errorCount: number; note: string | null;
};
type Account = { id: string; name: string; currency: string };

const PLATFORMS = [
  { k: "meta", label: "Facebook", enabled: true },
  { k: "google", label: "Google", enabled: false },
  { k: "kwai", label: "Kwai", enabled: false },
];

type PlanInfo = { limit: number | null; used: number; planName: string; isAdmin: boolean };

export function RulesView({ initialRules, accounts, plan }: { initialRules: Rule[]; accounts: Account[]; plan: PlanInfo }) {
  const router = useRouter();
  const [platform, setPlatform] = useState("meta");
  const [editing, setEditing] = useState<Rule | null>(null);
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [historyRule, setHistoryRule] = useState<Rule | null>(null);

  const rules = initialRules.filter((r) => r.platform === platform);
  const atLimit = plan.limit !== null && plan.used >= plan.limit;

  async function runNow(r: Rule) {
    if (!confirm(`Executar "${r.name}" agora? Isso avalia e AGE na Meta imediatamente (ignora a agenda).`)) return;
    setRunningId(r.id);
    try {
      const res = await fetch(`/api/rules/${r.id}/run`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "Falha");
      alert(
        `Resultado: ${d.matched} casaram, ${d.acted} ação(ões) aplicada(s), ${d.errors} erro(s).` +
        (d.notes?.length ? `\n\n${d.notes.join("\n")}` : ""),
      );
      router.refresh();
    } catch (e) {
      alert(`Erro: ${e instanceof Error ? e.message : "desconhecido"}`);
    } finally {
      setRunningId(null);
    }
  }

  async function toggle(r: Rule) {
    await fetch(`/api/rules/${r.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !r.enabled }),
    });
    router.refresh();
  }
  async function remove(r: Rule) {
    if (!confirm(`Excluir a regra "${r.name}"?`)) return;
    await fetch(`/api/rules/${r.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Plataformas */}
      <div className="flex items-center gap-1 rounded-lg border border-line bg-panel p-1 w-fit">
        {PLATFORMS.map((p) => (
          <button key={p.k} onClick={() => p.enabled && setPlatform(p.k)} disabled={!p.enabled}
            className={`px-3 py-1.5 text-sm rounded-md ${platform === p.k ? "bg-accent text-bg font-medium" : "text-muted hover:text-text"} ${!p.enabled ? "opacity-40 cursor-not-allowed" : ""}`}>
            {p.label}{!p.enabled && " (em breve)"}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">
          {plan.limit === null
            ? `${rules.length} regra(s) · ilimitadas (admin)`
            : `${plan.used}/${plan.limit} regra(s) · plano ${plan.planName}`}
        </p>
        {atLimit ? (
          <Link href="/planos" className="inline-flex items-center gap-2 rounded-lg border border-accent/50 text-accent px-3 py-2 text-sm font-medium hover:bg-accent/10">
            <Zap size={15} /> Limite atingido — fazer upgrade
          </Link>
        ) : (
          <button onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-bg hover:opacity-90">
            <Plus size={15} /> Nova regra
          </button>
        )}
      </div>

      {/* Listagem */}
      {rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-panel/40 p-10 text-center">
          <Zap size={26} className="mx-auto text-faint" />
          <p className="mt-2 text-sm font-medium">Nenhuma regra ainda.</p>
          <p className="text-xs text-faint mt-1">Crie uma regra pra automatizar ativar/pausar/orçamento com base em ROI, gasto, etc.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-panel/70 p-4">
              <div className="flex items-start gap-3">
                <button onClick={() => toggle(r)} title={r.enabled ? "Ativa" : "Desativada"}
                  className={`relative h-6 w-11 shrink-0 rounded-full mt-0.5 transition-colors ${r.enabled ? "bg-pos" : "bg-panel-2 border border-line"}`}>
                  <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition-transform ${r.enabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.name}</span>
                    <ActionBadge action={r.action} />
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {APPLY_TO[r.applyTo as keyof typeof APPLY_TO]} · {accounts.find((a) => a.id === r.adAccountId)?.name ?? "Todas as contas"} · {FREQUENCIES.find((f) => f.v === r.frequencyMinutes)?.l}
                    {r.dailyLimit > 0 && ` · máx ${r.dailyLimit}x/dia`}
                    {(r.execWindowStart && r.execWindowEnd) && ` · ${r.execWindowStart}–${r.execWindowEnd}`}
                    {r.lastRunAt && ` · última: ${new Date(r.lastRunAt).toLocaleString("pt-BR")}`}
                  </div>
                  <div className="text-xs mt-1.5 flex flex-wrap gap-1.5">
                    {r.conditions.map((c, i) => (
                      <span key={i} className="rounded bg-panel-2 px-1.5 py-0.5 text-faint">
                        {FIELDS[c.field as keyof typeof FIELDS]} {OPERATORS[c.operator as keyof typeof OPERATORS]} {c.value}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => runNow(r)} disabled={runningId === r.id} className="grid place-items-center size-8 rounded-lg hover:bg-panel-2 text-accent disabled:opacity-50" title="Executar agora">
                    {runningId === r.id ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />}
                  </button>
                  <button onClick={() => setHistoryRule(r)} className="grid place-items-center size-8 rounded-lg hover:bg-panel-2 text-muted" title="Histórico de execuções"><History size={15} /></button>
                  <button onClick={() => setEditing(r)} className="grid place-items-center size-8 rounded-lg hover:bg-panel-2 text-muted" title="Editar"><Pencil size={15} /></button>
                  <button onClick={() => remove(r)} className="grid place-items-center size-8 rounded-lg hover:bg-panel-2 text-neg" title="Excluir"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <RuleForm
          platform={platform}
          accounts={accounts}
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); router.refresh(); }}
        />
      )}

      {historyRule && <HistoryModal rule={historyRule} onClose={() => setHistoryRule(null)} />}
    </div>
  );
}

function HistoryModal({ rule, onClose }: { rule: Rule; onClose: () => void }) {
  const [rows, setRows] = useState<Execution[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/rules/${rule.id}/executions`)
      .then((r) => r.json())
      .then((d) => { if (!cancel) (d.executions ? setRows(d.executions) : setErr(d.message ?? "Falha")); })
      .catch(() => !cancel && setErr("Erro ao carregar."));
    return () => { cancel = true; };
  }, [rule.id]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-5 space-y-3 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><History size={17} /> Histórico — {rule.name}</h3>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={18} /></button>
        </div>

        {err && <p className="text-sm text-neg">{err}</p>}
        {!rows && !err && <p className="text-sm text-faint py-6 text-center"><Loader2 size={16} className="inline animate-spin" /> Carregando...</p>}
        {rows && rows.length === 0 && (
          <p className="text-sm text-faint py-6 text-center">Ainda não executou. Use ▶️ &quot;Executar agora&quot; ou aguarde a agenda.</p>
        )}
        {rows && rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((e) => {
              const ok = e.errorCount === 0;
              return (
                <li key={e.id} className="rounded-lg border border-line bg-panel-2/40 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    {ok ? <CheckCircle2 size={15} className="text-pos shrink-0" /> : <AlertTriangle size={15} className="text-warn shrink-0" />}
                    <span className="text-xs text-muted">{new Date(e.ranAt).toLocaleString("pt-BR")}</span>
                    <span className="ml-auto text-xs tabular">
                      <span className="text-faint">{e.matchedCount} casaram · </span>
                      <span className="text-pos">{e.actedCount} alterado(s)</span>
                      {e.errorCount > 0 && <span className="text-neg"> · {e.errorCount} erro(s)</span>}
                    </span>
                  </div>
                  {e.note && <div className="text-[11px] text-faint mt-1 whitespace-pre-wrap">{e.note}</div>}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-faint">&quot;Alterado(s)&quot; = campanhas/conjuntos/anúncios que a regra de fato mudou na Meta.</p>
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { icon: React.ReactNode; cls: string }> = {
    activate: { icon: <Play size={11} />, cls: "bg-pos/15 text-pos" },
    pause: { icon: <Pause size={11} />, cls: "bg-warn/15 text-warn" },
    increase_budget: { icon: <DollarSign size={11} />, cls: "bg-accent/15 text-accent" },
    decrease_budget: { icon: <DollarSign size={11} />, cls: "bg-accent/15 text-accent" },
    set_budget: { icon: <DollarSign size={11} />, cls: "bg-accent/15 text-accent" },
  };
  const m = map[action] ?? map.activate;
  return <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${m.cls}`}>{m.icon}{ACTIONS[action as keyof typeof ACTIONS]}</span>;
}

// ---------- Formulário ----------
const FIELD_ENTRIES = Object.entries(FIELDS) as [string, string][];

function RuleForm({ platform, accounts, initial, onClose, onSaved }: {
  platform: string; accounts: Account[]; initial: Rule | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [adAccountId, setAdAccountId] = useState(initial?.adAccountId ?? "");
  const [applyTo, setApplyTo] = useState(initial?.applyTo ?? "ActiveCampaigns");
  const [action, setAction] = useState(initial?.action ?? "pause");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [amountIsPercent, setAmountIsPercent] = useState(initial?.amountIsPercent ?? true);
  const [maxBudget, setMaxBudget] = useState(initial ? String(initial.maxBudgetCents / 100) : "");
  const [frequency, setFrequency] = useState(initial?.frequencyMinutes ?? 60);
  const [customWindow, setCustomWindow] = useState(!!(initial?.execWindowStart && initial?.execWindowEnd));
  const [winStart, setWinStart] = useState(initial?.execWindowStart ?? "08:00");
  const [winEnd, setWinEnd] = useState(initial?.execWindowEnd ?? "20:00");
  const [dailyLimit, setDailyLimit] = useState(initial?.dailyLimit ?? 0);
  const [conditions, setConditions] = useState<Cond[]>(
    initial?.conditions.length ? initial.conditions : [{ field: "spend", operator: "gt", value: 0 }],
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isBudget = action === "increase_budget" || action === "decrease_budget" || action === "set_budget";
  const isSet = action === "set_budget";

  function setCond(i: number, patch: Partial<Cond>) {
    setConditions((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addCond() { setConditions((p) => [...p, { field: "roi", operator: "lt", value: 0 }]); }
  function removeCond(i: number) { setConditions((p) => p.filter((_, idx) => idx !== i)); }

  async function save() {
    setErr(null);
    const body = {
      name, platform, adAccountId: adAccountId || null, applyTo, action,
      amount: Number(String(amount).replace(",", ".")) || 0,
      amountIsPercent: isSet ? false : amountIsPercent,
      maxBudgetCents: Math.round((Number(String(maxBudget).replace(",", ".")) || 0) * 100),
      frequencyMinutes: frequency, calcPeriod: "today",
      execWindowStart: customWindow ? winStart : null,
      execWindowEnd: customWindow ? winEnd : null,
      dailyLimit,
      conditions: conditions.map((c) => ({ field: c.field, operator: c.operator, value: Number(String(c.value).toString().replace(",", ".")) || 0 })),
    };
    setBusy(true);
    try {
      const res = await fetch(initial ? `/api/rules/${initial.id}` : "/api/rules", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Falha");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-5 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{initial ? "Editar regra" : "Nova regra"}</h3>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={18} /></button>
        </div>

        <Field label="Nome da regra">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pausar anúncio furado" className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Conta de anúncio">
            <select value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} className={inputCls}>
              <option value="">Todas as contas</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Aplicar regra a">
            <select value={applyTo} onChange={(e) => setApplyTo(e.target.value)} className={inputCls}>
              {Object.entries(APPLY_TO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Ação">
          <select value={action} onChange={(e) => setAction(e.target.value)} className={inputCls}>
            {Object.entries(ACTIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>

        {isBudget && (
          <div className="rounded-xl border border-line bg-panel-2/40 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={isSet ? "Novo orçamento (R$)" : "Valor"}>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={isSet ? "30,00" : amountIsPercent ? "20" : "10,00"} className={inputCls} />
              </Field>
              {!isSet && (
                <Field label="Tipo">
                  <div className="flex rounded-lg border border-line overflow-hidden">
                    <button onClick={() => setAmountIsPercent(true)} className={`flex-1 py-2 text-sm ${amountIsPercent ? "bg-accent text-bg" : "hover:bg-panel-2"}`}>%</button>
                    <button onClick={() => setAmountIsPercent(false)} className={`flex-1 py-2 text-sm ${!amountIsPercent ? "bg-accent text-bg" : "hover:bg-panel-2"}`}>R$</button>
                  </div>
                </Field>
              )}
            </div>
            {!isSet && (
              <Field label="Limite máximo de orçamento (R$) — 0 = sem limite">
                <input value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} inputMode="decimal" placeholder="0,00" className={inputCls} />
              </Field>
            )}
            <p className="text-[11px] text-warn">
              ⚠️ Respeite os limites mín./máx. da plataforma. Um valor que a Meta não aceita (ex: R$ 0,01) faz a regra falhar por bloqueio da própria Meta.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Frequência de execução">
            <select value={frequency} onChange={(e) => setFrequency(Number(e.target.value))} className={inputCls}>
              {FREQUENCIES.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
            </select>
          </Field>
          <Field label="Período do cálculo">
            <select disabled className={inputCls}><option>Hoje</option></select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Intervalo de execução">
            <select value={customWindow ? "custom" : "any"} onChange={(e) => setCustomWindow(e.target.value === "custom")} className={inputCls}>
              <option value="any">Qualquer horário</option>
              <option value="custom">Personalizado</option>
            </select>
          </Field>
          <Field label="Limite de execuções diárias">
            <select value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} className={inputCls}>
              <option value={0}>Sem limite</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x por dia</option>)}
            </select>
          </Field>
        </div>
        {customWindow && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início"><input type="time" value={winStart} onChange={(e) => setWinStart(e.target.value)} className={inputCls} /></Field>
            <Field label="Fim"><input type="time" value={winEnd} onChange={(e) => setWinEnd(e.target.value)} className={inputCls} /></Field>
          </div>
        )}

        {/* Condições */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-1.5"><Filter size={14} /> Condições (todas precisam bater)</span>
            <button onClick={addCond} className="text-xs text-accent hover:underline inline-flex items-center gap-1"><Plus size={12} /> Adicionar</button>
          </div>
          {conditions.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <select value={c.field} onChange={(e) => setCond(i, { field: e.target.value })} className={`${inputCls} min-w-0 flex-[2]`}>
                {FIELD_ENTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={c.operator} onChange={(e) => setCond(i, { operator: e.target.value })} className={`${inputCls} min-w-0 flex-[1.4]`}>
                {Object.entries(OPERATORS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="number" step="any" value={c.value} onChange={(e) => setCond(i, { value: Number(e.target.value) })} className={`${inputCls} min-w-0 flex-1`} />
              {conditions.length > 1 && <button onClick={() => removeCond(i)} className="text-faint hover:text-neg shrink-0"><X size={16} /></button>}
            </div>
          ))}
        </div>

        {err && <p className="text-sm text-neg">{err}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-panel-2">Cancelar</button>
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-60">
            {busy && <Loader2 size={15} className="animate-spin" />} {initial ? "Salvar" : "Criar regra"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}
