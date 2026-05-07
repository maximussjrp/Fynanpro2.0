'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/energyColors';

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

interface CategoryDonutProps {
  data: DonutSlice[];
  totalLabel?: string;
}

const FALLBACK_COLORS = ['#3B82F6', '#C026D3', '#F59E0B', '#10B981', '#F43F5E', '#8B5CF6', '#06B6D4'];

export default function CategoryDonut({ data, totalLabel = 'Total' }: CategoryDonutProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const enriched = data.map((d, i) => ({ ...d, color: d.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length] }));

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 v2-faint text-sm">
        Sem despesas no período.
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="relative w-[180px] h-[180px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={enriched}
              dataKey="value"
              innerRadius={62}
              outerRadius={86}
              paddingAngle={2}
              stroke="none"
            >
              {enriched.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] v2-faint">{totalLabel}</span>
          <span className="v2-num text-base mt-0.5">{formatCurrency(total)}</span>
        </div>
      </div>

      <ul className="flex-1 w-full flex flex-col gap-2.5">
        {enriched.slice(0, 6).map((slice) => {
          const pct = (slice.value / total) * 100;
          return (
            <li key={slice.name} className="flex items-center gap-3">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: slice.color }}
              />
              <span className="flex-1 text-sm text-[var(--v2-text-primary)] truncate">{slice.name}</span>
              <span className="text-sm v2-num text-[var(--v2-text-primary)]">{formatCurrency(slice.value)}</span>
              <span className="text-xs v2-muted w-12 text-right">{pct.toFixed(1)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
