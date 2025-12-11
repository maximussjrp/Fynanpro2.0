'use client';

import { Repeat, Plus } from 'lucide-react';
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
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-6">
          <Repeat className="w-16 h-16 text-[#1C6DD0]" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2 font-['Poppins']">
          Nenhuma conta recorrente
        </h3>
        <p className="text-gray-600 text-center mb-6 max-w-md">
          Comece criando sua primeira conta recorrente para organizar suas despesas e receitas que se repetem.
        </p>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1C6DD0] to-[#1557A8] text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          Criar Primeira Conta Recorrente
        </button>
      </div>
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
