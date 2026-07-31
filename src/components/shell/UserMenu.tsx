"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";

export function UserMenu({ name, email }: { name: string | null; email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const initials = (name || email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="size-8 rounded-full bg-violet/30 text-violet grid place-items-center text-sm font-medium hover:opacity-90"
        title={email}
      >
        {initials || <User size={16} />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-line bg-panel shadow-xl z-30 py-1">
            <div className="px-3 py-2 border-b border-line">
              <div className="text-sm font-medium truncate">{name || "Você"}</div>
              <div className="text-xs text-faint truncate">{email}</div>
            </div>
            <button
              onClick={logout}
              disabled={busy}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-panel-2 disabled:opacity-60"
            >
              <LogOut size={15} /> {busy ? "Saindo..." : "Sair"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
