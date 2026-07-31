import { NextResponse } from "next/server";
import { db } from "@/db";
import { ruleExecutions, rules } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentDashboard } from "@/lib/dashboards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rules/[id]/executions — histórico de execuções da regra (mais recentes)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });

  // confirma que a regra é do dashboard atual
  const [rule] = await db
    .select({ id: rules.id })
    .from(rules)
    .where(and(eq(rules.id, id), eq(rules.dashboardId, dashboard.id)))
    .limit(1);
  if (!rule) return NextResponse.json({ message: "Regra não encontrada." }, { status: 404 });

  const executions = await db
    .select()
    .from(ruleExecutions)
    .where(eq(ruleExecutions.ruleId, id))
    .orderBy(desc(ruleExecutions.ranAt))
    .limit(50);

  return NextResponse.json({ executions });
}
