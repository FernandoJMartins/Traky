"use client";

import { useMemo, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, RefreshCw, RotateCw, Shield, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

type ApiCredential = {
  id: string;
  dashboardId: string;
  name: string;
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

export function WebhooksManager({
  credentials,
  limit,
}: {
  credentials: ApiCredential[];
  limit: number | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("Webhook principal");
  const [busy, setBusy] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [freshLabel, setFreshLabel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const activeCount = useMemo(() => credentials.filter((cred) => !cred.revoked).length, [credentials]);

  async function copyToken(token: string) {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function createCredential() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/api-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Falha ao criar credencial");
      setFreshToken(data.token as string);
      setFreshLabel((data.credential?.name as string) ?? name.trim());
      setName("Webhook principal");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function updateCredential(id: string, payload: Record<string, unknown>) {
    setRowBusy(id);
    try {
      const res = await fetch(`/api/api-credentials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Falha ao atualizar credencial");
      if (data.credential?.token) {
        setFreshToken(data.credential.token as string);
        setFreshLabel(data.credential.name as string);
      }
      router.refresh();
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-line bg-panel-2 p-4 lg:grid-cols-[1.2fr_auto] lg:items-end">
        <div>
          <div className="text-sm font-medium">Nova credencial</div>
          <p className="mt-1 text-xs text-muted">
            Nomeie a integração para organizar webhooks por checkout, ambiente ou loja.
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Loja principal"
            className="mt-3 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <button
          onClick={createCredential}
          disabled={busy || !name.trim() || (limit !== null && activeCount >= limit)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Criar webhook
        </button>
      </div>

      {freshToken && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-text">Token gerado</div>
              <p className="mt-1 text-xs text-muted">
                Copie agora o <span className="font-mono">x-api-token</span> da credencial
                {freshLabel ? ` ${freshLabel}` : ""}.
              </p>
            </div>
            <button
              onClick={() => copyToken(freshToken)}
              className="inline-flex items-center gap-2 rounded-lg bg-text px-3 py-2 text-sm font-medium text-bg hover:opacity-90"
            >
              {copied ? <Check size={15} className="text-pos" /> : <Copy size={15} />}
              {copied ? "Copiado" : "Copiar token"}
            </button>
          </div>
          <div className="mt-3 rounded-lg border border-line bg-panel px-3 py-2 font-mono text-xs break-all">
            {freshToken}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {credentials.length ? (
          credentials.map((credential) => (
            <div key={credential.id} className="rounded-xl border border-line bg-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <KeyRound size={16} className="text-accent" />
                    <span className="font-medium truncate">{credential.name}</span>
                    {credential.revoked ? (
                      <span className="rounded-full bg-neg/10 px-2 py-0.5 text-[11px] font-medium text-neg">Revogada</span>
                    ) : (
                      <span className="rounded-full bg-pos/10 px-2 py-0.5 text-[11px] font-medium text-pos">Ativa</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Criada em {new Date(credential.createdAt).toLocaleString("pt-BR")}
                    {credential.lastUsedAt ? ` · último uso ${new Date(credential.lastUsedAt).toLocaleString("pt-BR")}` : " · ainda não usada"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => updateCredential(credential.id, { regenerate: true })}
                    disabled={rowBusy === credential.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm hover:bg-panel disabled:opacity-40"
                  >
                    {rowBusy === credential.id ? <Loader2 size={15} className="animate-spin" /> : <RotateCw size={15} />}
                    Regenerar
                  </button>
                  <button
                    onClick={() => updateCredential(credential.id, { revoked: !credential.revoked })}
                    disabled={rowBusy === credential.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm hover:bg-panel disabled:opacity-40"
                  >
                    {rowBusy === credential.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    {credential.revoked ? "Reativar" : "Revogar"}
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-dashed border-line bg-bg/30 px-3 py-2 text-xs text-muted">
                <div className="flex items-center gap-2 text-text/90">
                  <Shield size={14} className="text-accent" />
                  URL do webhook compatível com a API da Tracky
                </div>
                <div className="mt-1 font-mono break-all">/api/api-credentials/orders</div>
                <div className="mt-1">
                  Envie o token em <span className="font-mono">x-api-token</span>, <span className="font-mono">x-api-key</span> ou <span className="font-mono">Authorization: Bearer</span>.
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-line bg-panel-2 p-6 text-sm text-muted">
            Nenhuma credencial criada ainda.
          </div>
        )}
      </div>
    </div>
  );
}