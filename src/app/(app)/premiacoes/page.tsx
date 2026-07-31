import { getAwardsData } from "@/lib/queries";
import { AwardsBoard } from "@/components/awards/AwardsBoard";

export const dynamic = "force-dynamic";

export default async function PremiacoesPage() {
  const data = await getAwardsData();

  if (!data) {
    return (
      <div className="mt-20 text-center text-muted">
        Nenhum dashboard. Crie um dashboard pra acompanhar suas conquistas.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Premiações</h1>
        <p className="text-sm text-muted">
          {data.dashboardName} · marcos acumulados (todo o histórico)
        </p>
      </div>
      <AwardsBoard data={data} />
    </div>
  );
}
