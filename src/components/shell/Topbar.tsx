import { listDashboards, getCurrentDashboard } from "@/lib/dashboards";
import { getCurrentPeriod } from "@/lib/period";
import { DashboardSwitcher } from "./DashboardSwitcher";
import { PeriodSelector } from "./PeriodSelector";
import { SyncButton } from "./SyncButton";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import { Search } from "lucide-react";

export async function Topbar({ user }: { user: { name: string | null; email: string } }) {
  const [all, current, period] = await Promise.all([
    listDashboards(),
    getCurrentDashboard(),
    getCurrentPeriod(),
  ]);

  return (
    <header className="h-14 shrink-0 border-b border-line bg-bg/80 backdrop-blur sticky top-0 z-20 flex items-center gap-2 sm:gap-3 px-3 sm:px-6">
      <MobileNav />
      <DashboardSwitcher
        dashboards={all.map((d) => ({ id: d.id, name: d.name, currency: d.currency }))}
        currentId={current?.id ?? null}
      />

      <PeriodSelector current={period.key} fromStr={period.fromStr} toStr={period.toStr} />

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <SyncButton />
        <button className="hidden sm:grid place-items-center size-8 rounded-lg border border-line bg-panel text-muted hover:text-text">
          <Search size={16} />
        </button>
        <UserMenu name={user.name} email={user.email} />
      </div>
    </header>
  );
}
