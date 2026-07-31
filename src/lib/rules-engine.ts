// Engine PURO das Regras de Otimização (sem DB, sem rede — testável).
// Decide, dado um conjunto de linhas (campanhas/conjuntos/anúncios) e as
// condições/ação de uma regra, quem deve ser afetado e qual o novo orçamento.

export type Operator = "gt" | "lt" | "gte" | "lte";
export type Action = "activate" | "pause" | "increase_budget" | "decrease_budget" | "set_budget";
export type ApplyTo =
  | "ActiveCampaigns" | "ActiveAdsets" | "ActiveAds"
  | "PausedCampaigns" | "PausedAdsets" | "PausedAds";
export type Level = "campaign" | "adset" | "ad";
export type Status = "active" | "paused" | "restricted";

export type MetricField =
  | "spend" | "cpa" | "roi" | "roas" | "profit" | "profitMargin" | "cpc" | "budget"
  | "cpi" | "approvedSales" | "initiatedCheckouts" | "ctr" | "cpm" | "clicks"
  | "conversations" | "costPerConversation" | "costPerLead" | "cpv" | "pv";

export type Condition = { field: MetricField; operator: Operator; value: number };

// Linha (subconjunto do que getCampaignsData/adsetRows/adRows já produz).
export interface EngineRow {
  status: Status;
  spendCents: number;
  profitCents: number;
  budgetCents: number;
  cpaCents: number | null;
  cpcCents: number | null;
  cpmCents: number | null;
  cpvCents: number | null;
  roi: number | null;
  roas: number | null;
  margin: number | null; // razão (0-1)
  ctr: number | null; // razão (0-1)
  sales: number;
  initiateCheckouts: number;
  clicks: number;
  pageViews: number;
}

// ---------- Comparação ----------
export function compare(op: Operator, a: number, b: number): boolean {
  switch (op) {
    case "gt": return a > b;
    case "lt": return a < b;
    case "gte": return a >= b;
    case "lte": return a <= b;
  }
}

// ---------- ApplyTo -> nível + status ----------
const APPLY_MAP: Record<ApplyTo, { level: Level; status: Exclude<Status, "restricted"> }> = {
  ActiveCampaigns: { level: "campaign", status: "active" },
  ActiveAdsets: { level: "adset", status: "active" },
  ActiveAds: { level: "ad", status: "active" },
  PausedCampaigns: { level: "campaign", status: "paused" },
  PausedAdsets: { level: "adset", status: "paused" },
  PausedAds: { level: "ad", status: "paused" },
};
export function applyToTarget(applyTo: ApplyTo) {
  return APPLY_MAP[applyTo];
}

// ---------- Extração de métrica em UNIDADES DO USUÁRIO ----------
// Dinheiro em R$ (não centavos); ROI/ROAS como número; margem/CTR em %; contagens cruas.
// Métricas que ainda não coletamos retornam null (condição não casa por segurança).
export function extractMetric(field: MetricField, r: EngineRow): number | null {
  switch (field) {
    case "spend": return r.spendCents / 100;
    case "profit": return r.profitCents / 100;
    case "budget": return r.budgetCents / 100;
    case "cpa": return r.cpaCents === null ? null : r.cpaCents / 100;
    case "cpc": return r.cpcCents === null ? null : r.cpcCents / 100;
    case "cpm": return r.cpmCents === null ? null : r.cpmCents / 100;
    case "cpv": return r.cpvCents === null ? null : r.cpvCents / 100;
    case "roi": return r.roi;
    case "roas": return r.roas;
    case "profitMargin": return r.margin === null ? null : r.margin * 100;
    case "ctr": return r.ctr === null ? null : r.ctr * 100;
    case "approvedSales": return r.sales;
    case "initiatedCheckouts": return r.initiateCheckouts;
    case "clicks": return r.clicks;
    case "pv": return r.pageViews;
    // ainda não coletadas
    case "cpi":
    case "conversations":
    case "costPerConversation":
    case "costPerLead":
      return null;
  }
}

// ---------- Condições (AND entre todas) ----------
export function conditionsMatch(conditions: Condition[], r: EngineRow): boolean {
  if (!conditions.length) return false; // regra sem condição não age (segurança)
  for (const c of conditions) {
    const m = extractMetric(c.field, r);
    if (m === null) return false; // métrica indisponível → não casa
    if (!compare(c.operator, m, c.value)) return false;
  }
  return true;
}

function statusMatches(rowStatus: Status, target: "active" | "paused"): boolean {
  return rowStatus === target;
}

/** Linhas que a regra deve afetar: status do applyTo + todas as condições. */
export function matchedRows<T extends EngineRow>(applyTo: ApplyTo, conditions: Condition[], rows: T[]): T[] {
  const target = applyToTarget(applyTo);
  return rows.filter((r) => statusMatches(r.status, target.status) && conditionsMatch(conditions, r));
}

// ---------- Novo orçamento (para ações de orçamento) ----------
// amount = % (se isPercent) OU R$ (fixo/alvo). maxCents=0 => sem teto. Nunca negativo.
export function computeNewBudgetCents(
  action: Action,
  currentCents: number,
  amount: number,
  isPercent: boolean,
  maxCents: number,
): number | null {
  let next: number;
  if (action === "set_budget") {
    next = Math.round(amount * 100);
  } else if (action === "increase_budget" || action === "decrease_budget") {
    const delta = isPercent ? Math.round(currentCents * (amount / 100)) : Math.round(amount * 100);
    next = action === "increase_budget" ? currentCents + delta : currentCents - delta;
  } else {
    return null; // activate/pause não mexem em orçamento
  }
  if (next < 0) next = 0;
  if (maxCents > 0 && next > maxCents) next = maxCents; // respeita o limite máximo
  return next;
}

export const isBudgetAction = (a: Action) =>
  a === "increase_budget" || a === "decrease_budget" || a === "set_budget";

// ---------- Janela de horário ("HH:MM") ----------
// Sem janela → sempre dentro. Trata janela que cruza a meia-noite (22:00–06:00).
export function withinWindow(start: string | null, end: string | null, cur: string): boolean {
  if (!start || !end) return true;
  return start <= end ? cur >= start && cur <= end : cur >= start || cur <= end;
}

// ---------- Planejamento da operação (puro, sem rede) ----------
// Decide o QUE fazer numa linha; a execução (chamada à Meta) é feita à parte.
export type PlannedOp =
  | { type: "status"; status: "ACTIVE" | "PAUSED" }
  | { type: "budget"; brlCents: number } // novo orçamento em centavos de BRL
  | { type: "skip"; reason: string };

export function planOperation(
  action: Action,
  level: Level,
  currentBudgetCents: number,
  amount: number,
  isPercent: boolean,
  maxCents: number,
): PlannedOp {
  if (action === "activate") return { type: "status", status: "ACTIVE" };
  if (action === "pause") return { type: "status", status: "PAUSED" };
  if (level === "ad") return { type: "skip", reason: "Anúncio não tem orçamento próprio." };
  const newBRL = computeNewBudgetCents(action, currentBudgetCents, amount, isPercent, maxCents);
  if (newBRL === null) return { type: "skip", reason: "Ação de orçamento inválida." };
  if (newBRL <= 0) return { type: "skip", reason: "Orçamento calculado ≤ 0." };
  return { type: "budget", brlCents: newBRL };
}

// ---------- Valores válidos (validação de API e UI) ----------
export const OPERATORS: Operator[] = ["gt", "lt", "gte", "lte"];
export const ACTIONS: Action[] = ["activate", "pause", "increase_budget", "decrease_budget", "set_budget"];
export const APPLY_TOS: ApplyTo[] = [
  "ActiveCampaigns", "ActiveAdsets", "ActiveAds", "PausedCampaigns", "PausedAdsets", "PausedAds",
];
export const METRIC_FIELDS: MetricField[] = [
  "spend", "cpa", "roi", "roas", "profit", "profitMargin", "cpc", "budget", "cpi",
  "approvedSales", "initiatedCheckouts", "ctr", "cpm", "clicks", "conversations",
  "costPerConversation", "costPerLead", "cpv", "pv",
];
// Frequências permitidas (minutos).
export const FREQUENCIES = [10, 15, 30, 60, 120, 180, 360, 1440];
