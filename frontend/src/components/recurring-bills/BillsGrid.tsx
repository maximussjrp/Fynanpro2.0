'use client';

import { Repeat, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import RecurringBillCard from './RecurringBillCard';

interface RecurringBill {
  id: string;
  name: string;
  description?: string;
  type: string;
  amount: string;
  frequency: string;
  firstDueDate?: string;
  endDate?: string;
  dueDay: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  status: string;
  category?: {
    id: string;
    name: string;
    type: string;
    icon: string;
    color: string;
  } | null;
  bankAccount?: {
    id: string;
    name: string;
  } | null;
  paymentMethod?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    occurrences: number;
  };
  nextOccurrence?: string;
  createdAt: string;
}

interface BillsGridProps {
  bills: RecurringBill[];
  loading: boolean;
  onEdit: (bill: RecurringBill) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onToggleStatus: (bill: RecurringBill) => void | Promise<void>;
  onGenerateOccurrences: (id: string) => void | Promise<void>;
  onCreateNew: () => void;
}

export default function BillsGrid({
  bills,
  loading,
  onEdit,
  onDelete,
  onToggleStatus,
  onGenerateOccurrences,
  onCreateNew,
}: BillsGridProps) {
  // Loading Skeleton
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl shadow-md overflow-hidden animate-pulse"
          >
            <div className="h-24 bg-gradient-to-r from-gray-200 to-gray-300" />
            <div className="p-6 space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="flex gap-2">
                <div className="flex-1 h-10 bg-gray-200 rounded-xl" />
                <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                <div className="w-10 h-10 bg-gray-200 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty State
  if (bills.length === 0) {
    return (
      <EmptyState
        icon={<Repeat className="w-10 h-10" />}
        title="Nenhuma conta recorrente"
        description="Comece criando sua primeira conta recorrente para organizar suas despesas e receitas que se repetem."
        action={
          <Button
            onClick={onCreateNew}
            variant="primary"
            size="lg"
            leftIcon={<Plus className="w-5 h-5" />}
          >
            Criar Primeira Conta Recorrente
          </Button>
        }
      />
    );
  }

  // Grid com Cards
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {bills.map((bill) => (
        <RecurringBillCard
          key={bill.id}
          bill={bill}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleStatus={onToggleStatus}
          onGenerateOccurrences={onGenerateOccurrences}
        />
      ))}
    </div>
  );
}
