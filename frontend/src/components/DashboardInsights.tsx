'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Lightbulb, Calendar, Target, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface Insight {
  type: string;
  title: string;
  description: string;
  icon: string;
}

interface ComparisonData {
  income: {
    current: number;
    last: number;
    variation: number;
  };
  expense: {
    current: number;
    last: number;
    variation: number;
  };
  balance: {
    current: number;
    last: number;
  };
}

export default function DashboardInsights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard/insights');
      setInsights(response.data.data.insights);
      setComparison(response.data.data.comparison);
    } catch (error) {
      console.error('Erro ao carregar insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVariationColor = (variation: number) => {
    if (variation > 0) return 'text-green-600';
    if (variation < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getVariationIcon = (variation: number) => {
    if (variation > 0) return <TrendingUp className="w-4 h-4" />;
    if (variation < 0) return <TrendingDown className="w-4 h-4" />;
    return null;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Comparação com Mês Anterior */}
      {comparison && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Receitas */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-green-900">Receitas</h3>
              <div className={`flex items-center gap-1 text-sm font-semibold ${getVariationColor(comparison.income.variation)}`}>
                {getVariationIcon(comparison.income.variation)}
                <span>{Math.abs(comparison.income.variation).toFixed(1)}%</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-green-900 mb-1">
              R$ {comparison.income.current.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-green-700">
              Mês anterior: R$ {comparison.income.last.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Despesas */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-red-900">Despesas</h3>
              <div className={`flex items-center gap-1 text-sm font-semibold ${
                comparison.expense.variation > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {getVariationIcon(comparison.expense.variation)}
                <span>{Math.abs(comparison.expense.variation).toFixed(1)}%</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-red-900 mb-1">
              R$ {comparison.expense.current.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-red-700">
              Mês anterior: R$ {comparison.expense.last.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Saldo */}
          <div className={`bg-gradient-to-br ${
            comparison.balance.current >= 0 ? 'from-blue-50 to-blue-100 border-blue-200' : 'from-orange-50 to-orange-100 border-orange-200'
          } rounded-lg p-6 border`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-sm font-medium ${
                comparison.balance.current >= 0 ? 'text-blue-900' : 'text-orange-900'
              }`}>
                Saldo do Mês
              </h3>
              {comparison.balance.current < 0 && (
                <AlertCircle className="w-5 h-5 text-orange-600" />
              )}
            </div>
            <p className={`text-2xl font-bold mb-1 ${
              comparison.balance.current >= 0 ? 'text-blue-900' : 'text-orange-900'
            }`}>
              R$ {comparison.balance.current.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className={`text-xs ${
              comparison.balance.current >= 0 ? 'text-[#1A44BF]' : 'text-orange-700'
            }`}>
              Mês anterior: R$ {comparison.balance.last.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Cards de Insights */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-semibold text-gray-900">Insights Inteligentes</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {insights.map((insight, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200"
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl flex-shrink-0">{insight.icon}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm">
                    {insight.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {insight.description}
                  </p>
                </div>
              </div>

              {/* Badge do tipo */}
              <div className="mt-4">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  insight.type === 'savings' && insight.icon === '✅'
                    ? 'bg-green-100 text-green-700'
                    : insight.type === 'savings' && insight.icon === '⚠️'
                    ? 'bg-orange-100 text-orange-700'
                    : insight.type === 'projection'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-[#DBEAFE] text-[#1A44BF]'
                }`}>
                  {insight.type === 'day_analysis' && (
                    <>
                      <Calendar className="w-3 h-3" />
                      Padrão de Gastos
                    </>
                  )}
                  {insight.type === 'projection' && (
                    <>
                      <TrendingUp className="w-3 h-3" />
                      Projeção
                    </>
                  )}
                  {insight.type === 'savings' && (
                    <>
                      <Target className="w-3 h-3" />
                      Taxa de Economia
                    </>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dica */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-[#1F4FD8] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-900 font-medium mb-1">💡 Dica do Sistema</p>
            <p className="text-sm text-[#1A44BF]">
              Os insights são atualizados automaticamente com base no seu comportamento financeiro. 
              Continue registrando suas transações para obter análises mais precisas!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
