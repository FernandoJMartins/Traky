"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Plus, Loader2, LayoutGrid } from "lucide-react";

type Dash = { id: string; name: string; currency: string };

export function DashboardSwitcher({
  dashboards,
  currentId,
}: {
  dashboards: Dash[];
  currentId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = dashboards.find((d) => d.id === currentId) ?? dashboards[0];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function switchTo(id: string) {
    if (id === currentId) return setOpen(false);
    setBusy(true);
    await fetch("/api/dashboards/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dashboardId: id }),
    });
    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  async function createDash() {
    if (!name.trim()) return;
    setBusy(true);
    await fetch("/api/dashboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setName("");
    setCreating(false);
    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm hover:bg-panel-2"
      >
        <span className="size-4 rounded bg-accent/25 text-accent grid place-items-center text-[10px] font-bold">
          @
        </span>
        <span className="max-w-[160px] truncate">{current?.name ?? "Dashboard"}</span>
        <ChevronDown size={15} className="text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-72 rounded-xl border border-line bg-panel shadow-xl overflow-hidden z-30">
          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-faint flex items-center gap-1.5">
            <LayoutGrid size={12} /> Seus dashboards
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {dashboards.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => switchTo(d.id)}
                  disabled={busy}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-panel-2 text-left"
                >
                  <span className="size-5 rounded bg-accent/20 text-accent grid place-items-center text-[10px] font-bold shrink-0">
                    @
                  </span>
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="text-[11px] text-faint">{d.currency}</span>
                  {d.id === currentId && <Check size={15} className="text-pos shrink-0" />}
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-line p-2">
            {creating ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createDash()}
                  placeholder="Nome do dashboard"
                  className="flex-1 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  onClick={createDash}
                  disabled={busy || !name.trim()}
                  className="grid place-items-center size-8 rounded-lg bg-accent text-bg disabled:opacity-40"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-accent hover:bg-panel-2 rounded-lg"
              >
                <Plus size={15} /> Novo dashboard
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
