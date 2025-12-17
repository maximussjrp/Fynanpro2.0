'use client';

import { Plus, Repeat, Calendar, CreditCard } from 'lucide-react';

interface QuickActionsProps {
  onAddTransaction: () => void;
  onAddRecurring?: () => void;
  onOpenCalendar?: () => void;
  onAddInstallment?: () => void;
}

export default function QuickActions({ 
  onAddTransaction,
  onAddRecurring,
  onOpenCalendar,
  onAddInstallment
}: QuickActionsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <button
        onClick={onAddTransaction}
        className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#1F4FD8] to-[#1A44BF] rounded-xl hover:shadow-lg transition-all group"
      >
        <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Plus className="w-6 h-6 text-white" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-white font-inter">
            Nova Transação
          </p>
          <p className="text-xs text-white/80 font-inter">
            Receita ou Despesa
          </p>
        </div>
      </button>

      {onAddRecurring && (
        <button
          onClick={onAddRecurring}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border-2 border-transparent hover:border-[#1F4FD8] transition-all shadow-sm group"
        >
          <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center group-hover:scale-110 transition-transform">
            <Repeat className="w-6 h-6 text-[#1F4FD8]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900 font-inter">
              Recorrente
            </p>
            <p className="text-xs text-gray-500 font-inter">
              Conta repetida
            </p>
          </div>
        </button>
      )}

      {onAddInstallment && (
        <button
          onClick={onAddInstallment}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border-2 border-transparent hover:border-[#10B981] transition-all shadow-sm group"
        >
          <div className="w-12 h-12 rounded-lg bg-[#D1FAE5] flex items-center justify-center group-hover:scale-110 transition-transform">
            <CreditCard className="w-6 h-6 text-[#10B981]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900 font-inter">
              Parcelada
            </p>
            <p className="text-xs text-gray-500 font-inter">
              Dividir valores
            </p>
          </div>
        </button>
      )}

      {onOpenCalendar && (
        <button
          onClick={onOpenCalendar}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border-2 border-transparent hover:border-[#9333EA] transition-all shadow-sm group"
        >
          <div className="w-12 h-12 rounded-lg bg-[#F3E8FF] flex items-center justify-center group-hover:scale-110 transition-transform">
            <Calendar className="w-6 h-6 text-[#9333EA]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900 font-inter">
              Calendário
            </p>
            <p className="text-xs text-gray-500 font-inter">
              Ver agenda
            </p>
          </div>
        </button>
      )}
    </div>
  );
}
