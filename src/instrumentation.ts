// Roda uma vez quando o servidor Next sobe (só no runtime nodejs).
// 1) aplica migrações pendentes; 2) liga o sync agendado.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { runMigrations } = await import("./db/migrate");
      await runMigrations();
    } catch (e) {
      console.error("[boot] migrações falharam:", e);
    }
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
