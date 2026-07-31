import { NextResponse } from "next/server";
import { db } from "@/db";
import { rules, ruleConditions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentDashboard } from "@/lib/dashboards";
import { validateRule } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownedRule(id: string) {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return null;
  const [r] = await db
    .select()
    .from(rules)
    .where(and(eq(rules.id, id), eq(rules.dashboardId, dashboard.id)))
    .limit(1);
  return r ?? null;
}

// PATCH /api/rules/[id] — atualiza a regra (ou só o toggle `enabled`)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rule = await ownedRule(id);
  if (!rule) return NextResponse.json({ message: "Regra não encontrada." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }

  // Toggle simples: só o campo enabled.
  if (Object.keys(body).length === 1 && typeof body.enabled === "boolean") {
    await db.update(rules).set({ enabled: body.enabled }).where(eq(rules.id, id));
    return NextResponse.json({ ok: true });
  }

  const v = validateRule(body);
  if ("error" in v) return NextResponse.json({ message: v.error }, { status: 400 });

  await db.update(rules).set(v.rule).where(eq(rules.id, id));
  await db.delete(ruleConditions).where(eq(ruleConditions.ruleId, id));
  await db.insert(ruleConditions).values(v.conditions.map((c) => ({ ruleId: id, ...c })));

  return NextResponse.json({ ok: true });
}

// DELETE /api/rules/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rule = await ownedRule(id);
  if (!rule) return NextResponse.json({ message: "Regra não encontrada." }, { status: 404 });
  await db.delete(rules).where(eq(rules.id, id));
  return NextResponse.json({ ok: true });
}
