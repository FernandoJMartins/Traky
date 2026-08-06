import { getCampaignsData } from "@/lib/queries";
import { getCurrentPeriod } from "@/lib/period";
import { CampaignsView } from "@/components/campaigns/CampaignsView";

export const dynamic = "force-dynamic";

type PageSearchParams = Record<string, string | string[] | undefined>;

function firstParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function csvParam(v: string | string[] | undefined) {
  const raw = firstParam(v);
  return raw ? raw.split(",").map((x) => x.trim()).filter(Boolean) : [];
}

export default async function CampanhasPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const [data, period] = await Promise.all([getCampaignsData(), getCurrentPeriod()]);
  const periodFrom = period.from ? period.from.toISOString().slice(0, 10) : null;
  const periodTo = period.to ? period.to.toISOString().slice(0, 10) : null;
  const level = firstParam(searchParams?.level);

  if (!data) {
    return (
      <div className="mt-20 text-center text-muted">
        Nenhum dashboard. Rode o seed ou crie um dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <CampaignsView
        data={data}
        currentPeriodKey={period.key}
        currentPeriodFrom={periodFrom}
        currentPeriodTo={periodTo}
        initialLevel={level === "account" || level === "campaign" || level === "adset" || level === "ad" ? level : "campaign"}
        initialSelectedAccounts={csvParam(searchParams?.selAccounts)}
        initialSelectedCampaigns={csvParam(searchParams?.selCampaigns)}
        initialSelectedAdsets={csvParam(searchParams?.selAdsets)}
        initialSelectedAds={csvParam(searchParams?.selAds)}
        initialCampaignScope={csvParam(searchParams?.scopeCampaigns)}
        initialAdsetScope={csvParam(searchParams?.scopeAdsets)}
      />
    </div>
  );
}
