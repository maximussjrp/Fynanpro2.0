'use client';

import { LucideIcon } from 'lucide-react';

interface QuickCardProps {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  primary: string;
  secondary?: string;
  detail?: { label: string; value: string };
  onClick?: () => void;
}

export default function QuickCard({
  icon: Icon,
  iconColor,
  label,
  primary,
  secondary,
  detail,
  onClick,
}: QuickCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="v2-card p-4 flex items-center gap-3 text-left w-full hover:translate-y-[-1px]"
      title={label}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${iconColor}1F`, color: iconColor }}
      >
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs v2-muted">{label}</span>
          {detail && (
            <span className="text-[11px] v2-faint truncate" title={`${detail.label} ${detail.value}`}>
              {detail.label}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-0.5">
          <span className="v2-num text-lg leading-tight truncate">{primary}</span>
          {detail && (
            <span className="text-xs v2-muted whitespace-nowrap">{detail.value}</span>
          )}
        </div>
        {secondary && <p className="text-xs v2-faint mt-0.5 truncate">{secondary}</p>}
      </div>
    </button>
  );
}
