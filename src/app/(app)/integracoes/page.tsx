import { db } from "@/db";
import { adAccounts, apiCredentials, metaConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentDashboard } from "@/lib/dashboards";
import { getCurrentUser } from "@/lib/auth";
import { webhookCredentialLimitFor } from "@/lib/plans";
import { Card } from "@/components/ui/Card";
import { MetaConnect } from "@/components/integrations/MetaConnect";
import { AdAccountList } from "@/components/integrations/AdAccountList";
import { WebhooksManager } from "@/components/integrations/WebhooksManager";

export const dynamic = "force-dynamic";

export default async function IntegracoesPage() {
  const dashboard = await getCurrentDashboard();
  const user = await getCurrentUser();
  const connections = dashboard
    ? await db.select().from(metaConnections).where(eq(metaConnections.dashboardId, dashboard.id))
    : [];
  const accounts = dashboard
    ? await db.select().from(adAccounts).where(eq(adAccounts.dashboardId, dashboard.id))
    : [];
  const credentials = dashboard
    ? await db
        .select({
          id: apiCredentials.id,
          dashboardId: apiCredentials.dashboardId,
          name: apiCredentials.name,
          revoked: apiCredentials.revoked,
          lastUsedAt: apiCredentials.lastUsedAt,
          createdAt: apiCredentials.createdAt,
        })
        .from(apiCredentials)
        .where(eq(apiCredentials.dashboardId, dashboard.id))
        .orderBy(apiCredentials.createdAt)
    : [];

  const oauthConfigured = !!process.env.META_APP_ID;
  const webhookLimit = user ? webhookCredentialLimitFor(user) : 0;

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Integrações</h1>
        <p className="text-sm text-muted">Conecte Meta Ads e gerencie seus webhooks da Tracky.</p>
      </div>

      <Card
        title="Webhooks"
        subtitle={
          webhookLimit === null
            ? "Credenciais ilimitadas para este usuário."
            : `Até ${webhookLimit} credencial(is) ativa(s) neste plano.`
        }
      >
        <WebhooksManager credentials={credentials} limit={webhookLimit} />
      </Card>

      <Card title="Conectar Meta Ads" subtitle="Escolha como deseja conectar sua conta">
        <MetaConnect oauthConfigured={oauthConfigured} hasConnection={connections.length > 0} />
      </Card>

      {connections.map((conn) => {
        const connAccounts = accounts.filter((a) => a.metaConnectionId === conn.id);
        return (
          <Card
            key={conn.id}
            title={conn.name ?? "Perfil Meta"}
            subtitle={
              conn.lastSyncedAt
                ? `Última sincronização: ${new Date(conn.lastSyncedAt).toLocaleString("pt-BR")}`
                : "Ainda não sincronizado"
            }
          >
            <AdAccountList
              accounts={connAccounts.map((a) => ({
                id: a.id,
                name: a.name,
                metaAccountId: a.metaAccountId,
                currency: a.currency,
                status: a.accountStatus,
                active: a.active,
              }))}
            />
          </Card>
        );
      })}

      {/* contas sem conexão (ex: dados de seed) */}
      {accounts.some((a) => !a.metaConnectionId) && (
        <Card title="Contas locais" subtitle="Dados de exemplo (seed), sem conexão Meta real">
          <AdAccountList
            accounts={accounts
              .filter((a) => !a.metaConnectionId)
              .map((a) => ({
                id: a.id,
                name: a.name,
                metaAccountId: a.metaAccountId,
                currency: a.currency,
                status: a.accountStatus,
                active: a.active,
              }))}
          />
        </Card>
      )}
    </div>
  );
}
