import { getCurrentDashboard } from "@/lib/dashboards";
import { getNotificationSettings } from "@/lib/notifications";
import { NotificationSettingsView } from "@/components/notifications/NotificationSettingsView";

export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  const dashboard = await getCurrentDashboard();
  if (!dashboard) {
    return <div className="mt-20 text-center text-muted">Nenhum dashboard. Crie um dashboard primeiro.</div>;
  }
  const settings = await getNotificationSettings(dashboard.id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Notificações</h1>
        <p className="text-sm text-muted">Configure os avisos de novas vendas · {dashboard.name}</p>
      </div>
      <NotificationSettingsView initial={settings} dashboardName={dashboard.name} />
    </div>
  );
}
