// Conversão de moeda pro orçamento da Meta (que trabalha na moeda da conta).
// O dashboard é BRL; contas em USD/EUR recebem o valor convertido.

type Cache = { at: number; rates: Record<string, number> };
const globalForFx = globalThis as unknown as { __fx?: Cache };
const TTL = 6 * 60 * 60 * 1000; // 6h

// Fallback caso a API de câmbio falhe (aprox., atualizar se precisar).
const FALLBACK: Record<string, number> = { BRL: 1, USD: 0.18, EUR: 0.17, GBP: 0.14 };

async function getRatesFromBRL(): Promise<Record<string, number>> {
  const cached = globalForFx.__fx;
  if (cached && Date.now() - cached.at < TTL) return cached.rates;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/BRL", { cache: "no-store" });
    const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (json.result === "success" && json.rates) {
      globalForFx.__fx = { at: Date.now(), rates: json.rates };
      return json.rates;
    }
  } catch {
    /* usa fallback */
  }
  return FALLBACK;
}

/** Converte centavos de BRL para a menor unidade da moeda destino (centavos). */
export async function convertBRLCents(brlCents: number, toCurrency: string): Promise<number> {
  const cur = toCurrency.toUpperCase();
  if (cur === "BRL") return brlCents;
  const rates = await getRatesFromBRL();
  const rate = rates[cur] ?? FALLBACK[cur];
  if (!rate) throw new Error(`Sem cotação para ${cur}`);
  return Math.round(brlCents * rate);
}

/** Mapa de cotações (a partir de BRL). Use com toBRLCentsWith p/ converter em lote sem await por linha. */
export async function getBRLRates(): Promise<Record<string, number>> {
  return getRatesFromBRL();
}

/** Versão síncrona de toBRLCents dado o mapa de cotações já carregado. */
export function toBRLCentsWith(cents: number, fromCurrency: string, rates: Record<string, number>): number {
  const cur = fromCurrency.toUpperCase();
  if (cur === "BRL") return cents;
  const rate = rates[cur] ?? FALLBACK[cur];
  if (!rate) return cents;
  return Math.round(cents / rate);
}

/** Converte centavos da moeda de origem para centavos de BRL. */
export async function toBRLCents(cents: number, fromCurrency: string): Promise<number> {
  const cur = fromCurrency.toUpperCase();
  if (cur === "BRL") return cents;
  const rates = await getRatesFromBRL();
  const rate = rates[cur] ?? FALLBACK[cur];
  if (!rate) return cents;
  return Math.round(cents / rate);
}
