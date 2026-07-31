import { db } from "@/db";
import { adAccounts, dashboards, ruleConditions, rules } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { getCurrentDashboard } from "@/lib/dashboards";
import { getCurrentUser } from "@/lib/auth";
import { planById, ruleLimitFor } from "@/lib/plans";
import { RulesView } from "@/components/rules/RulesView";

export const dynamic = "force-dynamic";

export default async function RegrasPage() {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) {
    return <div className="mt-20 text-center text-muted">Nenhum dashboard. Crie um primeiro.</div>;
  }

  const list = await db.select().from(rules).where(eq(rules.dashboardId, dashboard.id));
  const ids = list.map((r) => r.id);
  const conds = ids.length ? await db.select().from(ruleConditions).where(inArray(ruleConditions.ruleId, ids)) : [];
  const byRule = new Map<string, typeof conds>();
  for (const c of conds) {
    const arr = byRule.get(c.ruleId) ?? [];
    arr.push(c);
    byRule.set(c.ruleId, arr);
  }
  const rulesWithConds = list.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    lastRunAt: r.lastRunAt?.toISOString() ?? null,
    conditions: (byRule.get(r.id) ?? []).map((c) => ({ field: c.field, operator: c.operator, value: c.value })),
  }));

  const accounts = await db
    .select({ id: adAccounts.id, name: adAccounts.name, currency: adAccounts.currency })
    .from(adAccounts)
    .where(eq(adAccounts.dashboardId, dashboard.id));

  // Limite de regras do plano (conta em todos os dashboards do usuário).
  const user = await getCurrentUser();
  const limit = user ? ruleLimitFor(user) : 0;
  const [usedRow] = user
    ? await db
        .select({ c: sql<number>`count(*)::int` })
        .from(rules)
        .innerJoin(dashboards, eq(rules.dashboardId, dashboards.id))
        .where(eq(dashboards.userId, user.id))
    : [{ c: 0 }];
  const plan = {
    limit,
    used: usedRow?.c ?? 0,
    planName: user ? planById(user.plan).name : "Gratuito",
    isAdmin: user?.isAdmin ?? false,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Regras de Otimização</h1>
        <p className="text-sm text-muted">
          Automatize ações nas suas campanhas com base em performance · {dashboard.name}
        </p>
      </div>
      <RulesView initialRules={rulesWithConds} accounts={accounts} plan={plan} />
    </div>
  );
}
