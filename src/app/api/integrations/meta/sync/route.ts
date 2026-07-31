import { NextResponse } from "next/server";
import { db } from "@/db";
import { metaConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentDashboard } from "@/lib/dashboards";
import { syncConnection } from "@/lib/meta-sync";
import { MetaApiError } from "@/lib/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/integrations/meta/sync  { connectionId?, days? }
// Sem connectionId: sincroniza todas as conexões do dashboard primário.
export async function POST(req: Request) {
  let body: { connectionId?: string; days?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* body opcional */
  }

  let connectionIds: string[];
  if (body.connectionId) {
    connectionIds = [body.connectionId];
  } else {
    const dashboard = await getCurrentDashboard();
    if (!dashboard) return NextResponse.json({ message: "Sem dashboard." }, { status: 400 });
    const conns = await db
      .select({ id: metaConnections.id })
      .from(metaConnections)
      .where(eq(metaConnections.dashboardId, dashboard.id));
    connectionIds = conns.map((c) => c.id);
  }

  if (!connectionIds.length) {
    return NextResponse.json({ message: "Nenhuma conexão Meta pra sincronizar." }, { status: 400 });
  }

  try {
    const results = [];
    for (const id of connectionIds) {
      results.push({ connectionId: id, ...(await syncConnection(id, body.days ?? 30)) });
    }
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    if (e instanceof MetaApiError) {
      return NextResponse.json({ message: `Erro Meta: ${e.message}` }, { status: 400 });
    }
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Erro no sync." },
      { status: 500 },
    );
  }
}
