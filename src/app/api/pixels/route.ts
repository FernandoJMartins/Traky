import { NextResponse } from "next/server";
import { db } from "@/db";
import { pixels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentDashboard } from "@/lib/dashboards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/pixels  — cria um Pixel de otimização
export async function POST(req: Request) {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return NextResponse.json({ message: "Sem dashboard." }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ message: "Nome é obrigatório." }, { status: 400 });

  const [created] = await db
    .insert(pixels)
    .values({
      dashboardId: dashboard.id,
      name,
      productName: typeof body.productName === "string" && body.productName ? body.productName : null,
      sendPurchase: body.sendPurchase !== false,
      sendInitiateCheckout: body.sendInitiateCheckout === true,
      sendAddToCart: body.sendAddToCart === true,
      sendLead: body.sendLead === true,
      sendIp: body.sendIp !== false,
    })
    .returning();

  return NextResponse.json({ ok: true, pixel: created });
}

// PATCH /api/pixels  — atualiza flags / toggle
export async function PATCH(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  const pixelId = typeof body.pixelId === "string" ? body.pixelId : null;
  if (!pixelId) return NextResponse.json({ message: "pixelId obrigatório." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of [
    "active",
    "sendPurchase",
    "sendInitiateCheckout",
    "sendAddToCart",
    "sendLead",
    "sendIp",
  ]) {
    if (typeof body[k] === "boolean") patch[k] = body[k];
  }
  if (typeof body.name === "string") patch.name = body.name;
  if ("productName" in body) patch.productName = body.productName || null;

  if (Object.keys(patch).length) {
    await db.update(pixels).set(patch).where(eq(pixels.id, pixelId));
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/pixels?id=...
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ message: "id obrigatório." }, { status: 400 });
  await db.delete(pixels).where(eq(pixels.id, id));
  return NextResponse.json({ ok: true });
}
