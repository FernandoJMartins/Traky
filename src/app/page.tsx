import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TrendingUp, Target, Crosshair, Bell, Link2, Trophy, ArrowRight, Check } from "lucide-react";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: TrendingUp, title: "ROI e lucro em tempo real", desc: "Cruze as vendas do seu checkout com o gasto da Meta e veja lucro por campanha, conjunto e anúncio." },
  { icon: Target, title: "Atribuição por UTM", desc: "Cada venda casada com a campanha certa via UTMs — sem depender da atribuição atrasada do Facebook." },
  { icon: Crosshair, title: "Pixels + CAPI", desc: "Reenvio server-side de eventos (Purchase, InitiateCheckout) pra otimizar suas campanhas." },
  { icon: Bell, title: "Notificações de venda", desc: "Push no app a cada venda aprovada ou pendente, com valor, produto e campanha." },
  { icon: Link2, title: "Relatório de UTMs", desc: "Vendas agrupadas por source, campaign, medium, content e term. Ticket médio e faturamento." },
  { icon: Trophy, title: "Premiações", desc: "Marcos de vendas trackeadas e faturamento — do primeiro milhar ao primeiro milhão." },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-5 h-14">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-accent/20 text-accent grid place-items-center font-bold">U</div>
            <span className="font-semibold tracking-tight">Utmify</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-4 py-2 text-sm text-muted hover:text-text">Entrar</Link>
            <Link href="/register" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90">Criar conta</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted mb-6">
          <span className="size-1.5 rounded-full bg-pos" /> Rastreamento de vendas para tráfego pago
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Saiba na hora <span className="text-accent">quem está no lucro</span>.
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-lg text-muted">
          Rastreie cada venda do seu checkout, cruze com o gasto da Meta Ads por UTM e veja ROI, ROAS e lucro por campanha — do dashboard ao anúncio.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg hover:opacity-90">
            Começar grátis <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="rounded-lg border border-line bg-panel px-5 py-3 text-sm hover:bg-panel-2">Já tenho conta</Link>
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-faint">
          <span className="inline-flex items-center gap-1"><Check size={13} className="text-pos" /> API 1:1 Utmify</span>
          <span className="inline-flex items-center gap-1"><Check size={13} className="text-pos" /> Meta Ads real</span>
          <span className="inline-flex items-center gap-1"><Check size={13} className="text-pos" /> Sem cartão</span>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-line bg-panel/70 p-5">
              <div className="size-9 rounded-lg bg-accent/15 text-accent grid place-items-center mb-3">
                <f.icon size={18} />
              </div>
              <div className="font-semibold">{f.title}</div>
              <p className="text-sm text-muted mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-6xl mx-auto px-5 pb-24">
        <div className="rounded-2xl border border-line bg-gradient-to-br from-accent/10 to-panel p-8 sm:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Pare de adivinhar. Comece a medir.</h2>
          <p className="mt-3 text-muted max-w-xl mx-auto">Conecte sua conta Meta, aponte o webhook do seu checkout e veja o lucro real de cada campanha.</p>
          <Link href="/register" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg hover:opacity-90">
            Criar minha conta <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-5 py-6 text-xs text-faint flex items-center justify-between">
          <span>Utmify · rastreamento de vendas</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-text">Entrar</Link>
            <Link href="/register" className="hover:text-text">Criar conta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
