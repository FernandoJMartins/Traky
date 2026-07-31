import { NextResponse } from "next/server";
import { db } from "@/db";
import { notificationSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentDashboard } from "@/lib/dashboards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = ["sendPending", "sendApproved", "showValue", "showProduct", "showUtmCampaign", "showDashboardName"] as const;

// PATCH /api/notifications/settings — salva as opções de notificação do dashboard atual.
export async function PATCH(req: Request) {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return NextResponse.json({ message: "Sem dashboard." }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }

  const patch: Record<string, boolean> = {};
  for (const f of FIELDS) if (typeof body[f] === "boolean") patch[f] = body[f] as boolean;

  await db
    .insert(notificationSettings)
    .values({ dashboardId: dashboard.id, ...patch, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: notificationSettings.dashboardId,
      set: { ...patch, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}
