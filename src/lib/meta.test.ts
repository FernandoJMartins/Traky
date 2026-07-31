import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCampaignInsights, getAdSets } from "./meta";
import { currentUsage } from "./meta-usage";

// Stub do fetch global — simula a resposta da Graph API, sem rede real.
function mockFetch(body: unknown, headers: Record<string, string> = {}) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("sync Meta: getCampaignInsights parseia a resposta corretamente", () => {
  it("converte spend em centavos e soma actions (pageViews/ICs)", async () => {
    mockFetch({
      data: [
        {
          campaign_id: "c1",
          campaign_name: "Campanha A",
          date_start: "2026-07-25",
          spend: "12.34",
          impressions: "1000",
          clicks: "50",
          actions: [
            { action_type: "landing_page_view", value: "40" },
            { action_type: "initiate_checkout", value: "7" },
            { action_type: "other", value: "99" },
          ],
        },
      ],
    });

    const out = await getCampaignInsights("act_1", "tok", "2026-07-25", "2026-07-25");
    expect(out).toHaveLength(1);
    const r = out[0];
    expect(r.campaignId).toBe("c1");
    expect(r.spendCents).toBe(1234); // 12.34 * 100
    expect(r.impressions).toBe(1000);
    expect(r.clicks).toBe(50);
    expect(r.pageViews).toBe(40);
    expect(r.initiateCheckouts).toBe(7);
  });

  it("campos ausentes viram zero (spend/actions vazios)", async () => {
    mockFetch({ data: [{ campaign_id: "c2", campaign_name: "B", date_start: "2026-07-25" }] });
    const [r] = await getCampaignInsights("act_1", "tok", "2026-07-25", "2026-07-25");
    expect(r.spendCents).toBe(0);
    expect(r.pageViews).toBe(0);
    expect(r.initiateCheckouts).toBe(0);
  });

  it("captura o uso de rate limit dos headers da resposta (sync + throttle)", async () => {
    mockFetch({ data: [] }, { "x-app-usage": JSON.stringify({ call_count: 66 }) });
    await getCampaignInsights("act_1", "tok", "2026-07-25", "2026-07-25");
    expect(currentUsage().pct).toBe(66);
  });
});

describe("sync Meta: getAdSets parseia orçamento/bid/campanha-pai", () => {
  it("lê daily_budget, bid_amount e campaign_id", async () => {
    mockFetch({
      data: [
        { id: "as1", campaign_id: "c1", name: "Conj 1", status: "ACTIVE", effective_status: "ACTIVE", daily_budget: "5000", bid_amount: "300" },
        { id: "as2", campaign_id: "c1", name: "Conj 2", status: "PAUSED", effective_status: "PAUSED" },
      ],
    });
    const out = await getAdSets("act_1", ["c1"], "tok");
    expect(out).toHaveLength(2);
    expect(out[0].dailyBudgetCents).toBe(5000);
    expect(out[0].bidCents).toBe(300);
    expect(out[0].campaignId).toBe("c1");
    expect(out[1].dailyBudgetCents).toBeNull(); // sem daily_budget
    expect(out[1].bidCents).toBeNull();
  });
});
