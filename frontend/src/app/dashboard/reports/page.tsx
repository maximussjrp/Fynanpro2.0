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
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
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
  
  // Estados temporários para os inputs de data (só aplica ao clicar no botão)
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  
  const handleApplyDateFilter = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
  };
  
  // Estado para categorias expansivas
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryFlowData, setCategoryFlowData] = useState<any>(null);

  // Dados
  const [cashFlowData, setCashFlowData] = useState<CashFlowData | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [incomeVsExpenseData, setIncomeVsExpenseData] = useState<IncomeVsExpenseData | null>(null);

  useEffect(() => {
    if (accessToken) {
      loadAllReports();
    }
  }, [startDate, endDate, accessToken]);

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

  const loadCategoryFlowData = async () => {
    try {
      const token = accessToken;
      if (!token) {
        console.warn('Token não disponível, ignorando carregamento de categorias');
        return;
      }
      
      // Buscar transações
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
      
      // Buscar orçamentos para ter o "esperado"
      const budgetsResponse = await fetch(
        `http://localhost:3000/api/v1/budgets`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const budgetsData = await budgetsResponse.json();
      
      // API transactions retorna { success: true, data: { transactions: [...], pagination: {...} } }
      const transactions = transactionsData.success && transactionsData.data ? (transactionsData.data.transactions || []) : [];
      // API categories retorna { success: true, data: { categories: [...], count: X, summary: {...} } }
      const categories = categoriesData.success && categoriesData.data ? (categoriesData.data.categories || []) : [];
      // API budgets retorna { success: true, data: [...] }
      const budgets = budgetsData.success ? (budgetsData.data || []) : [];
      
      console.log('Transações carregadas:', transactions.length);
      console.log('Categorias carregadas:', categories.length);
      console.log('Budgets carregados:', budgets.length);
      
      const flowData = processFluxoCaixaData(transactions, categories, budgets);
      console.log('FlowData processado:', flowData);
      setCategoryFlowData(flowData);
    } catch (error) {
      console.error('Erro ao carregar fluxo por categoria:', error);
      setCategoryFlowData({ groups: [], allMonths: [], monthlyTotals: {} });
    }
  };

  // Fluxo de Caixa por Categoria - Regime de Caixa com HIERARQUIA
  const processFluxoCaixaData = (transactions: any[], categories: any[], budgets: any[]) => {
    // Gerar lista de meses no período - usar parseISO para evitar problemas de timezone
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const allMonths: string[] = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      allMonths.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current.setMonth(current.getMonth() + 1);
    }

    // Criar mapa de orçamentos por categoria/mês
    const budgetMap = new Map<string, number>();
    budgets.forEach((budget: any) => {
      budgetMap.set(budget.categoryId, budget.amount || 0);
    });

    // Criar mapa de transações por categoria/mês
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

    // Organizar categorias em hierarquia
    const categoryMap = new Map<string, any>();
    categories.forEach(cat => categoryMap.set(cat.id, cat));

    // Separar categorias por nível e tipo
    const l1Income: any[] = [];
    const l1Expense: any[] = [];
    
    categories.forEach((cat: any) => {
      if (cat.level === 1) {
        if (cat.type === 'income') {
          l1Income.push(cat);
        } else {
          l1Expense.push(cat);
        }
      }
    });

    // Função para calcular dados de uma categoria (incluindo filhos)
    const processCategoryHierarchy = (cat: any, allMonths: string[]): any => {
      // Buscar filhos diretos
      const children = categories.filter((c: any) => c.parentId === cat.id);
      
      const categoryData: any = {
        id: cat.id,
        name: cat.name || 'Sem Nome',
        icon: cat.icon || '📋',
        type: cat.type,
        level: cat.level,
        months: {} as any,
        totalRealizado: 0,
        totalEsperado: budgetMap.get(cat.id) || 0,
        children: [] as any[],
        hasChildren: children.length > 0
      };

      // Processar filhos recursivamente
      children.forEach((child: any) => {
        const childData = processCategoryHierarchy(child, allMonths);
        categoryData.children.push(childData);
      });

      // Ordenar filhos por nome
      categoryData.children.sort((a: any, b: any) => a.name.localeCompare(b.name));

      // Preencher todos os meses
      allMonths.forEach(month => {
        // Valor próprio da categoria
        let realizado = transactionMap.get(cat.id)?.get(month) || 0;
        
        // Somar valores dos filhos
        categoryData.children.forEach((child: any) => {
          realizado += child.months[month]?.realizado || 0;
        });
        
        const esperadoMensal = (budgetMap.get(cat.id) || 0) / allMonths.length;
        
        categoryData.months[month] = {
          realizado: realizado,
          esperado: esperadoMensal
        };
        
        categoryData.totalRealizado += realizado;
      });

      // Se tem filhos, recalcular total como soma dos filhos
      if (categoryData.children.length > 0) {
        categoryData.totalRealizado = categoryData.children.reduce((sum: number, child: any) => sum + child.totalRealizado, 0);
        categoryData.totalEsperado = categoryData.children.reduce((sum: number, child: any) => sum + child.totalEsperado, 0);
      }

      return categoryData;
    };

    // Processar categorias L1 de cada tipo
    const incomeCategories = l1Income.map(cat => processCategoryHierarchy(cat, allMonths))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    const expenseCategories = l1Expense.map(cat => processCategoryHierarchy(cat, allMonths))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    // Estrutura de grupos do Fluxo de Caixa
    const groups = [
      { id: 'entradas', name: 'ENTRADAS (Receitas)', icon: '💰', type: 'income', categories: incomeCategories, isGroup: true },
      { id: 'saidas', name: 'SAÍDAS (Despesas)', icon: '💸', type: 'expense', categories: expenseCategories, isGroup: true },
      { id: 'saldo_periodo', name: 'SALDO DO PERÍODO', icon: '📊', type: 'calculated', isCalculated: true },
    ];

    // Calcular totais por mês
    const monthlyTotals: any = {};
    allMonths.forEach(month => {
      let totalEntradas = 0;
      let totalSaidas = 0;
      let esperadoEntradas = 0;
      let esperadoSaidas = 0;

      incomeCategories.forEach((cat: any) => {
        totalEntradas += cat.months[month]?.realizado || 0;
        esperadoEntradas += cat.months[month]?.esperado || 0;
      });

      expenseCategories.forEach((cat: any) => {
        totalSaidas += cat.months[month]?.realizado || 0;
        esperadoSaidas += cat.months[month]?.esperado || 0;
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

  // Função recursiva para renderizar linhas de categoria com hierarquia
  const renderCategoryRow = (category: any, group: any, groupTotalRealizado: number, catIndex: number, level: number): React.ReactNode => {
    const isExpanded = expandedCategories.has(category.id);
    const hasChildren = category.children && category.children.length > 0;
    const paddingLeft = 10 + (level * 20); // Incrementa padding por nível
    
    // Calcular AV% (Análise Vertical) - percentual em relação ao total do grupo
    const avTotal = groupTotalRealizado !== 0 
      ? ((Math.abs(category.totalRealizado) / Math.abs(groupTotalRealizado)) * 100).toFixed(1) 
      : '0.0';
    
    // Cores por nível
    const levelBgColors = [
      '', // nível 0 não usado
      catIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50', // L1
      'bg-[#EFF6FF]/50', // L2
      'bg-purple-50/30', // L3
    ];
    const bgColor = levelBgColors[level] || levelBgColors[1];
    
    return (
      <React.Fragment key={category.id}>
        <tr 
          className={`border-b border-gray-100 text-sm ${bgColor} ${hasChildren ? 'cursor-pointer hover:bg-gray-100' : ''}`}
          onClick={() => hasChildren && toggleCategory(category.id)}
        >
          <td 
            className={`sticky left-0 z-10 px-4 py-2 border-r border-gray-200 ${bgColor}`}
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            <div className="flex items-center gap-2">
              {hasChildren && (
                <svg 
                  className={`w-3 h-3 text-gray-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {!hasChildren && <span className="w-3" />}
              <span>{category.icon}</span>
              <span className={`${level === 1 ? 'font-medium text-gray-800' : level === 2 ? 'text-gray-700' : 'text-gray-600'}`}>
                {category.name}
              </span>
              {hasChildren && (
                <span className="text-xs text-gray-400">({category.children.length})</span>
              )}
            </div>
          </td>
          {categoryFlowData?.allMonths.map((month: string, monthIdx: number) => {
            const data = category.months?.[month] || { esperado: 0, realizado: 0 };
            
            // AV% mensal
            const monthTotal = categoryFlowData.monthlyTotals?.[month]?.[group.id]?.realizado || 0;
            const avMonth = monthTotal !== 0 
              ? ((Math.abs(data.realizado) / Math.abs(monthTotal)) * 100).toFixed(1) 
              : '0.0';
            
            // AH% (variação vs mês anterior)
            let ahMonth = '-';
            if (monthIdx > 0) {
              const prevMonth = categoryFlowData.allMonths[monthIdx - 1];
              const prevData = category.months?.[prevMonth] || { realizado: 0 };
              if (prevData.realizado !== 0) {
                const variation = ((data.realizado - prevData.realizado) / Math.abs(prevData.realizado)) * 100;
                ahMonth = `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%`;
              } else if (data.realizado !== 0) {
                ahMonth = '+∞';
              }
            }
            
            return (
              <React.Fragment key={`${category.id}-${month}`}>
                <td className={`px-2 py-2 text-right border-l border-gray-100 text-xs ${
                  hasChildren ? 'font-medium' : ''
                } ${
                  group.id === 'entradas' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {data.realizado !== 0 ? formatCurrency(data.realizado) : '-'}
                </td>
                <td className="px-1 py-2 text-center text-xs text-gray-500 bg-gray-50/50">
                  {data.realizado !== 0 ? `${avMonth}%` : '-'}
                </td>
                {monthIdx > 0 && (
                  <td className={`px-1 py-2 text-center text-xs ${
                    ahMonth.startsWith('+') && ahMonth !== '+∞' 
                      ? (group.id === 'entradas' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50')
                      : ahMonth.startsWith('-') 
                        ? (group.id === 'entradas' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50')
                        : 'text-gray-400'
                  }`}>
                    {ahMonth}
                  </td>
                )}
                <td className="px-2 py-2 text-right text-gray-400 text-xs">
                  {data.esperado !== 0 ? formatCurrency(data.esperado) : '-'}
                </td>
              </React.Fragment>
            );
          })}
          <td className={`px-2 py-2 text-right border-l-2 border-gray-200 bg-gray-50/50 text-xs ${
            hasChildren ? 'font-semibold' : 'font-medium'
          } ${
            group.id === 'entradas' ? 'text-green-600' : 'text-red-600'
          }`}>
            {category.totalRealizado !== 0 ? formatCurrency(category.totalRealizado) : '-'}
          </td>
          <td className="px-1 py-2 text-center bg-gray-100 text-xs text-gray-600 font-medium">
            {category.totalRealizado !== 0 ? `${avTotal}%` : '-'}
          </td>
          <td className="px-2 py-2 text-right bg-gray-50/50 text-gray-400 text-xs">
            {category.totalEsperado !== 0 ? formatCurrency(category.totalEsperado) : '-'}
          </td>
        </tr>
        
        {/* Renderizar filhos recursivamente */}
        {isExpanded && hasChildren && category.children.map((child: any, childIdx: number) => 
          renderCategoryRow(child, group, groupTotalRealizado, childIdx, level + 1)
        )}
      </React.Fragment>
    );
  };

  // Função para expandir todas as categorias recursivamente
  const expandAllCategories = () => {
    if (!categoryFlowData) return;
    
    const allIds = new Set<string>();
    
    const addCategoryIds = (category: any) => {
      allIds.add(category.id);
      if (category.children) {
        category.children.forEach((child: any) => addCategoryIds(child));
      }
    };
    
    categoryFlowData.groups.forEach((group: any) => {
      allIds.add(group.id);
      if (group.categories) {
        group.categories.forEach((cat: any) => addCategoryIds(cat));
      }
    });
    
    setExpandedCategories(allIds);
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
        <div className="flex flex-wrap items-center gap-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <label className="text-sm font-medium text-gray-700">Período:</label>
          <input
            type="date"
            value={tempStartDate}
            onChange={(e) => setTempStartDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
            aria-label="Data inicial"
            title="Data inicial do período"
          />
          <span className="text-gray-500">até</span>
          <input
            type="date"
            value={tempEndDate}
            onChange={(e) => setTempEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
            aria-label="Data final"
            title="Data final do período"
          />
          <button
            onClick={handleApplyDateFilter}
            className="px-4 py-2 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] text-sm font-medium"
            title="Aplicar filtro de data"
          >
            Filtrar
          </button>
          
          {/* Atalhos de período */}
          <div className="flex items-center gap-2 ml-4 border-l pl-4 border-gray-200">
            <span className="text-xs text-gray-500">Atalhos:</span>
            <button
              onClick={() => {
                const newStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
                const newEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
                setTempStartDate(newStart);
                setTempEndDate(newEnd);
                setStartDate(newStart);
                setEndDate(newEnd);
              }}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
            >
              Este mês
            </button>
            <button
              onClick={() => {
                const lastMonth = subMonths(new Date(), 1);
                const newStart = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
                const newEnd = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
                setTempStartDate(newStart);
                setTempEndDate(newEnd);
                setStartDate(newStart);
                setEndDate(newEnd);
              }}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
            >
              Mês anterior
            </button>
            <button
              onClick={() => {
                const newStart = format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd');
                const newEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
                setTempStartDate(newStart);
                setTempEndDate(newEnd);
                setStartDate(newStart);
                setEndDate(newEnd);
              }}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
            >
              3 meses
            </button>
            <button
              onClick={() => {
                const newStart = format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd');
                const newEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
                setTempStartDate(newStart);
                setTempEndDate(newEnd);
                setStartDate(newStart);
                setEndDate(newEnd);
              }}
              className="px-3 py-1.5 text-xs bg-[#DBEAFE] hover:bg-blue-200 text-[#1A44BF] rounded-lg transition font-medium"
            >
              6 meses
            </button>
            <button
              onClick={() => {
                const newStart = format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd');
                const newEnd = format(new Date(new Date().getFullYear(), 11, 31), 'yyyy-MM-dd');
                setTempStartDate(newStart);
                setTempEndDate(newEnd);
                setStartDate(newStart);
                setEndDate(newEnd);
              }}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
            >
              Ano {new Date().getFullYear()}
            </button>
            <button
              onClick={() => {
                const lastYear = new Date().getFullYear() - 1;
                const newStart = format(new Date(lastYear, 0, 1), 'yyyy-MM-dd');
                const newEnd = format(new Date(lastYear, 11, 31), 'yyyy-MM-dd');
                setTempStartDate(newStart);
                setTempEndDate(newEnd);
                setStartDate(newStart);
                setEndDate(newEnd);
              }}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
            >
              Ano {new Date().getFullYear() - 1}
            </button>
          </div>
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
                ? 'text-[#1F4FD8] border-b-2 border-[#1F4FD8] bg-[#EFF6FF]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            📈 Fluxo de Caixa
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'categories'
                ? 'text-[#1F4FD8] border-b-2 border-[#1F4FD8] bg-[#EFF6FF]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            🍕 Por Categoria
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'comparison'
                ? 'text-[#1F4FD8] border-b-2 border-[#1F4FD8] bg-[#EFF6FF]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            📊 Receitas x Despesas
          </button>
          <button
            onClick={() => {
              setActiveTab('cashflow-categories');
              if (!categoryFlowData) loadCategoryFlowData();
            }}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'cashflow-categories'
                ? 'text-[#1F4FD8] border-b-2 border-[#1F4FD8] bg-[#EFF6FF]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            📊💰 Fluxo por Categoria
          </button>
          <button
            onClick={() => setActiveTab('budgets')}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'budgets'
                ? 'text-[#1F4FD8] border-b-2 border-[#1F4FD8] bg-[#EFF6FF]'
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
                <div className="bg-[#EFF6FF] p-4 rounded-lg">
                  <div className="text-sm text-[#1F4FD8] font-medium">Total de Receitas</div>
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

          {/* Fluxo de Caixa por Categoria */}
          {activeTab === 'cashflow-categories' && categoryFlowData && categoryFlowData.groups && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">📊 Fluxo de Caixa por Categoria</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={expandAllCategories}
                    className="text-sm text-[#1F4FD8] hover:underline"
                  >
                    Expandir Tudo
                  </button>
                  <span className="text-gray-400">|</span>
                  <button 
                    onClick={() => setExpandedCategories(new Set())}
                    className="text-sm text-[#1F4FD8] hover:underline"
                  >
                    Recolher Tudo
                  </button>
                </div>
              </div>

              {/* Tabela Fluxo de Caixa */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto shadow-lg">
                <table className="w-full text-sm border-collapse">
                  {/* Cabeçalho */}
                  <thead>
                    <tr className="bg-gradient-to-r from-teal-700 to-teal-800 text-white">
                      <th className="sticky left-0 z-20 bg-teal-700 px-4 py-3 text-left font-bold min-w-[280px] border-r border-teal-600">
                        ▶ CATEGORIA
                      </th>
                      {categoryFlowData.allMonths.map((month: string, monthIdx: number) => {
                        const [year, monthNum] = month.split('-');
                        const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
                        return (
                          <th key={month} colSpan={monthIdx === 0 ? 3 : 4} className="px-2 py-3 text-center font-bold border-l border-teal-600 min-w-[200px]">
                            {monthName}/{year}
                          </th>
                        );
                      })}
                      <th colSpan={3} className="px-2 py-3 text-center font-bold border-l-2 border-teal-500 bg-teal-900 min-w-[220px]">
                        TOTAL PERÍODO
                      </th>
                    </tr>
                    <tr className="bg-teal-600 text-white text-xs">
                      <th className="sticky left-0 z-20 bg-teal-600 px-4 py-2 border-r border-teal-500"></th>
                      {categoryFlowData.allMonths.map((month: string, monthIdx: number) => (
                        <React.Fragment key={`sub-${month}`}>
                          <th className="px-2 py-2 text-center border-l border-teal-500 w-16">REAL.</th>
                          <th className="px-2 py-2 text-center w-12 bg-teal-500" title="Análise Vertical - % do total do grupo">AV%</th>
                          {monthIdx > 0 && (
                            <th className="px-2 py-2 text-center w-12 bg-teal-400" title="Análise Horizontal - Variação % vs mês anterior">AH%</th>
                          )}
                          <th className="px-2 py-2 text-center w-16 text-teal-200">PREV.</th>
                        </React.Fragment>
                      ))}
                      <th className="px-2 py-2 text-center border-l-2 border-teal-500 bg-teal-800 w-16">REAL.</th>
                      <th className="px-2 py-2 text-center bg-teal-700 w-12" title="Análise Vertical - % do total do grupo">AV%</th>
                      <th className="px-2 py-2 text-center bg-teal-800 w-16 text-teal-200">PREV.</th>
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
                              isCalculated ? 'bg-[#DBEAFE]' : group.id === 'entradas' ? 'bg-green-100' : 'bg-red-100'
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
                            {categoryFlowData.allMonths.map((month: string, monthIdx: number) => {
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
                              
                              // AH% (variação vs mês anterior)
                              let ahMonth = '-';
                              if (monthIdx > 0) {
                                const prevMonth = categoryFlowData.allMonths[monthIdx - 1];
                                let prevRealizado = 0;
                                if (isCalculated) {
                                  prevRealizado = categoryFlowData.monthlyTotals?.[prevMonth]?.[group.id]?.realizado || 0;
                                } else {
                                  group.categories?.forEach((cat: any) => {
                                    prevRealizado += cat.months?.[prevMonth]?.realizado || 0;
                                  });
                                }
                                if (prevRealizado !== 0) {
                                  const variation = ((monthRealizado - prevRealizado) / Math.abs(prevRealizado)) * 100;
                                  ahMonth = `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%`;
                                } else if (monthRealizado !== 0) {
                                  ahMonth = '+∞';
                                }
                              }
                              
                              return (
                                <React.Fragment key={`${group.id}-${month}`}>
                                  <td className={`px-2 py-3 text-right border-l border-gray-200 font-bold ${
                                    group.id === 'entradas' ? 'text-green-700' : 
                                    group.id === 'saidas' ? 'text-red-700' : 
                                    monthRealizado >= 0 ? 'text-[#1A44BF]' : 'text-red-700'
                                  }`}>
                                    {formatCurrency(Math.abs(monthRealizado))}
                                  </td>
                                  <td className={`px-1 py-3 text-center text-xs font-semibold ${
                                    isCalculated ? 'bg-[#EFF6FF]' : group.id === 'entradas' ? 'bg-green-50' : 'bg-red-50'
                                  }`}>
                                    100%
                                  </td>
                                  {monthIdx > 0 && (
                                    <td className={`px-1 py-3 text-center text-xs font-semibold ${
                                      ahMonth.startsWith('+') && ahMonth !== '+∞'
                                        ? (group.id === 'saidas' ? 'text-red-700 bg-red-100' : 'text-green-700 bg-green-100')
                                        : ahMonth.startsWith('-')
                                          ? (group.id === 'saidas' ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100')
                                          : 'text-gray-500 bg-gray-100'
                                    }`}>
                                      {ahMonth}
                                    </td>
                                  )}
                                  <td className="px-2 py-3 text-right text-gray-500">
                                    {formatCurrency(monthEsperado)}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                            {/* Totais */}
                            <td className={`px-2 py-3 text-right border-l-2 border-gray-300 font-bold ${
                              isCalculated ? 'bg-[#EFF6FF]' : 'bg-gray-50'
                            } ${
                              group.id === 'entradas' ? 'text-green-700' : 
                              group.id === 'saidas' ? 'text-red-700' : 
                              groupTotalRealizado >= 0 ? 'text-[#1A44BF]' : 'text-red-700'
                            }`}>
                              {formatCurrency(Math.abs(groupTotalRealizado))}
                            </td>
                            <td className={`px-1 py-3 text-center text-xs font-bold ${
                              isCalculated ? 'bg-[#DBEAFE]' : group.id === 'entradas' ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                              100%
                            </td>
                            <td className={`px-2 py-3 text-right ${
                              isCalculated ? 'bg-[#EFF6FF]' : 'bg-gray-50'
                            } text-gray-500`}>
                              {formatCurrency(groupTotalEsperado)}
                            </td>
                          </tr>
                          
                          {/* Categorias L1 (quando grupo expandido) */}
                          {isGroupExpanded && !isCalculated && group.categories?.map((category: any, catIndex: number) => 
                            renderCategoryRow(category, group, groupTotalRealizado, catIndex, 1)
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legenda */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>Entradas (Receitas)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span>Saídas (Despesas)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-[#1F4FD8] rounded"></div>
                    <span>Saldo do Período</span>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-teal-600 w-10">AV%</span>
                    <span>Análise Vertical - Participação % da categoria no total do grupo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-teal-500 w-10">AH%</span>
                    <span>Análise Horizontal - Variação % em relação ao mês anterior</span>
                  </div>
                  <div className="text-gray-400 mt-2">
                    💡 Clique nos grupos para expandir/recolher categorias
                  </div>
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
                              {cat.budgetUsed!.toFixed(1)}% do orçamento
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
                                <span className="text-sm text-gray-500">({category.transactionCount} transações)</span>
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

                        {/* Conteúdo Expandido */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 p-6 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Estatísticas Detalhadas */}
                              <div className="space-y-4">
                                <h4 className="font-semibold text-gray-700 mb-3">📊 Estatísticas</h4>
                                
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <div className="text-sm text-gray-600 mb-1">Valor Total</div>
                                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(category.total)}</div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <div className="text-sm text-gray-600 mb-1">Média por Transação</div>
                                  <div className="text-lg font-bold text-gray-900">{formatCurrency(category.avgPerTransaction)}</div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <div className="text-sm text-gray-600 mb-1">Total de Transações</div>
                                  <div className="text-lg font-bold text-gray-900">{category.transactionCount}</div>
                                </div>

                                {category.budget && (
                                  <div className={`p-4 rounded-lg border ${
                                    category.budgetUsed! > 100 ? 'bg-red-50 border-red-200' :
                                    category.budgetUsed! > 90 ? 'bg-orange-50 border-orange-200' :
                                    category.budgetUsed! > 80 ? 'bg-yellow-50 border-yellow-200' :
                                    'bg-green-50 border-green-200'
                                  }`}>
                                    <div className="text-sm text-gray-600 mb-1">Orçamento Utilizado</div>
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

                              {/* Gráfico de Pizza Individual */}
                              <div className="md:col-span-2">
                                <h4 className="font-semibold text-gray-700 mb-3">📈 Distribuição</h4>
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
                                      <span className="text-sm text-gray-600">Em {category.transactionCount} transações</span>
                                      <span className="font-semibold text-gray-900">~{formatCurrency(category.avgPerTransaction)} cada</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Barra de Progresso Visual */}
                            <div className="mt-6">
                              <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-gray-600">Participação no Total</span>
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
