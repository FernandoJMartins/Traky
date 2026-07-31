import { getCampaignsData } from "@/lib/queries";
import { CampaignsView } from "@/components/campaigns/CampaignsView";

export const dynamic = "force-dynamic";

export default async function CampanhasPage() {
  const data = await getCampaignsData();

  if (!data) {
    return (
      <div className="mt-20 text-center text-muted">
        Nenhum dashboard. Rode o seed ou crie um dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Campanhas</h1>
        <p className="text-sm text-muted">
          conta → campanha → conjunto → anúncio · percebe na hora quem está no lucro
        </p>
      </div>
      <CampaignsView data={data} />
    </div>
  );
}
