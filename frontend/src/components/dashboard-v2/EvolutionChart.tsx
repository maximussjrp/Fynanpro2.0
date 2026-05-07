'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/lib/energyColors';

interface Point {
  label: string;
  income: number;
  expense: number;
}

interface EvolutionChartProps {
  data: Point[];
  height?: number;
}

const fmtCompact = (v: number) => {
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
  return `R$${Math.round(v)}`;
};

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  name: string;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: 'var(--v2-bg-elevated)',
        border: '1px solid var(--v2-border-strong)',
        borderRadius: 12,
        padding: '10px 12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--v2-text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, lineHeight: '20px' }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: p.color, display: 'inline-block' }} />
          <span style={{ color: 'var(--v2-text-muted)' }}>{p.name}:</span>
          <span style={{ color: 'var(--v2-text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {formatCurrency(Number(p.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function EvolutionChart({ data, height = 300 }: EvolutionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C026D3" stopOpacity={0.30} />
            <stop offset="100%" stopColor="#C026D3" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="label"
          stroke="#64748B"
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          stroke="#64748B"
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          tickFormatter={fmtCompact}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="income"
          name="Receitas"
          stroke="#3B82F6"
          strokeWidth={2}
          fill="url(#incomeGrad)"
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="expense"
          name="Despesas"
          stroke="#C026D3"
          strokeWidth={2}
          fill="url(#expenseGrad)"
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
