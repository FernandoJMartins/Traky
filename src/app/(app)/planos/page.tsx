import { getCurrentUser } from "@/lib/auth";
import { PLANS, planById } from "@/lib/plans";
import { PlansBoard } from "@/components/plans/PlansBoard";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const user = await getCurrentUser();
  const current = user?.plan ?? "free";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Planos</h1>
        <p className="text-sm text-muted">
          Escolha o plano ideal · você está no plano <span className="text-text font-medium">{planById(current).name}</span>
          {user?.isAdmin && " (admin — recursos ilimitados)"}
        </p>
      </div>
      <PlansBoard plans={PLANS} current={current} />
      <p className="text-xs text-faint">
        Pagamento (Stripe/etc.) será integrado em breve — por ora esta página é ilustrativa. Os limites de regras por plano já são aplicados.
      </p>
    </div>
  );
}
