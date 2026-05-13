'use client';

import { formatCurrency } from '@/lib/energyColors';
import Badge from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';

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
    return (
      <Card className="border-dashed">
        <CardContent className="py-6">
          <EmptyState
            title="Nenhum compromisso à vista"
            description="Bom trabalho! 👏"
            variant="compact"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <TableContainer className="-mx-2">
      <Table>
        <TableHeader>
          <TableRow className="text-left v2-faint">
            <TableHead>Descrição</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="hidden md:table-cell">Conta</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const sty = STATUS_STYLES[item.status];
            return (
              <TableRow
                key={item.id}
                onClick={onItemClick ? () => onItemClick(item.id) : undefined}
                hover={!!onItemClick}
                className={onItemClick ? 'cursor-pointer hover:bg-[var(--v2-bg-elevated)]/40' : ''}
              >
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    {item.icon && (
                      <span className="w-7 h-7 rounded-lg bg-[var(--v2-bg-elevated)] flex items-center justify-center text-sm" aria-hidden>
                        {item.icon}
                      </span>
                    )}
                    <span className="text-[var(--v2-text-primary)] truncate">{item.description}</span>
                  </div>
                </TableCell>
                <TableCell className="v2-muted">{formatBrDate(item.dueDate)}</TableCell>
                <TableCell className="text-right v2-num text-[var(--v2-text-primary)]">{formatCurrency(item.amount)}</TableCell>
                <TableCell className="v2-muted hidden md:table-cell truncate max-w-[160px]">{item.account || '—'}</TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={
                      item.status === 'upcoming' ? 'info' : item.status === 'overdue' ? 'danger' : 'success'
                    }
                  >
                    {sty.label}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
