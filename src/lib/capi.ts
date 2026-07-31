// Cliente da Conversions API (CAPI) da Meta — envio de eventos server-side.
import { createHash } from "crypto";

const API_VERSION = "v21.0";
const BASE = `https://graph.facebook.com/${API_VERSION}`;

export class CapiError extends Error {
  constructor(
    message: string,
    public status: number,
    public metaCode?: number,
  ) {
    super(message);
    this.name = "CapiError";
  }
}

// A Meta exige SHA-256 de dados pessoais (email/telefone), lowercase e sem espaços.
function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function hashEmail(email?: string | null): string[] | undefined {
  if (!email) return undefined;
  return [sha256(email)];
}

function hashPhone(phone?: string | null): string[] | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  return digits ? [sha256(digits)] : undefined;
}

export type CapiEventName =
  | "Purchase"
  | "InitiateCheckout"
  | "AddToCart"
  | "Lead";

export type CapiUserData = {
  email?: string | null;
  phone?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbc?: string | null;
  fbp?: string | null;
};

export type CapiEvent = {
  eventName: CapiEventName;
  eventId: string; // dedup com o pixel do navegador (usar orderId)
  eventTime?: number; // unix seconds
  valueCents?: number;
  currency?: string;
  sourceUrl?: string;
  user: CapiUserData;
};

/** Valida um pixel: o token precisa ter acesso a esse pixel id. */
export async function validatePixel(
  metaPixelId: string,
  token: string,
): Promise<{ id: string; name?: string }> {
  const url = new URL(`${BASE}/${metaPixelId}`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: number } }).error;
    throw new CapiError(err?.message ?? `Pixel inválido (${res.status})`, res.status, err?.code);
  }
  return json as { id: string; name?: string };
}

/** Envia um evento para um pixel da Meta via CAPI. */
export async function sendEvent(
  metaPixelId: string,
  token: string,
  event: CapiEvent,
  opts: { sendIp?: boolean } = {},
): Promise<{ eventsReceived: number; fbtraceId?: string }> {
  const userData: Record<string, unknown> = {};
  const em = hashEmail(event.user.email);
  const ph = hashPhone(event.user.phone);
  if (em) userData.em = em;
  if (ph) userData.ph = ph;
  if (opts.sendIp && event.user.ip) userData.client_ip_address = event.user.ip;
  if (event.user.userAgent) userData.client_user_agent = event.user.userAgent;
  if (event.user.fbc) userData.fbc = event.user.fbc;
  if (event.user.fbp) userData.fbp = event.user.fbp;

  const payload = {
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTime ?? Math.floor(Date.now() / 1000),
        action_source: "website",
        event_id: event.eventId,
        ...(event.sourceUrl ? { event_source_url: event.sourceUrl } : {}),
        user_data: userData,
        custom_data: {
          currency: event.currency ?? "BRL",
          value: (event.valueCents ?? 0) / 100,
        },
      },
    ],
  };

  const url = new URL(`${BASE}/${metaPixelId}/events`);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: number } }).error;
    throw new CapiError(err?.message ?? `Falha CAPI (${res.status})`, res.status, err?.code);
  }
  const j = json as { events_received?: number; fbtrace_id?: string };
  return { eventsReceived: j.events_received ?? 0, fbtraceId: j.fbtrace_id };
}
