import { NextResponse } from "next/server";
import { db } from "@/db";
import { dashboards, rules, ruleConditions } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { getCurrentDashboard } from "@/lib/dashboards";
import { getCurrentUser } from "@/lib/auth";
import { planById, ruleLimitFor } from "@/lib/plans";
import { ACTIONS, APPLY_TOS, FREQUENCIES, METRIC_FIELDS, OPERATORS } from "@/lib/rules-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CondIn = { field?: string; operator?: string; value?: number };
type RuleIn = {
  name?: string;
  platform?: string;
  adAccountId?: string | null;
  applyTo?: string;
  action?: string;
  amount?: number;
  amountIsPercent?: boolean;
  maxBudgetCents?: number;
  frequencyMinutes?: number;
  calcPeriod?: string;
  execWindowStart?: string | null;
  execWindowEnd?: string | null;
  dailyLimit?: number;
  enabled?: boolean;
  conditions?: CondIn[];
};

// Valida e normaliza o corpo. Retorna { rule, conditions } ou { error }.
export function validateRule(body: RuleIn) {
  const name = (body.name ?? "").trim();
  if (!name) return { error: "Nome é obrigatório." };
  if (!APPLY_TOS.includes(body.applyTo as never)) return { error: "Opção 'aplicar a' inválida." };
  if (!ACTIONS.includes(body.action as never)) return { error: "Ação inválida." };
  const freq = Number(body.frequencyMinutes);
  if (!FREQUENCIES.includes(freq)) return { error: "Frequência inválida." };

  const conds = Array.isArray(body.conditions) ? body.conditions : [];
  if (!conds.length) return { error: "Adicione ao menos uma condição." };
  const conditions = [];
  for (const c of conds) {
    if (!METRIC_FIELDS.includes(c.field as never)) return { error: `Campo de condição inválido: ${c.field}` };
    if (!OPERATORS.includes(c.operator as never)) return { error: "Operador inválido." };
    if (typeof c.value !== "number" || !isFinite(c.value)) return { error: "Valor de condição inválido." };
    conditions.push({ field: c.field!, operator: c.operator!, value: c.value });
  }

  const dailyLimit = Math.max(0, Math.min(10, Math.floor(Number(body.dailyLimit ?? 0) || 0)));
  const rule = {
    name,
    platform: body.platform === "google" || body.platform === "kwai" ? body.platform : "meta",
    adAccountId: body.adAccountId || null,
    applyTo: body.applyTo!,
    action: body.action!,
    amount: Number(body.amount ?? 0) || 0,
    amountIsPercent: !!body.amountIsPercent,
    maxBudgetCents: Math.max(0, Math.floor(Number(body.maxBudgetCents ?? 0) || 0)),
    calcPeriod: body.calcPeriod || "today",
    frequencyMinutes: freq,
    execWindowStart: body.execWindowStart || null,
    execWindowEnd: body.execWindowEnd || null,
    dailyLimit,
    enabled: body.enabled !== false,
  };
  return { rule, conditions };
}

// GET /api/rules — lista as regras do dashboard atual (com condições)
export async function GET() {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return NextResponse.json({ rules: [] });

  const list = await db.select().from(rules).where(eq(rules.dashboardId, dashboard.id));
  const ids = list.map((r) => r.id);
  const conds = ids.length
    ? await db.select().from(ruleConditions).where(inArray(ruleConditions.ruleId, ids))
    : [];
  const byRule = new Map<string, typeof conds>();
  for (const c of conds) {
    const arr = byRule.get(c.ruleId) ?? [];
    arr.push(c);
    byRule.set(c.ruleId, arr);
  }
  return NextResponse.json({
    rules: list.map((r) => ({ ...r, conditions: byRule.get(r.id) ?? [] })),
  });
}

// POST /api/rules — cria uma regra + condições
export async function POST(req: Request) {
  const dashboard = await getCurrentDashboard();
  const user = await getCurrentUser();
  if (!dashboard || !user) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });

  // Limite de regras por plano (admin = ilimitado). Conta em todos os dashboards do usuário.
  const limit = ruleLimitFor(user);
  if (limit !== null) {
    const dashIds = (await db.select({ id: dashboards.id }).from(dashboards).where(eq(dashboards.userId, user.id))).map((d) => d.id);
    const [row] = dashIds.length
      ? await db.select({ c: sql<number>`count(*)::int` }).from(rules).where(inArray(rules.dashboardId, dashIds))
      : [{ c: 0 }];
    if ((row?.c ?? 0) >= limit) {
      const planName = planById(user.plan).name;
      return NextResponse.json(
        { message: limit === 0
            ? `O plano ${planName} não inclui regras de otimização. Faça upgrade em Planos.`
            : `Limite de ${limit} regra(s) do plano ${planName} atingido. Faça upgrade em Planos.` },
        { status: 403 },
      );
    }
  }

  let body: RuleIn;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  const v = validateRule(body);
  if ("error" in v) return NextResponse.json({ message: v.error }, { status: 400 });

  const [created] = await db
    .insert(rules)
    .values({ dashboardId: dashboard.id, ...v.rule })
    .returning();
  await db.insert(ruleConditions).values(v.conditions.map((c) => ({ ruleId: created.id, ...c })));

  return NextResponse.json({ ok: true, id: created.id });
}
