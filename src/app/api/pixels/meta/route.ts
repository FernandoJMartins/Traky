import { NextResponse } from "next/server";
import { db } from "@/db";
import { metaPixels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validatePixel, CapiError } from "@/lib/capi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/pixels/meta  { pixelId, metaPixelId, accessToken, label? }
// Valida id+token na Meta antes de salvar.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  const pixelId = typeof body.pixelId === "string" ? body.pixelId : "";
  const metaPixelId = typeof body.metaPixelId === "string" ? body.metaPixelId.trim() : "";
  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  const label = typeof body.label === "string" && body.label ? body.label : null;

  if (!pixelId || !metaPixelId || !accessToken) {
    return NextResponse.json(
      { message: "pixelId, metaPixelId e accessToken são obrigatórios." },
      { status: 400 },
    );
  }

  // Valida na Meta (id + token precisam bater)
  try {
    await validatePixel(metaPixelId, accessToken);
  } catch (e) {
    const msg = e instanceof CapiError ? e.message : "Falha ao validar pixel";
    return NextResponse.json({ message: `Pixel inválido: ${msg}` }, { status: 400 });
  }

  const [created] = await db
    .insert(metaPixels)
    .values({
      pixelId,
      metaPixelId,
      accessToken,
      label,
      validated: true,
      validatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [metaPixels.pixelId, metaPixels.metaPixelId],
      set: { accessToken, label, validated: true, validatedAt: new Date() },
    })
    .returning({ id: metaPixels.id, metaPixelId: metaPixels.metaPixelId, label: metaPixels.label });

  return NextResponse.json({ ok: true, metaPixel: created });
}

// DELETE /api/pixels/meta?id=...
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ message: "id obrigatório." }, { status: 400 });
  await db.delete(metaPixels).where(eq(metaPixels.id, id));
  return NextResponse.json({ ok: true });
}
