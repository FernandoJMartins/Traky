import { ReactNode } from "react";

type Tone = "default" | "pos" | "neg" | "warn" | "accent";

const toneText: Record<Tone, string> = {
  default: "text-text",
  pos: "text-pos",
  neg: "text-neg",
  warn: "text-warn",
  accent: "text-accent",
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-line p-4 ${
        emphasis ? "bg-panel-2" : "bg-panel/70"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular tracking-tight ${toneText[tone]}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </div>
  );
}
