import { NextResponse } from "next/server";
import { getOAuthUrl } from "@/lib/meta";
import { signState } from "@/lib/oauth-state";
import { getCurrentDashboard } from "@/lib/dashboards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/integrations/meta/oauth/start  → redireciona pro consentimento da Meta.
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
  return NextResponse.redirect(getOAuthUrl(state));
}
