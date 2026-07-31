import { NextResponse } from "next/server";
import { db } from "@/db";
import { sales } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { extractToken, resolveToken } from "@/lib/api-auth";
import {
  mapPaymentMethod,
  mapStatus,
  orderSchema,
  parseMetaId,
  parseUtcDate,
} from "@/lib/utmify";
import { dispatchSaleEvents } from "@/lib/pixel-dispatch";
import { sendSaleNotification } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/api-credentials/orders  (compatível com a API da Utmify)
export async function POST(req: Request) {
  const token = extractToken(req.headers);
  const cred = await resolveToken(token);
  if (!cred) {
    return NextResponse.json(
      { message: "Token de API inválido ou ausente (header x-api-token)." },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ message: "Body inválido: JSON esperado." }, { status: 400 });
  }

  const parsed = orderSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Payload inválido.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const order = parsed.data;

  const tp = order.trackingParameters ?? {};
  const firstProduct = order.products[0];
  const status = mapStatus(order.status);

  const row = {
    dashboardId: cred.dashboardId,
    externalId: order.orderId,
    platform: order.platform,
    productName: firstProduct?.name ?? "Produto",
    valueCents: order.commission.totalPriceInCents,
    status,
    paymentMethod: mapPaymentMethod(order.paymentMethod),
    gatewayFeeCents: order.commission.gatewayFeeInCents,
    userCommissionCents: order.commission.userCommissionInCents,
    currency: order.commission.currency ?? "BRL",
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    customerPhone: order.customer.phone ?? null,
    customerDocument: order.customer.document ?? null,
    customerCountry: order.customer.country ?? null,
    customerIp: order.customer.ip ?? null,
    src: tp.src ?? null,
    sck: tp.sck ?? null,
    utmSource: tp.utm_source ?? null,
    utmCampaign: tp.utm_campaign ?? null,
    utmMedium: tp.utm_medium ?? null,
    utmContent: tp.utm_content ?? null,
    utmTerm: tp.utm_term ?? null,
    metaCampaignId: parseMetaId(tp.utm_campaign),
    isTest: order.isTest ?? false,
    createdAt: parseUtcDate(order.createdAt) ?? new Date(),
    approvedAt: parseUtcDate(order.approvedDate),
    refundedAt: parseUtcDate(order.refundedAt),
  };

  // Status anterior (pra só notificar em venda NOVA ou que mudou de status —
  // evita push duplicado em retry do gateway com o mesmo status).
  const [existing] = await db
    .select({ status: sales.status })
    .from(sales)
    .where(and(eq(sales.dashboardId, cred.dashboardId), eq(sales.externalId, order.orderId)))
    .limit(1);
  const isNewOrChanged = !existing || existing.status !== row.status;

  // Idempotência + atualização de status (pending -> paid -> refunded...).
  await db
    .insert(sales)
    .values(row)
    .onConflictDoUpdate({
      target: [sales.dashboardId, sales.externalId],
      set: {
        status: row.status,
        paymentMethod: row.paymentMethod,
        valueCents: row.valueCents,
        gatewayFeeCents: row.gatewayFeeCents,
        userCommissionCents: row.userCommissionCents,
        approvedAt: row.approvedAt,
        refundedAt: row.refundedAt,
      },
    });

  // Reenvia server-side pros pixels da Meta (CAPI). Best-effort.
  const pixelResults = await dispatchSaleEvents(cred.dashboardId, {
    externalId: row.externalId,
    status: row.status,
    productName: row.productName,
    valueCents: row.valueCents,
    currency: row.currency,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    customerIp: row.customerIp,
  }).catch(() => []);

  // Push PWA de nova venda (best-effort; sendSaleNotification nunca lança).
  if (!row.isTest && isNewOrChanged) {
    await sendSaleNotification(cred.dashboardId, {
      status: row.status,
      valueCents: row.valueCents,
      productName: row.productName,
      utmCampaign: row.utmCampaign,
    });
  }

  return NextResponse.json(
    { ok: true, orderId: order.orderId, status, pixelEvents: pixelResults.length },
    { status: 200 },
  );
}
