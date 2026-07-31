import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { dashboards } from "@/db/schema";
import { DASHBOARD_COOKIE, listDashboards } from "@/lib/dashboards";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dashboards — lista
export async function GET() {
  const all = await listDashboards();
  return NextResponse.json({ dashboards: all });
}

// POST /api/dashboards — cria e já seleciona (cookie)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ message: "Nome é obrigatório." }, { status: 400 });

  const [created] = await db
    .insert(dashboards)
    .values({
      userId: user.id,
      name,
      currency: typeof body.currency === "string" ? body.currency : "BRL",
      timezone: typeof body.timezone === "string" ? body.timezone : "America/Sao_Paulo",
      countInterest: body.countInterest !== false,
    })
    .returning();

  const cookieStore = await cookies();
  cookieStore.set(DASHBOARD_COOKIE, created.id, { path: "/", sameSite: "lax", maxAge: 31536000 });

  return NextResponse.json({ ok: true, dashboard: created });
}
