import { NextResponse } from "next/server";
import { getCurrentDashboard } from "@/lib/dashboards";
import { connectManualToken, syncConnection } from "@/lib/meta-sync";
import { MetaApiError } from "@/lib/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/integrations/meta/connect  { accessToken, sync?: boolean }
export async function POST(req: Request) {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) {
    return NextResponse.json({ message: "Nenhum dashboard encontrado." }, { status: 400 });
  }

  let body: { accessToken?: string; sync?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  const accessToken = body.accessToken?.trim();
  if (!accessToken) {
    return NextResponse.json({ message: "accessToken é obrigatório." }, { status: 400 });
  }

  try {
    const { connection, accounts } = await connectManualToken(dashboard.id, accessToken);
    let synced = null;
    if (body.sync !== false) {
      synced = await syncConnection(connection.id);
    }
    return NextResponse.json({
      ok: true,
      connectionId: connection.id,
      profile: connection.name,
      accounts: accounts.map((a) => ({
        metaAccountId: a.id,
        name: a.name,
        currency: a.currency,
        status: a.status,
      })),
      synced,
    });
  } catch (e) {
    if (e instanceof MetaApiError) {
      return NextResponse.json(
        { message: `Meta recusou o token: ${e.message}`, metaCode: e.metaCode },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Erro ao conectar." },
      { status: 500 },
    );
  }
}
