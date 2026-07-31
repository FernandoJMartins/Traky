import { ReactNode } from "react";

export function Card({
  children,
  className = "",
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-line bg-panel/70 backdrop-blur-sm ${className}`}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4">
          <div>
            {title && <h3 className="text-sm font-medium text-text">{title}</h3>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
