import { z } from "zod";
import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Contrato IDÊNTICO ao da Utmify (docs.utmify.com.br/envio-de-vendas).
// Assim qualquer integração que já envia pra Utmify funciona aqui sem mudança.
// ---------------------------------------------------------------------------

export const utmifyPaymentMethod = z.enum([
  "credit_card",
  "boleto",
  "pix",
  "paypal",
  "free_price",
]);

export const utmifyStatus = z.enum([
  "waiting_payment",
  "paid",
  "refused",
  "refunded",
  "chargedback",
]);

const nullableString = z.string().nullish();

export const orderSchema = z.object({
  orderId: z.string().min(1),
  platform: z.string().min(1),
  paymentMethod: utmifyPaymentMethod,
  status: utmifyStatus,
  createdAt: z.string().min(1), // "YYYY-MM-DD HH:MM:SS" UTC
  approvedDate: nullableString,
  refundedAt: nullableString,
  customer: z.object({
    name: z.string(),
    email: z.string(),
    phone: nullableString,
    document: nullableString,
    country: nullableString,
    ip: nullableString,
  }),
  products: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        planId: z.string().nullish(),
        planName: z.string().nullish(),
        quantity: z.number(),
        priceInCents: z.number(),
      }),
    )
    .min(1),
  trackingParameters: z
    .object({
      src: nullableString,
      sck: nullableString,
      utm_source: nullableString,
      utm_campaign: nullableString,
      utm_medium: nullableString,
      utm_content: nullableString,
      utm_term: nullableString,
    })
    .partial()
    .optional(),
  commission: z.object({
    totalPriceInCents: z.number(),
    gatewayFeeInCents: z.number(),
    userCommissionInCents: z.number(),
    currency: z.string().optional().default("BRL"),
  }),
  isTest: z.boolean().optional().default(false),
});

export type UtmifyOrder = z.infer<typeof orderSchema>;

// ---------------------------------------------------------------------------
// Mapeamento Utmify -> interno
// ---------------------------------------------------------------------------

export function mapPaymentMethod(m: z.infer<typeof utmifyPaymentMethod>) {
  const table = {
    credit_card: "card",
    boleto: "boleto",
    pix: "pix",
    paypal: "paypal",
    free_price: "free",
  } as const;
  return table[m];
}

export function mapStatus(s: z.infer<typeof utmifyStatus>) {
  const table = {
    waiting_payment: "pending",
    paid: "approved",
    refused: "refused",
    refunded: "refunded",
    chargedback: "chargeback",
  } as const;
  return table[s];
}

// Inverso: interno -> Utmify (para a API de consulta responder no padrão deles)
export function toUtmifyStatus(s: string) {
  const table: Record<string, string> = {
    pending: "waiting_payment",
    approved: "paid",
    refused: "refused",
    refunded: "refunded",
    chargeback: "chargedback",
  };
  return table[s] ?? s;
}

// Extrai o id da campanha Meta do padrão "{{campaign.name}}|{{campaign.id}}".
export function parseMetaId(utmCampaign?: string | null): string | null {
  if (!utmCampaign) return null;
  const parts = utmCampaign.split("|");
  const last = parts[parts.length - 1]?.trim();
  // só considera se for numérico (id da Meta), evita pegar o nome
  return last && /^\d{5,}$/.test(last) ? last : null;
}

// "YYYY-MM-DD HH:MM:SS" (UTC) -> Date. Aceita ISO também.
export function parseUtcDate(s?: string | null): Date | null {
  if (!s) return null;
  const normalized = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

// Token estilo Utmify: 36 chars base62.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export function generateApiToken(len = 36): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
