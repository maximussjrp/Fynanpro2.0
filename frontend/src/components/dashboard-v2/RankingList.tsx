'use client';

import { formatCurrency } from '@/lib/energyColors';

export interface RankingItem {
  name: string;
  value: number;
  color?: string;
  icon?: string; // emoji or short text
}

interface RankingListProps {
  items: RankingItem[];
  max?: number;
}

const FALLBACK = '#3B82F6';

export default function RankingList({ items, max = 5 }: RankingListProps) {
  const top = items.slice(0, max);
  const peak = top.reduce((m, i) => Math.max(m, i.value), 0) || 1;

  if (top.length === 0) {
    return <div className="text-sm v2-faint py-6 text-center">Nenhum dado no período.</div>;
  }

  return (
    <ul className="flex flex-col gap-3.5">
      {top.map((item) => {
        const pct = (item.value / peak) * 100;
        const color = item.color || FALLBACK;
        return (
          <li key={item.name} className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
              style={{ background: `${color}22`, color }}
              aria-hidden
            >
              {item.icon || item.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-sm text-[var(--v2-text-primary)] truncate">{item.name}</span>
                <span className="text-sm v2-num text-[var(--v2-text-primary)] whitespace-nowrap">
                  {formatCurrency(item.value)}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--v2-bg-elevated)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
