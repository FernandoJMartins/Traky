import { NextResponse } from "next/server";
import { db } from "@/db";
import { adAccounts, adSets, campaigns, metaConnections } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getCurrentDashboard } from "@/lib/dashboards";
import { convertBRLCents } from "@/lib/fx";
import {
  copyCampaign,
  deleteCampaign,
  MetaApiError,
  setAdSetBid,
  setAdSetDailyBudget,
  setAdSetStatus,
  setCampaignDailyBudget,
  setCampaignStatus,
} from "@/lib/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action: "activate" | "pause" | "budget" | "bidcap" | "delete" | "duplicate";
  level?: "campaign" | "adset";
  campaignIds: string[]; // ids nossos (campanha ou conjunto conforme level)
  valueBRL?: string; // "30,00"
  copies?: number;
  targetAccount?: string; // "same" | accountId
};

function parseBRLCents(v?: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? Math.round(n * 100) : null;
}

// POST /api/campaigns/actions — executa ações de escrita na Meta
export async function POST(req: Request) {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) return NextResponse.json({ message: "Sem dashboard." }, { status: 400 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  if (!body.action || !Array.isArray(body.campaignIds) || body.campaignIds.length === 0) {
    return NextResponse.json({ message: "action e ids são obrigatórios." }, { status: 400 });
  }

  const budgetCents = parseBRLCents(body.valueBRL);
  if ((body.action === "budget" || body.action === "bidcap") && (budgetCents === null || budgetCents <= 0)) {
    return NextResponse.json({ message: "Valor inválido." }, { status: 400 });
  }

  const results: { id: string; name: string; ok: boolean; message?: string }[] = [];

  // ---------------- Nível CONJUNTO (activate/pause/budget) ----------------
  if (body.level === "adset") {
    if (!["activate", "pause", "budget", "bidcap"].includes(body.action)) {
      return NextResponse.json({ message: "Ação não suportada em conjuntos." }, { status: 400 });
    }
    const rows = await db.select().from(adSets).where(inArray(adSets.id, body.campaignIds));
    const campIds = [...new Set(rows.map((r) => r.campaignId))];
    const camps = campIds.length ? await db.select().from(campaigns).where(inArray(campaigns.id, campIds)) : [];
    const campById = new Map(camps.map((c) => [c.id, c]));
    const accts = await db.select().from(adAccounts).where(inArray(adAccounts.id, [...new Set(camps.map((c) => c.adAccountId))]));
    const acctById = new Map(accts.map((a) => [a.id, a]));
    const conns = await db.select().from(metaConnections).where(eq(metaConnections.dashboardId, dashboard.id));
    const connById = new Map(conns.map((c) => [c.id, c]));

    for (const r of rows) {
      const camp = campById.get(r.campaignId);
      const acc = camp ? acctById.get(camp.adAccountId) : undefined;
      const conn = acc?.metaConnectionId ? connById.get(acc.metaConnectionId) : null;
      if (!acc || !conn) {
        results.push({ id: r.id, name: r.name, ok: false, message: "Sem conexão Meta." });
        continue;
      }
      try {
        if (body.action === "activate") {
          await setAdSetStatus(r.metaAdSetId, conn.accessToken, "ACTIVE");
          await db.update(adSets).set({ status: "active" }).where(eq(adSets.id, r.id));
        } else if (body.action === "pause") {
          await setAdSetStatus(r.metaAdSetId, conn.accessToken, "PAUSED");
          await db.update(adSets).set({ status: "paused" }).where(eq(adSets.id, r.id));
        } else if (body.action === "bidcap") {
          const minor = await convertBRLCents(budgetCents!, acc.currency);
          await setAdSetBid(r.metaAdSetId, conn.accessToken, minor);
          await db.update(adSets).set({ bidCents: minor }).where(eq(adSets.id, r.id));
        } else {
          const minor = await convertBRLCents(budgetCents!, acc.currency);
          await setAdSetDailyBudget(r.metaAdSetId, conn.accessToken, minor);
          await db.update(adSets).set({ dailyBudgetCents: minor }).where(eq(adSets.id, r.id));
        }
        results.push({ id: r.id, name: r.name, ok: true });
      } catch (e) {
        results.push({ id: r.id, name: r.name, ok: false, message: e instanceof MetaApiError ? e.message : e instanceof Error ? e.message : "erro" });
      }
    }
    const okA = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: okA > 0, okCount: okA, total: results.length, results });
  }

  // ---------------- Nível CAMPANHA ----------------
  const camps = await db.select().from(campaigns).where(inArray(campaigns.id, body.campaignIds));
  const accountIds = [...new Set(camps.map((c) => c.adAccountId))];
  const accts = accountIds.length
    ? await db.select().from(adAccounts).where(inArray(adAccounts.id, accountIds))
    : [];
  const acctById = new Map(accts.map((a) => [a.id, a]));
  const connIds = [...new Set(accts.map((a) => a.metaConnectionId).filter(Boolean))] as string[];
  const conns = connIds.length
    ? await db.select().from(metaConnections).where(inArray(metaConnections.id, connIds))
    : [];
  const connById = new Map(conns.map((c) => [c.id, c]));

  for (const c of camps) {
    const acc = acctById.get(c.adAccountId);
    const conn = acc?.metaConnectionId ? connById.get(acc.metaConnectionId) : null;
    if (!acc || !conn) {
      results.push({ id: c.id, name: c.name, ok: false, message: "Sem conexão Meta (campanha local/seed)." });
      continue;
    }
    const token = conn.accessToken;
    try {
      switch (body.action) {
        case "activate":
          await setCampaignStatus(c.metaCampaignId, token, "ACTIVE");
          await db.update(campaigns).set({ status: "active" }).where(eq(campaigns.id, c.id));
          break;
        case "pause":
          await setCampaignStatus(c.metaCampaignId, token, "PAUSED");
          await db.update(campaigns).set({ status: "paused" }).where(eq(campaigns.id, c.id));
          break;
        case "budget": {
          const minor = await convertBRLCents(budgetCents!, acc.currency);
          await setCampaignDailyBudget(c.metaCampaignId, token, minor);
          await db.update(campaigns).set({ budgetCents: minor }).where(eq(campaigns.id, c.id));
          break;
        }
        case "delete":
          await deleteCampaign(c.metaCampaignId, token);
          await db.delete(campaigns).where(eq(campaigns.id, c.id));
          break;
        case "duplicate": {
          if (body.targetAccount && body.targetAccount !== "same") {
            results.push({ id: c.id, name: c.name, ok: false, message: "Duplicação entre contas não é suportada pela API de cópia da Meta." });
            continue;
          }
          const copies = Math.min(Math.max(1, body.copies ?? 1), 50);
          for (let i = 0; i < copies; i++) await copyCampaign(c.metaCampaignId, token);
          break;
        }
      }
      results.push({ id: c.id, name: c.name, ok: true });
    } catch (e) {
      const msg = e instanceof MetaApiError ? e.message : e instanceof Error ? e.message : "erro";
      results.push({ id: c.id, name: c.name, ok: false, message: msg });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: okCount > 0, okCount, total: results.length, results });
}
