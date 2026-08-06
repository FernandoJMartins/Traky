import { NextResponse } from "next/server";
import { getCurrentDashboard } from "@/lib/dashboards";
import { getCurrentPeriod } from "@/lib/period";
import { syncCampaignsFull } from "@/lib/meta-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dstr = (d: Date) => d.toISOString().slice(0, 10);

// POST /api/campaigns/sync
// Botão "Sincronizar" (= "Atualizar"): puxa da Meta e grava no banco, usando o
// PERÍODO ATUAL selecionado (default Hoje). Assim conjuntos/anúncios refletem o período.
// É a ÚNICA porta que toca a Meta a partir da tela de campanhas.
export async function POST(req: Request) {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return NextResponse.json({ message: "Sem dashboard." }, { status: 400 });

  // Permite override manual via body { days } ou { from, to }; senão usa o período atual.
  let bodyFrom: string | undefined;
  let bodyTo: string | undefined;
  let bodyDays: number | undefined;
  try {
    const body = await req.json();
    if (typeof body?.from === "string" && typeof body?.to === "string") { bodyFrom = body.from; bodyTo = body.to; }
    else if (typeof body?.days === "number" && body.days > 0 && body.days <= 90) bodyDays = Math.floor(body.days);
  } catch {
    /* usa período atual */
  }

  try {
    let res;
    if (bodyFrom && bodyTo) {
      res = await syncCampaignsFull(dashboard.id, { from: bodyFrom, to: bodyTo });
    } else if (bodyDays) {
      res = await syncCampaignsFull(dashboard.id, bodyDays);
    } else {
      // período atual (default Hoje). "Máximo" (sem from/to) → 90 dias.
      const { from, to } = await getCurrentPeriod();
      res = from && to
        ? await syncCampaignsFull(dashboard.id, { from: dstr(from), to: dstr(to) })
        : await syncCampaignsFull(dashboard.id, 90);
    }
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Falha ao sincronizar." },
      { status: 500 },
    );
  }
}
