"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Zap,
  Link2,
  MoreHorizontal,
} from "lucide-react";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Campanhas",
    href: "/campanhas",
    icon: Megaphone,
  },
  {
    label: "Regras",
    href: "/regras",
    icon: Zap,
  },
  {
    label: "UTMs",
    href: "/utms",
    icon: Link2,
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="
        fixed
        bottom-0
        left-0
        right-0
        z-50
        md:hidden
        border-t
        border-line
        bg-panel
        backdrop-blur
      "
    >
      <div className="grid grid-cols-5 h-16">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`
                flex
                flex-col
                items-center
                justify-center
                gap-1
                text-xs
                ${
                  active
                    ? "text-accent"
                    : "text-muted"
                }
              `}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}

        <button
          className="
            flex
            flex-col
            items-center
            justify-center
            gap-1
            text-xs
            text-muted
          "
        >
          <MoreHorizontal size={20} />
          <span>Mais</span>
        </button>
      </div>
    </nav>
  );
}