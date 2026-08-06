import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiCredentials } from "@/db/schema";
import { getCurrentDashboard } from "@/lib/dashboards";
import { getCurrentUser } from "@/lib/auth";
import { generateApiToken } from "@/lib/utmify";
import { webhookCredentialLimitFor } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trimName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return NextResponse.json({ message: "Sem dashboard." }, { status: 400 });

  const credentials = await db
    .select({
      id: apiCredentials.id,
      dashboardId: apiCredentials.dashboardId,
      name: apiCredentials.name,
      revoked: apiCredentials.revoked,
      lastUsedAt: apiCredentials.lastUsedAt,
      createdAt: apiCredentials.createdAt,
    })
    .from(apiCredentials)
    .where(eq(apiCredentials.dashboardId, dashboard.id))
    .orderBy(desc(apiCredentials.createdAt));

  return NextResponse.json({ ok: true, credentials });
}

export async function POST(req: Request) {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return NextResponse.json({ message: "Sem dashboard." }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });

  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* body opcional */
  }

  const name = trimName(body.name) || "Webhooks";
  const limit = webhookCredentialLimitFor(user);
  if (limit !== null) {
    const count = await db
      .select({ id: apiCredentials.id })
      .from(apiCredentials)
      .where(and(eq(apiCredentials.dashboardId, dashboard.id), eq(apiCredentials.revoked, false)));
    if (count.length >= limit) {
      return NextResponse.json(
        { message: `Seu plano permite até ${limit} credencial(ais) ativa(s).` },
        { status: 403 },
      );
    }
  }

  const token = generateApiToken(36);
  const [created] = await db
    .insert(apiCredentials)
    .values({
      id: randomUUID(),
      dashboardId: dashboard.id,
      token,
      name,
    })
    .returning();

  return NextResponse.json({ ok: true, credential: created, token }, { status: 201 });
}