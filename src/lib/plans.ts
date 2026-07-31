// Planos e limites. Preços de referência (Utmify) — placeholders ajustáveis.
// Sem integração de pagamento ainda: a página de Planos é visual.
export type PlanId = "free" | "premium" | "advanced" | "monster";

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  salesLimit: number | null; // null = ilimitado
  ruleLimit: number; // nº de regras de otimização
  dashboards: number | null;
  highlight?: boolean;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "free", name: "Gratuito", priceCents: 0, salesLimit: 30, ruleLimit: 0, dashboards: 1,
    features: ["Até 30 vendas rastreadas", "1 dashboard", "Integração Meta Ads", "Relatório de UTMs", "Sem regras de otimização"],
  },
  {
    id: "premium", name: "Premium", priceCents: 11990, salesLimit: null, ruleLimit: 5, dashboards: 3, highlight: true,
    features: ["Vendas ilimitadas", "3 dashboards", "5 regras de otimização", "Notificações + PWA", "Pixels / CAPI"],
  },
  {
    id: "advanced", name: "Avançado", priceCents: 24990, salesLimit: null, ruleLimit: 15, dashboards: 10,
    features: ["Tudo do Premium", "10 dashboards", "15 regras de otimização", "Sync em background", "Suporte prioritário"],
  },
  {
    id: "monster", name: "Monster", priceCents: 39990, salesLimit: null, ruleLimit: 50, dashboards: null,
    features: ["Tudo do Avançado", "Dashboards ilimitados", "50 regras de otimização", "Sync mais frequente", "Suporte dedicado"],
  },
];

export function planById(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** Limite de regras do usuário. null = ilimitado (admin). */
export function ruleLimitFor(user: { plan: string; isAdmin: boolean }): number | null {
  if (user.isAdmin) return null;
  return planById(user.plan).ruleLimit;
}
