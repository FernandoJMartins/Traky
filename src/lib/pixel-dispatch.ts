import { db } from "@/db";
import { metaPixels, pixels } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { CapiEventName, sendEvent } from "./capi";

type SaleForDispatch = {
  externalId: string;
  status: string; // interno: approved | pending | ...
  productName: string;
  valueCents: number;
  currency: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerIp?: string | null;
};

// Decide o evento CAPI a partir do status interno da venda + flags do pixel.
function eventFor(
  status: string,
  p: { sendPurchase: boolean; sendInitiateCheckout: boolean },
): CapiEventName | null {
  if (status === "approved" && p.sendPurchase) return "Purchase";
  if (status === "pending" && p.sendInitiateCheckout) return "InitiateCheckout";
  return null;
}

/**
 * Reenvia a venda como evento server-side pros pixels ativos do dashboard.
 * Best-effort: erros são coletados, nunca derrubam o webhook.
 */
export async function dispatchSaleEvents(dashboardId: string, sale: SaleForDispatch) {
  const activePixels = await db
    .select()
    .from(pixels)
    .where(and(eq(pixels.dashboardId, dashboardId), eq(pixels.active, true)));

  const results: { metaPixelId: string; event: string; ok: boolean; error?: string }[] = [];

  for (const p of activePixels) {
    // filtro opcional por produto
    if (p.productName && p.productName !== sale.productName) continue;

    const eventName = eventFor(sale.status, p);
    if (!eventName) continue;

    const metas = await db
      .select()
      .from(metaPixels)
      .where(and(eq(metaPixels.pixelId, p.id), eq(metaPixels.validated, true)));

    for (const m of metas) {
      try {
        const r = await sendEvent(
          m.metaPixelId,
          m.accessToken,
          {
            eventName,
            eventId: sale.externalId, // dedup com pixel do navegador
            valueCents: sale.valueCents,
            currency: sale.currency,
            user: {
              email: sale.customerEmail,
              phone: sale.customerPhone,
              ip: sale.customerIp,
            },
          },
          { sendIp: p.sendIp },
        );
        results.push({ metaPixelId: m.metaPixelId, event: eventName, ok: r.eventsReceived > 0 });
      } catch (e) {
        results.push({
          metaPixelId: m.metaPixelId,
          event: eventName,
          ok: false,
          error: e instanceof Error ? e.message : "erro",
        });
      }
    }
  }

  return results;
}
