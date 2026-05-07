'use client';

import { ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';
import Sparkline from './Sparkline';
import { formatCurrency } from '@/lib/energyColors';

interface KpiCardProps {
  label: string;
  value: number;
  microcopy?: string;
  trendPct?: number; // positive number = up; negative = down
  trendLabel?: string; // ex: "vs mês anterior"
  positiveIsGood?: boolean; // se true, alta é verde; se false, alta é vermelha
  accentColor: string; // CSS color for sparkline + accent
  icon?: LucideIcon;
  spark?: number[];
}

export default function KpiCard({
  label,
  value,
  microcopy,
  trendPct,
  trendLabel = 'vs mês anterior',
  positiveIsGood = true,
  accentColor,
  icon: Icon,
  spark,
}: KpiCardProps) {
  const hasTrend = typeof trendPct === 'number' && Number.isFinite(trendPct);
  const isUp = hasTrend && trendPct! > 0;
  const isDown = hasTrend && trendPct! < 0;
  const trendIsGood = positiveIsGood ? isUp : isDown;
  const trendColor = !hasTrend
    ? 'var(--v2-text-faint)'
    : trendIsGood
      ? 'var(--v2-goal)'
      : isUp || isDown
        ? 'var(--v2-danger)'
        : 'var(--v2-text-faint)';

  return (
    <div className="v2-card p-5 flex flex-col gap-3 min-h-[148px]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider v2-muted">{label}</span>
        </div>
        {Icon && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `${accentColor}1F`, color: accentColor }}
          >
            <Icon className="w-4.5 h-4.5" size={18} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <p className="v2-num text-[28px] leading-none">{formatCurrency(value)}</p>
        {microcopy && <p className="text-xs v2-faint">{microcopy}</p>}
      </div>

      <div className="flex items-end justify-between mt-auto">
        {hasTrend ? (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: trendColor }}
          >
            {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : isDown ? <ArrowDownRight className="w-3.5 h-3.5" /> : null}
            {`${trendPct! > 0 ? '+' : ''}${trendPct!.toFixed(1)}% ${trendLabel}`}
          </span>
        ) : (
          <span className="text-xs v2-faint">{trendLabel}</span>
        )}
        {spark && spark.length >= 2 && <Sparkline data={spark} color={accentColor} height={36} width={96} />}
      </div>
    </div>
  );
}
