import { NextResponse } from "next/server";
import { getCurrentDashboard } from "@/lib/dashboards";
import { syncCampaignsFull } from "@/lib/meta-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/campaigns/sync { days? } | { from, to }
// Botão "Sincronizar": puxa da Meta (campanhas/conjuntos/anúncios + gasto) e grava no banco.
// É a ÚNICA porta que toca a Meta a partir da tela de campanhas.
export async function POST(req: Request) {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return NextResponse.json({ message: "Sem dashboard." }, { status: 400 });

  let days = 30;
  let from: string | undefined;
  let to: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.from === "string" && typeof body?.to === "string") {
      from = body.from;
      to = body.to;
    } else if (typeof body?.days === "number" && body.days > 0 && body.days <= 90) {
      days = Math.floor(body.days);
    }
  } catch {
    /* usa 30 */
  }

  try {
    const res = from && to ? await syncCampaignsFull(dashboard.id, { from, to }) : await syncCampaignsFull(dashboard.id, days);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Falha ao sincronizar." },
      { status: 500 },
    );
  }
}
