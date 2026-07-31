import { NextResponse } from "next/server";
import { getOAuthUrl } from "@/lib/meta";
import { signState } from "@/lib/oauth-state";
import { getCurrentDashboard } from "@/lib/dashboards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/integrations/meta/oauth/url  → devolve a URL de autorização (JSON).
// Pro fluxo multilogin: o usuário copia e cola no navegador onde a conta FB está logada.
export async function GET() {
  if (!process.env.META_APP_ID || !process.env.META_REDIRECT_URI) {
    return NextResponse.json(
      { message: "OAuth não configurado (META_APP_ID/SECRET/REDIRECT_URI). Use a conexão por token." },
      { status: 501 },
    );
  }
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return NextResponse.json({ message: "Sem dashboard." }, { status: 400 });

  const state = signState(dashboard.id);
  return NextResponse.json({ url: getOAuthUrl(state) });
}
