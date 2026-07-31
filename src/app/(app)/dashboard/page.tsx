import { getDashboardData } from "@/lib/queries";
import { money, multiple, percent, ratio } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Card } from "@/components/ui/Card";
import { HourlyAccumChart, SimpleBar, DonutChart } from "@/components/dashboard/charts";
import { ApprovalRates, BarList, Funnel, MiniStat } from "@/components/dashboard/widgets";
import { TrendingUp, Wallet, Target, Percent, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let data: Awaited<ReturnType<typeof getDashboardData>> = null;
  let error: string | null = null;
  try {
    data = await getDashboardData();
  } catch (e) {
    error = e instanceof Error ? e.message : "Erro desconhecido";
  }

  if (error || !data) {
    return (
      <div className="mt-20 mx-auto max-w-md text-center">
        <div className="text-2xl font-semibold">Sem dados ainda</div>
        <p className="mt-2 text-sm text-muted">
          {error
            ? "Não consegui conectar ao banco. Suba o Postgres com "
            : "Nenhum dashboard encontrado. Rode o seed com "}
          <code className="rounded bg-panel-2 px-1.5 py-0.5 text-accent">
            {error ? "docker compose up -d" : "npm run db:seed"}
          </code>
          .
        </p>
      </div>
    );
  }

  const { kpis } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted">
            {data.dashboard.name} · Faturamento Normal · GMT-3
          </p>
        </div>
      </div>

      {/* ---- KPIs principais ---- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Faturamento Bruto"
          value={money(kpis.grossRevenue)}
          tone="accent"
          emphasis
          icon={<TrendingUp size={16} />}
        />
        <KpiCard
          label="Gastos com anúncios"
          value={money(kpis.adSpend)}
          icon={<Wallet size={16} />}
        />
        <KpiCard label="ROI" value={ratio(kpis.roi)} tone={roiTone(kpis.roi)} />
        <KpiCard label="Faturamento Líquido" value={money(kpis.netRevenue)} />
        <KpiCard
          label="Lucro"
          value={money(kpis.profit)}
          tone={kpis.profit >= 0 ? "pos" : "neg"}
          emphasis
        />
        <KpiCard label="ROAS" value={multiple(kpis.roas)} icon={<Target size={16} />} />
      </div>

      {/* ---- KPIs secundários ---- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Vendas Pendentes" value={money(kpis.pendingRevenue)} tone="warn" />
        <KpiCard label="Margem" value={percent(kpis.margin)} icon={<Percent size={16} />} />
        <KpiCard label="CPA" value={kpis.cpaCents !== null ? money(kpis.cpaCents) : "N/A"} />
        <KpiCard label="Imposto Meta Ads" value={money(kpis.metaTax)} />
        <KpiCard label="Taxas" value={money(kpis.fees)} />
        <KpiCard label="Vendas Aprovadas" value={String(kpis.salesCount)} tone="pos" />
      </div>

      {/* ---- Gráfico principal + funil + aprovação ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card
          className="lg:col-span-2"
          title="Lucro por Horário"
          subtitle="Faturamento × Investimento × Lucro por hora (acumulado)"
        >
          <HourlyAccumChart data={data.hourlyAccum} />
        </Card>
        <div className="space-y-4">
          <Card title="Taxa de Aprovação">
            <ApprovalRates rows={data.approvalByMethod} />
          </Card>
          <Card title="Funil de Conversão" subtitle="Meta Ads">
            <Funnel steps={data.funnel} />
          </Card>
        </div>
      </div>

      {/* ---- Distribuições ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Vendas por Dia da Semana">
          <SimpleBar data={data.salesByWeekday} xKey="dia" yKey="valor" color="#26d07c" money />
        </Card>
        <Card title="Vendas por Horário" action={<Clock size={15} className="text-faint" />}>
          <SimpleBar data={data.salesByHour} xKey="hour" yKey="vendas" color="#6c8cff" />
        </Card>
        <Card title="Vendas por Pagamento">
          <DonutChart data={data.byPayment} />
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Vendas por Fonte">
          <BarList items={data.bySource} />
        </Card>
        <Card title="Vendas por Produto">
          <BarList items={data.byProduct} />
        </Card>
        <Card title="Resumo Financeiro">
          <div className="space-y-2">
            <MiniStat label="Faturamento Bruto" value={money(kpis.grossRevenue)} />
            <MiniStat label="Faturamento Pendente" value={money(kpis.pendingRevenue)} />
            <MiniStat label="Gastos com Anúncios" value={money(kpis.adSpend)} />
            <MiniStat label="Taxas" value={money(kpis.fees)} />
            <MiniStat label="Lucro Final" value={money(kpis.profit)} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function roiTone(roi: number | null): "pos" | "neg" | "default" {
  if (roi === null) return "default";
  return roi >= 0 ? "pos" : "neg";
}
