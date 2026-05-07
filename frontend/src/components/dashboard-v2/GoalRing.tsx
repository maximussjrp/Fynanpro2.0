'use client';

import { formatCurrency } from '@/lib/energyColors';

interface GoalRingProps {
  current: number;
  target: number;
  label?: string;
  size?: number;
}

export default function GoalRing({ current, target, label = 'Meta', size = 160 }: GoalRingProps) {
  const safeTarget = target > 0 ? target : 1;
  const pct = Math.max(0, Math.min(100, (current / safeTarget) * 100));
  const remaining = Math.max(0, target - current);

  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id="goalGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#goalGrad)"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="v2-num text-2xl">{pct.toFixed(0)}%</span>
          <span className="text-[11px] v2-faint mt-0.5">{label}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 flex-1">
        <div>
          <p className="text-xs v2-muted">Objetivo</p>
          <p className="v2-num text-xl text-[var(--v2-text-primary)]">{formatCurrency(target)}</p>
        </div>
        <div>
          <p className="text-xs v2-muted">Guardado</p>
          <p className="v2-num text-xl text-[#10B981]">{formatCurrency(current)}</p>
        </div>
        <div>
          <p className="text-xs v2-muted">Faltam</p>
          <p className="v2-num text-base text-[var(--v2-text-primary)]">{formatCurrency(remaining)}</p>
        </div>
      </div>
    </div>
  );
}
