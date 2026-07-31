import { NextResponse } from "next/server";
import { getCurrentDashboard } from "@/lib/dashboards";
import { runRuleNow } from "@/lib/rules-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/rules/[id]/run — executa a regra AGORA (ignora agenda). Escreve na Meta.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });

  const res = await runRuleNow(dashboard.id, id);
  if (!res) return NextResponse.json({ message: "Regra não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true, ...res });
}
