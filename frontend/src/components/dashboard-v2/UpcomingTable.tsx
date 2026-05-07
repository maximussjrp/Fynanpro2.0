'use client';

import { formatCurrency } from '@/lib/energyColors';

export interface UpcomingItem {
  id: string;
  description: string;
  dueDate: string; // ISO
  amount: number;
  account?: string;
  status: 'upcoming' | 'overdue' | 'recurring';
  icon?: string;
}

interface UpcomingTableProps {
  items: UpcomingItem[];
  onItemClick?: (id: string) => void;
}

function formatBrDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  } catch {
    return iso;
  }
}

const STATUS_STYLES: Record<UpcomingItem['status'], { label: string; bg: string; color: string }> = {
  upcoming: { label: 'A vencer', bg: 'rgba(59,130,246,0.15)', color: '#60A5FA' },
  overdue: { label: 'Atrasada', bg: 'rgba(244,63,94,0.15)', color: '#FB7185' },
  recurring: { label: 'Recorrente', bg: 'rgba(139,92,246,0.15)', color: '#A78BFA' },
};

export default function UpcomingTable({ items, onItemClick }: UpcomingTableProps) {
  if (items.length === 0) {
    return <div className="text-sm v2-faint py-8 text-center">Nenhum compromisso à vista. Bom trabalho 👏</div>;
  }

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left v2-faint text-xs uppercase tracking-wider">
            <th className="py-2 px-2 font-medium">Descrição</th>
            <th className="py-2 px-2 font-medium">Vencimento</th>
            <th className="py-2 px-2 font-medium text-right">Valor</th>
            <th className="py-2 px-2 font-medium hidden md:table-cell">Conta</th>
            <th className="py-2 px-2 font-medium text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const sty = STATUS_STYLES[item.status];
            return (
              <tr
                key={item.id}
                onClick={onItemClick ? () => onItemClick(item.id) : undefined}
                className={`border-t border-[var(--v2-border)] ${
                  onItemClick ? 'cursor-pointer hover:bg-[var(--v2-bg-elevated)]/40' : ''
                } transition-colors`}
              >
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2.5">
                    {item.icon && (
                      <span className="w-7 h-7 rounded-lg bg-[var(--v2-bg-elevated)] flex items-center justify-center text-sm" aria-hidden>
                        {item.icon}
                      </span>
                    )}
                    <span className="text-[var(--v2-text-primary)] truncate">{item.description}</span>
                  </div>
                </td>
                <td className="py-3 px-2 v2-muted">{formatBrDate(item.dueDate)}</td>
                <td className="py-3 px-2 text-right v2-num text-[var(--v2-text-primary)]">{formatCurrency(item.amount)}</td>
                <td className="py-3 px-2 v2-muted hidden md:table-cell truncate max-w-[160px]">{item.account || '—'}</td>
                <td className="py-3 px-2 text-right">
                  <span
                    className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: sty.bg, color: sty.color }}
                  >
                    {sty.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
