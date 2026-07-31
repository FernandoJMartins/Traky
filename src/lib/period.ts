import { cookies } from "next/headers";

export const PERIOD_COOKIE = "period";

export type PeriodKey =
  | "today"
  | "yesterday"
  | "7d"
  | "14d"
  | "30d"
  | "this_month"
  | "max"
  | "custom";

export const PERIOD_LABELS: Record<Exclude<PeriodKey, "custom">, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "Últimos 7 dias",
  "14d": "Últimos 14 dias",
  "30d": "Últimos 30 dias",
  this_month: "Este mês",
  max: "Máximo",
};

export const DEFAULT_PERIOD: PeriodKey = "today";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Resolve chave/valor de período em {from, to}. `max` => vazio. */
export function resolvePeriod(value: string): {
  key: PeriodKey;
  from?: Date;
  to?: Date;
  fromStr?: string;
  toStr?: string;
} {
  // custom:YYYY-MM-DD:YYYY-MM-DD
  if (value.startsWith("custom:")) {
    const [, f, t] = value.split(":");
    const from = f ? startOfDay(new Date(f + "T00:00:00")) : undefined;
    const to = t ? endOfDay(new Date(t + "T00:00:00")) : undefined;
    if (from && to) return { key: "custom", from, to, fromStr: f, toStr: t };
  }

  const now = new Date();
  switch (value) {
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { key: "yesterday", from: startOfDay(y), to: endOfDay(y) };
    }
    case "7d": {
      const f = new Date(now);
      f.setDate(f.getDate() - 6);
      return { key: "7d", from: startOfDay(f), to: endOfDay(now) };
    }
    case "14d": {
      const f = new Date(now);
      f.setDate(f.getDate() - 13);
      return { key: "14d", from: startOfDay(f), to: endOfDay(now) };
    }
    case "30d": {
      const f = new Date(now);
      f.setDate(f.getDate() - 29);
      return { key: "30d", from: startOfDay(f), to: endOfDay(now) };
    }
    case "this_month":
      return {
        key: "this_month",
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: endOfDay(now),
      };
    case "max":
      return { key: "max" };
    case "today":
    default:
      return { key: "today", from: startOfDay(now), to: endOfDay(now) };
  }
}

export function isPresetKey(v: string | undefined): v is Exclude<PeriodKey, "custom"> {
  return !!v && v in PERIOD_LABELS;
}

/** Período atual (cookie), default = Hoje. */
export async function getCurrentPeriod() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PERIOD_COOKIE)?.value ?? DEFAULT_PERIOD;
  return resolvePeriod(raw);
}
