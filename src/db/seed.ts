import "dotenv/config";
import { db, schema } from "./index";
import { sql } from "drizzle-orm";
import { generateApiToken } from "../lib/utmify";

const GATEWAY_FEE_RATE = 0.08; // ~8% de taxa do gateway

// Dados baseados no relatório de UTMs real do usuário.
// [nome, metaCampaignId, vendasAprovadas, faturamentoReais, gastoReais, ativa]
const CAMPAIGNS: [string, string, number, number, number, boolean][] = [
  ["CHAVE-FENDA — Cópia", "120210000000001", 13, 124.61, 58.0, true],
  ["CAMP-BARBA", "120210000000002", 5, 90.32, 30.0, true],
  ["VZ", "120210000000003", 6, 78.74, 41.0, true],
  ["CAMP-BARB 30-06 — Cópia", "120210000000004", 6, 55.6, 33.0, true],
  ["CALISTENIA16", "120210000000005", 4, 54.86, 22.0, true],
  ["VZ-CBK", "120210000000006", 5, 54.85, 40.0, false],
  ["CALI13 — Cópia", "120210000000007", 4, 46.87, 25.0, true],
  ["CAMP-BARB 02-07 — Cópia", "120210000000008", 5, 46.74, 28.0, true],
  ["CAMP-SUP", "120210000000009", 3, 35.9, 19.0, true],
  ["CHAVE-FENDA", "120210000000010", 3, 29.88, 15.0, false],
  ["CAMP-VIZAO", "120210000000011", 2, 15.9, 12.0, true],
];

const PRODUCTS = [
  "Kit Barba Completo",
  "Guia Calistenia PRO",
  "Chave de Fenda Multi",
  "Suplemento Vizão",
];
const PLACEMENTS = ["Feed", "Stories", "Reels", "Explore"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
// Distribui vendas ao longo do dia com pico à noite (19h-23h).
function randHour() {
  const weights = [1, 1, 1, 1, 1, 1, 2, 3, 4, 4, 5, 5, 5, 4, 4, 5, 6, 7, 8, 10, 10, 9, 6, 3];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let h = 0; h < 24; h++) {
    r -= weights[h];
    if (r <= 0) return h;
  }
  return 20;
}

async function main() {
  console.log("🌱 Limpando e populando o banco...");

  // Ordem importa por causa das FKs
  await db.execute(sql`TRUNCATE TABLE ${schema.apiCredentials} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${schema.sales} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${schema.adInsights} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${schema.campaigns} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${schema.adAccounts} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${schema.dashboards} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${schema.users} CASCADE`);

  const [user] = await db
    .insert(schema.users)
    .values({ email: "julio8martins@gmail.com", name: "Julio Martins" })
    .returning();

  const [dashboard] = await db
    .insert(schema.dashboards)
    .values({ userId: user.id, name: "@nand7.ads", currency: "BRL" })
    .returning();

  const [account] = await db
    .insert(schema.adAccounts)
    .values({
      dashboardId: dashboard.id,
      metaAccountId: "act_1043382170",
      name: "Vizão Ads BM",
    })
    .returning();

  const DAYS = 7;
  const now = new Date();

  let totalSales = 0;
  let productIdx = 0;

  for (const [name, metaId, approvedCount, revenue, spend, active] of CAMPAIGNS) {
    const [campaign] = await db
      .insert(schema.campaigns)
      .values({
        adAccountId: account.id,
        metaCampaignId: metaId,
        name,
        status: active ? "active" : "paused",
        budgetCents: Math.round((spend / DAYS) * 100 * 1.5),
      })
      .returning();

    const product = pick(PRODUCTS, productIdx++);

    // ----- ad_insights: distribui o gasto pelos últimos 7 dias -----
    for (let d = 0; d < DAYS; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);
      const dayStr = day.toISOString().slice(0, 10);
      const dailySpend = Math.round((spend / DAYS) * 100 * (0.7 + Math.random() * 0.6));
      const impressions = randInt(800, 4000);
      const clicks = Math.round(impressions * (0.008 + Math.random() * 0.02));
      await db.insert(schema.adInsights).values({
        campaignId: campaign.id,
        date: dayStr,
        spendCents: dailySpend,
        impressions,
        clicks,
        pageViews: Math.round(clicks * (0.5 + Math.random() * 0.3)),
        initiateCheckouts: Math.round(clicks * (0.1 + Math.random() * 0.15)),
      });
    }

    // ----- sales aprovadas -----
    const avgTicket = approvedCount > 0 ? revenue / approvedCount : 0;
    const salesRows = [];
    for (let i = 0; i < approvedCount; i++) {
      const created = new Date(now);
      created.setDate(created.getDate() - randInt(0, DAYS - 1));
      created.setHours(randHour(), randInt(0, 59), 0, 0);
      const method = pick<"card" | "pix" | "boleto">(
        ["card", "card", "card", "pix", "pix", "boleto"],
        randInt(0, 5),
      );
      const v = Math.round(avgTicket * 100 * (0.9 + Math.random() * 0.2));
      const fee = Math.round(v * GATEWAY_FEE_RATE);
      salesRows.push({
        dashboardId: dashboard.id,
        externalId: `seed-${metaId}-a${i}`,
        platform: "Kirvano",
        productName: product,
        valueCents: v,
        status: "approved" as const,
        paymentMethod: method,
        gatewayFeeCents: fee,
        userCommissionCents: v - fee,
        currency: "BRL",
        customerName: `Cliente ${i + 1}`,
        customerEmail: `cliente${i + 1}@exemplo.com`,
        utmSource: "FB",
        utmCampaign: `${name}|${metaId}`,
        utmMedium: `${name} - Conjunto|120211${metaId.slice(-6)}`,
        utmContent: `Criativo ${i + 1}|120212${metaId.slice(-6)}`,
        utmTerm: pick(PLACEMENTS, i),
        metaCampaignId: metaId,
        createdAt: created,
        approvedAt: created,
      });
    }

    // ----- sales pendentes (aguardando pagamento, ~metade boleto/pix) -----
    const pendingCount = randInt(1, Math.max(2, Math.round(approvedCount * 1.2)));
    for (let i = 0; i < pendingCount; i++) {
      const created = new Date(now);
      created.setDate(created.getDate() - randInt(0, DAYS - 1));
      created.setHours(randHour(), randInt(0, 59), 0, 0);
      salesRows.push({
        dashboardId: dashboard.id,
        externalId: `seed-${metaId}-p${i}`,
        platform: "Kirvano",
        productName: product,
        valueCents: Math.round(avgTicket * 100 * (0.9 + Math.random() * 0.2)) || 1299,
        status: "pending" as const,
        paymentMethod: pick<"pix" | "boleto">(["pix", "boleto"], i),
        gatewayFeeCents: 0,
        userCommissionCents: 0,
        currency: "BRL",
        customerName: `Cliente P${i + 1}`,
        customerEmail: `pendente${i + 1}@exemplo.com`,
        utmSource: "FB",
        utmCampaign: `${name}|${metaId}`,
        utmMedium: `${name} - Conjunto|120211${metaId.slice(-6)}`,
        utmContent: `Criativo ${i + 1}|120212${metaId.slice(-6)}`,
        utmTerm: pick(PLACEMENTS, i),
        metaCampaignId: metaId,
        createdAt: created,
      });
    }

    await db.insert(schema.sales).values(salesRows);
    totalSales += salesRows.length;
  }

  // Credencial de API fixa para facilitar testes locais.
  const token = "seed_" + generateApiToken(31); // 36 chars total
  await db.insert(schema.apiCredentials).values({
    dashboardId: dashboard.id,
    token,
    name: "Credencial de Teste",
  });

  console.log(`✅ Seed pronto: ${CAMPAIGNS.length} campanhas, ${totalSales} vendas.`);
  console.log(`\n🔑 Credencial de API (x-api-token):\n   ${token}`);
  console.log(`📊 dashboardId: ${dashboard.id}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
