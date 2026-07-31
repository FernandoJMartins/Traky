import { describe, it, expect } from "vitest";
import {
  compare, extractMetric, conditionsMatch, matchedRows, computeNewBudgetCents,
  applyToTarget, isBudgetAction, withinWindow, planOperation, type EngineRow, type Condition,
} from "./rules-engine";

function row(p: Partial<EngineRow> = {}): EngineRow {
  return {
    status: "active", spendCents: 0, profitCents: 0, budgetCents: 0,
    cpaCents: null, cpcCents: null, cpmCents: null, cpvCents: null,
    roi: null, roas: null, margin: null, ctr: null,
    sales: 0, initiateCheckouts: 0, clicks: 0, pageViews: 0, ...p,
  };
}

describe("compare", () => {
  it("operadores", () => {
    expect(compare("gt", 3, 2)).toBe(true);
    expect(compare("gt", 2, 2)).toBe(false);
    expect(compare("lt", 1, 2)).toBe(true);
    expect(compare("gte", 2, 2)).toBe(true);
    expect(compare("lte", 2, 3)).toBe(true);
    expect(compare("lte", 4, 3)).toBe(false);
  });
});

describe("extractMetric (unidades do usuário) — todos os campos", () => {
  it("dinheiro em reais, margem/CTR em %, roi cru", () => {
    const r = row({
      spendCents: 1234, profitCents: -500, budgetCents: 3000, roi: 1.5, roas: 2.4, margin: 0.3, ctr: 0.025,
      sales: 5, cpaCents: 700, cpcCents: 150, cpmCents: 2500, cpvCents: 80,
      clicks: 42, pageViews: 88, initiateCheckouts: 9,
    });
    expect(extractMetric("spend", r)).toBeCloseTo(12.34);
    expect(extractMetric("profit", r)).toBeCloseTo(-5);
    expect(extractMetric("budget", r)).toBe(30);
    expect(extractMetric("roi", r)).toBe(1.5);
    expect(extractMetric("roas", r)).toBe(2.4);
    expect(extractMetric("profitMargin", r)).toBeCloseTo(30);
    expect(extractMetric("ctr", r)).toBeCloseTo(2.5);
    expect(extractMetric("approvedSales", r)).toBe(5);
    expect(extractMetric("cpa", r)).toBe(7);
    expect(extractMetric("cpc", r)).toBe(1.5);
    expect(extractMetric("cpm", r)).toBe(25);
    expect(extractMetric("cpv", r)).toBe(0.8);
    expect(extractMetric("clicks", r)).toBe(42);
    expect(extractMetric("pv", r)).toBe(88);
    expect(extractMetric("initiatedCheckouts", r)).toBe(9);
  });

  it("métricas ainda não coletadas retornam null", () => {
    const r = row({ cpaCents: null });
    for (const f of ["cpi", "conversations", "costPerConversation", "costPerLead"] as const) {
      expect(extractMetric(f, r)).toBeNull();
    }
    expect(extractMetric("cpa", r)).toBeNull(); // null quando cpaCents null
  });
});

describe("withinWindow (janela de horário)", () => {
  it("sem janela → sempre dentro", () => {
    expect(withinWindow(null, null, "03:00")).toBe(true);
    expect(withinWindow("08:00", null, "03:00")).toBe(true);
  });
  it("janela normal", () => {
    expect(withinWindow("08:00", "20:00", "12:00")).toBe(true);
    expect(withinWindow("08:00", "20:00", "06:00")).toBe(false);
    expect(withinWindow("08:00", "20:00", "20:00")).toBe(true); // inclusivo
  });
  it("janela que cruza a meia-noite (22:00–06:00)", () => {
    expect(withinWindow("22:00", "06:00", "23:30")).toBe(true);
    expect(withinWindow("22:00", "06:00", "03:00")).toBe(true);
    expect(withinWindow("22:00", "06:00", "12:00")).toBe(false);
  });
});

describe("planOperation (decisão da ação, sem rede)", () => {
  it("activate/pause → status", () => {
    expect(planOperation("activate", "campaign", 0, 0, false, 0)).toEqual({ type: "status", status: "ACTIVE" });
    expect(planOperation("pause", "adset", 0, 0, false, 0)).toEqual({ type: "status", status: "PAUSED" });
  });
  it("orçamento no nível campanha/conjunto → budget calculado", () => {
    expect(planOperation("increase_budget", "campaign", 5000, 20, true, 0)).toEqual({ type: "budget", brlCents: 6000 });
    expect(planOperation("set_budget", "adset", 5000, 30, false, 0)).toEqual({ type: "budget", brlCents: 3000 });
  });
  it("orçamento em anúncio → skip (anúncio não tem orçamento)", () => {
    const op = planOperation("increase_budget", "ad", 5000, 20, true, 0);
    expect(op.type).toBe("skip");
  });
  it("orçamento que zera → skip", () => {
    const op = planOperation("decrease_budget", "campaign", 5000, 100, false, 0);
    expect(op).toEqual({ type: "skip", reason: "Orçamento calculado ≤ 0." });
  });
});

describe("conditionsMatch (AND)", () => {
  const r = row({ spendCents: 2000, roi: 1.0 }); // R$20, roi 1.0

  it("todas verdadeiras → casa", () => {
    const conds: Condition[] = [
      { field: "spend", operator: "gt", value: 10 },
      { field: "roi", operator: "lt", value: 1.2 },
    ];
    expect(conditionsMatch(conds, r)).toBe(true);
  });

  it("uma falsa → não casa", () => {
    expect(conditionsMatch([{ field: "spend", operator: "gt", value: 50 }], r)).toBe(false);
  });

  it("valor negativo é aceito (ex: lucro < -10)", () => {
    const loss = row({ profitCents: -1500 }); // -R$15
    expect(conditionsMatch([{ field: "profit", operator: "lt", value: -10 }], loss)).toBe(true);
  });

  it("métrica indisponível → não casa (segurança)", () => {
    expect(conditionsMatch([{ field: "cpa", operator: "gt", value: 0 }], r)).toBe(false);
  });

  it("sem condições → não age", () => {
    expect(conditionsMatch([], r)).toBe(false);
  });
});

describe("matchedRows (status do applyTo + condições)", () => {
  it("filtra por status e condições", () => {
    const rows = [
      row({ status: "active", spendCents: 2000 }),   // casa
      row({ status: "active", spendCents: 500 }),     // gasto baixo, não casa
      row({ status: "paused", spendCents: 9000 }),    // pausada, excluída
    ];
    const out = matchedRows("ActiveCampaigns", [{ field: "spend", operator: "gt", value: 10 }], rows);
    expect(out).toHaveLength(1);
    expect(out[0].spendCents).toBe(2000);
  });

  it("applyToTarget mapeia nível + status", () => {
    expect(applyToTarget("ActiveAdsets")).toEqual({ level: "adset", status: "active" });
    expect(applyToTarget("PausedAds")).toEqual({ level: "ad", status: "paused" });
  });
});

describe("computeNewBudgetCents", () => {
  it("aumentar em %", () => {
    expect(computeNewBudgetCents("increase_budget", 5000, 20, true, 0)).toBe(6000);
  });
  it("aumentar valor fixo (R$)", () => {
    expect(computeNewBudgetCents("increase_budget", 5000, 10, false, 0)).toBe(6000);
  });
  it("diminuir em %", () => {
    expect(computeNewBudgetCents("decrease_budget", 5000, 50, true, 0)).toBe(2500);
  });
  it("diminuir abaixo de zero → clampa em 0", () => {
    expect(computeNewBudgetCents("decrease_budget", 5000, 100, false, 0)).toBe(0);
  });
  it("definir orçamento (alvo em R$)", () => {
    expect(computeNewBudgetCents("set_budget", 5000, 30, false, 0)).toBe(3000);
  });
  it("respeita o limite máximo", () => {
    expect(computeNewBudgetCents("increase_budget", 5000, 200, true, 8000)).toBe(8000);
  });
  it("maxCents 0 = sem teto", () => {
    expect(computeNewBudgetCents("increase_budget", 5000, 200, true, 0)).toBe(15000);
  });
  it("activate/pause não mexem em orçamento", () => {
    expect(computeNewBudgetCents("activate", 5000, 20, true, 0)).toBeNull();
    expect(isBudgetAction("pause")).toBe(false);
    expect(isBudgetAction("set_budget")).toBe(true);
  });
});
