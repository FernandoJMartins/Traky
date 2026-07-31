import { describe, it, expect } from "vitest";
import { recordUsageFromHeaders, currentUsage, suggestedDelayMs } from "./meta-usage";

function h(obj: Record<string, string>): Headers {
  return new Headers(obj);
}

describe("meta-usage: leitura de headers de rate limit", () => {
  it("lê o pior % de X-App-Usage", () => {
    recordUsageFromHeaders(h({ "x-app-usage": JSON.stringify({ call_count: 40, total_cputime: 82, total_time: 10 }) }));
    expect(currentUsage().pct).toBe(82);
    expect(currentUsage().regainMs).toBe(0);
  });

  it("lê % e tempo de regain de X-Business-Use-Case-Usage (minutos → ms)", () => {
    recordUsageFromHeaders(
      h({ "x-business-use-case-usage": JSON.stringify({ "act_123": [{ call_count: 55, estimated_time_to_regain_access: 3 }] }) }),
    );
    expect(currentUsage().pct).toBe(55);
    expect(currentUsage().regainMs).toBe(3 * 60_000);
  });

  it("combina app-usage e business-use-case pegando o maior %", () => {
    recordUsageFromHeaders(
      h({
        "x-app-usage": JSON.stringify({ call_count: 30 }),
        "x-business-use-case-usage": JSON.stringify({ "act_1": [{ total_time: 91 }] }),
      }),
    );
    expect(currentUsage().pct).toBe(91);
  });

  it("headers ausentes/ inválidos → zera", () => {
    recordUsageFromHeaders(h({}));
    expect(currentUsage().pct).toBe(0);
    expect(currentUsage().regainMs).toBe(0);
  });
});

describe("meta-usage: auto-throttle", () => {
  it("uso baixo mantém o intervalo base", () => {
    recordUsageFromHeaders(h({ "x-app-usage": JSON.stringify({ call_count: 50 }) }));
    expect(suggestedDelayMs(1000)).toBe(1000);
  });

  it("uso >=75% triplica o intervalo", () => {
    recordUsageFromHeaders(h({ "x-app-usage": JSON.stringify({ call_count: 80 }) }));
    expect(suggestedDelayMs(1000)).toBe(3000);
  });

  it("uso >=90% multiplica por 6", () => {
    recordUsageFromHeaders(h({ "x-app-usage": JSON.stringify({ call_count: 95 }) }));
    expect(suggestedDelayMs(1000)).toBe(6000);
  });

  it("bloqueado (regain>0) espera o tempo de regain (teto 5min)", () => {
    recordUsageFromHeaders(h({ "x-business-use-case-usage": JSON.stringify({ "a": [{ estimated_time_to_regain_access: 2 }] }) }));
    expect(suggestedDelayMs(1000)).toBe(2 * 60_000);
    recordUsageFromHeaders(h({ "x-business-use-case-usage": JSON.stringify({ "a": [{ estimated_time_to_regain_access: 30 }] }) }));
    expect(suggestedDelayMs(1000)).toBe(5 * 60_000); // teto
  });
});
