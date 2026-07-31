import webpush from "web-push";
import { db } from "@/db";
import { dashboards, pushSubscriptions } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getNotificationSettings } from "./notifications";

let configured = false;
function ensureVapid(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@utmify.local", pub, priv);
  configured = true;
  return true;
}

function brl(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type SaleForPush = { status: string; valueCents: number; productName: string; utmCampaign: string | null };

/**
 * Dispara push de nova venda pras assinaturas do dashboard, respeitando as prefs.
 * Best-effort: NUNCA lança — é chamado dentro do webhook de vendas.
 */
export async function sendSaleNotification(dashboardId: string, sale: SaleForPush): Promise<void> {
  try {
    if (!ensureVapid()) return;
    if (sale.status !== "approved" && sale.status !== "pending") return;

    const prefs = await getNotificationSettings(dashboardId);
    if (sale.status === "approved" && !prefs.sendApproved) return;
    if (sale.status === "pending" && !prefs.sendPending) return;

    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.dashboardId, dashboardId));
    if (!subs.length) return;

    const [dash] = await db.select({ name: dashboards.name }).from(dashboards).where(eq(dashboards.id, dashboardId)).limit(1);
    const dashboardName = dash?.name ?? "Dashboard";

    const base = sale.status === "approved" ? "Venda aprovada 🎉" : "Venda pendente 🕒";
    const lines: string[] = [];
    if (prefs.showValue) lines.push(brl(sale.valueCents));
    if (prefs.showProduct) lines.push(sale.productName);
    if (prefs.showUtmCampaign && sale.utmCampaign) lines.push(`utm_campaign: ${sale.utmCampaign}`);
    const payload = JSON.stringify({
      title: prefs.showDashboardName ? `${base} · ${dashboardName}` : base,
      body: lines.join(" · ") || "Nova venda registrada",
      url: "/",
      tag: `sale-${Date.now()}`,
    });

    const dead: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) dead.push(s.endpoint); // assinatura expirada
        }
      }),
    );
    if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, dead));
  } catch {
    // silencioso — não pode quebrar a ingestão de vendas
  }
}
