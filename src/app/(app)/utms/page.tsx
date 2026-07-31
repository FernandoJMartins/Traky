import { getUtmData } from "@/lib/queries";
import { UtmReport } from "@/components/utms/UtmReport";

export const dynamic = "force-dynamic";

export default async function UtmsPage() {
  const data = await getUtmData();

  if (!data) {
    return (
      <div className="mt-20 text-center text-muted">
        Nenhum dashboard. Crie um dashboard pra ver o relatório.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Relatório de UTMs</h1>
        <p className="text-sm text-muted">
          Vendas agrupadas por parâmetro de UTM · fonte: suas vendas (nosso sistema)
        </p>
      </div>
      <UtmReport data={data} />
    </div>
  );
}
