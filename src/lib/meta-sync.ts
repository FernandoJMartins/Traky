import { db } from "@/db";
import { adAccounts, adInsights, adSets, ads, campaigns, metaConnections, syncRuns } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { currentUsage, suggestedDelayMs } from "./meta-usage";

const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
import {
  getAdSets,
  getAds,
  getBreakdownInsights,
  getCampaignEntities,
  getCampaignInsights,
  getLongLivedToken,
  getMe,
  listAdAccounts,
  MetaApiError,
} from "./meta";

const hasAppCreds = () => !!(process.env.META_APP_ID && process.env.META_APP_SECRET);

/**
 * Conecta um perfil Meta a partir de um access token (caminho manual, testável já).
 * Valida o token, tenta estendê-lo pra longa duração e importa as contas de anúncio.
 */
export async function connectManualToken(dashboardId: string, rawToken: string) {
  const me = await getMe(rawToken); // valida o token (lança se inválido)

  // Se o App estiver configurado, troca por token de longa duração (~60 dias).
  let token = rawToken;
  let expiresAt: Date | null = null;
  if (hasAppCreds()) {
    try {
      const long = await getLongLivedToken(rawToken);
      token = long.access_token;
      if (long.expires_in) expiresAt = new Date(Date.now() + long.expires_in * 1000);
    } catch {
      // segue com o token original se a troca falhar
    }
  }

  const [conn] = await db
    .insert(metaConnections)
    .values({
      dashboardId,
      metaUserId: me.id,
      name: me.name,
      accessToken: token,
      tokenExpiresAt: expiresAt,
    })
    .returning();

  // Importa as contas de anúncio do perfil.
  const accounts = await listAdAccounts(token);
  for (const acc of accounts) {
    await db
      .insert(adAccounts)
      .values({
        dashboardId,
        metaConnectionId: conn.id,
        metaAccountId: acc.id,
        name: acc.name,
        currency: acc.currency,
        accountStatus: acc.status,
        active: acc.status === "ACTIVE",
      })
      .onConflictDoUpdate({
        target: [adAccounts.dashboardId, adAccounts.metaAccountId],
        set: {
          metaConnectionId: conn.id,
          name: acc.name,
          currency: acc.currency,
          accountStatus: acc.status,
        },
      });
  }

  return { connection: conn, accounts };
}

/** Sincroniza gasto/insights das contas ATIVAS de uma conexão. */
export async function syncConnection(connectionId: string, days = 30) {
  const [conn] = await db
    .select()
    .from(metaConnections)
    .where(eq(metaConnections.id, connectionId))
    .limit(1);
  if (!conn) throw new Error("Conexão Meta não encontrada");

  const accounts = await db
    .select()
    .from(adAccounts)
    .where(
      and(eq(adAccounts.metaConnectionId, connectionId), eq(adAccounts.active, true)),
    );

  const until = new Date();
  const since = new Date(until.getTime() - days * 86400_000);
  const sinceStr = since.toISOString().slice(0, 10);
  const untilStr = until.toISOString().slice(0, 10);

  let insightsWritten = 0;
  for (const acc of accounts) {
    const insights = await getCampaignInsights(
      acc.metaAccountId,
      conn.accessToken,
      sinceStr,
      untilStr,
    );

    // cache metaCampaignId -> campaignId (nosso)
    const campMap = new Map<string, string>();
    for (const ins of insights) {
      let campaignId = campMap.get(ins.campaignId);
      if (!campaignId) {
        const [c] = await db
          .insert(campaigns)
          .values({
            adAccountId: acc.id,
            metaCampaignId: ins.campaignId,
            name: ins.campaignName ?? ins.campaignId,
          })
          .onConflictDoUpdate({
            target: [campaigns.adAccountId, campaigns.metaCampaignId],
            set: { name: ins.campaignName ?? ins.campaignId },
          })
          .returning({ id: campaigns.id });
        campaignId = c.id;
        campMap.set(ins.campaignId, campaignId);
      }

      await db
        .insert(adInsights)
        .values({
          campaignId,
          date: ins.date,
          spendCents: ins.spendCents,
          impressions: ins.impressions,
          clicks: ins.clicks,
          pageViews: ins.pageViews,
          initiateCheckouts: ins.initiateCheckouts,
        })
        .onConflictDoUpdate({
          target: [adInsights.campaignId, adInsights.date],
          set: {
            spendCents: ins.spendCents,
            impressions: ins.impressions,
            clicks: ins.clicks,
            pageViews: ins.pageViews,
            initiateCheckouts: ins.initiateCheckouts,
          },
        });
      insightsWritten++;
    }
  }

  await db
    .update(metaConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(metaConnections.id, connectionId));

  return { accounts: accounts.length, insightsWritten };
}

const st = (eff: string | undefined) => (eff === "ACTIVE" ? "active" : "paused") as "active" | "paused";

/**
 * Sincronização COMPLETA do dashboard, disparada SÓ no clique do botão.
 * Puxa da Meta: insights por campanha (diário) + estrutura (campanhas/conjuntos/anúncios
 * com orçamento/bid/status) + snapshot de gasto por conjunto/anúncio no período.
 * Grava tudo no NOSSO banco — as telas leem só do banco, nunca da Meta ao vivo.
 * Orçamentos/gastos ficam na moeda da conta (convertidos p/ BRL na leitura).
 */
export async function syncCampaignsFull(
  dashboardId: string,
  daysOrWindow:
    | number
    | { days?: number; from?: string; to?: string; staggerMs?: number; trigger?: "manual" | "scheduled" } = 30,
  opts: { staggerMs?: number; trigger?: "manual" | "scheduled" } = {},
) {
  const window = typeof daysOrWindow === "number" ? { days: daysOrWindow } : daysOrWindow;
  const staggerMs = window.staggerMs ?? opts.staggerMs ?? 0;
  const conns = await db
    .select()
    .from(metaConnections)
    .where(eq(metaConnections.dashboardId, dashboardId));
  const connById = new Map(conns.map((c) => [c.id, c]));
  const accts = await db
    .select()
    .from(adAccounts)
    .where(and(eq(adAccounts.dashboardId, dashboardId), eq(adAccounts.active, true)));

  const until = new Date();
  const since = new Date(until.getTime() - (window.days ?? 30) * 86400_000);
  const sinceStr = window.from ?? since.toISOString().slice(0, 10);
  const untilStr = window.to ?? until.toISOString().slice(0, 10);
  const now = new Date();

  const [run] = await db
    .insert(syncRuns)
    .values({ dashboardId, trigger: window.trigger ?? opts.trigger ?? "manual" })
    .returning({ id: syncRuns.id });

  let campaignsUpserted = 0;
  let adsetsUpserted = 0;
  let adsUpserted = 0;
  let maxUsage = 0;
  const errors: string[] = [];

  for (const acc of accts) {
    const conn = acc.metaConnectionId ? connById.get(acc.metaConnectionId) : null;
    if (!conn) continue;
    const token = conn.accessToken;
    try {
      // 1) insights por campanha (diário) + 2) estrutura de campanhas (orçamento/status)
      // — em paralelo, são independentes (economiza 1 ida à Meta por conta).
      const [insights, campEnts] = await Promise.all([
        getCampaignInsights(acc.metaAccountId, token, sinceStr, untilStr),
        getCampaignEntities(acc.metaAccountId, token),
      ]);
      const campEntById = new Map(campEnts.map((c) => [c.id, c]));

      // Mantém a estrutura completa no período. Se a janela não teve gasto,
      // ainda assim precisamos atualizar conjuntos/anúncios para evitar snapshot velho.
      const allMetaCampIds = campEnts.map((c) => c.id);

      const campMap = new Map<string, string>(); // metaCampaignId -> nosso id
      const metaCampToUpsert = new Set<string>([...allMetaCampIds, ...insights.map((i) => i.campaignId)]);
      for (const metaCampId of metaCampToUpsert) {
        const ent = campEntById.get(metaCampId);
        const name = ent?.name ?? insights.find((i) => i.campaignId === metaCampId)?.campaignName ?? metaCampId;
        const budget = ent ? ent.dailyBudgetCents ?? ent.lifetimeBudgetCents ?? 0 : 0;
        const [c] = await db
          .insert(campaigns)
          .values({ adAccountId: acc.id, metaCampaignId: metaCampId, name, status: st(ent?.effectiveStatus), effectiveStatus: ent?.effectiveStatus ?? null, issuesInfo: ent?.issueReason ?? null, budgetCents: budget, metaCreatedAt: ent?.metaCreatedAt ?? null })
          .onConflictDoUpdate({
            target: [campaigns.adAccountId, campaigns.metaCampaignId],
            set: { name, status: st(ent?.effectiveStatus), effectiveStatus: ent?.effectiveStatus ?? null, issuesInfo: ent?.issueReason ?? null, budgetCents: budget, ...(ent?.metaCreatedAt ? { metaCreatedAt: ent.metaCreatedAt } : {}) },
          })
          .returning({ id: campaigns.id });
        campMap.set(metaCampId, c.id);
        campaignsUpserted++;
      }

      // insights diários por campanha
      for (const ins of insights) {
        const campaignId = campMap.get(ins.campaignId);
        if (!campaignId) continue;
        await db
          .insert(adInsights)
          .values({ campaignId, date: ins.date, spendCents: ins.spendCents, impressions: ins.impressions, clicks: ins.clicks, pageViews: ins.pageViews, initiateCheckouts: ins.initiateCheckouts })
          .onConflictDoUpdate({
            target: [adInsights.campaignId, adInsights.date],
            set: { spendCents: ins.spendCents, impressions: ins.impressions, clicks: ins.clicks, pageViews: ins.pageViews, initiateCheckouts: ins.initiateCheckouts },
          });
      }

      // 3-5) conjuntos + anúncios (estrutura + snapshot de gasto) — 4 chamadas em
      // paralelo (independentes). Reduz a espera de 4 idas em fila pra 1 onda.
      const [adsetEnts, adsetIns, adEnts, adIns] = await Promise.all([
        getAdSets(acc.metaAccountId, allMetaCampIds, token),
        getBreakdownInsights(acc.metaAccountId, allMetaCampIds, token, "adset", sinceStr, untilStr),
        getAds(acc.metaAccountId, allMetaCampIds, token),
        getBreakdownInsights(acc.metaAccountId, allMetaCampIds, token, "ad", sinceStr, untilStr),
      ]);
      const adsetInsById = new Map(adsetIns.map((i) => [i.entityId, i]));
      const adsetMap = new Map<string, string>(); // metaAdSetId -> nosso id
      for (const a of adsetEnts) {
        const campaignId = campMap.get(a.campaignId);
        if (!campaignId) continue;
        const ins = adsetInsById.get(a.id);
        const [row] = await db
          .insert(adSets)
          .values({
            campaignId, metaAdSetId: a.id, name: a.name, status: st(a.effectiveStatus), effectiveStatus: a.effectiveStatus, issuesInfo: a.issueReason ?? null,
            dailyBudgetCents: a.dailyBudgetCents ?? 0, lifetimeBudgetCents: a.lifetimeBudgetCents ?? 0, bidCents: a.bidCents ?? null,
            spendCents: ins?.spendCents ?? 0, impressions: ins?.impressions ?? 0, clicks: ins?.clicks ?? 0, pageViews: ins?.pageViews ?? 0, initiateCheckouts: ins?.initiateCheckouts ?? 0, syncedAt: now,
            metaCreatedAt: a.metaCreatedAt ?? null,
          })
          .onConflictDoUpdate({
            target: [adSets.campaignId, adSets.metaAdSetId],
            set: {
              name: a.name, status: st(a.effectiveStatus), effectiveStatus: a.effectiveStatus, issuesInfo: a.issueReason ?? null,
              dailyBudgetCents: a.dailyBudgetCents ?? 0, lifetimeBudgetCents: a.lifetimeBudgetCents ?? 0, bidCents: a.bidCents ?? null,
              spendCents: ins?.spendCents ?? 0, impressions: ins?.impressions ?? 0, clicks: ins?.clicks ?? 0, pageViews: ins?.pageViews ?? 0, initiateCheckouts: ins?.initiateCheckouts ?? 0, syncedAt: now,
              ...(a.metaCreatedAt ? { metaCreatedAt: a.metaCreatedAt } : {}),
            },
          })
          .returning({ id: adSets.id });
        adsetMap.set(a.id, row.id);
        adsetsUpserted++;
      }

      // anúncios: usa o que já foi buscado na onda paralela acima
      const adInsById = new Map(adIns.map((i) => [i.entityId, i]));
      for (const a of adEnts) {
        const adSetId = adsetMap.get(a.adSetId);
        if (!adSetId) continue;
        const ins = adInsById.get(a.id);
        await db
          .insert(ads)
          .values({
            adSetId, metaAdId: a.id, name: a.name, status: st(a.effectiveStatus), effectiveStatus: a.effectiveStatus, issuesInfo: a.issueReason ?? null,
            spendCents: ins?.spendCents ?? 0, impressions: ins?.impressions ?? 0, clicks: ins?.clicks ?? 0, pageViews: ins?.pageViews ?? 0, initiateCheckouts: ins?.initiateCheckouts ?? 0, syncedAt: now,
            metaCreatedAt: a.metaCreatedAt ?? null,
          })
          .onConflictDoUpdate({
            target: [ads.adSetId, ads.metaAdId],
            set: {
              name: a.name, status: st(a.effectiveStatus), effectiveStatus: a.effectiveStatus, issuesInfo: a.issueReason ?? null,
              spendCents: ins?.spendCents ?? 0, impressions: ins?.impressions ?? 0, clicks: ins?.clicks ?? 0, pageViews: ins?.pageViews ?? 0, initiateCheckouts: ins?.initiateCheckouts ?? 0, syncedAt: now,
              ...(a.metaCreatedAt ? { metaCreatedAt: a.metaCreatedAt } : {}),
            },
          });
        adsUpserted++;
      }
    } catch (e) {
      errors.push(`${acc.name}: ${e instanceof MetaApiError ? e.message : e instanceof Error ? e.message : "erro"}`);
    }

    // Escalonamento + auto-throttle: espera entre contas conforme o uso reportado
    // pela Meta (base = staggerMs; sobe se o uso passa de 75%/90%; para se bloqueado).
    maxUsage = Math.max(maxUsage, currentUsage().pct);
    await sleep(suggestedDelayMs(staggerMs));
  }

  for (const conn of conns) {
    await db.update(metaConnections).set({ lastSyncedAt: now }).where(eq(metaConnections.id, conn.id));
  }

  await db
    .update(syncRuns)
    .set({
      finishedAt: new Date(),
      campaignsUpserted,
      adsetsUpserted,
      adsUpserted,
      errorCount: errors.length,
      usagePct: Math.round(maxUsage),
      note: errors.length ? errors.slice(0, 3).join(" | ").slice(0, 500) : null,
    })
    .where(eq(syncRuns.id, run.id));

  return { campaignsUpserted, adsetsUpserted, adsUpserted, errors };
}
