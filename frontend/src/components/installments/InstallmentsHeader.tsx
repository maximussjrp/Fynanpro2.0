'use client';

import { Plus, TrendingDown, CreditCard, Calendar, CheckCircle, Clock, PieChart, Zap } from 'lucide-react';

interface CategoryBreakdown {
  name: string;
  icon: string;
  total: number;
  remaining: number;
  count: number;
  percent: number;
  paid?: number;
  paymentProgress?: number;
}

interface MonthlyReduction {
  month: string;
  monthLabel: string;
  reduction: number;
  endingPurchases: string[];
}

interface InstallmentsHeaderProps {
  totalActive: number;
  totalOwed: number;
  pendingInstallments: number;
  totalPaid?: number;
  totalOverall?: number;
  monthlyInstallmentSpend?: number;
  payoffDate?: Date | null;
  monthsUntilPayoff?: number;
  overallProgress?: number;
  topCategories?: CategoryBreakdown[];
  monthlyReductions?: MonthlyReduction[];
  biggestReductionMonth?: MonthlyReduction | null;
  onCreateNew: () => void;
}

export default function InstallmentsHeader({
  totalActive,
  totalOwed,
  pendingInstallments,
  totalPaid = 0,
  totalOverall = 0,
  monthlyInstallmentSpend = 0,
  payoffDate,
  monthsUntilPayoff = 0,
  overallProgress = 0,
  topCategories = [],
  monthlyReductions = [],
  biggestReductionMonth = null,
  onCreateNew,
}: InstallmentsHeaderProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="mb-8">
      {/* Título e Botão */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 font-['Poppins']">
            Compras Parceladas
          </h1>
          <p className="text-gray-600 mt-2 font-['Inter']">
            Controle suas compras divididas em várias parcelas
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          Nova Compra Parcelada
        </button>
      </div>

      {/* Cards de Estatísticas - 4 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Compras Ativas */}
        <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-[#8B5CF6]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Compras Ativas</p>
              <p className="text-2xl font-bold text-gray-900">{totalActive}</p>
              <p className="text-xs text-gray-500 mt-1">{pendingInstallments} parcelas pendentes</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-[#8B5CF6]" />
            </div>
          </div>
        </div>

        {/* Gasto Mensal com Parcelas */}
        <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-[#F59E0B]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Gasto Mensal</p>
              <p className="text-2xl font-bold text-[#F59E0B]">{formatCurrency(monthlyInstallmentSpend)}</p>
              <p className="text-xs text-gray-500 mt-1">em parcelas</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#F59E0B]" />
            </div>
          </div>
        </div>

        {/* Já Pago */}
        <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-[#10B981]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Já Pago</p>
              <p className="text-2xl font-bold text-[#10B981]">{formatCurrency(totalPaid)}</p>
              <p className="text-xs text-gray-500 mt-1">de {formatCurrency(totalOverall)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-[#10B981]" />
            </div>
          </div>
        </div>

        {/* Total a Pagar */}
        <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-[#EF4444]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Ainda Falta</p>
              <p className="text-2xl font-bold text-[#EF4444]">{formatCurrency(totalOwed)}</p>
              <p className="text-xs text-gray-500 mt-1">para quitar tudo</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-[#EF4444]" />
            </div>
          </div>
        </div>
      </div>

      {/* Segunda linha - Progresso + Timeline + Categorias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Progresso Geral e Previsão */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[#8B5CF6]" />
            <h3 className="font-semibold text-gray-800">Progresso Geral</h3>
          </div>
          
          <div className="space-y-4">
            {/* Barra de progresso geral */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total quitado</span>
                <span className="text-sm font-bold text-[#8B5CF6]">{overallProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] h-full rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>

            {/* Timeline de quitação */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div>
                <p className="text-sm text-gray-500">Previsão de Quitação Total</p>
                <p className="text-lg font-bold text-gray-900">
                  {payoffDate ? formatDate(payoffDate) : 'Sem parcelamentos'}
                </p>
              </div>
              {monthsUntilPayoff > 0 && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Faltam</p>
                  <p className="text-lg font-bold text-[#8B5CF6]">
                    {monthsUntilPayoff} {monthsUntilPayoff === 1 ? 'mês' : 'meses'}
                  </p>
                </div>
              )}
            </div>

            {/* Resumo visual */}
            <div className="flex gap-4 pt-4 border-t border-gray-100">
              <div className="flex-1 text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-600 mb-1">✓ Pago</p>
                <p className="font-bold text-green-700">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="flex-1 text-center p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-red-600 mb-1">Restante</p>
                <p className="font-bold text-red-700">{formatCurrency(totalOwed)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progresso de Pagamento por Categoria - COM LOADING */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-[#8B5CF6]" />
              <h3 className="font-semibold text-gray-800">Progresso por Categoria</h3>
            </div>
          </div>
          {topCategories.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {topCategories.map((cat, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{cat.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-800">{cat.name}</span>
                        <span className="text-sm font-bold text-[#8B5CF6]">{cat.paymentProgress || 0}%</span>
                      </div>
                      {/* Barra de progresso de pagamento */}
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-[#10B981] to-[#059669] h-full rounded-full transition-all duration-500"
                          style={{ width: `${cat.paymentProgress || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs ml-11">
                    <span className="text-green-600">✓ Pago: {formatCurrency(cat.paid || 0)}</span>
                    <span className="text-red-500">Falta: {formatCurrency(cat.remaining)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">Nenhum parcelamento cadastrado</p>
          )}
        </div>
      </div>

      {/* Terceira linha - Mês com Maior Redução */}
      {biggestReductionMonth && (
        <div className="mt-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl shadow-md p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-[#10B981] to-[#059669] rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Maior redução mensal prevista</p>
                <p className="text-2xl font-bold text-gray-900">{biggestReductionMonth.monthLabel}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {biggestReductionMonth.endingPurchases.length} parcelamento{biggestReductionMonth.endingPurchases.length > 1 ? 's' : ''} termina{biggestReductionMonth.endingPurchases.length > 1 ? 'm' : ''}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">Economia mensal</p>
              <p className="text-3xl font-bold text-[#10B981]">
                -{formatCurrency(biggestReductionMonth.reduction)}
              </p>
              <p className="text-xs text-gray-400 mt-1">se não adquirir novos</p>
            </div>
          </div>
          
          {/* Lista de parcelamentos que terminam */}
          {biggestReductionMonth.endingPurchases.length > 0 && (
            <div className="mt-4 pt-4 border-t border-green-200">
              <p className="text-xs text-gray-500 mb-2">Parcelamentos que terminam em {biggestReductionMonth.monthLabel}:</p>
              <div className="flex flex-wrap gap-2">
                {biggestReductionMonth.endingPurchases.slice(0, 5).map((name, idx) => (
                  <span key={idx} className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border border-green-200">
                    {name}
                  </span>
                ))}
                {biggestReductionMonth.endingPurchases.length > 5 && (
                  <span className="px-3 py-1 bg-green-100 rounded-full text-xs font-medium text-green-700">
                    +{biggestReductionMonth.endingPurchases.length - 5} mais
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Próximas Reduções (se houver mais de uma) */}
      {monthlyReductions.length > 1 && (
        <div className="mt-4 bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-[#10B981]" />
            <h3 className="font-semibold text-gray-800">Cronograma de Reduções</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {monthlyReductions.slice(0, 6).map((reduction, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded-lg text-center ${
                  idx === 0 
                    ? 'bg-gradient-to-br from-green-100 to-emerald-100 border-2 border-green-300' 
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <p className="text-xs text-gray-500 mb-1">{reduction.monthLabel}</p>
                <p className={`text-sm font-bold ${idx === 0 ? 'text-green-600' : 'text-gray-700'}`}>
                  -{formatCurrency(reduction.reduction)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {reduction.endingPurchases.length} parcela{reduction.endingPurchases.length > 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
