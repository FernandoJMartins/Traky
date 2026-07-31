"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";

// Botão global de sincronização. Vive na navbar → funciona em qualquer tela
// (dashboard, campanhas...). É a ÚNICA porta que toca a Meta; a UI lê do banco.
export function SyncButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/campaigns/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 30 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "Falha");
      alert(
        `Sincronizado: ${d.campaignsUpserted} campanha(s), ${d.adsetsUpserted} conjunto(s), ${d.adsUpserted} anúncio(s).` +
        (d.errors?.length ? `\n\nAvisos:\n${d.errors.join("\n")}` : ""),
      );
      router.refresh();
    } catch (e) {
      alert(`Erro ao sincronizar: ${e instanceof Error ? e.message : "desconhecido"}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      onClick={syncNow}
      disabled={syncing}
      title="Puxar da Meta e atualizar o banco"
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-3 h-8 text-sm text-muted hover:text-text hover:bg-panel-2 disabled:opacity-60"
    >
      {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
      <span className="hidden sm:inline">{syncing ? "Sincronizando..." : "Sincronizar"}</span>
    </button>
  );
}
