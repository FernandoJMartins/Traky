import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DASHBOARD_COOKIE, listDashboards } from "@/lib/dashboards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/dashboards/switch { dashboardId } — troca o dashboard atual (cookie)
export async function POST(req: Request) {
  let body: { dashboardId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  if (!body.dashboardId) {
    return NextResponse.json({ message: "dashboardId obrigatório." }, { status: 400 });
  }

  const all = await listDashboards();
  if (!all.some((d) => d.id === body.dashboardId)) {
    return NextResponse.json({ message: "Dashboard não encontrado." }, { status: 404 });
  }

  const cookieStore = await cookies();
  cookieStore.set(DASHBOARD_COOKIE, body.dashboardId, {
    path: "/",
    sameSite: "lax",
    maxAge: 31536000,
  });
  return NextResponse.json({ ok: true });
}
