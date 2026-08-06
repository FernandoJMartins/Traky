import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiCredentials } from "@/db/schema";
import { getCurrentDashboard } from "@/lib/dashboards";
import { generateApiToken } from "@/lib/utmify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return NextResponse.json({ message: "Sem dashboard." }, { status: 400 });

  const { id } = await params;
  let body: { name?: string; revoked?: boolean; regenerate?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* body opcional */
  }

  const patch: Partial<typeof apiCredentials.$inferInsert> = {};
  if (typeof body.name === "string") patch.name = body.name.trim() || "Webhooks";
  if (typeof body.revoked === "boolean") patch.revoked = body.revoked;
  if (body.regenerate) patch.token = generateApiToken(36);

  const [updated] = await db
    .update(apiCredentials)
    .set(patch)
    .where(and(eq(apiCredentials.id, id), eq(apiCredentials.dashboardId, dashboard.id)))
    .returning();

  if (!updated) return NextResponse.json({ message: "Credencial não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true, credential: updated });
}