// Roda uma vez quando o servidor Next sobe. Liga o sync agendado (só no nodejs).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
