import { db } from "@/db";
import { adAccounts, adInsights, adSets, ads, campaigns, dashboards, sales } from "@/db/schema";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getCurrentDashboard } from "./dashboards";
import { getCurrentPeriod } from "./period";
import { getBRLRates, toBRLCentsWith } from "./fx";
import { parseMetaId } from "./utmify";

const div = (a: number, b: number) => (b > 0 ? a / b : null);

// Monta uma linha padrão (mesma forma p/ conta/campanha/conjunto/anúncio).
// spend/revenue/budget já em centavos de BRL. Calcula imposto, lucro e métricas.
function buildRow(base: {
  id: string;
  metaId: string;
  name: string;
  status: "active" | "paused" | "restricted";
  accountId: string;
  accountName: string;
  currency: string;
  product: string | null;
  products: string[];
  budgetCents: number;
  bidCents: number | null;
  parentName: string | null;
  effectiveStatus: string | null; // veiculação granular da Meta
  issueReason: string | null; // motivo da restrição
  createdAt: string;
  spend: number;
  revenue: number;
  pendingRevenue: number;
  approved: number;
  pending: number;
  impressions: number;
  clicks: number;
  pageViews: number;
  ics: number;
}) {
  // Imposto Meta Ads só em contas BRL — contas gringas (USD/EUR...) não pagam.
  const metaTax = base.currency === "BRL" ? Math.round(base.spend * META_TAX_RATE) : 0;
  const profit = base.revenue - base.spend - metaTax;
  return {
    id: base.id,
    metaCampaignId: base.metaId,
    name: base.name,
    status: base.status,
    accountId: base.accountId,
    accountName: base.accountName,
    currency: base.currency,
    product: base.product,
    products: base.products,
    budgetCents: base.budgetCents,
    bidCents: base.bidCents,
    parentName: base.parentName,
    effectiveStatus: base.effectiveStatus,
    issueReason: base.issueReason,
    createdAt: base.createdAt,
    pending: base.pending,
    sales: base.approved,
    pendingRevenueCents: base.pendingRevenue,
    revenueCents: base.revenue,
    spendCents: base.spend,
    metaTaxCents: metaTax,
    profitCents: profit,
    impressions: base.impressions,
    clicks: base.clicks,
    pageViews: base.pageViews,
    initiateCheckouts: base.ics,
    roi: div(profit, base.spend),
    roas: div(base.revenue, base.spend),
    margin: div(profit, base.revenue),
    cpaCents: base.approved > 0 ? Math.round(base.spend / base.approved) : null,
    cpcCents: base.clicks > 0 ? Math.round(base.spend / base.clicks) : null,
    cpmCents: base.impressions > 0 ? Math.round((base.spend / base.impressions) * 1000) : null,
    cpvCents: base.pageViews > 0 ? Math.round(base.spend / base.pageViews) : null,
    ctr: div(base.clicks, base.impressions),
  };
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Imposto da Meta sobre gastos em anúncios — 12,50% em todas as contas BRL (legado).
// TODO: tornar configurável por conta quando houver contas não-BRL.
export const META_TAX_RATE = 0.125;

// ---------------------------------------------------------------------------
// API de consulta — resposta IDÊNTICA à da Utmify
// POST /public-api/v1/dashboards/{dashboardId}/summary  (valores em centavos)
// ---------------------------------------------------------------------------
export type SummaryFilters = {
  from?: Date;
  to?: Date;
  productNames?: string[];
  platforms?: string[];
  metaAdAccountIds?: string[];
};

export async function getSummary(dashboardId: string, filters: SummaryFilters = {}) {
  const [dash] = await db.select().from(dashboards).where(eq(dashboards.id, dashboardId)).limit(1);
  if (!dash) return null;

  const { from, to } = filters;

  // --- vendas do período ---
  const saleConds = [eq(sales.dashboardId, dashboardId)];
  if (from) saleConds.push(gte(sales.createdAt, from));
  if (to) saleConds.push(lte(sales.createdAt, to));
  if (filters.productNames?.length)
    saleConds.push(inArray(sales.productName, filters.productNames));
  if (filters.platforms?.length) saleConds.push(inArray(sales.platform, filters.platforms));
  const rows = await db.select().from(sales).where(and(...saleConds));

  // --- gasto de anúncios do período (Meta) ---
  let accts = await db.select().from(adAccounts).where(eq(adAccounts.dashboardId, dashboardId));
  if (filters.metaAdAccountIds?.length)
    accts = accts.filter((a) => filters.metaAdAccountIds!.includes(a.metaAccountId));
  const acctIds = accts.map((a) => a.id);
  const camps = acctIds.length
    ? await db.select().from(campaigns).where(inArray(campaigns.adAccountId, acctIds))
    : [];
  const campIds = camps.map((c) => c.id);

  const insightConds = campIds.length ? [inArray(adInsights.campaignId, campIds)] : [];
  if (campIds.length && from) insightConds.push(gte(adInsights.date, toDateStr(from)));
  if (campIds.length && to) insightConds.push(lte(adInsights.date, toDateStr(to)));
  const insights = campIds.length
    ? await db.select().from(adInsights).where(and(...insightConds))
    : [];

  // --- agregações ---
  const by = (st: string) => rows.filter((r) => r.status === st);
  const sum = (arr: typeof rows, f: (r: (typeof rows)[number]) => number) =>
    arr.reduce((s, r) => s + f(r), 0);

  const approved = by("approved");
  const gross = sum(approved, (r) => r.valueCents);
  const fees = sum(approved, (r) => r.gatewayFeeCents);
  const net = gross - fees;

  const spend = insights.reduce((s, i) => s + i.spendCents, 0);
  const clicks = insights.reduce((s, i) => s + i.clicks, 0);
  const pageViews = insights.reduce((s, i) => s + i.pageViews, 0);
  const initiateCheckouts = insights.reduce((s, i) => s + i.initiateCheckouts, 0);

  const productsCost = 0;
  // Imposto Meta Ads só em contas BRL — soma só o gasto das contas BRL.
  const brlAccountIds = new Set(accts.filter((a) => a.currency === "BRL").map((a) => a.id));
  const brlCampIds = new Set(camps.filter((c) => brlAccountIds.has(c.adAccountId)).map((c) => c.id));
  const brlSpend = insights.filter((i) => brlCampIds.has(i.campaignId)).reduce((s, i) => s + i.spendCents, 0);
  const metaTax = Math.round(brlSpend * META_TAX_RATE); // 12,5% só em contas BRL
  const profit = net - spend - metaTax - productsCost;
  const approvedCount = approved.length;

  const div = (a: number, b: number) => (b > 0 ? a / b : null);

  return {
    dashboardId,
    currency: dash.currency,
    viewType: "Normal" as const,
    period: {
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
    },
    orders: {
      total: rows.length,
      approved: approvedCount,
      pending: by("pending").length,
      refunded: by("refunded").length,
      chargedback: by("chargeback").length,
    },
    revenue: {
      gross,
      net,
      pending: sum(by("pending"), (r) => r.valueCents),
      refunded: sum(by("refunded"), (r) => r.valueCents),
      chargeback: sum(by("chargeback"), (r) => r.valueCents),
    },
    ads: {
      spend,
      byPlatform: { meta: spend, google: 0, kwai: 0, tiktok: 0, taboola: 0 },
      clicks,
      pageViews,
      initiateCheckouts,
      leads: 0,
    },
    costs: { fees, taxes: 0, metaAdsTax: metaTax, productsCost, customSpent: 0 },
    result: {
      profit,
      roas: div(gross, spend),
      roi: div(profit, spend),
      profitMargin: div(profit, gross),
      avgTicket: div(gross, approvedCount),
      cpa: div(spend, approvedCount),
      arpu: div(gross, approvedCount),
    },
  };
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

// ---------------------------------------------------------------------------
// Central de campanhas — agrega por campanha no período atual (só leitura).
// ---------------------------------------------------------------------------
export type CampaignsData = Awaited<ReturnType<typeof getCampaignsData>>;

export async function getCampaignsData(opts?: { dashboardId?: string; from?: Date | null; to?: Date | null }) {
  // Sem opts → contexto de request (cookies). Com opts → uso pelo agendador (sem cookies).
  let dashboard;
  if (opts?.dashboardId) {
    [dashboard] = await db.select().from(dashboards).where(eq(dashboards.id, opts.dashboardId)).limit(1);
  } else {
    dashboard = await getCurrentDashboard();
  }
  if (!dashboard) return null;
  const { from, to } = opts ? { from: opts.from ?? null, to: opts.to ?? null } : await getCurrentPeriod();

  const accounts = await db
    .select()
    .from(adAccounts)
    .where(and(eq(adAccounts.dashboardId, dashboard.id), eq(adAccounts.active, true)));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const accountIds = accounts.map((a) => a.id);

  const camps = accountIds.length
    ? await db.select().from(campaigns).where(inArray(campaigns.adAccountId, accountIds))
    : [];
  const campIds = camps.map((c) => c.id);

  const insightConds = campIds.length ? [inArray(adInsights.campaignId, campIds)] : [];
  if (campIds.length && from) insightConds.push(gte(adInsights.date, toDateStr(from)));
  if (campIds.length && to) insightConds.push(lte(adInsights.date, toDateStr(to)));
  const insights = campIds.length
    ? await db.select().from(adInsights).where(and(...insightConds))
    : [];

  const saleConds = [eq(sales.dashboardId, dashboard.id)];
  if (from) saleConds.push(gte(sales.createdAt, from));
  if (to) saleConds.push(lte(sales.createdAt, to));
  const allSales = await db.select().from(sales).where(and(...saleConds));

  // insights agregados por campanha (id nosso)
  const insByCamp = new Map<
    string,
    { spend: number; impressions: number; clicks: number; pageViews: number; ics: number }
  >();
  for (const i of insights) {
    const c = insByCamp.get(i.campaignId) ?? { spend: 0, impressions: 0, clicks: 0, pageViews: 0, ics: 0 };
    c.spend += i.spendCents;
    c.impressions += i.impressions;
    c.clicks += i.clicks;
    c.pageViews += i.pageViews;
    c.ics += i.initiateCheckouts;
    insByCamp.set(i.campaignId, c);
  }

  // vendas agregadas por metaCampaignId
  const salesByMeta = new Map<
    string,
    { approved: number; pending: number; revenue: number; pendingRevenue: number; products: Set<string> }
  >();
  for (const s of allSales) {
    if (!s.metaCampaignId) continue;
    const c =
      salesByMeta.get(s.metaCampaignId) ??
      { approved: 0, pending: 0, revenue: 0, pendingRevenue: 0, products: new Set<string>() };
    if (s.status === "approved") {
      c.approved += 1;
      c.revenue += s.valueCents;
    } else if (s.status === "pending") {
      c.pending += 1;
      c.pendingRevenue += s.valueCents;
    }
    c.products.add(s.productName);
    salesByMeta.set(s.metaCampaignId, c);
  }

  const rates = await getBRLRates();
  const toBRL = (cents: number, cur: string) => toBRLCentsWith(cents, cur, rates);
  const campById = new Map(camps.map((c) => [c.id, c]));

  const rows = camps.map((c) => {
    const acc = accountById.get(c.adAccountId);
    const cur = acc?.currency ?? "BRL";
    const ins = insByCamp.get(c.id) ?? { spend: 0, impressions: 0, clicks: 0, pageViews: 0, ics: 0 };
    const sl =
      salesByMeta.get(c.metaCampaignId) ??
      { approved: 0, pending: 0, revenue: 0, pendingRevenue: 0, products: new Set<string>() };
    const restricted = acc && acc.accountStatus !== "ACTIVE" && acc.accountStatus != null;
    return buildRow({
      id: c.id,
      metaId: c.metaCampaignId,
      name: c.name,
      status: restricted ? "restricted" : c.status,
      accountId: c.adAccountId,
      accountName: acc?.name ?? "—",
      currency: cur,
      product: [...sl.products][0] ?? null,
      products: [...sl.products],
      budgetCents: toBRL(c.budgetCents, cur), // orçamento nível campanha (CBO); 0 = N/A
      bidCents: null,
      parentName: null,
      effectiveStatus: c.effectiveStatus,
      issueReason: c.issuesInfo,
      createdAt: c.createdAt.toISOString(),
      spend: toBRL(ins.spend, cur),
      revenue: sl.revenue,
      pendingRevenue: sl.pendingRevenue,
      approved: sl.approved,
      pending: sl.pending,
      impressions: ins.impressions,
      clicks: ins.clicks,
      pageViews: ins.pageViews,
      ics: ins.ics,
    });
  });

  const products = [...new Set(allSales.map((s) => s.productName))].sort();

  // --------- Série diária dos últimos 7 dias (independente do período) ---------
  const days: string[] = [];
  const base = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const dayFrom = days[0];
  const metaToId = new Map(camps.map((c) => [c.metaCampaignId, c.id]));

  const ins7 = campIds.length
    ? await db
        .select()
        .from(adInsights)
        .where(and(inArray(adInsights.campaignId, campIds), gte(adInsights.date, dayFrom)))
    : [];
  const sales7 = await db
    .select()
    .from(sales)
    .where(and(eq(sales.dashboardId, dashboard.id), gte(sales.createdAt, new Date(dayFrom + "T00:00:00"))));

  // spend[campId][date] e revenue[campId][date]
  const spendMap = new Map<string, Map<string, number>>();
  for (const i of ins7) {
    const m = spendMap.get(i.campaignId) ?? new Map();
    m.set(i.date, (m.get(i.date) ?? 0) + i.spendCents);
    spendMap.set(i.campaignId, m);
  }
  const revMap = new Map<string, Map<string, number>>();
  for (const s of sales7) {
    if (s.status !== "approved" || !s.metaCampaignId) continue;
    const cid = metaToId.get(s.metaCampaignId);
    if (!cid) continue;
    const day = new Date(s.createdAt).toISOString().slice(0, 10);
    const m = revMap.get(cid) ?? new Map();
    m.set(day, (m.get(day) ?? 0) + s.valueCents);
    revMap.set(cid, m);
  }

  const daily: Record<string, { profit: number[]; revenue: number[]; spend: number[] }> = {};
  for (const c of camps) {
    const cur = accountById.get(c.adAccountId)?.currency ?? "BRL";
    const sp = spendMap.get(c.id);
    const rv = revMap.get(c.id);
    const profit: number[] = [];
    const revenue: number[] = [];
    const spend: number[] = [];
    for (const d of days) {
      const s = toBRL(sp?.get(d) ?? 0, cur);
      const r = rv?.get(d) ?? 0;
      const tax = cur === "BRL" ? Math.round(s * META_TAX_RATE) : 0; // imposto só BRL
      spend.push(s / 100);
      revenue.push(r / 100);
      profit.push((r - s - tax) / 100);
    }
    daily[c.id] = { profit, revenue, spend };
  }

  // Só campanhas com atividade no período (gastaram ou venderam). Sem isso,
  // apareciam todas as campanhas de todas as contas mesmo sem nenhum dado.
  const hasActivity = (r: { spendCents: number; sales: number; pending: number }) =>
    r.spendCents > 0 || r.sales > 0 || r.pending > 0;
  const rowsWithActivity = rows.filter(hasActivity);

  // ---------- Nível CONTA (agrega as campanhas por conta; orçamento = N/A) ----------
  type Agg = { spend: number; revenue: number; pendingRevenue: number; approved: number; pending: number; impressions: number; clicks: number; pageViews: number; ics: number; products: Set<string> };
  const zero = (): Agg => ({ spend: 0, revenue: 0, pendingRevenue: 0, approved: 0, pending: 0, impressions: 0, clicks: 0, pageViews: 0, ics: 0, products: new Set() });
  const acctAgg = new Map<string, Agg>();
  for (const r of rows) {
    const a = acctAgg.get(r.accountId) ?? zero();
    a.spend += r.spendCents; a.revenue += r.revenueCents; a.pendingRevenue += r.pendingRevenueCents;
    a.approved += r.sales; a.pending += r.pending; a.impressions += r.impressions;
    a.clicks += r.clicks; a.pageViews += r.pageViews; a.ics += r.initiateCheckouts;
    r.products.forEach((p) => a.products.add(p));
    acctAgg.set(r.accountId, a);
  }
  const accountRows = accounts
    .map((acc) => {
      const a = acctAgg.get(acc.id) ?? zero();
      const restricted = acc.accountStatus !== "ACTIVE" && acc.accountStatus != null;
      return buildRow({
        id: acc.id, metaId: acc.metaAccountId, name: acc.name,
        status: restricted ? "restricted" : "active",
        accountId: acc.id, accountName: acc.name, currency: acc.currency,
        product: null, products: [...a.products], budgetCents: 0, bidCents: null, parentName: null,
        effectiveStatus: acc.accountStatus, issueReason: null,
        createdAt: acc.createdAt.toISOString(),
        spend: a.spend, revenue: a.revenue, pendingRevenue: a.pendingRevenue,
        approved: a.approved, pending: a.pending, impressions: a.impressions,
        clicks: a.clicks, pageViews: a.pageViews, ics: a.ics,
      });
    })
    .filter(hasActivity);

  // ---------- Vendas por conjunto (utm_medium) e por anúncio (utm_content) ----------
  const revByEntity = (key: (s: (typeof allSales)[number]) => string | null) => {
    const m = new Map<string, Agg>();
    for (const s of allSales) {
      const id = key(s);
      if (!id) continue;
      const a = m.get(id) ?? zero();
      if (s.status === "approved") { a.approved += 1; a.revenue += s.valueCents; }
      else if (s.status === "pending") { a.pending += 1; a.pendingRevenue += s.valueCents; }
      a.products.add(s.productName);
      m.set(id, a);
    }
    return m;
  };
  const revByAdset = revByEntity((s) => parseMetaId(s.utmMedium));
  const revByAd = revByEntity((s) => parseMetaId(s.utmContent));

  // ---------- Nível CONJUNTO (lê do banco; snapshot da última sincronização) ----------
  const adsetRowsDb = campIds.length
    ? await db.select().from(adSets).where(inArray(adSets.campaignId, campIds))
    : [];
  const adsetById = new Map(adsetRowsDb.map((a) => [a.id, a]));
  let lastSync: Date | null = null;
  const adsetRows = adsetRowsDb
    .map((a) => {
      const camp = campById.get(a.campaignId);
      const acc = camp ? accountById.get(camp.adAccountId) : undefined;
      const cur = acc?.currency ?? "BRL";
      if (a.syncedAt && (!lastSync || a.syncedAt > lastSync)) lastSync = a.syncedAt;
      const rev = revByAdset.get(a.metaAdSetId) ?? zero();
      const restricted = acc && acc.accountStatus !== "ACTIVE" && acc.accountStatus != null;
      const budget = a.dailyBudgetCents > 0 ? a.dailyBudgetCents : a.lifetimeBudgetCents;
      return buildRow({
        id: a.id, metaId: a.metaAdSetId, name: a.name,
        status: restricted ? "restricted" : a.status,
        accountId: camp?.adAccountId ?? "", accountName: acc?.name ?? "—", currency: cur,
        product: [...rev.products][0] ?? null, products: [...rev.products],
        budgetCents: toBRL(budget, cur), bidCents: a.bidCents != null ? toBRL(a.bidCents, cur) : null,
        parentName: camp?.name ?? null, effectiveStatus: a.effectiveStatus, issueReason: a.issuesInfo,
        createdAt: a.createdAt.toISOString(),
        spend: toBRL(a.spendCents, cur), revenue: rev.revenue, pendingRevenue: rev.pendingRevenue,
        approved: rev.approved, pending: rev.pending,
        impressions: a.impressions, clicks: a.clicks, pageViews: a.pageViews, ics: a.initiateCheckouts,
      });
    })
    .filter(hasActivity);

  // ---------- Nível ANÚNCIO ----------
  const adsetIds = adsetRowsDb.map((a) => a.id);
  const adRowsDb = adsetIds.length
    ? await db.select().from(ads).where(inArray(ads.adSetId, adsetIds))
    : [];
  const adRows = adRowsDb
    .map((a) => {
      const adset = adsetById.get(a.adSetId);
      const camp = adset ? campById.get(adset.campaignId) : undefined;
      const acc = camp ? accountById.get(camp.adAccountId) : undefined;
      const cur = acc?.currency ?? "BRL";
      const rev = revByAd.get(a.metaAdId) ?? zero();
      const restricted = acc && acc.accountStatus !== "ACTIVE" && acc.accountStatus != null;
      return buildRow({
        id: a.id, metaId: a.metaAdId, name: a.name,
        status: restricted ? "restricted" : a.status,
        accountId: camp?.adAccountId ?? "", accountName: acc?.name ?? "—", currency: cur,
        product: [...rev.products][0] ?? null, products: [...rev.products],
        budgetCents: 0, bidCents: null, parentName: adset?.name ?? null,
        effectiveStatus: a.effectiveStatus, issueReason: a.issuesInfo,
        createdAt: a.createdAt.toISOString(),
        spend: toBRL(a.spendCents, cur), revenue: rev.revenue, pendingRevenue: rev.pendingRevenue,
        approved: rev.approved, pending: rev.pending,
        impressions: a.impressions, clicks: a.clicks, pageViews: a.pageViews, ics: a.initiateCheckouts,
      });
    })
    .filter(hasActivity);

  return {
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
    products,
    rows: rowsWithActivity,
    accountRows,
    adsetRows,
    adRows,
    syncedAt: (lastSync as Date | null)?.toISOString() ?? null,
    series: {
      dates: days.map((d) => {
        const [, m, day] = d.split("-");
        return `${day}/${m}`;
      }),
      daily,
    },
  };
}

export type CampaignRow = NonNullable<CampaignsData>["rows"][number];

export async function getDashboardData() {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return null;

  const { from, to } = await getCurrentPeriod();

  const accounts = await db
    .select()
    .from(adAccounts)
    .where(and(eq(adAccounts.dashboardId, dashboard.id), eq(adAccounts.active, true)));
  const accountIds = accounts.map((a) => a.id);

  const camps = accountIds.length
    ? await db.select().from(campaigns).where(inArray(campaigns.adAccountId, accountIds))
    : [];
  const campIds = camps.map((c) => c.id);

  const insightConds = campIds.length ? [inArray(adInsights.campaignId, campIds)] : [];
  if (campIds.length && from) insightConds.push(gte(adInsights.date, toDateStr(from)));
  if (campIds.length && to) insightConds.push(lte(adInsights.date, toDateStr(to)));
  const insights = campIds.length
    ? await db.select().from(adInsights).where(and(...insightConds))
    : [];

  const saleConds = [eq(sales.dashboardId, dashboard.id)];
  if (from) saleConds.push(gte(sales.createdAt, from));
  if (to) saleConds.push(lte(sales.createdAt, to));
  const allSales = await db.select().from(sales).where(and(...saleConds));

  // ---------- Agregados de gasto ----------
  const adSpend = insights.reduce((s, i) => s + i.spendCents, 0);
  const clicks = insights.reduce((s, i) => s + i.clicks, 0);
  const impressions = insights.reduce((s, i) => s + i.impressions, 0);
  const pageViews = insights.reduce((s, i) => s + i.pageViews, 0);
  const initiateCheckouts = insights.reduce((s, i) => s + i.initiateCheckouts, 0);

  // ---------- Agregados de venda ----------
  const approved = allSales.filter((s) => s.status === "approved");
  const pending = allSales.filter((s) => s.status === "pending");
  const grossRevenue = approved.reduce((s, v) => s + v.valueCents, 0);
  const pendingRevenue = pending.reduce((s, v) => s + v.valueCents, 0);

  const fees = approved.reduce((s, v) => s + v.gatewayFeeCents, 0); // taxas de gateway
  // Imposto Meta Ads só em contas BRL — soma só o gasto das contas BRL.
  const brlAccountIds = new Set(accounts.filter((a) => a.currency === "BRL").map((a) => a.id));
  const brlCampIds = new Set(camps.filter((c) => brlAccountIds.has(c.adAccountId)).map((c) => c.id));
  const brlSpend = insights.filter((i) => brlCampIds.has(i.campaignId)).reduce((s, i) => s + i.spendCents, 0);
  const metaTax = Math.round(brlSpend * META_TAX_RATE); // 12,5% só em contas BRL
  const netRevenue = grossRevenue - fees;
  const profit = netRevenue - adSpend - metaTax;

  const salesCount = approved.length;
  const roas = adSpend > 0 ? grossRevenue / adSpend : null;
  const roi = adSpend > 0 ? profit / adSpend : null;
  const margin = grossRevenue > 0 ? profit / grossRevenue : null;
  const cpaCents = salesCount > 0 ? Math.round(adSpend / salesCount) : null;

  // ---------- Taxa de aprovação por método ----------
  const methods = ["card", "pix", "boleto"] as const;
  const approvalByMethod = methods.map((m) => {
    const total = allSales.filter((s) => s.paymentMethod === m).length;
    const ok = approved.filter((s) => s.paymentMethod === m).length;
    return { method: m, rate: total > 0 ? ok / total : null, total, approved: ok };
  });

  // ---------- Funil ----------
  const funnel = [
    { label: "Cliques", value: clicks },
    { label: "Vis. Página", value: pageViews },
    { label: "ICs", value: initiateCheckouts },
    { label: "Vendas Inic.", value: allSales.length },
    { label: "Vendas Apr.", value: salesCount },
  ];

  // ---------- Por horário (acumulado: fat x invest x lucro) ----------
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, sales: 0 }));
  for (const s of approved) {
    const h = new Date(s.createdAt).getHours();
    byHour[h].revenue += s.valueCents;
    byHour[h].sales += 1;
  }
  const spendPerHour = adSpend / 24;
  let accRev = 0;
  let accSpend = 0;
  const hourlyAccum = byHour.map((row) => {
    accRev += row.revenue;
    accSpend += spendPerHour;
    return {
      hour: `${String(row.hour).padStart(2, "0")}h`,
      faturamento: Math.round(accRev) / 100,
      investimento: Math.round(accSpend) / 100,
      lucro: Math.round(accRev - accSpend) / 100,
    };
  });

  const salesByHour = byHour.map((r) => ({
    hour: `${String(r.hour).padStart(2, "0")}h`,
    vendas: r.sales,
  }));

  // ---------- Por dia da semana ----------
  const wd = Array.from({ length: 7 }, () => 0);
  for (const s of approved) wd[new Date(s.createdAt).getDay()] += s.valueCents;
  const salesByWeekday = wd.map((v, i) => ({ dia: WEEKDAYS[i], valor: Math.round(v) / 100 }));

  // ---------- Por fonte / pagamento / produto ----------
  const bySource = groupSum(approved, (s) => s.utmSource ?? "Direto");
  const byPayment = groupSum(approved, (s) => labelMethod(s.paymentMethod));
  const byProduct = groupSum(approved, (s) => s.productName);

  // ---------- Tabela de campanhas ----------
  const insightByCamp = new Map<string, { spend: number; clicks: number; impressions: number }>();
  for (const i of insights) {
    const cur = insightByCamp.get(i.campaignId) ?? { spend: 0, clicks: 0, impressions: 0 };
    cur.spend += i.spendCents;
    cur.clicks += i.clicks;
    cur.impressions += i.impressions;
    insightByCamp.set(i.campaignId, cur);
  }
  const salesByCamp = new Map<string, { approved: number; pending: number; revenue: number }>();
  for (const s of allSales) {
    if (!s.metaCampaignId) continue;
    const cur = salesByCamp.get(s.metaCampaignId) ?? { approved: 0, pending: 0, revenue: 0 };
    if (s.status === "approved") {
      cur.approved += 1;
      cur.revenue += s.valueCents;
    } else if (s.status === "pending") cur.pending += 1;
    salesByCamp.set(s.metaCampaignId, cur);
  }

  const campaignRows = camps
    .map((c) => {
      const ins = insightByCamp.get(c.id) ?? { spend: 0, clicks: 0, impressions: 0 };
      const sl = salesByCamp.get(c.metaCampaignId) ?? { approved: 0, pending: 0, revenue: 0 };
      const cProfit = sl.revenue - ins.spend;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        pending: sl.pending,
        sales: sl.approved,
        spendCents: ins.spend,
        revenueCents: sl.revenue,
        profitCents: cProfit,
        roi: ins.spend > 0 ? cProfit / ins.spend : null,
        roas: ins.spend > 0 ? sl.revenue / ins.spend : null,
        cpaCents: sl.approved > 0 ? Math.round(ins.spend / sl.approved) : null,
        clicks: ins.clicks,
        impressions: ins.impressions,
      };
    })
    .sort((a, b) => b.revenueCents - a.revenueCents);

  return {
    dashboard,
    kpis: {
      grossRevenue,
      adSpend,
      pendingRevenue,
      netRevenue,
      profit,
      fees,
      metaTax,
      roas,
      roi,
      margin,
      cpaCents,
      salesCount,
    },
    approvalByMethod,
    funnel,
    hourlyAccum,
    salesByHour,
    salesByWeekday,
    bySource,
    byPayment,
    byProduct,
    campaignRows,
  };
}

function groupSum<T>(rows: T[], key: (r: T) => string) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    map.set(k, (map.get(k) ?? 0) + (r as unknown as { valueCents: number }).valueCents);
  }
  return [...map.entries()]
    .map(([label, cents]) => ({ label, valor: Math.round(cents) / 100 }))
    .sort((a, b) => b.valor - a.valor);
}

function labelMethod(m: string) {
  return m === "card" ? "Cartão" : m === "pix" ? "Pix" : "Boleto";
}

// ---------------------------------------------------------------------------
// Premiações — marcos de vendas trackeadas / faturamento (acumulado, all-time).
// ---------------------------------------------------------------------------
export type AwardsData = Awaited<ReturnType<typeof getAwardsData>>;

export async function getAwardsData() {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return null;
  const rows = await db
    .select({ status: sales.status, valueCents: sales.valueCents })
    .from(sales)
    .where(eq(sales.dashboardId, dashboard.id));
  return {
    dashboardName: dashboard.name,
    trackedSales: rows.length, // toda venda ingerida = trackeada (qualquer status)
    trackedRevenueCents: rows.filter((r) => r.status === "approved").reduce((s, r) => s + r.valueCents, 0),
  };
}

// ---------------------------------------------------------------------------
// Relatório de UTMs — agrega as VENDAS (nosso banco) por cada dimensão UTM.
// Fonte 100% do nosso sistema (webhook 1:1 Utmify), zero Meta.
// ---------------------------------------------------------------------------
export type UtmData = Awaited<ReturnType<typeof getUtmData>>;
export const UTM_DIMS = ["utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term"] as const;
export type UtmDim = (typeof UTM_DIMS)[number];

export async function getUtmData() {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return null;
  const { from, to } = await getCurrentPeriod();

  const conds = [eq(sales.dashboardId, dashboard.id)];
  if (from) conds.push(gte(sales.createdAt, from));
  if (to) conds.push(lte(sales.createdAt, to));
  const rows = await db.select().from(sales).where(and(...conds));

  const pick = (s: (typeof rows)[number], d: UtmDim): string | null =>
    d === "utm_source" ? s.utmSource
      : d === "utm_campaign" ? s.utmCampaign
      : d === "utm_medium" ? s.utmMedium
      : d === "utm_content" ? s.utmContent
      : s.utmTerm;

  type UtmGroup = { value: string; approved: number; pending: number; refunded: number; revenueCents: number; pendingRevenueCents: number };
  const build = (d: UtmDim): UtmGroup[] => {
    const m = new Map<string, UtmGroup>();
    for (const s of rows) {
      const raw = pick(s, d);
      const key = raw && raw.trim() ? raw : "(não definido)";
      const g = m.get(key) ?? { value: key, approved: 0, pending: 0, refunded: 0, revenueCents: 0, pendingRevenueCents: 0 };
      if (s.status === "approved") { g.approved += 1; g.revenueCents += s.valueCents; }
      else if (s.status === "pending") { g.pending += 1; g.pendingRevenueCents += s.valueCents; }
      else if (s.status === "refunded" || s.status === "chargeback") g.refunded += 1;
      m.set(key, g);
    }
    return [...m.values()].sort((a, b) => b.revenueCents - a.revenueCents);
  };

  const approved = rows.filter((r) => r.status === "approved");
  const pending = rows.filter((r) => r.status === "pending");

  return {
    dimensions: {
      utm_source: build("utm_source"),
      utm_campaign: build("utm_campaign"),
      utm_medium: build("utm_medium"),
      utm_content: build("utm_content"),
      utm_term: build("utm_term"),
    },
    totals: {
      total: rows.length,
      approved: approved.length,
      pending: pending.length,
      revenueCents: approved.reduce((s, r) => s + r.valueCents, 0),
      pendingRevenueCents: pending.reduce((s, r) => s + r.valueCents, 0),
    },
  };
}
