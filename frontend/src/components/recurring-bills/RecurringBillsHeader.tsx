'use client';

import { Plus, TrendingUp, Calendar, DollarSign } from 'lucide-react';

interface RecurringBillsHeaderProps {
  totalActive: number;
  totalMonthly: number;
  nextDueCount: number;
  onCreateNew: () => void;
}

export default function RecurringBillsHeader({
  totalActive,
  totalMonthly,
  nextDueCount,
  onCreateNew,
}: RecurringBillsHeaderProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="mb-8">
      {/* Título e Botão */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 font-['Poppins']">
            Contas Recorrentes
          </h1>
          <p className="text-gray-600 mt-2 font-['Inter']">
            Gerencie suas despesas e receitas que se repetem regularmente
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1F4FD8] to-[#1A44BF] text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          Nova Conta Recorrente
        </button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total de Contas Ativas */}
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#1F4FD8]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Contas Ativas</p>
              <p className="text-3xl font-bold text-gray-900">{totalActive}</p>
            </div>
            <div className="w-12 h-12 bg-[#DBEAFE] rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-[#1F4FD8]" />
            </div>
          </div>
        </div>

        {/* Total Mensal */}
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#2ECC9A]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Mensal</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalMonthly)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-[#2ECC9A]" />
            </div>
          </div>
        </div>

        {/* Próximos Vencimentos */}
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#F59E0B]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Vencendo em 7 dias</p>
              <p className="text-3xl font-bold text-gray-900">{nextDueCount}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#F59E0B]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
