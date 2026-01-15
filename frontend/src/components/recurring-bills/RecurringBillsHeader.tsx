'use client';

import { Plus, TrendingUp, TrendingDown, Calendar, DollarSign, PieChart, AlertTriangle } from 'lucide-react';

interface CategoryBreakdown {
  name: string;
  icon: string;
  total: number;
  count: number;
  percent: number;
}

interface RecurringBillsHeaderProps {
  totalActive: number;
  totalMonthly: number;
  nextDueCount: number;
  totalMonthlyExpenses?: number;
  totalMonthlyIncome?: number;
  netFixedMonthly?: number;
  incomeCommitmentPercent?: number;
  topCategories?: CategoryBreakdown[];
  onCreateNew: () => void;
}

export default function RecurringBillsHeader({
  totalActive,
  totalMonthly,
  nextDueCount,
  totalMonthlyExpenses = 0,
  totalMonthlyIncome = 0,
  netFixedMonthly = 0,
  incomeCommitmentPercent = 0,
  topCategories = [],
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

      {/* Cards de Estatísticas - 4 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Despesas Fixas */}
        <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-[#EF4444]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Despesas Fixas</p>
              <p className="text-2xl font-bold text-[#EF4444]">{formatCurrency(totalMonthlyExpenses)}</p>
              <p className="text-xs text-gray-500 mt-1">por mês</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-[#EF4444]" />
            </div>
          </div>
        </div>

        {/* Receitas Fixas */}
        <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-[#10B981]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Receitas Fixas</p>
              <p className="text-2xl font-bold text-[#10B981]">{formatCurrency(totalMonthlyIncome)}</p>
              <p className="text-xs text-gray-500 mt-1">por mês</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-[#10B981]" />
            </div>
          </div>
        </div>

        {/* Saldo Fixo */}
        <div className={`bg-white rounded-xl shadow-md p-5 border-l-4 ${netFixedMonthly >= 0 ? 'border-[#1F4FD8]' : 'border-[#F59E0B]'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Saldo Fixo</p>
              <p className={`text-2xl font-bold ${netFixedMonthly >= 0 ? 'text-[#1F4FD8]' : 'text-[#F59E0B]'}`}>
                {formatCurrency(netFixedMonthly)}
              </p>
              <p className="text-xs text-gray-500 mt-1">receita - despesa</p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${netFixedMonthly >= 0 ? 'bg-blue-100' : 'bg-yellow-100'}`}>
              <DollarSign className={`w-6 h-6 ${netFixedMonthly >= 0 ? 'text-[#1F4FD8]' : 'text-[#F59E0B]'}`} />
            </div>
          </div>
        </div>

        {/* Vencendo em 7 dias */}
        <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-[#8B5CF6]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Vencendo em 7 dias</p>
              <p className="text-2xl font-bold text-gray-900">{nextDueCount}</p>
              <p className="text-xs text-gray-500 mt-1">contas</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#8B5CF6]" />
            </div>
          </div>
        </div>
      </div>

      {/* Segunda linha - Comprometimento + Top Categorias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Comprometimento da Renda */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-[#1F4FD8]" />
            <h3 className="font-semibold text-gray-800">Comprometimento da Renda</h3>
          </div>
          <div className="flex items-center gap-6">
            {/* Gauge visual */}
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#E5E7EB"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke={incomeCommitmentPercent > 80 ? '#EF4444' : incomeCommitmentPercent > 60 ? '#F59E0B' : '#10B981'}
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${(incomeCommitmentPercent / 100) * 352} 352`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${incomeCommitmentPercent > 80 ? 'text-[#EF4444]' : incomeCommitmentPercent > 60 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                  {incomeCommitmentPercent}%
                </span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-2">
                Das suas receitas fixas mensais, <strong>{incomeCommitmentPercent}%</strong> está comprometido com despesas fixas.
              </p>
              {incomeCommitmentPercent > 80 && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Atenção! Mais de 80% comprometido</span>
                </div>
              )}
              {incomeCommitmentPercent <= 80 && incomeCommitmentPercent > 60 && (
                <div className="flex items-center gap-2 text-yellow-600 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Cuidado! Entre 60-80% comprometido</span>
                </div>
              )}
              {incomeCommitmentPercent <= 60 && (
                <p className="text-green-600 text-sm font-medium">✓ Saudável! Menos de 60% comprometido</p>
              )}
            </div>
          </div>
        </div>

        {/* Top Categorias */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-[#8B5CF6]" />
              <h3 className="font-semibold text-gray-800">Maiores Despesas Fixas</h3>
            </div>
            <span className="text-xs text-gray-500">{totalActive} contas ativas</span>
          </div>
          {topCategories.length > 0 ? (
            <div className="space-y-3">
              {topCategories.map((cat, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-xl">{cat.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(cat.total)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] h-2 rounded-full"
                        style={{ width: `${cat.percent}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right">{cat.percent}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">Nenhuma despesa fixa cadastrada</p>
          )}
        </div>
      </div>
    </div>
  );
}
