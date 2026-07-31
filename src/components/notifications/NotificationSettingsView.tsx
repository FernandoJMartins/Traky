"use client";

import { useEffect, useState } from "react";
import type { NotificationPrefs } from "@/lib/notifications";
import { Bell, BellOff, Check, Smartphone } from "lucide-react";

const SAMPLE = { value: "R$ 97,00", product: "Curso de Tráfego Pro", utmCampaign: "BLACKFRIDAY|1203948", };

// Converte a chave VAPID (base64url) pra Uint8Array exigido pelo pushManager.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type PushState = "loading" | "unsupported" | "idle" | "on" | "denied";

export function NotificationSettingsView({ initial, dashboardName }: { initial: NotificationPrefs; dashboardName: string }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial);
  const [saving, setSaving] = useState(false);
  const [push, setPush] = useState<PushState>("loading");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setPush("unsupported"); return; }
    if (Notification.permission === "denied") { setPush("denied"); return; }
    navigator.serviceWorker.getRegistration()
      .then(async (reg) => {
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setPush(sub ? "on" : "idle");
      })
      .catch(() => setPush("idle"));
  }, []);

  async function enablePush() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setPush("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) return alert("Chave VAPID não configurada no servidor.");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const json = sub.toJSON();
      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setPush("on");
    } catch (e) {
      alert("Não consegui ativar as notificações: " + (e instanceof Error ? e.message : "erro"));
    }
  }

  async function disablePush() {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPush("idle");
    } catch { /* ignora */ }
  }

  async function update<K extends keyof NotificationPrefs>(key: K, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    try {
      await fetch("/api/notifications/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } finally {
      setSaving(false);
    }
  }

  const anySend = prefs.sendApproved || prefs.sendPending;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* ---- Opções ---- */}
      <div className="space-y-5">
        <div className="rounded-2xl border border-line bg-panel/70 p-5 space-y-3">
          <div>
            <div className="flex items-center gap-2 font-semibold"><Bell size={17} className="text-accent" /> Seja notificado no app</div>
            <p className="text-sm text-muted">Receba um push sempre que uma nova venda for realizada.</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-panel-2/50 border border-line px-3 py-2.5">
            <Smartphone size={18} className={push === "on" ? "text-pos" : "text-faint"} />
            <div className="flex-1 min-w-0 text-sm">
              {push === "on" ? "Notificações ativas neste dispositivo."
                : push === "denied" ? "Permissão bloqueada no navegador — libere nas configurações do site."
                : push === "unsupported" ? "Este navegador não suporta notificações push."
                : "Ative as notificações push neste dispositivo."}
            </div>
            {push === "on" ? (
              <button onClick={disablePush} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-panel-2">Desativar</button>
            ) : (push === "idle" || push === "denied") ? (
              <button onClick={enablePush} disabled={push === "denied"} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50">Ativar</button>
            ) : null}
          </div>
        </div>

        <Section title="O que enviar">
          <Toggle label="Enviar vendas pendentes" desc="Boleto/Pix aguardando pagamento" checked={prefs.sendPending} onChange={(v) => update("sendPending", v)} />
          <Toggle label="Enviar vendas aprovadas" desc="Pagamento confirmado" checked={prefs.sendApproved} onChange={(v) => update("sendApproved", v)} />
        </Section>

        <Section title="O que mostrar na notificação">
          <Toggle label="Valor da venda" checked={prefs.showValue} onChange={(v) => update("showValue", v)} />
          <Toggle label="Nome do produto" checked={prefs.showProduct} onChange={(v) => update("showProduct", v)} />
          <Toggle label="Valor de utm_campaign" checked={prefs.showUtmCampaign} onChange={(v) => update("showUtmCampaign", v)} />
          <Toggle label="Nome do dashboard" checked={prefs.showDashboardName} onChange={(v) => update("showDashboardName", v)} />
        </Section>

        <p className="text-[11px] text-faint">{saving ? "Salvando..." : "Alterações salvas automaticamente."}</p>
      </div>

      {/* ---- Prévia ---- */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-muted">Prévia de Notificação</div>
        {!anySend ? (
          <div className="rounded-2xl border border-dashed border-line bg-panel/40 p-8 text-center">
            <BellOff size={26} className="mx-auto text-faint" />
            <p className="mt-2 text-sm font-medium">Prévia indisponível.</p>
            <p className="text-xs text-faint mt-1">Habilite o envio de vendas pendentes e/ou aprovadas para visualizar a prévia.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {prefs.sendApproved && <PreviewCard kind="approved" prefs={prefs} dashboardName={dashboardName} />}
            {prefs.sendPending && <PreviewCard kind="pending" prefs={prefs} dashboardName={dashboardName} />}
          </div>
        )}
        <div className="rounded-xl border border-line bg-panel-2/40 px-3 py-2 text-[11px] text-faint">
          Ative as notificações neste dispositivo (acima) e faça uma venda de teste no webhook pra receber o push real.
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ kind, prefs, dashboardName }: { kind: "approved" | "pending"; prefs: NotificationPrefs; dashboardName: string }) {
  const title = kind === "approved" ? "Venda aprovada 🎉" : "Venda pendente 🕒";
  const lines: string[] = [];
  if (prefs.showValue) lines.push(SAMPLE.value);
  if (prefs.showProduct) lines.push(SAMPLE.product);
  if (prefs.showUtmCampaign) lines.push(`utm_campaign: ${SAMPLE.utmCampaign}`);
  const body = lines.join(" · ") || "Nova venda registrada";

  return (
    <div className="rounded-2xl border border-line bg-panel shadow-xl p-3.5 flex gap-3">
      <div className={`size-9 shrink-0 rounded-lg grid place-items-center ${kind === "approved" ? "bg-pos/20 text-pos" : "bg-warn/20 text-warn"}`}>
        <Bell size={18} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] text-faint">
          <span className="size-4 rounded bg-accent/20 text-accent grid place-items-center font-bold text-[9px]">U</span>
          Utmify {prefs.showDashboardName && <span>· {dashboardName}</span>} <span className="ml-auto">agora</span>
        </div>
        <div className="text-sm font-semibold mt-0.5">{title}</div>
        <div className="text-xs text-muted truncate">{body}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/70 p-5 space-y-1">
      <div className="text-xs uppercase tracking-wide text-faint mb-2">{title}</div>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 py-2.5 cursor-pointer">
      <div className="min-w-0 flex-1">
        <div className="text-sm">{label}</div>
        {desc && <div className="text-[11px] text-faint">{desc}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-pos" : "bg-panel-2 border border-line"}`}
        aria-pressed={checked}
      >
        <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white grid place-items-center transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}>
          {checked && <Check size={12} className="text-pos" />}
        </span>
      </button>
    </label>
  );
}
