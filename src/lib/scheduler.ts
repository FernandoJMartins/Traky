import { db } from "@/db";
import { metaConnections } from "@/db/schema";
import { syncCampaignsFull } from "./meta-sync";
import { runRulesForDashboard } from "./rules-runner";

// Agendador in-process: puxa a Meta periodicamente pra manter os dados frescos
// mesmo com o usuário offline (base pra as Regras de Otimização).
// Escalonado + auto-throttle por header (ver meta-sync/meta-usage). Desliga com
// SYNC_ENABLED=false. Só roda no runtime nodejs (via instrumentation.ts).
const g = globalThis as unknown as { __utmifyScheduler?: boolean };

export function startScheduler() {
  if (g.__utmifyScheduler) return; // sobrevive a HMR/reimport
  if (process.env.SYNC_ENABLED === "false") {
    console.log("[sync] agendado DESATIVADO (SYNC_ENABLED=false)");
    return;
  }
  g.__utmifyScheduler = true;

  const intervalMs = Math.max(1, Number(process.env.SYNC_INTERVAL_MIN ?? 10)) * 60_000;
  const staggerMs = Number(process.env.SYNC_STAGGER_MS ?? 1500);
  const days = Number(process.env.SYNC_DAYS ?? 30);

  let running = false;
  const tick = async () => {
    if (running) return; // nunca sobrepõe dois ciclos
    running = true;
    try {
      const conns = await db.select({ dashboardId: metaConnections.dashboardId }).from(metaConnections);
      const ids = [...new Set(conns.map((c) => c.dashboardId))];
      for (const dashboardId of ids) {
        try {
          const r = await syncCampaignsFull(dashboardId, days, { staggerMs, trigger: "scheduled" });
          console.log(
            `[sync] ${dashboardId}: ${r.campaignsUpserted} camp, ${r.adsetsUpserted} conj, ${r.adsUpserted} ads` +
              (r.errors.length ? `, ${r.errors.length} erro(s)` : ""),
          );
          // Dados frescos → avalia e executa as regras deste dashboard.
          const rr = await runRulesForDashboard(dashboardId);
          if (rr.rulesRun > 0) console.log(`[rules] ${dashboardId}: ${rr.rulesRun} regra(s) rodada(s), ${rr.acted} ação(ões)`);
        } catch (e) {
          console.error("[sync] falha no dashboard", dashboardId, e);
        }
      }
    } catch (e) {
      console.error("[sync] tick falhou", e);
    } finally {
      running = false;
    }
  };

  console.log(`[sync] agendado LIGADO — a cada ${intervalMs / 60000} min (stagger ${staggerMs}ms, janela ${days}d)`);
  // Aquece 30s antes do 1º ciclo (deixa o server subir), depois no intervalo.
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), intervalMs);
  }, 30_000);
}
