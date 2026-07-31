"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Loader2, Plus, Trash2, Check } from "lucide-react";

type MetaPixel = { id: string; metaPixelId: string; label: string | null };
type PixelData = {
  id: string;
  name: string;
  productName: string | null;
  active: boolean;
  sendPurchase: boolean;
  sendInitiateCheckout: boolean;
  sendAddToCart: boolean;
  sendLead: boolean;
  sendIp: boolean;
  metaPixels: MetaPixel[];
};

const EVENT_FLAGS: { key: keyof PixelData; label: string }[] = [
  { key: "sendPurchase", label: "Purchase" },
  { key: "sendInitiateCheckout", label: "Initiate Checkout" },
  { key: "sendAddToCart", label: "Add to Cart" },
  { key: "sendLead", label: "Lead" },
  { key: "sendIp", label: "Enviar IP" },
];

export function PixelManager({ pixels }: { pixels: PixelData[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [creating, setCreating] = useState(false);

  async function createPixel() {
    if (!name.trim()) return;
    setCreating(true);
    await fetch("/api/pixels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), productName: product.trim() || undefined }),
    });
    setName("");
    setProduct("");
    setCreating(false);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card title="Novo Pixel" subtitle="Agrupa um ou mais pixels da Meta">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome (ex: ROI-7 Vizão)"
            className="flex-1 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="Produto (opcional)"
            className="flex-1 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={createPixel}
            disabled={creating || !name.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-40 hover:opacity-90"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Criar
          </button>
        </div>
      </Card>

      {pixels.length === 0 && (
        <p className="text-sm text-faint text-center py-6">
          Nenhum pixel ainda. Crie um acima pra começar a enviar eventos.
        </p>
      )}

      {pixels.map((p) => (
        <PixelCard key={p.id} pixel={p} onChange={() => router.refresh()} />
      ))}
    </div>
  );
}

function PixelCard({ pixel, onChange }: { pixel: PixelData; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  async function patch(patch: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/pixels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pixelId: pixel.id, ...patch }),
    });
    setBusy(false);
    onChange();
  }

  async function removePixel() {
    if (!confirm(`Remover o pixel "${pixel.name}"?`)) return;
    await fetch(`/api/pixels?id=${pixel.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{pixel.name}</span>
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded ${
                pixel.active ? "bg-pos/15 text-pos" : "bg-panel-2 text-faint"
              }`}
            >
              {pixel.active ? "Ativo" : "Inativo"}
            </span>
          </div>
          {pixel.productName && (
            <div className="text-xs text-faint mt-0.5">Produto: {pixel.productName}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => patch({ active: !pixel.active })}
            disabled={busy}
            className="text-xs rounded-lg border border-line px-2.5 py-1.5 hover:bg-panel-2"
          >
            {pixel.active ? "Desativar" : "Ativar"}
          </button>
          <button
            onClick={removePixel}
            className="grid place-items-center size-8 rounded-lg border border-line text-neg hover:bg-neg/10"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* eventos */}
      <div className="mt-3 flex flex-wrap gap-2">
        {EVENT_FLAGS.map((f) => {
          const on = pixel[f.key] as boolean;
          return (
            <button
              key={f.key}
              onClick={() => patch({ [f.key]: !on })}
              disabled={busy}
              className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                on
                  ? "border-accent/50 bg-accent/15 text-accent"
                  : "border-line text-muted hover:bg-panel-2"
              }`}
            >
              {on && <Check size={12} className="inline mr-1" />}
              {f.label}
            </button>
          );
        })}
      </div>

      {/* pixels da Meta */}
      <div className="mt-4 border-t border-line pt-3">
        <div className="text-xs text-muted mb-2">Pixels da Meta ({pixel.metaPixels.length})</div>
        <ul className="space-y-1.5">
          {pixel.metaPixels.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-lg bg-panel-2 px-3 py-2 text-sm"
            >
              <Check size={14} className="text-pos shrink-0" />
              <span className="font-mono">{m.metaPixelId}</span>
              {m.label && <span className="text-faint">— {m.label}</span>}
              <button
                onClick={async () => {
                  await fetch(`/api/pixels/meta?id=${m.id}`, { method: "DELETE" });
                  onChange();
                }}
                className="ml-auto text-neg/70 hover:text-neg"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
        <AddMetaPixel pixelId={pixel.id} onAdded={onChange} />
      </div>
    </Card>
  );
}

function AddMetaPixel({ pixelId, onAdded }: { pixelId: string; onAdded: () => void }) {
  const [metaPixelId, setMetaPixelId] = useState("");
  const [token, setToken] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    if (!metaPixelId.trim() || !token.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/pixels/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pixelId,
          metaPixelId: metaPixelId.trim(),
          accessToken: token.trim(),
          label: label.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Falha");
      setMetaPixelId("");
      setToken("");
      setLabel("");
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
      <input
        value={metaPixelId}
        onChange={(e) => setMetaPixelId(e.target.value)}
        placeholder="ID do pixel Meta"
        className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Token de acesso (CAPI)"
        className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Apelido"
          className="w-full sm:w-28 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          onClick={add}
          disabled={busy || !metaPixelId.trim() || !token.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm hover:bg-panel disabled:opacity-40 shrink-0"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Validar
        </button>
      </div>
      {err && <div className="sm:col-span-3 text-xs text-neg">{err}</div>}
    </div>
  );
}
