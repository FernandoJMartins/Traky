"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plug, RefreshCw, Link2, Copy, Check } from "lucide-react";

export function MetaConnect({
  oauthConfigured,
  hasConnection,
}: {
  oauthConfigured: boolean;
  hasConnection: boolean;
}) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generateLink() {
    setLinkLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/meta/oauth/url");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Falha ao gerar link");
      setLinkUrl(data.url);
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Erro" });
    } finally {
      setLinkLoading(false);
    }
  }

  async function copyLink() {
    if (!linkUrl) return;
    await navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function connect() {
    if (!token.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/meta/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Falha ao conectar");
      setMsg({
        type: "ok",
        text: `Conectado como ${data.profile ?? "perfil"} · ${data.accounts?.length ?? 0} conta(s) importada(s).`,
      });
      setToken("");
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Erro" });
    } finally {
      setLoading(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/meta/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Falha ao sincronizar");
      const total = data.results?.reduce((s: number, r: { insightsWritten: number }) => s + r.insightsWritten, 0) ?? 0;
      setMsg({ type: "ok", text: `Sincronizado: ${total} registros de insight atualizados.` });
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Erro" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Opção 1: OAuth — neste navegador OU link pra multilogin */}
      <div className="rounded-lg border border-line p-4">
        <div className="text-sm font-medium">Conectar diretamente (OAuth)</div>
        <p className="text-xs text-muted mt-1">
          Faça login na sua conta Meta via Facebook.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            disabled={!oauthConfigured}
            onClick={() => (window.location.href = "/api/integrations/meta/oauth/start")}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-bg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          >
            <Plug size={16} /> Conectar neste navegador
          </button>
          <button
            disabled={!oauthConfigured || linkLoading}
            onClick={generateLink}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm disabled:opacity-40 hover:bg-panel"
          >
            {linkLoading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
            Gerar link para outro navegador
          </button>
        </div>

        {linkUrl && (
          <div className="mt-3">
            <p className="text-[11px] text-muted mb-1">
              Cole este link no navegador (ou perfil do multilogin) onde a conta do Facebook está
              logada. Expira em 10 min.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={linkUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm hover:bg-panel shrink-0"
              >
                {copied ? <Check size={15} className="text-pos" /> : <Copy size={15} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>
        )}

        {!oauthConfigured && (
          <p className="text-[11px] text-warn mt-2">
            Requer App da Meta (META_APP_ID/SECRET no .env). Use a conexão por token abaixo pra
            testar agora.
          </p>
        )}
      </div>

      {/* Opção 2: token manual */}
      <div className="rounded-lg border border-line p-4">
        <div className="text-sm font-medium">Conectar por access token</div>
        <p className="text-xs text-muted mt-1">
          Cole um token do Graph API Explorer ou de um System User (permissão{" "}
          <code className="text-accent">ads_read</code>).
        </p>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="EAAG... "
          rows={3}
          className="mt-3 w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          onClick={connect}
          disabled={loading || !token.trim()}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-bg disabled:opacity-40 hover:opacity-90"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
          Conectar
        </button>
      </div>

      {hasConnection && (
        <button
          onClick={sync}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm hover:bg-panel disabled:opacity-40"
        >
          {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Sincronizar agora
        </button>
      )}

      {msg && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.type === "ok" ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg"
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
