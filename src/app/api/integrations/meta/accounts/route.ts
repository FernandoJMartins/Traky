import { NextResponse } from "next/server";
import { db } from "@/db";
import { adAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/integrations/meta/accounts  { accountId, active }
// Liga/desliga uma conta de anúncio (entra ou não nos números do dashboard).
export async function PATCH(req: Request) {
  let body: { accountId?: string; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  if (!body.accountId || typeof body.active !== "boolean") {
    return NextResponse.json(
      { message: "accountId e active (boolean) são obrigatórios." },
      { status: 400 },
    );
  }

  await db
    .update(adAccounts)
    .set({ active: body.active })
    .where(eq(adAccounts.id, body.accountId));

  return NextResponse.json({ ok: true });
}
