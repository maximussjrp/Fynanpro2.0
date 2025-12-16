'use client';

import { useAuth } from '@/stores/auth';

import React, { useState, useEffect } from 'react';
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
  const [activeTab, setActiveTab] = useState<'cashflow' | 'categories' | 'comparison' | 'budgets' | 'cashflow-categories'>('cashflow');
  
  // Filtros
  const [startDate, setStartDate] = useState(format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
  // Estado para categorias expansivas
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryFlowData, setCategoryFlowData] = useState<any>(null);

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
        loadIncomeVsExpense(),
        loadCategoryFlowData()
      ]);
    } catch (error) {
      console.error('Erro ao carregar relatÃ³rios:', error);
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
      console.error('Erro ao carregar anÃ¡lise por categoria:', error);
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

  const loadCategoryFlowData = async () => {
    try {
      const token = accessToken;
      
      // Buscar transaÃ§Ãµes
      const transactionsResponse = await fetch(
        `http://localhost:3000/api/v1/transactions?startDate=${startDate}&endDate=${endDate}&limit=10000`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const transactionsData = await transactionsResponse.json();
      
      // Buscar TODAS as categorias do sistema
      const categoriesResponse = await fetch(
        `http://localhost:3000/api/v1/categories`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const categoriesData = await categoriesResponse.json();
      
      // Buscar orÃ§amentos para ter o "esperado"
      const budgetsResponse = await fetch(
        `http://localhost:3000/api/v1/budgets`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const budgetsData = await budgetsResponse.json();
      
      const transactions = transactionsData.success ? (transactionsData.data || []) : [];
      const categories = categoriesData.success ? (categoriesData.data || []) : [];
      const budgets = budgetsData.success ? (budgetsData.data || []) : [];
      
      const flowData = processFluxoCaixaData(transactions, categories, budgets);
      setCategoryFlowData(flowData);
    } catch (error) {
      console.error('Erro ao carregar fluxo por categoria:', error);
      setCategoryFlowData({ groups: [], allMonths: [], monthlyTotals: {} });
    }
  };

  // Fluxo de Caixa por Categoria - Regime de Caixa
  const processFluxoCaixaData = (transactions: any[], categories: any[], budgets: any[]) => {
    // Gerar lista de meses no perÃ­odo
    const start = new Date(startDate);
    const end = new Date(endDate);
    const allMonths: string[] = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      allMonths.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current.setMonth(current.getMonth() + 1);
    }

    // Estrutura de grupos do Fluxo de Caixa
    const groups = [
      { id: 'entradas', name: 'ENTRADAS (Receitas)', icon: 'ðŸ’°', type: 'income', categories: [] as any[], isGroup: true },
      { id: 'saidas', name: 'SAÃDAS (Despesas)', icon: 'ðŸ’¸', type: 'expense', categories: [] as any[], isGroup: true },
      { id: 'saldo_periodo', name: 'SALDO DO PERÃODO', icon: 'ðŸ“Š', type: 'calculated', isCalculated: true },
    ];

    // Criar mapa de orÃ§amentos por categoria/mÃªs
    const budgetMap = new Map<string, number>();
    budgets.forEach((budget: any) => {
      budgetMap.set(budget.categoryId, budget.amount || 0);
    });

    // Criar mapa de transaÃ§Ãµes por categoria/mÃªs
    const transactionMap = new Map<string, Map<string, number>>();
    transactions.forEach((transaction: any) => {
      if (transaction.deletedAt) return;
      
      const categoryId = transaction.categoryId || 'sem-categoria';
      const amount = Number(transaction.amount);
      const date = new Date(transaction.transactionDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!transactionMap.has(categoryId)) {
        transactionMap.set(categoryId, new Map());
      }
      
      const catMap = transactionMap.get(categoryId)!;
      catMap.set(monthKey, (catMap.get(monthKey) || 0) + amount);
    });

    // Processar TODAS as categorias cadastradas
    categories.forEach((cat: any) => {
      const isIncome = cat.type === 'income';
      const groupId = isIncome ? 'entradas' : 'saidas';
      const group = groups.find(g => g.id === groupId);
      
      if (!group || group.isCalculated) return;

      // Criar estrutura da categoria com todos os meses
      const categoryData: any = {
        id: cat.id,
        name: cat.name || 'Sem Nome',
        icon: cat.icon || 'ðŸ“‹',
        type: cat.type,
        months: {} as any,
        totalRealizado: 0,
        totalEsperado: budgetMap.get(cat.id) || 0
      };

      // Preencher todos os meses (mesmo zerados)
      allMonths.forEach(month => {
        const realizado = transactionMap.get(cat.id)?.get(month) || 0;
        const esperadoMensal = (budgetMap.get(cat.id) || 0) / allMonths.length;
        
        categoryData.months[month] = {
          realizado: realizado,
          esperado: esperadoMensal
        };
        
        categoryData.totalRealizado += realizado;
      });

      group.categories.push(categoryData);
    });

    // Ordenar categorias por nome
    groups.forEach(group => {
      if (!group.isCalculated) {
        group.categories.sort((a: any, b: any) => a.name.localeCompare(b.name));
      }
    });

    // Calcular totais por mÃªs
    const monthlyTotals: any = {};
    allMonths.forEach(month => {
      let totalEntradas = 0;
      let totalSaidas = 0;
      let esperadoEntradas = 0;
      let esperadoSaidas = 0;

      groups.forEach(group => {
        if (group.isCalculated) return;
        
        group.categories.forEach((cat: any) => {
          const data = cat.months[month] || { realizado: 0, esperado: 0 };
          if (group.id === 'entradas') {
            totalEntradas += data.realizado;
            esperadoEntradas += data.esperado;
          } else {
            totalSaidas += data.realizado;
            esperadoSaidas += data.esperado;
          }
        });
      });

      monthlyTotals[month] = {
        entradas: { realizado: totalEntradas, esperado: esperadoEntradas },
        saidas: { realizado: totalSaidas, esperado: esperadoSaidas },
        saldo_periodo: { 
          realizado: totalEntradas - totalSaidas, 
          esperado: esperadoEntradas - esperadoSaidas 
        }
      };
    });

    return {
      groups,
      allMonths,
      monthlyTotals
    };
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const exportToPDF = () => {
    alert('Funcionalidade de exportaÃ§Ã£o PDF serÃ¡ implementada em breve!');
  };

  const exportToExcel = () => {
    alert('Funcionalidade de exportaÃ§Ã£o Excel serÃ¡ implementada em breve!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Carregando relatÃ³rios...</div>
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
            <h1 className="text-3xl font-bold text-gray-900">ðŸ“Š RelatÃ³rios Financeiros</h1>
            <p className="text-gray-600 mt-1">AnÃ¡lises e insights dos seus dados</p>
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
          <label className="text-sm font-medium text-gray-700">PerÃ­odo:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            aria-label="Data inicial"
            title="Data inicial do perÃ­odo"
          />
          <span className="text-gray-500">atÃ©</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            aria-label="Data final"
            title="Data final do perÃ­odo"
          />
          <button
            onClick={() => {
              setStartDate(format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd'));
              setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
            }}
            className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
          >
            Ãšltimos 6 meses
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
            ðŸ“ˆ Fluxo de Caixa
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'categories'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            ðŸ• Por Categoria
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'comparison'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            ðŸ“Š Receitas x Despesas
          </button>
          <button
            onClick={() => {
              setActiveTab('cashflow-categories');
              if (!categoryFlowData) loadCategoryFlowData();
            }}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'cashflow-categories'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            ðŸ“ŠðŸ’° Fluxo por Categoria
          </button>
          <button
            onClick={() => setActiveTab('budgets')}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'budgets'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            ðŸ’° OrÃ§amentos
          </button>
        </div>

        <div className="p-6">
          {/* Fluxo de Caixa */}
          {activeTab === 'cashflow' && cashFlowData && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900">EvoluÃ§Ã£o do Fluxo de Caixa</h3>
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
                  <h3 className="text-xl font-bold text-gray-900 mt-8">ProjeÃ§Ã£o (prÃ³ximos 3 meses)</h3>
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

          {/* AnÃ¡lise por Categoria */}
          {activeTab === 'categories' && categoryData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">DistribuiÃ§Ã£o por Categoria</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie
                        data={categoryData.categories.slice(0, 8)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry: any) => `${entry.icon || ''} ${(entry.percent * 100).toFixed(1)}%`}
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
                              {cat.budgetUsed!.toFixed(1)}% do orÃ§amento
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
                  <div className="text-sm text-green-600 font-medium">Taxa MÃ©dia de Economia</div>
                  <div className="text-2xl font-bold text-green-900">
                    {incomeVsExpenseData.summary.avgSavingsRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DRE - Fluxo de Caixa por Categoria */}
          {activeTab === 'cashflow-categories' && categoryFlowData && categoryFlowData.groups && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">ðŸ“Š DRE - DemonstraÃ§Ã£o de Resultado</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setExpandedCategories(new Set(categoryFlowData.groups.map((g: any) => g.id)))}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Expandir Tudo
                  </button>
                  <span className="text-gray-400">|</span>
                  <button 
                    onClick={() => setExpandedCategories(new Set())}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Recolher Tudo
                  </button>
                </div>
              </div>

              {/* Tabela Fluxo de Caixa */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto shadow-lg">
                <table className="w-full text-sm border-collapse">
                  {/* CabeÃ§alho */}
                  <thead>
                    <tr className="bg-gradient-to-r from-teal-700 to-teal-800 text-white">
                      <th className="sticky left-0 z-20 bg-teal-700 px-4 py-3 text-left font-bold min-w-[280px] border-r border-teal-600">
                        â–¶ CATEGORIA
                      </th>
                      {categoryFlowData.allMonths.map((month: string) => {
                        const [year, monthNum] = month.split('-');
                        const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
                        return (
                          <th key={month} colSpan={2} className="px-2 py-3 text-center font-bold border-l border-teal-600 min-w-[160px]">
                            {monthName}/{year}
                          </th>
                        );
                      })}
                      <th colSpan={2} className="px-2 py-3 text-center font-bold border-l-2 border-teal-500 bg-teal-900 min-w-[180px]">
                        TOTAL PERÃODO
                      </th>
                    </tr>
                    <tr className="bg-teal-600 text-white text-xs">
                      <th className="sticky left-0 z-20 bg-teal-600 px-4 py-2 border-r border-teal-500"></th>
                      {categoryFlowData.allMonths.map((month: string) => (
                        <React.Fragment key={`sub-${month}`}>
                          <th className="px-2 py-2 text-center border-l border-teal-500 w-20">PREVISTO</th>
                          <th className="px-2 py-2 text-center w-20">REALIZADO</th>
                        </React.Fragment>
                      ))}
                      <th className="px-2 py-2 text-center border-l-2 border-teal-500 bg-teal-800 w-20">PREVISTO</th>
                      <th className="px-2 py-2 text-center bg-teal-800 w-20">REALIZADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryFlowData.groups.map((group: any, groupIndex: number) => {
                      const isGroupExpanded = expandedCategories.has(group.id);
                      const isCalculated = group.isCalculated;
                      
                      // Calcular totais do grupo
                      let groupTotalEsperado = 0;
                      let groupTotalRealizado = 0;
                      
                      if (!isCalculated) {
                        group.categories?.forEach((cat: any) => {
                          groupTotalEsperado += cat.totalEsperado || 0;
                          groupTotalRealizado += cat.totalRealizado || 0;
                        });
                      } else {
                        categoryFlowData.allMonths.forEach((month: string) => {
                          const totals = categoryFlowData.monthlyTotals?.[month]?.[group.id] || { esperado: 0, realizado: 0 };
                          groupTotalEsperado += totals.esperado;
                          groupTotalRealizado += totals.realizado;
                        });
                      }
                      
                      return (
                        <React.Fragment key={group.id}>
                          {/* Linha do Grupo */}
                          <tr 
                            className={`border-b-2 border-gray-300 cursor-pointer transition font-bold ${
                              isCalculated 
                                ? 'bg-gradient-to-r from-blue-100 to-blue-200 hover:from-blue-200 hover:to-blue-300' 
                                : group.id === 'entradas' 
                                  ? 'bg-green-100 hover:bg-green-200' 
                                  : 'bg-red-100 hover:bg-red-200'
                            }`}
                            onClick={() => !isCalculated && toggleCategory(group.id)}
                          >
                            <td className={`sticky left-0 z-10 px-4 py-3 font-bold border-r border-gray-200 ${
                              isCalculated ? 'bg-blue-100' : group.id === 'entradas' ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                              <div className="flex items-center gap-2">
                                {!isCalculated && (
                                  <svg 
                                    className={`w-4 h-4 text-gray-600 transition-transform ${isGroupExpanded ? 'rotate-90' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                                <span className="text-lg">{group.icon}</span>
                                <span className={`${
                                  group.id === 'entradas' ? 'text-green-800' : 
                                  group.id === 'saidas' ? 'text-red-800' : 
                                  'text-blue-800'
                                }`}>{group.name}</span>
                                {!isCalculated && (
                                  <span className="text-xs text-gray-500 font-normal">({group.categories?.length || 0} categorias)</span>
                                )}
                              </div>
                            </td>
                            {categoryFlowData.allMonths.map((month: string) => {
                              let monthEsperado = 0;
                              let monthRealizado = 0;
                              
                              if (isCalculated) {
                                const totals = categoryFlowData.monthlyTotals?.[month]?.[group.id] || { esperado: 0, realizado: 0 };
                                monthEsperado = totals.esperado;
                                monthRealizado = totals.realizado;
                              } else {
                                group.categories?.forEach((cat: any) => {
                                  const data = cat.months?.[month] || { esperado: 0, realizado: 0 };
                                  monthEsperado += data.esperado || 0;
                                  monthRealizado += data.realizado || 0;
                                });
                              }
                              
                              return (
                                <React.Fragment key={`${group.id}-${month}`}>
                                  <td className="px-2 py-3 text-right border-l border-gray-200 text-gray-600">
                                    {formatCurrency(monthEsperado)}
                                  </td>
                                  <td className={`px-2 py-3 text-right font-bold ${
                                    group.id === 'entradas' ? 'text-green-700' : 
                                    group.id === 'saidas' ? 'text-red-700' : 
                                    monthRealizado >= 0 ? 'text-blue-700' : 'text-red-700'
                                  }`}>
                                    {formatCurrency(Math.abs(monthRealizado))}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                            {/* Totais */}
                            <td className="px-2 py-3 text-right border-l-2 border-gray-300 bg-gray-50 text-gray-600">
                              {formatCurrency(groupTotalEsperado)}
                            </td>
                            <td className={`px-2 py-3 text-right font-bold bg-gray-50 ${
                              group.id === 'entradas' ? 'text-green-700' : 
                              group.id === 'saidas' ? 'text-red-700' : 
                              groupTotalRealizado >= 0 ? 'text-blue-700' : 'text-red-700'
                            }`}>
                              {formatCurrency(Math.abs(groupTotalRealizado))}
                            </td>
                          </tr>
                          
                          {/* Categorias filhas (quando expandido) */}
                          {isGroupExpanded && !isCalculated && group.categories?.map((category: any, catIndex: number) => (
                            <tr 
                              key={category.id}
                              className={`border-b border-gray-100 text-sm ${
                                catIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                              }`}
                            >
                              <td className={`sticky left-0 z-10 px-4 py-2 pl-10 border-r border-gray-200 ${
                                catIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                              }`}>
                                <div className="flex items-center gap-2">
                                  <span>{category.icon}</span>
                                  <span className="text-gray-700">{category.name}</span>
                                </div>
                              </td>
                              {categoryFlowData.allMonths.map((month: string) => {
                                const data = category.months?.[month] || { esperado: 0, realizado: 0 };
                                
                                return (
                                  <React.Fragment key={`${category.id}-${month}`}>
                                    <td className="px-2 py-2 text-right border-l border-gray-100 text-gray-500 text-xs">
                                      {data.esperado !== 0 ? formatCurrency(data.esperado) : '-'}
                                    </td>
                                    <td className={`px-2 py-2 text-right text-xs ${
                                      group.id === 'entradas' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {data.realizado !== 0 ? formatCurrency(data.realizado) : '-'}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                              <td className="px-2 py-2 text-right border-l-2 border-gray-200 bg-gray-50/50 text-gray-500 text-xs">
                                {category.totalEsperado !== 0 ? formatCurrency(category.totalEsperado) : '-'}
                              </td>
                              <td className={`px-2 py-2 text-right bg-gray-50/50 text-xs font-medium ${
                                group.id === 'entradas' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {category.totalRealizado !== 0 ? formatCurrency(category.totalRealizado) : '-'}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              {/* Legenda */}
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Entradas (Receitas)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>SaÃ­das (Despesas)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span>Saldo do PerÃ­odo</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Clique nos grupos para expandir/recolher categorias</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cashflow-categories' && !categoryFlowData && (
            <div className="text-center py-12 text-gray-500">
              <PieChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Carregando Fluxo de Caixa por Categorias...</p>
            </div>
          )}

          {/* AnÃ¡lise por Categoria */}
          {activeTab === 'categories' && categoryData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">DistribuiÃ§Ã£o por Categoria</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie
                        data={categoryData.categories.slice(0, 8)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry: any) => `${entry.icon || ''} ${(entry.percent * 100).toFixed(1)}%`}
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
                              {cat.budgetUsed!.toFixed(1)}% do orÃ§amento
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Todas as Categorias</h3>
                {categoryData.categories.map((category, index) => {
                    const isExpanded = expandedCategories.has(category.id);
                    const categoryColor = COLORS[index % COLORS.length];
                    
                    return (
                      <div key={category.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition">
                        {/* Header da Categoria */}
                        <button
                          onClick={() => toggleCategory(category.id)}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: categoryColor }}
                            />
                            <div className="text-left flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{category.icon}</span>
                                <span className="font-semibold text-gray-900">{category.name}</span>
                                <span className="text-sm text-gray-500">({category.transactionCount} transaÃ§Ãµes)</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-xl font-bold text-gray-900">{formatCurrency(category.total)}</div>
                              <div className="text-sm text-gray-500">{category.percentage.toFixed(1)}% do total</div>
                            </div>
                            <svg 
                              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {/* ConteÃºdo Expandido */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 p-6 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* EstatÃ­sticas Detalhadas */}
                              <div className="space-y-4">
                                <h4 className="font-semibold text-gray-700 mb-3">ðŸ“Š EstatÃ­sticas</h4>
                                
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <div className="text-sm text-gray-600 mb-1">Valor Total</div>
                                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(category.total)}</div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <div className="text-sm text-gray-600 mb-1">MÃ©dia por TransaÃ§Ã£o</div>
                                  <div className="text-lg font-bold text-gray-900">{formatCurrency(category.avgPerTransaction)}</div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <div className="text-sm text-gray-600 mb-1">Total de TransaÃ§Ãµes</div>
                                  <div className="text-lg font-bold text-gray-900">{category.transactionCount}</div>
                                </div>

                                {category.budget && (
                                  <div className={`p-4 rounded-lg border ${
                                    category.budgetUsed! > 100 ? 'bg-red-50 border-red-200' :
                                    category.budgetUsed! > 90 ? 'bg-orange-50 border-orange-200' :
                                    category.budgetUsed! > 80 ? 'bg-yellow-50 border-yellow-200' :
                                    'bg-green-50 border-green-200'
                                  }`}>
                                    <div className="text-sm text-gray-600 mb-1">OrÃ§amento Utilizado</div>
                                    <div className="text-lg font-bold mb-2">{category.budgetUsed!.toFixed(1)}%</div>
                                    <div className="text-xs text-gray-600">
                                      {formatCurrency(category.total)} de {formatCurrency(category.budget)}
                                    </div>
                                    <div className="mt-2 bg-gray-200 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full transition-all ${
                                          category.budgetUsed! > 100 ? 'bg-red-500' :
                                          category.budgetUsed! > 90 ? 'bg-orange-500' :
                                          category.budgetUsed! > 80 ? 'bg-yellow-500' :
                                          'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min(category.budgetUsed!, 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* GrÃ¡fico de Pizza Individual */}
                              <div className="md:col-span-2">
                                <h4 className="font-semibold text-gray-700 mb-3">ðŸ“ˆ DistribuiÃ§Ã£o</h4>
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <div className="flex items-center justify-center h-64">
                                    <div className="text-center">
                                      <div 
                                        className="w-48 h-48 rounded-full mx-auto mb-4 flex items-center justify-center text-6xl"
                                        style={{ 
                                          background: `conic-gradient(${categoryColor} ${category.percentage}%, #e5e7eb ${category.percentage}%)` 
                                        }}
                                      >
                                        <div className="bg-white w-32 h-32 rounded-full flex items-center justify-center">
                                          {category.icon}
                                        </div>
                                      </div>
                                      <div className="text-2xl font-bold text-gray-900">{category.percentage.toFixed(1)}%</div>
                                      <div className="text-sm text-gray-600">do total gasto</div>
                                    </div>
                                  </div>

                                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-gray-600">Representa</span>
                                      <span className="font-semibold text-gray-900">{formatCurrency(category.total)}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                      <span className="text-sm text-gray-600">Em {category.transactionCount} transaÃ§Ãµes</span>
                                      <span className="font-semibold text-gray-900">~{formatCurrency(category.avgPerTransaction)} cada</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Barra de Progresso Visual */}
                            <div className="mt-6">
                              <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-gray-600">ParticipaÃ§Ã£o no Total</span>
                                <span className="font-semibold" style={{ color: categoryColor }}>{category.percentage.toFixed(1)}%</span>
                              </div>
                              <div className="bg-gray-200 rounded-full h-3">
                                <div
                                  className="h-3 rounded-full transition-all"
                                  style={{ 
                                    width: `${category.percentage}%`,
                                    backgroundColor: categoryColor
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* OrÃ§amentos */}
          {activeTab === 'budgets' && (
            <div className="text-center py-12 text-gray-500">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>AnÃ¡lise de orÃ§amentos serÃ¡ carregada aqui</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

