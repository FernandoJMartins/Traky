"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { name, email, password } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Falha");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro desconhecido");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text grid place-items-center px-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="size-8 rounded-lg bg-accent/20 text-accent grid place-items-center font-bold">U</div>
          <span className="font-semibold tracking-tight text-lg">Utmify</span>
        </Link>

        <div className="rounded-2xl border border-line bg-panel/70 p-6">
          <h1 className="text-xl font-semibold">{isRegister ? "Criar conta" : "Entrar"}</h1>
          <p className="text-sm text-muted mt-1">
            {isRegister ? "Comece a rastrear suas vendas." : "Bem-vindo de volta."}
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            {isRegister && (
              <Field label="Nome">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome"
                  className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" autoComplete="name" />
              </Field>
            )}
            <Field label="E-mail">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com"
                className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" autoComplete="email" />
            </Field>
            <Field label="Senha">
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" autoComplete={isRegister ? "new-password" : "current-password"} />
            </Field>

            {err && <p className="text-sm text-neg">{err}</p>}

            <button type="submit" disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-60">
              {busy && <Loader2 size={15} className="animate-spin" />}
              {isRegister ? "Criar conta" : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted mt-4">
          {isRegister ? (
            <>Já tem conta? <Link href="/login" className="text-accent hover:underline">Entrar</Link></>
          ) : (
            <>Não tem conta? <Link href="/register" className="text-accent hover:underline">Criar conta</Link></>
          )}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}
