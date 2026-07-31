import { db } from "@/db";
import { adAccounts, metaConnections, ruleConditions, ruleExecutions, rules } from "@/db/schema";
import { and, eq, gt, gte, sql } from "drizzle-orm";
import { getCampaignsData, type CampaignRow } from "./queries";
import {
  applyToTarget, matchedRows, planOperation, withinWindow,
  type Action, type ApplyTo, type Condition, type Level,
} from "./rules-engine";
import { convertBRLCents } from "./fx";
import {
  MetaApiError, setAdSetDailyBudget, setAdSetStatus, setAdStatus,
  setCampaignDailyBudget, setCampaignStatus,
} from "./meta";

// HH:MM atual (hora local do servidor ~ fuso do usuário/Brasil).
function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Executa a ação da regra numa linha (campanha/conjunto/anúncio) via Marketing API.
// A DECISÃO é de planOperation (puro, testado); aqui só o IO (converter moeda + chamar).
async function executeAction(
  rule: typeof rules.$inferSelect,
  level: Level,
  row: CampaignRow,
  token: string,
): Promise<void> {
  const metaId = row.metaCampaignId; // id da entidade na Meta (campanha/adset/ad)
  const op = planOperation(rule.action as Action, level, row.budgetCents, rule.amount, rule.amountIsPercent, rule.maxBudgetCents);

  if (op.type === "skip") throw new Error(op.reason);
  if (op.type === "status") {
    if (level === "campaign") await setCampaignStatus(metaId, token, op.status);
    else if (level === "adset") await setAdSetStatus(metaId, token, op.status);
    else await setAdStatus(metaId, token, op.status);
    return;
  }
  // op.type === "budget"
  const minor = await convertBRLCents(op.brlCents, row.currency); // BRL → moeda da conta
  if (level === "campaign") await setCampaignDailyBudget(metaId, token, minor);
  else await setAdSetDailyBudget(metaId, token, minor);
}

type Rule = typeof rules.$inferSelect;
type Ctx = { data: NonNullable<Awaited<ReturnType<typeof getCampaignsData>>>; tokenByAccount: Map<string, string> };

// Carrega dados do período do cálculo (default "today") + tokens por conta.
// Campanhas usam insights diários (hoje = preciso). Conjuntos/anúncios ainda
// usam o snapshot da última sync (limitação; futuro = insights diários por entidade).
async function loadContext(dashboardId: string): Promise<Ctx | null> {
  const to = new Date();
  const from = new Date();
  from.setHours(0, 0, 0, 0); // início de hoje (hora local do servidor = Brasil)
  const data = await getCampaignsData({ dashboardId, from, to });
  if (!data) return null;

  const accts = await db.select().from(adAccounts).where(eq(adAccounts.dashboardId, dashboardId));
  const conns = await db.select().from(metaConnections).where(eq(metaConnections.dashboardId, dashboardId));
  const connById = new Map(conns.map((c) => [c.id, c]));
  const tokenByAccount = new Map<string, string>();
  for (const a of accts) {
    const c = a.metaConnectionId ? connById.get(a.metaConnectionId) : null;
    if (c) tokenByAccount.set(a.id, c.accessToken);
  }
  return { data, tokenByAccount };
}

// Avalia UMA regra e executa as ações. Grava o log e atualiza lastRunAt.
async function evalAndAct(rule: Rule, ctx: Ctx) {
  const conds = await db.select().from(ruleConditions).where(eq(ruleConditions.ruleId, rule.id));
  const conditions: Condition[] = conds.map((c) => ({
    field: c.field as Condition["field"],
    operator: c.operator as Condition["operator"],
    value: c.value,
  }));

  const target = applyToTarget(rule.applyTo as ApplyTo);
  let rows: CampaignRow[] =
    target.level === "campaign" ? ctx.data.rows : target.level === "adset" ? ctx.data.adsetRows : ctx.data.adRows;
  if (rule.adAccountId) rows = rows.filter((r) => r.accountId === rule.adAccountId);

  const matched = matchedRows(rule.applyTo as ApplyTo, conditions, rows);

  let acted = 0;
  let errors = 0;
  const notes: string[] = [];
  for (const row of matched) {
    const token = ctx.tokenByAccount.get(row.accountId);
    if (!token) {
      errors++;
      notes.push(`${row.name}: sem conexão Meta`);
      continue;
    }
    try {
      await executeAction(rule, target.level, row, token);
      acted++;
    } catch (e) {
      errors++;
      notes.push(`${row.name}: ${e instanceof MetaApiError ? e.message : e instanceof Error ? e.message : "erro"}`);
    }
  }

  await db.insert(ruleExecutions).values({
    ruleId: rule.id,
    matchedCount: matched.length,
    actedCount: acted,
    errorCount: errors,
    note: notes.slice(0, 3).join(" | ").slice(0, 500) || null,
  });
  await db.update(rules).set({ lastRunAt: new Date() }).where(eq(rules.id, rule.id));
  return { matched: matched.length, acted, errors, notes };
}

/**
 * Avalia e executa todas as regras enabled de um dashboard. Chamado pelo agendador
 * depois do sync. Respeita frequência, janela de horário e limite diário.
 * Métricas sobre a janela sincronizada (SYNC_DAYS) — consistente entre níveis.
 */
export async function runRulesForDashboard(dashboardId: string) {
  const enabled = await db
    .select()
    .from(rules)
    .where(and(eq(rules.dashboardId, dashboardId), eq(rules.enabled, true)));
  if (!enabled.length) return { rulesRun: 0, acted: 0 };

  const ctx = await loadContext(dashboardId);
  if (!ctx) return { rulesRun: 0, acted: 0 };

  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const curHHMM = nowHHMM();

  let rulesRun = 0;
  let actedTotal = 0;

  for (const rule of enabled) {
    if (rule.lastRunAt && now - rule.lastRunAt.getTime() < rule.frequencyMinutes * 60_000) continue; // frequência
    if (!withinWindow(rule.execWindowStart, rule.execWindowEnd, curHHMM)) continue; // janela
    if (rule.dailyLimit > 0) {
      const [row] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(ruleExecutions)
        .where(and(eq(ruleExecutions.ruleId, rule.id), gte(ruleExecutions.ranAt, startOfDay), gt(ruleExecutions.actedCount, 0)));
      if ((row?.c ?? 0) >= rule.dailyLimit) continue; // limite diário
    }
    const r = await evalAndAct(rule, ctx);
    rulesRun++;
    actedTotal += r.acted;
  }
  return { rulesRun, acted: actedTotal };
}

/** Executa UMA regra AGORA, ignorando frequência/janela/limite (botão "Executar agora"). */
export async function runRuleNow(dashboardId: string, ruleId: string) {
  const [rule] = await db.select().from(rules).where(and(eq(rules.id, ruleId), eq(rules.dashboardId, dashboardId))).limit(1);
  if (!rule) return null;
  const ctx = await loadContext(dashboardId);
  if (!ctx) return { matched: 0, acted: 0, errors: 0, notes: ["Sem dados."] };
  return evalAndAct(rule, ctx);
}
