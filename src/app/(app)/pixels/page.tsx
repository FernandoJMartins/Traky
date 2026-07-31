import { db } from "@/db";
import { metaPixels, pixels } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getCurrentDashboard } from "@/lib/dashboards";
import { PixelManager } from "@/components/pixels/PixelManager";

export const dynamic = "force-dynamic";

export default async function PixelsPage() {
  const dashboard = await getCurrentDashboard();
  const pixelRows = dashboard
    ? await db.select().from(pixels).where(eq(pixels.dashboardId, dashboard.id))
    : [];
  const pixelIds = pixelRows.map((p) => p.id);
  const metaRows = pixelIds.length
    ? await db.select().from(metaPixels).where(inArray(metaPixels.pixelId, pixelIds))
    : [];

  const data = pixelRows.map((p) => ({
    id: p.id,
    name: p.name,
    productName: p.productName,
    active: p.active,
    sendPurchase: p.sendPurchase,
    sendInitiateCheckout: p.sendInitiateCheckout,
    sendAddToCart: p.sendAddToCart,
    sendLead: p.sendLead,
    sendIp: p.sendIp,
    metaPixels: metaRows
      .filter((m) => m.pixelId === p.id)
      .map((m) => ({ id: m.id, metaPixelId: m.metaPixelId, label: m.label })),
  }));

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pixels de Otimização</h1>
        <p className="text-sm text-muted">
          Reenvia suas vendas pro Facebook server-side (CAPI) — à prova de bloqueio de navegador.
        </p>
      </div>
      <PixelManager pixels={data} />
    </div>
  );
}
