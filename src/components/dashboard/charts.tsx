"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const C = {
  accent: "#6c8cff",
  pos: "#26d07c",
  warn: "#f5b74e",
  violet: "#a78bfa",
  neg: "#f0616d",
  line: "#222c38",
  muted: "#8b98a9",
};

const axis = { stroke: C.muted, fontSize: 11, tickLine: false, axisLine: false };

function brl(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

const tooltipStyle = {
  contentStyle: {
    background: "#121821",
    border: "1px solid #222c38",
    borderRadius: 10,
    fontSize: 12,
  },
  labelStyle: { color: "#8b98a9" },
};

// ---- Faturamento x Investimento x Lucro por hora (acumulado) ----
export function HourlyAccumChart({
  data,
}: {
  data: { hour: string; faturamento: number; investimento: number; lucro: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gLucro" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.pos} stopOpacity={0.3} />
            <stop offset="100%" stopColor={C.pos} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
        <XAxis dataKey="hour" {...axis} interval={2} />
        <YAxis {...axis} tickFormatter={brl} width={64} />
        <Tooltip {...tooltipStyle} formatter={(v) => brl(Number(v))} />
        <Area
          type="monotone"
          dataKey="investimento"
          stroke={C.warn}
          strokeWidth={2}
          fill="none"
          name="Investimento"
        />
        <Area
          type="monotone"
          dataKey="faturamento"
          stroke={C.accent}
          strokeWidth={2}
          fill="url(#gFat)"
          name="Faturamento"
        />
        <Area
          type="monotone"
          dataKey="lucro"
          stroke={C.pos}
          strokeWidth={2}
          fill="url(#gLucro)"
          name="Lucro"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---- Barras genéricas (dia da semana, vendas por hora) ----
export function SimpleBar({
  data,
  xKey,
  yKey,
  color = C.accent,
  money = false,
  height = 220,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  color?: string;
  money?: boolean;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
        <XAxis dataKey={xKey} {...axis} interval={money ? 0 : 2} />
        <YAxis {...axis} width={money ? 56 : 32} tickFormatter={money ? brl : undefined} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ fill: "#ffffff08" }}
          formatter={(v) => (money ? brl(Number(v)) : Number(v))}
        />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---- Donut de vendas por pagamento ----
const DONUT = [C.accent, C.pos, C.warn, C.violet, C.neg];
export function DonutChart({ data }: { data: { label: string; valor: number }[] }) {
  const total = data.reduce((s, d) => s + d.valor, 0);
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="valor"
            nameKey="label"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={DONUT[i % DONUT.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(v) => brl(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: DONUT[i % DONUT.length] }}
            />
            <span className="text-muted">{d.label}</span>
            <span className="ml-auto tabular">
              {total > 0 ? Math.round((d.valor / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
