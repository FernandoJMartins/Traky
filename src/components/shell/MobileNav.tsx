"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV } from "./Sidebar";

// Navegação mobile: botão hambúrguer + drawer lateral. Só aparece em telas < md.
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fecha ao navegar.
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="grid place-items-center size-9 rounded-lg border border-line bg-panel text-muted hover:text-text"
      >
        <Menu size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-panel border-r border-line flex flex-col">
            <div className="h-14 flex items-center gap-2 px-5 border-b border-line">
              <div className="size-7 rounded-lg bg-accent/20 text-accent grid place-items-center font-bold">T</div>
              <span className="font-semibold tracking-tight">Tracky</span>
              <button onClick={() => setOpen(false)} className="ml-auto text-muted hover:text-text" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 z-100 overflow-y-auto">
              {NAV.map(({ label, icon: Icon, href }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={label}
                    href={href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      active ? "bg-accent/15 text-text font-medium" : "text-muted hover:bg-panel-2 hover:text-text"
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
