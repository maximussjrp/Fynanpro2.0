'use client';

import { Edit2, Trash2, Play, Pause, Zap, Calendar } from 'lucide-react';

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
  category: {
    id: string;
    name: string;
    type: string;
    icon: string;
    color: string;
  };
  bankAccount: {
    id: string;
    name: string;
  };
  paymentMethod?: {
    id: string;
    name: string;
  };
  _count?: {
    occurrences: number;
  };
  nextOccurrence?: string;
  createdAt: string;
}

interface RecurringBillCardProps {
  bill: RecurringBill;
  onEdit: (bill: RecurringBill) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (bill: RecurringBill) => void;
  onGenerateOccurrences: (id: string) => void;
}

export default function RecurringBillCard({
  bill,
  onEdit,
  onDelete,
  onToggleStatus,
  onGenerateOccurrences,
}: RecurringBillCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      daily: 'Diário',
      weekly: 'Semanal',
      monthly: 'Mensal',
      yearly: 'Anual',
    };
    return labels[frequency] || frequency;
  };

  const getDayOfWeekLabel = (day: number) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[day] || '';
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 hover:-translate-y-1">
      {/* Header do Card com Gradiente */}
      <div
        className={`p-4 ${
          bill.type === 'income'
            ? 'bg-gradient-to-r from-[#22C39A] to-[#16A085]'
            : 'bg-gradient-to-r from-[#E74C3C] to-[#C0392B]'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{bill.category.icon}</span>
            <div>
              <h3 className="text-white font-bold text-lg">{bill.name}</h3>
              <p className="text-white/90 text-sm">{bill.category.name}</p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              bill.status === 'active'
                ? 'bg-white/20 text-white backdrop-blur-sm'
                : 'bg-gray-900/30 text-white/80'
            }`}
          >
            {bill.status === 'active' ? '✓ Ativa' : '⏸ Pausada'}
          </span>
        </div>
      </div>

      {/* Conteúdo do Card */}
      <div className="p-6 space-y-4">
        {/* Valor e Frequência */}
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(Number(bill.amount))}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {getFrequencyLabel(bill.frequency)}
            </p>
          </div>
          <div
            className={`px-3 py-1 rounded-lg text-xs font-bold ${
              bill.type === 'income'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {bill.type === 'income' ? '↑ RECEITA' : '↓ DESPESA'}
          </div>
        </div>

        {/* Informações de Data */}
        <div className="space-y-2 pt-3 border-t border-gray-200">
          {bill.frequency === 'monthly' && (bill.dayOfMonth || bill.dueDay) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-[#1C6DD0]" />
              <span>Dia {bill.dayOfMonth || bill.dueDay} de cada mês</span>
            </div>
          )}

          {bill.frequency === 'weekly' && bill.dayOfWeek !== undefined && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-[#1C6DD0]" />
              <span>Toda {getDayOfWeekLabel(bill.dayOfWeek)}</span>
            </div>
          )}

          {bill.firstDueDate && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-semibold">Início:</span>
              <span>{formatDate(bill.firstDueDate)}</span>
            </div>
          )}

          {bill.endDate && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-semibold">Fim:</span>
              <span>{formatDate(bill.endDate)}</span>
            </div>
          )}
        </div>

        {/* Conta Bancária */}
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Conta</p>
          <p className="text-sm font-semibold text-gray-800">{bill.bankAccount.name}</p>
        </div>

        {/* Contador de Ocorrências */}
        {bill._count && bill._count.occurrences > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
            <Zap className="w-4 h-4 text-[#1C6DD0]" />
            <span className="text-sm font-medium text-[#1C6DD0]">
              {bill._count.occurrences} ocorrências geradas
            </span>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => onToggleStatus(bill)}
            className={`flex-1 px-3 py-2 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-200 ${
              bill.status === 'active'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {bill.status === 'active' ? (
              <>
                <Pause className="w-4 h-4" />
                Pausar
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Ativar
              </>
            )}
          </button>
          <button
            onClick={() => onEdit(bill)}
            className="px-3 py-2 bg-blue-100 text-[#1C6DD0] rounded-xl hover:bg-blue-200 transition-all duration-200"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(bill.id)}
            className="px-3 py-2 bg-red-100 text-[#E74C3C] rounded-xl hover:bg-red-200 transition-all duration-200"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Botão Gerar Ocorrências */}
        {bill.status === 'active' && (
          <button
            onClick={() => onGenerateOccurrences(bill.id)}
            className="w-full px-4 py-2 bg-gradient-to-r from-[#22C39A] to-[#16A085] text-white rounded-xl hover:shadow-lg transition-all duration-200 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Gerar Ocorrências
          </button>
        )}
      </div>
    </div>
  );
}
