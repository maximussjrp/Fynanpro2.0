'use client';

import { Plus, Repeat, Calendar } from 'lucide-react';

interface QuickActionsProps {
  onAddTransaction: () => void;
  onAddRecurring?: () => void;
  onOpenCalendar?: () => void;
}

export default function QuickActions({ 
  onAddTransaction,
  onAddRecurring,
  onOpenCalendar 
}: QuickActionsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <button
        onClick={onAddTransaction}
        className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] border border-[#C9A962] rounded-xl hover:shadow-lg transition-all group"
      >
        <div className="w-12 h-12 rounded-lg bg-[#C9A962]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Plus className="w-6 h-6 text-[#C9A962]" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
            Nova Transação
          </p>
          <p className="text-xs text-white/80" style={{ fontFamily: 'Inter, sans-serif' }}>
            Receita ou Despesa
          </p>
        </div>
      </button>

      {onAddRecurring && (
        <button
          onClick={onAddRecurring}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border-2 border-transparent hover:border-[#C9A962] transition-all shadow-sm group"
        >
          <div className="w-12 h-12 rounded-lg bg-[#F5F0E6] flex items-center justify-center group-hover:scale-110 transition-transform">
            <Repeat className="w-6 h-6 text-[#1A1A1A]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
              Recorrente
            </p>
            <p className="text-xs text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
              Conta repetida
            </p>
          </div>
        </button>
      )}

      {onOpenCalendar && (
        <button
          onClick={onOpenCalendar}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border-2 border-transparent hover:border-[#C9A962] transition-all shadow-sm group"
        >
          <div className="w-12 h-12 rounded-lg bg-[#F5F0E6] flex items-center justify-center group-hover:scale-110 transition-transform">
            <Calendar className="w-6 h-6 text-[#1A1A1A]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
              Calendário
            </p>
            <p className="text-xs text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
              Ver agenda
            </p>
          </div>
        </button>
      )}
    </div>
  );
}
