import { NextResponse } from "next/server";
import { extractToken, resolveToken } from "@/lib/api-auth";
import { getSummary } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /public-api/v1/dashboards/{dashboardId}/summary  (compatível com a Utmify)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ dashboardId: string }> },
) {
  const { dashboardId } = await params;

  const token = extractToken(req.headers);
  const cred = await resolveToken(token);
  if (!cred) {
    return NextResponse.json(
      { message: "Token inválido ou ausente (x-api-key ou Authorization: Bearer)." },
      { status: 401 },
    );
  }
  // o dashboard consultado precisa estar no escopo da credencial
  if (cred.dashboardId !== dashboardId) {
    return NextResponse.json(
      { message: "Dashboard fora do escopo desta credencial." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ message: "Body inválido: JSON esperado." }, { status: 400 });
  }

  const from = typeof body.from === "string" ? new Date(body.from) : undefined;
  const to = typeof body.to === "string" ? new Date(body.to) : undefined;

  const summary = await getSummary(dashboardId, {
    from: from && !isNaN(from.getTime()) ? from : undefined,
    to: to && !isNaN(to.getTime()) ? to : undefined,
    productNames: Array.isArray(body.productNames) ? (body.productNames as string[]) : undefined,
    platforms: Array.isArray(body.platforms) ? (body.platforms as string[]) : undefined,
    metaAdAccountIds: Array.isArray(body.metaAdAccountIds)
      ? (body.metaAdAccountIds as string[])
      : undefined,
  });

  if (!summary) {
    return NextResponse.json({ message: "Dashboard não encontrado." }, { status: 404 });
  }

  return NextResponse.json(summary, { status: 200 });
}
