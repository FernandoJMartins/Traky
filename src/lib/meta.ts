// Cliente da Meta Graph API (Marketing API).
// Usado tanto pelo caminho manual (token colado) quanto pelo OAuth.

import { recordUsageFromHeaders } from "./meta-usage";

const API_VERSION = "v21.0";
const BASE = `https://graph.facebook.com/${API_VERSION}`;

export class MetaApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public metaCode?: number,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

async function metaGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { cache: "no-store" });
  recordUsageFromHeaders(res.headers);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: number } }).error;
    throw new MetaApiError(err?.message ?? `Erro Meta (${res.status})`, res.status, err?.code);
  }
  return json as T;
}

// POST/DELETE genérico na Graph API (escrita).
async function metaWrite<T>(
  path: string,
  token: string,
  params: Record<string, string> = {},
  method: "POST" | "DELETE" = "POST",
): Promise<T> {
  const url = new URL(`${BASE}/${path}`);
  const form = new URLSearchParams({ access_token: token, ...params });
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });
  recordUsageFromHeaders(res.headers);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: number } }).error;
    throw new MetaApiError(err?.message ?? `Erro Meta (${res.status})`, res.status, err?.code);
  }
  return json as T;
}

// ---------- Escrita em campanhas ----------
export type CampaignStatus = "ACTIVE" | "PAUSED" | "DELETED";

export function setCampaignStatus(metaCampaignId: string, token: string, status: CampaignStatus) {
  return metaWrite<{ success: boolean }>(metaCampaignId, token, { status });
}

/** Orçamento diário na MENOR unidade da moeda da conta (ex: centavos). */
export function setCampaignDailyBudget(metaCampaignId: string, token: string, minorUnits: number) {
  return metaWrite<{ success: boolean }>(metaCampaignId, token, {
    daily_budget: String(minorUnits),
  });
}

export function deleteCampaign(metaCampaignId: string, token: string) {
  return metaWrite<{ success: boolean }>(metaCampaignId, token, {}, "DELETE");
}

/** Duplica a campanha (deep copy = leva conjuntos e anúncios). Copia PAUSADA. */
export function copyCampaign(metaCampaignId: string, token: string) {
  return metaWrite<{ copied_campaign_id: string }>(`${metaCampaignId}/copies`, token, {
    deep_copy: "true",
    status_option: "PAUSED",
  });
}

type Paged<T> = { data: T[]; paging?: { next?: string } };

// Segue paginação até acabar (limite de segurança).
async function metaGetAll<T>(path: string, token: string, params: Record<string, string>): Promise<T[]> {
  const first = await metaGet<Paged<T>>(path, token, { ...params, limit: "200" });
  let out = first.data ?? [];
  let next = first.paging?.next;
  let guard = 0;
  while (next && guard++ < 25) {
    const res = await fetch(next, { cache: "no-store" });
    recordUsageFromHeaders(res.headers);
    const json: Paged<T> = await res.json();
    if (!res.ok) break;
    out = out.concat(json.data ?? []);
    next = json.paging?.next;
  }
  return out;
}

// ---------- Perfil ----------
export async function getMe(token: string) {
  return metaGet<{ id: string; name: string }>("me", token, { fields: "id,name" });
}

// ---------- Contas de anúncio ----------
const ACCOUNT_STATUS: Record<number, string> = {
  1: "ACTIVE",
  2: "DISABLED",
  3: "UNSETTLED",
  7: "PENDING_RISK_REVIEW",
  8: "PENDING_SETTLEMENT",
  9: "IN_GRACE_PERIOD",
  100: "PENDING_CLOSURE",
  101: "CLOSED",
};

export type MetaAdAccount = {
  id: string; // act_XXXX
  name: string;
  currency: string;
  status: string;
};

export async function listAdAccounts(token: string): Promise<MetaAdAccount[]> {
  const raw = await metaGetAll<{
    id: string;
    name: string;
    currency: string;
    account_status: number;
  }>("me/adaccounts", token, { fields: "id,name,currency,account_status" });
  return raw.map((a) => ({
    id: a.id,
    name: a.name ?? a.id,
    currency: a.currency ?? "BRL",
    status: ACCOUNT_STATUS[a.account_status] ?? String(a.account_status),
  }));
}

// ---------- Insights por campanha (diário) ----------
export type CampaignInsight = {
  campaignId: string;
  campaignName: string;
  date: string; // YYYY-MM-DD
  spendCents: number;
  impressions: number;
  clicks: number;
  pageViews: number;
  initiateCheckouts: number;
};

type RawInsight = {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
};

function actionValue(actions: RawInsight["actions"], types: string[]): number {
  if (!actions) return 0;
  return actions
    .filter((a) => types.includes(a.action_type))
    .reduce((s, a) => s + Number(a.value || 0), 0);
}

/** Puxa insights diários por campanha de uma conta (act_...). */
export async function getCampaignInsights(
  accountId: string,
  token: string,
  since: string, // YYYY-MM-DD
  until: string,
): Promise<CampaignInsight[]> {
  const raw = await metaGetAll<RawInsight>(`${accountId}/insights`, token, {
    level: "campaign",
    fields: "campaign_id,campaign_name,spend,impressions,clicks,actions",
    time_range: JSON.stringify({ since, until }),
    time_increment: "1",
  });
  return raw.map((r) => ({
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    date: r.date_start,
    spendCents: Math.round(parseFloat(r.spend ?? "0") * 100),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    pageViews: actionValue(r.actions, ["landing_page_view", "omni_landing_page_view"]),
    initiateCheckouts: actionValue(r.actions, [
      "initiate_checkout",
      "omni_initiated_checkout",
      "offsite_conversion.fb_pixel_initiate_checkout",
    ]),
  }));
}

// ---------- Drill-down: conjuntos e anúncios (Fase C) ----------
export type BreakdownInsight = {
  entityId: string; // adset_id ou ad_id
  name: string;
  campaignName: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  pageViews: number;
  initiateCheckouts: number;
};

// Filtro opcional por campanhas (endpoint da CONTA — 1 chamada cobre várias campanhas).
function campaignFilter(campaignIds?: string[]): Record<string, string> {
  if (!campaignIds?.length) return {};
  return { filtering: JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }]) };
}

// Insights por conjunto/anúncio de uma conta (opcionalmente filtrado por campanhas).
export async function getBreakdownInsights(
  accountId: string,
  campaignIds: string[] | null,
  token: string,
  level: "adset" | "ad",
  since: string,
  until: string,
): Promise<BreakdownInsight[]> {
  const idField = level === "adset" ? "adset_id" : "ad_id";
  const nameField = level === "adset" ? "adset_name" : "ad_name";
  const raw = await metaGetAll<{
    spend?: string;
    impressions?: string;
    clicks?: string;
    actions?: { action_type: string; value: string }[];
    [k: string]: unknown;
  }>(`${accountId}/insights`, token, {
    level,
    fields: `${idField},${nameField},campaign_name,spend,impressions,clicks,actions`,
    time_range: JSON.stringify({ since, until }),
    ...campaignFilter(campaignIds ?? undefined),
  });
  return raw.map((r) => ({
    entityId: String(r[idField] ?? ""),
    name: String(r[nameField] ?? ""),
    campaignName: String(r.campaign_name ?? ""),
    spendCents: Math.round(parseFloat(r.spend ?? "0") * 100),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    pageViews: actionValue(r.actions, ["landing_page_view", "omni_landing_page_view"]),
    initiateCheckouts: actionValue(r.actions, [
      "initiate_checkout",
      "omni_initiated_checkout",
      "offsite_conversion.fb_pixel_initiate_checkout",
    ]),
  }));
}

// Entidades (campanha): status + orçamento a nível de campanha (CBO ligado).
export type CampaignEntity = {
  id: string;
  name: string;
  effectiveStatus: string;
  dailyBudgetCents: number | null; // moeda da conta; null = sem orçamento na campanha (CBO off)
  lifetimeBudgetCents: number | null;
};
export async function getCampaignEntities(accountId: string, token: string): Promise<CampaignEntity[]> {
  const raw = await metaGetAll<{
    id: string;
    name: string;
    effective_status: string;
    daily_budget?: string;
    lifetime_budget?: string;
  }>(`${accountId}/campaigns`, token, {
    fields: "id,name,effective_status,daily_budget,lifetime_budget",
  });
  return raw.map((c) => ({
    id: c.id,
    name: c.name,
    effectiveStatus: c.effective_status,
    dailyBudgetCents: c.daily_budget != null ? Number(c.daily_budget) : null,
    lifetimeBudgetCents: c.lifetime_budget != null ? Number(c.lifetime_budget) : null,
  }));
}

// Entidades (conjunto): status, orçamento, bid cap.
export type AdSetEntity = {
  id: string;
  campaignId: string;
  name: string;
  status: string;
  effectiveStatus: string;
  dailyBudgetCents: number | null;
  lifetimeBudgetCents: number | null;
  bidCents: number | null;
};

export async function getAdSets(accountId: string, campaignIds: string[] | null, token: string): Promise<AdSetEntity[]> {
  const raw = await metaGetAll<{
    id: string;
    campaign_id?: string;
    name: string;
    status: string;
    effective_status: string;
    daily_budget?: string;
    lifetime_budget?: string;
    bid_amount?: string;
  }>(`${accountId}/adsets`, token, {
    fields: "id,campaign_id,name,status,effective_status,daily_budget,lifetime_budget,bid_amount",
    ...campaignFilter(campaignIds ?? undefined),
  });
  return raw.map((a) => ({
    id: a.id,
    campaignId: String(a.campaign_id ?? ""),
    name: a.name,
    status: a.status,
    effectiveStatus: a.effective_status,
    dailyBudgetCents: a.daily_budget != null ? Number(a.daily_budget) : null,
    lifetimeBudgetCents: a.lifetime_budget != null ? Number(a.lifetime_budget) : null,
    bidCents: a.bid_amount != null ? Number(a.bid_amount) : null,
  }));
}

// Entidades (anúncio): status + conjunto pai.
export type AdEntity = { id: string; adSetId: string; name: string; status: string; effectiveStatus: string };
export async function getAds(accountId: string, campaignIds: string[] | null, token: string): Promise<AdEntity[]> {
  const raw = await metaGetAll<{ id: string; adset_id?: string; name: string; status: string; effective_status: string }>(
    `${accountId}/ads`,
    token,
    { fields: "id,adset_id,name,status,effective_status", ...campaignFilter(campaignIds ?? undefined) },
  );
  return raw.map((a) => ({
    id: a.id,
    adSetId: String(a.adset_id ?? ""),
    name: a.name,
    status: a.status,
    effectiveStatus: a.effective_status,
  }));
}

// Escrita: status, bid cap e orçamento no conjunto.
export function setAdSetStatus(adsetId: string, token: string, status: CampaignStatus) {
  return metaWrite<{ success: boolean }>(adsetId, token, { status });
}
export function setAdSetBid(adsetId: string, token: string, bidMinorUnits: number) {
  return metaWrite<{ success: boolean }>(adsetId, token, { bid_amount: String(bidMinorUnits) });
}
export function setAdSetDailyBudget(adsetId: string, token: string, minorUnits: number) {
  return metaWrite<{ success: boolean }>(adsetId, token, { daily_budget: String(minorUnits) });
}

// Escrita: status do anúncio (ativar/pausar).
export function setAdStatus(adId: string, token: string, status: CampaignStatus) {
  return metaWrite<{ success: boolean }>(adId, token, { status });
}

// ---------- OAuth (pronto pra quando houver App da Meta) ----------
export function getOAuthUrl(state: string): string {
  const appId = process.env.META_APP_ID!;
  const redirect = process.env.META_REDIRECT_URI!;
  const url = new URL(`https://www.facebook.com/${API_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "ads_read,ads_management,business_management");
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; expires_in?: number }> {
  return metaGet("oauth/access_token", "", {
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    code,
  });
}

// Troca token de curta por longa duração (~60 dias).
export async function getLongLivedToken(shortToken: string): Promise<{ access_token: string; expires_in?: number }> {
  return metaGet("oauth/access_token", "", {
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortToken,
  });
}
