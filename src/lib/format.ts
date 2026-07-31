const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Centavos -> "R$ 1.234,56" */
export function money(cents: number): string {
  return BRL.format((cents ?? 0) / 100);
}

/** 0.234 -> "23,4%" */
export function percent(ratio: number | null, digits = 1): string {
  if (ratio === null || !isFinite(ratio)) return "N/A";
  return `${(ratio * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

/** número simples com separador de milhar */
export function num(n: number): string {
  return (n ?? 0).toLocaleString("pt-BR");
}

/** múltiplo tipo ROAS -> "2,41x" ou "N/A" */
export function multiple(n: number | null): string {
  if (n === null || !isFinite(n)) return "N/A";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`;
}

/** razão tipo ROI -> "1,20" (número, não porcentagem) ou "N/A" */
export function ratio(n: number | null, digits = 2): string {
  if (n === null || !isFinite(n)) return "N/A";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
