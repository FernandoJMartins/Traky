"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Zap,
  Link2,
  Crosshair,
  Bell,
  BadgeDollarSign,
  KeyRound,
  Trophy,
} from "lucide-react";

export const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Campanhas", icon: Megaphone, href: "/campanhas" },
  { label: "Regras", icon: Zap, href: "/regras" },
  { label: "Relatório de UTMs", icon: Link2, href: "/utms" },
  { label: "Integrações", icon: KeyRound, href: "/integracoes" },
  { label: "Pixels", icon: Crosshair, href: "/pixels" },
  { label: "Notificações", icon: Bell, href: "/notificacoes" },
  { label: "Premiações", icon: Trophy, href: "/premiacoes" },
  { label: "Planos", icon: BadgeDollarSign, href: "/planos" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-panel/40">
      <div className="h-14 flex items-center gap-2 px-5 border-b border-line">
        <div className="size-7 rounded-lg bg-accent/20 text-accent grid place-items-center font-bold">
          T
        </div>
        <span className="font-semibold tracking-tight">Tracky</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ label, icon: Icon, href }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent/15 text-text font-medium"
                  : "text-muted hover:bg-panel-2 hover:text-text"
              }`}
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-line">
        <div className="rounded-lg bg-panel-2 px-3 py-2.5 text-xs text-muted">
          Plano <span className="text-pos font-medium">Gratuito</span>
          <div className="mt-1 text-faint">Vendas: 0 / 30</div>
        </div>
      </div>
    </aside>
  );
}
