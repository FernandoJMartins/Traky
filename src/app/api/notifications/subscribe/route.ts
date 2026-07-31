import { NextResponse } from "next/server";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentDashboard } from "@/lib/dashboards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubBody = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

// POST — registra a assinatura de push do navegador atual no dashboard atual.
export async function POST(req: Request) {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return NextResponse.json({ message: "Sem dashboard." }, { status: 400 });

  let body: SubBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ message: "Assinatura inválida." }, { status: 400 });
  }

  await db
    .insert(pushSubscriptions)
    .values({ dashboardId: dashboard.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { dashboardId: dashboard.id, p256dh: body.keys.p256dh, auth: body.keys.auth },
    });

  return NextResponse.json({ ok: true });
}

// DELETE — remove a assinatura (desativar no dispositivo).
export async function DELETE(req: Request) {
  let body: SubBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  if (!body.endpoint) return NextResponse.json({ message: "endpoint obrigatório." }, { status: 400 });
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint));
  return NextResponse.json({ ok: true });
}
