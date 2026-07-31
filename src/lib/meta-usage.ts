// Rastreia o uso de rate limit da Meta lendo os headers de resposta.
// Usado pelo sync agendado pra desacelerar antes de tomar bloqueio.

type Usage = { pct: number; regainMs: number; at: number };

const globalForUsage = globalThis as unknown as { __metaUsage?: Usage };
function state(): Usage {
  return (globalForUsage.__metaUsage ??= { pct: 0, regainMs: 0, at: 0 });
}

function safeJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type Buc = { call_count?: number; total_cputime?: number; total_time?: number; estimated_time_to_regain_access?: number };

/** Extrai o pior % de uso e o tempo de espera (ms) dos headers de rate limit. */
export function recordUsageFromHeaders(headers: Headers): void {
  let pct = 0;
  let regainMin = 0;

  // X-App-Usage: { call_count, total_cputime, total_time } (percentuais 0-100)
  const app = safeJson(headers.get("x-app-usage")) as Buc | null;
  if (app) pct = Math.max(pct, app.call_count ?? 0, app.total_cputime ?? 0, app.total_time ?? 0);

  // X-Business-Use-Case-Usage: { "<id>": [ { ...Buc } ] }
  const buc = safeJson(headers.get("x-business-use-case-usage")) as Record<string, Buc[]> | null;
  if (buc) {
    for (const arr of Object.values(buc)) {
      for (const u of arr ?? []) {
        pct = Math.max(pct, u.call_count ?? 0, u.total_cputime ?? 0, u.total_time ?? 0);
        regainMin = Math.max(regainMin, u.estimated_time_to_regain_access ?? 0);
      }
    }
  }

  const s = state();
  s.pct = pct;
  s.regainMs = regainMin * 60_000; // a Meta reporta em minutos
  s.at = Date.now();
}

export function currentUsage(): Usage {
  return state();
}

/** Sugere quanto esperar (ms) antes da próxima chamada, dado o uso atual. */
export function suggestedDelayMs(baseMs: number): number {
  const u = state();
  if (u.regainMs > 0) return Math.min(u.regainMs, 5 * 60_000); // bloqueado: espera (teto 5min)
  if (u.pct >= 90) return baseMs * 6;
  if (u.pct >= 75) return baseMs * 3;
  return baseMs;
}
