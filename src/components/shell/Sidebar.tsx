"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
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

const LS_COLLAPSED = "sidebarCollapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem(LS_COLLAPSED);
    if (v !== null) setCollapsed(v === "1");
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const n = !c;
      localStorage.setItem(LS_COLLAPSED, n ? "1" : "0");
      return n;
    });
  }

  return (
    <aside
      className={`hidden md:flex shrink-0 flex-col border-r border-line bg-panel/40 transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className={`h-14 flex items-center border-b border-line ${collapsed ? "justify-center px-2" : "gap-2 px-5"}`}>
        {!collapsed && (
          <>
            <div className="size-7 rounded-lg bg-accent/20 text-accent grid place-items-center font-bold">
              T
            </div>
            <span className="font-semibold tracking-tight">Tracky</span>
          </>
        )}
        <button
          onClick={toggle}
          title={collapsed ? "Expandir menu" : "Retrair menu"}
          aria-label={collapsed ? "Expandir menu" : "Retrair menu"}
          className={`grid place-items-center size-8 rounded-lg text-muted hover:bg-panel-2 hover:text-text ${collapsed ? "" : "ml-auto"}`}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ label, icon: Icon, href }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                collapsed ? "justify-center" : "gap-3"
              } ${
                active
                  ? "bg-accent/15 text-text font-medium"
                  : "text-muted hover:bg-panel-2 hover:text-text"
              }`}
            >
              <Icon size={18} strokeWidth={1.8} className="shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="p-3 border-t border-line">
          <div className="rounded-lg bg-panel-2 px-3 py-2.5 text-xs text-muted">
            Plano <span className="text-pos font-medium">Gratuito</span>
            <div className="mt-1 text-faint">Vendas: 0 / 30</div>
          </div>
        </div>
      )}
    </aside>
  );
}
