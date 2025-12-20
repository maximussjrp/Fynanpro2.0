'use client';

import { useAuth } from '@/stores/auth';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, PieChart, 
  Download, Calendar, Filter, BarChart3
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CashFlowData {
  period: { start: Date; end: Date };
  summary: {
    totalIncome: number;
    totalExpense: number;
    netCashFlow: number;
    savingsRate: number;
  };
  timeline: Array<{
    date: string;
    income: number;
    expense: number;
    balance: number;
  }>;
  projection: Array<{
    date: string;
    projectedIncome: number;
    projectedExpense: number;
    projectedBalance: number;
  }>;
}

interface CategoryData {
  categories: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    total: number;
    percentage: number;
    transactionCount: number;
    avgPerTransaction: number;
    budget?: number;
    budgetUsed?: number;
  }>;
  summary: {
    totalExpense: number;
    categoryCount: number;
    avgPerCategory: number;
  };
}

interface IncomeVsExpenseData {
  comparison: Array<{
    period: string;
    income: number;
    expense: number;
    balance: number;
    savingsRate: number;
  }>;
  summary: {
    totalIncome: number;
    totalExpense: number;
    totalBalance: number;
    avgSavingsRate: number;
    periodCount: number;
  };
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];

export default function ReportsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cashflow' | 'categories' | 'comparison' | 'budgets'>('cashflow');
  
  // Filtros
  const [startDate, setStartDate] = useState(format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Dados
  const [cashFlowData, setCashFlowData] = useState<CashFlowData | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [incomeVsExpenseData, setIncomeVsExpenseData] = useState<IncomeVsExpenseData | null>(null);

  useEffect(() => {
    loadAllReports();
  }, [startDate, endDate]);

  const loadAllReports = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCashFlow(),
        loadCategoryAnalysis(),
        loadIncomeVsExpense()
      ]);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCashFlow = async () => {
    try {
      const token = accessToken;
      const response = await fetch(
        `http://localhost:3000/api/v1/reports/cash-flow?startDate=${startDate}&endDate=${endDate}&groupBy=month`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setCashFlowData(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar fluxo de caixa:', error);
    }
  };

  const loadCategoryAnalysis = async () => {
    try {
      const token = accessToken;
      const response = await fetch(
        `http://localhost:3000/api/v1/reports/category-analysis?startDate=${startDate}&endDate=${endDate}&type=expense`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setCategoryData(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar análise por categoria:', error);
    }
  };

  const loadIncomeVsExpense = async () => {
    try {
      const token = accessToken;
      const response = await fetch(
        `http://localhost:3000/api/v1/reports/income-vs-expense?startDate=${startDate}&endDate=${endDate}&groupBy=month`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setIncomeVsExpenseData(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar receitas vs despesas:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const exportToPDF = () => {
    alert('Funcionalidade de exportação PDF será implementada em breve!');
  };

  const exportToExcel = () => {
    alert('Funcionalidade de exportação Excel será implementada em breve!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Carregando relatórios...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Voltar ao Dashboard"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📊 Relatórios Financeiros</h1>
            <p className="text-gray-600 mt-1">Análises e insights dos seus dados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <label className="text-sm font-medium text-gray-700">Período:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-500">até</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => {
              setStartDate(format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd'));
              setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
            }}
            className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
          >
            Últimos 6 meses
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      {cashFlowData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-lg text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-100">Receitas</span>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold">{formatCurrency(cashFlowData.summary.totalIncome)}</div>
          </div>
          
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-xl shadow-lg text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-100">Despesas</span>
              <TrendingDown className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold">{formatCurrency(cashFlowData.summary.totalExpense)}</div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-lg text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-100">Saldo</span>
              <DollarSign className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold">{formatCurrency(cashFlowData.summary.netCashFlow)}</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl shadow-lg text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-100">Taxa de Economia</span>
              <PieChart className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold">{cashFlowData.summary.savingsRate.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'cashflow'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            📈 Fluxo de Caixa
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'categories'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            🍕 Por Categoria
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'comparison'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            📊 Receitas x Despesas
          </button>
          <button
            onClick={() => setActiveTab('budgets')}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'budgets'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            💰 Orçamentos
          </button>
        </div>

        <div className="p-6">
          {/* Fluxo de Caixa */}
          {activeTab === 'cashflow' && cashFlowData && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900">Evolução do Fluxo de Caixa</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={cashFlowData.timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="income" 
                    stroke="#10B981" 
                    strokeWidth={2} 
                    name="Receitas"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="expense" 
                    stroke="#EF4444" 
                    strokeWidth={2} 
                    name="Despesas"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#3B82F6" 
                    strokeWidth={2} 
                    name="Saldo"
                  />
                </LineChart>
              </ResponsiveContainer>

              {cashFlowData.projection.length > 0 && (
                <>
                  <h3 className="text-xl font-bold text-gray-900 mt-8">Projeção (próximos 3 meses)</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={cashFlowData.projection}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Bar dataKey="projectedIncome" fill="#10B981" name="Receita Projetada" />
                      <Bar dataKey="projectedExpense" fill="#EF4444" name="Despesa Projetada" />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          )}

          {/* Análise por Categoria */}
          {activeTab === 'categories' && categoryData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Distribuição por Categoria</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie
                        data={categoryData.categories.slice(0, 8)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.icon} ${entry.percentage.toFixed(1)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="total"
                      >
                        {categoryData.categories.slice(0, 8).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Top 5 Categorias</h3>
                  <div className="space-y-3">
                    {categoryData.categories.slice(0, 5).map((cat, index) => (
                      <div key={cat.id} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">
                            {index + 1}. {cat.icon} {cat.name}
                          </span>
                          <span className="text-lg font-bold">{formatCurrency(cat.total)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${cat.percentage}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">{cat.percentage.toFixed(1)}%</span>
                        </div>
                        {cat.budget && (
                          <div className="mt-2 text-sm">
                            <span className={`font-medium ${
                              cat.budgetUsed! > 100 ? 'text-red-600' :
                              cat.budgetUsed! > 90 ? 'text-orange-600' :
                              cat.budgetUsed! > 80 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {cat.budgetUsed!.toFixed(1)}% do orçamento
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Receitas vs Despesas */}
          {activeTab === 'comparison' && incomeVsExpenseData && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900">Comparativo Mensal</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={incomeVsExpenseData.comparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="income" fill="#10B981" name="Receitas" />
                  <Bar dataKey="expense" fill="#EF4444" name="Despesas" />
                </BarChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium">Total de Receitas</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {formatCurrency(incomeVsExpenseData.summary.totalIncome)}
                  </div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-sm text-red-600 font-medium">Total de Despesas</div>
                  <div className="text-2xl font-bold text-red-900">
                    {formatCurrency(incomeVsExpenseData.summary.totalExpense)}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-600 font-medium">Taxa Média de Economia</div>
                  <div className="text-2xl font-bold text-green-900">
                    {incomeVsExpenseData.summary.avgSavingsRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orçamentos */}
          {activeTab === 'budgets' && (
            <div className="text-center py-12 text-gray-500">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Análise de orçamentos será carregada aqui</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
