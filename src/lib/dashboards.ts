import { cookies } from "next/headers";
import { db } from "@/db";
import { dashboards } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getCurrentUser } from "./auth";

export const DASHBOARD_COOKIE = "dashboardId";

/** Dashboards do usuário LOGADO (escopo por sessão). Vazio se não autenticado. */
export async function listDashboards() {
  const user = await getCurrentUser();
  if (!user) return [];
  return db
    .select()
    .from(dashboards)
    .where(eq(dashboards.userId, user.id))
    .orderBy(asc(dashboards.createdAt));
}

/**
 * Dashboard "atual" da sessão (via cookie), sempre entre os do usuário logado.
 * Cai no 1º se o cookie estiver ausente/inválido. Todas as telas e ações usam este.
 */
export async function getCurrentDashboard() {
  const all = await listDashboards();
  if (!all.length) return null;
  const cookieStore = await cookies();
  const id = cookieStore.get(DASHBOARD_COOKIE)?.value;
  return all.find((d) => d.id === id) ?? all[0];
}

/** Valida que um dashboard pertence ao usuário logado (pra o /switch). */
export async function userOwnsDashboard(dashboardId: string) {
  const user = await getCurrentUser();
  if (!user) return false;
  const [d] = await db
    .select({ id: dashboards.id })
    .from(dashboards)
    .where(and(eq(dashboards.id, dashboardId), eq(dashboards.userId, user.id)))
    .limit(1);
  return !!d;
}
