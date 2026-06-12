'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/stores/auth';
import api from '@/lib/api';

import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, PieChart, 
  Download, Calendar, Filter, BarChart3, ChevronDown, ChevronRight, ChevronLeft,
  Minus, Plus, FolderTree, Table2
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

// Interface para Plano de Contas Hierárquico
interface HierarchicalCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: string;
  level: number;
  income: number;
  expense: number;
  totalWithChildren: { income: number; expense: number; count: number };
  transactionCount: number;
  children: HierarchicalCategory[];
}

interface HierarchicalCategoryData {
  income: {
    categories: HierarchicalCategory[];
    total: number;
  };
  expense: {
    categories: HierarchicalCategory[];
    total: number;
  };
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    transactionCount: number;
  };
  period: {
    start: string;
    end: string;
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

// Interface para Orçamentos
interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
}

interface BudgetData {
  id: string;
  name: string;
  categoryId: string;
  category: BudgetCategory;
  amount: number;
  period: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  spent: number;
  percentage: number;
  remaining: number;
  status: 'normal' | 'warning' | 'exceeded';
  isCurrentPeriod: boolean;
}

// Interface para Mapa Financeiro (Esperado vs Realizado)
// LÓGICA:
// - ESPERADO: Total de todas as transações lançadas (pendentes + pagas)
// - REALIZADO: Total apenas das transações efetivamente pagas (status = completed)
interface DRERowData {
  id: string;
  name: string;
  icon: string | null;
  type: string;
  level: number;
  isGroup: boolean;
  isCalculated: boolean;
  months: {
    [key: string]: {
      esperado: number;
      realizado: number;
      av: number;
      ah: number;
    };
  };
  totalYear: {
    esperado: number;
    realizado: number;
    av: number;
  };
  children: DRERowData[];
}

interface DREData {
  year: number;
  months: string[];
  receitas: {
    categories: DRERowData[];
    total: { esperado: number; realizado: number };
    monthly: { [key: string]: { esperado: number; realizado: number } };
  };
  despesas: {
    categories: DRERowData[];
    expenseGroups?: Array<{
      key: 'needs' | 'wants' | 'priorities';
      name: string;
      targetPercent: number;
      description: string;
      categories: DRERowData[];
      monthly: { [key: string]: { esperado: number; realizado: number } };
      total: { esperado: number; realizado: number };
      actualPercent: number;
      targetAmount: number;
      varianceFromTarget: number;
    }>;
    total: { esperado: number; realizado: number };
    monthly: { [key: string]: { esperado: number; realizado: number } };
  };
  linhasCalculadas: {
    [key: string]: {
      name: string;
      months: { [key: string]: { esperado: number; realizado: number } };
      totalYear: { esperado: number; realizado: number };
    };
  };
  summary: {
    totalReceitas: number;
    totalDespesas: number;
    lucroOperacional: number;
    margemLucro: number;
  };
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];

export default function ReportsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cashflow' | 'categories' | 'dre' | 'comparison' | 'budgets'>('cashflow');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filtros
  const [startDate, setStartDate] = useState(format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dreYear, setDreYear] = useState(new Date().getFullYear());
  const [dreMonth, setDreMonth] = useState<number | null>(null); // null = ano inteiro, 0-11 = mês específico
  const [dreViewMode, setDreViewMode] = useState<'year' | 'month'>('year');
  const [showExpected, setShowExpected] = useState(true);

  // Dados
  const [cashFlowData, setCashFlowData] = useState<CashFlowData | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [hierarchicalData, setHierarchicalData] = useState<HierarchicalCategoryData | null>(null);
  const [incomeVsExpenseData, setIncomeVsExpenseData] = useState<IncomeVsExpenseData | null>(null);
  const [dreData, setDreData] = useState<DREData | null>(null);
  const [budgetData, setBudgetData] = useState<BudgetData[]>([]);
  
  // Estado de expansão das categorias
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedDRERows, setExpandedDRERows] = useState<Set<string>>(new Set());
  const [categoryViewType, setCategoryViewType] = useState<'income' | 'expense' | 'both'>('both');
  
  // Ref para scroll automático do DRE para o mês vigente
  const dreTableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAllReports();
  }, [startDate, endDate]);

  useEffect(() => {
    loadDREReport();
  }, [dreYear]);

  // Scroll automático para o mês vigente quando o DRE carregar
  useEffect(() => {
    if (dreData && dreTableRef.current && activeTab === 'dre' && dreViewMode === 'year') {
      const currentMonth = new Date().getMonth(); // 0-11
      // Cada coluna de mês tem aproximadamente 4 sub-colunas (esperado, realizado, av%, ah%)
      // A primeira coluna (nome) tem ~250px, cada grupo de mês tem ~280px
      const scrollPosition = 250 + (currentMonth * 280) - 300; // -300 para mostrar um pouco antes
      setTimeout(() => {
        dreTableRef.current?.scrollTo({ left: Math.max(0, scrollPosition), behavior: 'smooth' });
      }, 100);
    }
  }, [dreData, activeTab, dreViewMode]);

  const loadAllReports = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCashFlow(),
        loadCategoryAnalysis(),
        loadHierarchicalCategories(),
        loadIncomeVsExpense(),
        loadDREReport(),
        loadBudgets()
      ]);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCashFlow = async () => {
    try {
      const response = await api.get(`/reports/cash-flow?startDate=${startDate}&endDate=${endDate}&groupBy=month`);
      if (response.data.success) {
        setCashFlowData(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar fluxo de caixa:', error);
    }
  };

  const loadCategoryAnalysis = async () => {
    try {
      const response = await api.get(`/reports/category-analysis?startDate=${startDate}&endDate=${endDate}&type=expense`);
      if (response.data.success) {
        setCategoryData(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar análise por categoria:', error);
    }
  };

  const loadHierarchicalCategories = async () => {
    try {
      const response = await api.get(`/reports/hierarchical-categories?startDate=${startDate}&endDate=${endDate}`);
      if (response.data.success) {
        setHierarchicalData(response.data.data);
        // Expandir todas as categorias L1 por padrão
        const allL1Ids = new Set<string>();
        response.data.data.income.categories.forEach((cat: HierarchicalCategory) => allL1Ids.add(cat.id));
        response.data.data.expense.categories.forEach((cat: HierarchicalCategory) => allL1Ids.add(cat.id));
        setExpandedCategories(allL1Ids);
      }
    } catch (error) {
      console.error('Erro ao carregar plano de contas hierárquico:', error);
    }
  };

  const loadIncomeVsExpense = async () => {
    try {
      const response = await api.get(`/reports/income-vs-expense?startDate=${startDate}&endDate=${endDate}&groupBy=month`);
      if (response.data.success) {
        setIncomeVsExpenseData(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar receitas vs despesas:', error);
    }
  };

  const loadDREReport = async () => {
    try {
      const response = await api.get(`/reports/dre?year=${dreYear}&showExpected=${showExpected}`);
      if (response.data.success) {
        setDreData(response.data.data);
        // Expandir linhas principais por padrão
        const defaultExpanded = new Set<string>();
        response.data.data.receitas.categories.forEach((cat: DRERowData) => defaultExpanded.add(cat.id));
        response.data.data.despesas.categories.forEach((cat: DRERowData) => defaultExpanded.add(cat.id));
        setExpandedDRERows(defaultExpanded);
      }
    } catch (error) {
      console.error('Erro ao carregar DRE:', error);
    }
  };

  const loadBudgets = async () => {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const response = await api.get(`/budgets?month=${currentMonth}&year=${currentYear}`);
      if (response.data.success) {
        setBudgetData(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar orçamentos:', error);
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

  // Funções para expandir/colapsar categorias
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    if (!hierarchicalData) return;
    const allIds = new Set<string>();
    
    const collectIds = (categories: HierarchicalCategory[]) => {
      categories.forEach(cat => {
        allIds.add(cat.id);
        if (cat.children.length > 0) {
          collectIds(cat.children);
        }
      });
    };
    
    collectIds(hierarchicalData.income.categories);
    collectIds(hierarchicalData.expense.categories);
    setExpandedCategories(allIds);
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  // Funções para DRE
  const toggleDRERow = (rowId: string) => {
    setExpandedDRERows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const expandAllDRE = () => {
    if (!dreData) return;
    const allIds = new Set<string>();
    
    const collectIds = (rows: DRERowData[]) => {
      rows.forEach(row => {
        allIds.add(row.id);
        if (row.children.length > 0) {
          collectIds(row.children);
        }
      });
    };
    
    collectIds(dreData.receitas.categories);
    collectIds(dreData.despesas.categories);
    setExpandedDRERows(allIds);
  };

  const collapseAllDRE = () => {
    setExpandedDRERows(new Set());
  };

  // Componente para renderizar uma categoria hierárquica
  const renderHierarchicalCategory = (category: HierarchicalCategory, isIncome: boolean, depth: number = 0) => {
    const hasChildren = category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const total = isIncome ? category.totalWithChildren.income : category.totalWithChildren.expense;
    const directTotal = isIncome ? category.income : category.expense;
    const hasValue = total > 0;
    
    // Calcular porcentagem
    const grandTotal = isIncome ? hierarchicalData?.income.total || 1 : hierarchicalData?.expense.total || 1;
    const percentage = grandTotal > 0 ? (total / grandTotal) * 100 : 0;

    // Padding dinâmico - menor no mobile
    const mobilePadding = Math.min(depth * 12, 36) + 8;
    const desktopPadding = depth * 20 + 8;

    return (
      <div key={category.id}>
        <div 
          className={`flex items-center py-1.5 sm:py-2 px-2 hover:bg-gray-50 transition cursor-pointer border-b border-gray-100 ${
            depth === 0 ? 'bg-gray-50 font-semibold' : ''
          } ${depth === 1 ? 'bg-white' : ''} ${depth >= 2 ? 'bg-gray-25' : ''}`}
          style={{ paddingLeft: `${mobilePadding}px` }}
          onClick={() => hasChildren && toggleCategory(category.id)}
        >
          {/* Ícone de expansão */}
          <div className="w-4 h-4 sm:w-5 sm:h-5 mr-1 flex items-center justify-center flex-shrink-0">
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
              )
            ) : (
              <Minus className="w-2 h-2 sm:w-3 sm:h-3 text-gray-300" />
            )}
          </div>

          {/* Ícone e nome da categoria */}
          <div className="flex-1 flex items-center gap-1 sm:gap-2 min-w-0 overflow-hidden">
            <span className="text-sm sm:text-lg flex-shrink-0">{category.icon || '📁'}</span>
            <span className={`truncate ${depth === 0 ? 'text-xs sm:text-base font-medium' : 'text-[11px] sm:text-sm'} text-gray-900`}>
              {category.name}
            </span>
            {hasChildren && (
              <span className="text-[10px] sm:text-xs text-gray-400 flex-shrink-0">({category.children.length})</span>
            )}
          </div>

          {/* Valor */}
          <div className="flex items-center gap-1 sm:gap-4 ml-1 sm:ml-2 flex-shrink-0">
            {hasValue && (
              <>
                <div className="hidden sm:block w-24 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${isIncome ? 'bg-blue-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-500 w-8 sm:w-12 text-right hidden sm:block">
                  {percentage.toFixed(0)}%
                </span>
              </>
            )}
            <span className={`text-[11px] sm:text-base font-medium min-w-[70px] sm:w-32 text-right ${
              hasValue 
                ? isIncome ? 'text-blue-600' : 'text-rose-600'
                : 'text-gray-400'
            }`}>
              {hasValue ? formatCurrency(total) : '-'}
            </span>
          </div>
        </div>

        {/* Filhos */}
        {hasChildren && isExpanded && (
          <div>
            {category.children.map(child => renderHierarchicalCategory(child, isIncome, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Tabs config para facilitar mapeamento
  const tabs = [
    { id: 'cashflow', label: '📈 Fluxo', fullLabel: '📈 Fluxo de Caixa' },
    { id: 'categories', label: '🍕 Categorias', fullLabel: '🍕 Por Categoria' },
    { id: 'dre', label: '🗺️ Mapa', fullLabel: '🗺️ Mapa Financeiro' },
    { id: 'comparison', label: '⚖️ Comparativo', fullLabel: '⚖️ Receitas x Despesas' },
    { id: 'budgets', label: '💰 Orçamentos', fullLabel: '💰 Orçamentos' },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#1F4FD8] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-lg text-gray-600">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Voltar ao Dashboard"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg sm:text-3xl font-bold text-gray-900">📊 Relatórios</h1>
              <p className="text-xs sm:text-base text-gray-600 mt-0.5 hidden sm:block">Análises e insights dos seus dados</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToPDF}
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-xs sm:text-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-xs sm:text-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filtros - Colapsável no mobile */}
      <div className="mb-4 sm:mb-6 bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header do filtro - clicável no mobile */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-3 sm:hidden active:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-700 text-sm">Filtrar Período</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {format(new Date(startDate), 'dd/MM')} - {format(new Date(endDate), 'dd/MM')}
            </span>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {/* Filtros desktop - sempre visível */}
        <div className="hidden sm:flex items-center gap-4 p-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <label className="text-sm font-medium text-gray-700">Período:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            style={{ colorScheme: 'light' }}
            title="Data inicial do período"
            aria-label="Data inicial"
          />
          <span className="text-gray-500">até</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            style={{ colorScheme: 'light' }}
            title="Data final do período"
            aria-label="Data final"
          />
          <button
            onClick={() => {
              setStartDate(format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd'));
              setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
            }}
            className="px-4 py-2 min-h-[44px] text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition whitespace-nowrap"
          >
            Últimos 6 meses
          </button>
        </div>

        {/* Filtros mobile - colapsável */}
        {showFilters && (
          <div className="sm:hidden p-3 pt-0 space-y-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Início</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white text-sm"
                  style={{ colorScheme: 'light' }}
                  title="Data inicial do período"
                  aria-label="Data inicial"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fim</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white text-sm"
                  style={{ colorScheme: 'light' }}
                  title="Data final do período"
                  aria-label="Data final"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setStartDate(format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd'));
                  setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                }}
                className="flex-1 px-2 py-2.5 min-h-[44px] text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition active:scale-95"
              >
                3 meses
              </button>
              <button
                onClick={() => {
                  setStartDate(format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd'));
                  setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                }}
                className="flex-1 px-2 py-2.5 min-h-[44px] text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition active:scale-95"
              >
                6 meses
              </button>
              <button
                onClick={() => {
                  setStartDate(format(startOfMonth(subMonths(new Date(), 11)), 'yyyy-MM-dd'));
                  setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                }}
                className="flex-1 px-2 py-2.5 min-h-[44px] text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition active:scale-95"
              >
                12 meses
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cards de Resumo */}
      {cashFlowData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 sm:p-6 rounded-xl shadow-lg text-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-green-100 text-[10px] sm:text-sm">Receitas</span>
              <TrendingUp className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <div className="text-sm sm:text-2xl font-bold leading-tight">{formatCurrency(cashFlowData.summary.totalIncome)}</div>
          </div>
          
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-3 sm:p-6 rounded-xl shadow-lg text-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-red-100 text-[10px] sm:text-sm">Despesas</span>
              <TrendingDown className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <div className="text-sm sm:text-2xl font-bold leading-tight">{formatCurrency(cashFlowData.summary.totalExpense)}</div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 sm:p-6 rounded-xl shadow-lg text-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-blue-100 text-[10px] sm:text-sm">Saldo</span>
              <DollarSign className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <div className="text-sm sm:text-2xl font-bold leading-tight">{formatCurrency(cashFlowData.summary.netCashFlow)}</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-3 sm:p-6 rounded-xl shadow-lg text-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-purple-100 text-[10px] sm:text-sm">Economia</span>
              <PieChart className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <div className="text-sm sm:text-2xl font-bold">{cashFlowData.summary.savingsRate.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 sm:mb-6">
        {/* Tabs - Scroll horizontal no mobile com snap */}
        <div className="relative">
          <div className="flex overflow-x-auto border-b scrollbar-hide snap-x snap-mandatory">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 snap-start px-3 sm:px-6 py-2.5 sm:py-4 font-medium transition whitespace-nowrap text-xs sm:text-base min-h-[44px] sm:min-h-[48px] ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 active:bg-gray-100'
                }`}
              >
                <span className="sm:hidden">{tab.label}</span>
                <span className="hidden sm:inline">{tab.fullLabel}</span>
              </button>
            ))}
          </div>
          {/* Indicador de scroll - gradiente direito */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none sm:hidden" />
        </div>

        <div className="p-3 sm:p-6">
          {/* Fluxo de Caixa */}
          {activeTab === 'cashflow' && cashFlowData && (
            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-base sm:text-xl font-bold text-gray-900">Evolução do Fluxo de Caixa</h3>
              
              {/* Gráfico - versão mobile simplificada */}
              <div className="w-full -mx-2 sm:mx-0">
                <div className="overflow-x-auto">
                  <div className="min-w-[320px] sm:min-w-[500px] pr-2">
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={cashFlowData.timeline} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} width={60} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Line 
                          type="monotone" 
                          dataKey="income" 
                          stroke="#10B981" 
                          strokeWidth={2} 
                          name="Receitas"
                          dot={{ r: 2 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="expense" 
                          stroke="#EF4444" 
                          strokeWidth={2} 
                          name="Despesas"
                          dot={{ r: 2 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="balance" 
                          stroke="#3B82F6" 
                          strokeWidth={2} 
                          name="Saldo"
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {cashFlowData.projection.length > 0 && (
                <>
                  <h3 className="text-base sm:text-xl font-bold text-gray-900 mt-6 sm:mt-8">Projeção (próximos 3 meses)</h3>
                  <div className="w-full -mx-2 sm:mx-0">
                    <div className="overflow-x-auto">
                      <div className="min-w-[280px] sm:min-w-[400px] pr-2">
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={cashFlowData.projection} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} width={55} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                            <Bar dataKey="projectedIncome" fill="#10B981" name="Receita" />
                            <Bar dataKey="projectedExpense" fill="#EF4444" name="Despesa" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Análise por Categoria - PLANO DE CONTAS HIERÁRQUICO */}
          {activeTab === 'categories' && hierarchicalData && (
            <div className="space-y-4 sm:space-y-6">
              {/* Toolbar - Reorganizada para mobile */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderTree className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                    <h3 className="text-base sm:text-xl font-bold text-gray-900">Plano de Contas</h3>
                  </div>
                  
                  {/* Botões expandir/colapsar */}
                  <div className="flex gap-1">
                    <button
                      onClick={expandAll}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition min-w-[40px] min-h-[40px] flex items-center justify-center"
                      title="Expandir tudo"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={collapseAll}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition min-w-[40px] min-h-[40px] flex items-center justify-center"
                      title="Colapsar tudo"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Filtro de tipo - linha separada no mobile */}
                <div className="flex overflow-x-auto scrollbar-hide">
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                    <button
                      onClick={() => setCategoryViewType('both')}
                      className={`px-3 py-2 text-xs sm:text-sm font-medium transition min-h-[40px] ${
                        categoryViewType === 'both' 
                          ? 'bg-gray-900 text-white' 
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setCategoryViewType('income')}
                      className={`px-3 py-2 text-xs sm:text-sm font-medium transition min-h-[40px] ${
                        categoryViewType === 'income' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      📈 Receitas
                    </button>
                    <button
                      onClick={() => setCategoryViewType('expense')}
                      className={`px-3 py-2 text-xs sm:text-sm font-medium transition min-h-[40px] ${
                        categoryViewType === 'expense' 
                          ? 'bg-rose-600 text-white' 
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      📉 Despesas
                    </button>
                  </div>
                </div>
              </div>

              {/* Resumo */}
              <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-4">
                <div className="bg-blue-50 p-2.5 sm:p-4 rounded-lg border border-blue-100">
                  <div className="text-[10px] sm:text-sm text-blue-600 font-medium">Total Receitas</div>
                  <div className="text-sm sm:text-2xl font-bold text-blue-900">
                    {formatCurrency(hierarchicalData.summary.totalIncome)}
                  </div>
                </div>
                <div className="bg-rose-50 p-2.5 sm:p-4 rounded-lg border border-rose-100">
                  <div className="text-[10px] sm:text-sm text-rose-600 font-medium">Total Despesas</div>
                  <div className="text-sm sm:text-2xl font-bold text-rose-900">
                    {formatCurrency(hierarchicalData.summary.totalExpense)}
                  </div>
                </div>
                <div className={`p-2.5 sm:p-4 rounded-lg border ${
                  hierarchicalData.summary.balance >= 0 
                    ? 'bg-green-50 border-green-100' 
                    : 'bg-red-50 border-red-100'
                }`}>
                  <div className={`text-[10px] sm:text-sm font-medium ${
                    hierarchicalData.summary.balance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>Saldo</div>
                  <div className={`text-sm sm:text-2xl font-bold ${
                    hierarchicalData.summary.balance >= 0 ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {formatCurrency(hierarchicalData.summary.balance)}
                  </div>
                </div>
              </div>

              {/* Plano de Contas - RECEITAS */}
              {(categoryViewType === 'both' || categoryViewType === 'income') && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-blue-600 text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="font-semibold text-sm sm:text-base">RECEITAS</span>
                    </div>
                    <span className="font-bold text-sm sm:text-base">{formatCurrency(hierarchicalData.income.total)}</span>
                  </div>
                  <div className="max-h-[350px] sm:max-h-[400px] overflow-y-auto">
                    {hierarchicalData.income.categories.length > 0 ? (
                      hierarchicalData.income.categories.map(cat => 
                        renderHierarchicalCategory(cat, true, 0)
                      )
                    ) : (
                      <div className="p-6 sm:p-8 text-center text-gray-500 text-sm">
                        Nenhuma receita no período selecionado
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Plano de Contas - DESPESAS */}
              {(categoryViewType === 'both' || categoryViewType === 'expense') && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-rose-600 text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="font-semibold text-sm sm:text-base">DESPESAS</span>
                    </div>
                    <span className="font-bold text-sm sm:text-base">{formatCurrency(hierarchicalData.expense.total)}</span>
                  </div>
                  <div className="max-h-[350px] sm:max-h-[400px] overflow-y-auto">
                    {hierarchicalData.expense.categories.length > 0 ? (
                      hierarchicalData.expense.categories.map(cat => 
                        renderHierarchicalCategory(cat, false, 0)
                      )
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        Nenhuma despesa no período selecionado
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Gráfico de Pizza - Mantido para visualização rápida */}
              {categoryData && (
                <div className="mt-8 pt-6 border-t border-gray-200 pie-chart-mobile">
                  <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">📊 Top 8 Categorias de Despesa</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ResponsiveContainer width="100%" height={280}>
                      <RePieChart>
                        <Pie
                          data={categoryData.categories.slice(0, 8)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ cx, cy, midAngle, innerRadius, outerRadius, icon, percentage }: any) => {
                            const RADIAN = Math.PI / 180;
                            const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            return (
                              <text 
                                x={x} 
                                y={y} 
                                fill="#F1F5F9" 
                                textAnchor={x > cx ? 'start' : 'end'} 
                                dominantBaseline="central" 
                                fontSize={12} 
                                fontWeight={700}
                                style={{ fill: '#F1F5F9' }}
                              >
                                {`${percentage?.toFixed(0) || 0}%`}
                              </text>
                            );
                          }}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="total"
                        >
                          {categoryData.categories.slice(0, 8).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => formatCurrency(Number(value))} 
                          contentStyle={{ 
                            backgroundColor: '#ffffff', 
                            border: '1px solid #e5e7eb', 
                            borderRadius: '8px',
                            color: '#1f2937',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                          labelStyle={{ color: '#1f2937', fontWeight: 600 }}
                          itemStyle={{ color: '#1f2937' }}
                        />
                      </RePieChart>
                    </ResponsiveContainer>

                    {/* Legenda do gráfico - cores explícitas para mobile */}
                    <div className="space-y-2">
                      {categoryData.categories.slice(0, 8).map((cat, index) => (
                        <div key={cat.id} className="flex items-center gap-2 text-sm" style={{ color: '#E2E8F0' }}>
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="flex-1 truncate font-medium" style={{ color: '#E2E8F0' }}>{cat.icon} {cat.name}</span>
                          <span className="font-semibold" style={{ color: '#F8FAFC' }}>{formatCurrency(cat.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mapa Financeiro - Esperado vs Realizado */}
          {activeTab === 'dre' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Toolbar Mapa Financeiro - Responsivo */}
              <div className="flex flex-col gap-3">
                {/* Header com título e ações */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Table2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                    <h3 className="text-base sm:text-xl font-bold text-gray-900">🗺️ Mapa Financeiro</h3>
                  </div>
                
                  {/* Botões expandir/colapsar - compactos no mobile */}
                  <div className="flex gap-1">
                    <button
                      onClick={expandAllDRE}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition min-w-[40px] min-h-[40px] flex items-center justify-center"
                      title="Expandir tudo"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={collapseAllDRE}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition min-w-[40px] min-h-[40px] flex items-center justify-center"
                      title="Colapsar tudo"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Navegação de Período - Reorganizada para mobile */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 sm:p-4 rounded-xl border border-blue-100">
                  <div className="flex flex-col gap-3">
                    {/* Linha 1: Tipo de visualização + Navegação de Ano */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {/* Tipo de Visualização */}
                      <div className="flex bg-white rounded-lg shadow-sm">
                        <button
                          onClick={() => {
                            setDreViewMode('year');
                            setDreMonth(null);
                          }}
                          className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-l-lg transition min-h-[36px] ${
                            dreViewMode === 'year' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Ano
                        </button>
                        <button
                          onClick={() => {
                            setDreViewMode('month');
                            if (dreMonth === null) setDreMonth(new Date().getMonth());
                          }}
                          className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-r-lg transition min-h-[36px] ${
                            dreViewMode === 'month' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Mês
                        </button>
                      </div>
                      
                      {/* Navegação de Ano */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDreYear(y => y - 1)}
                          className="p-1.5 sm:p-2 bg-white hover:bg-gray-100 rounded-lg shadow-sm transition border min-w-[36px] min-h-[36px] flex items-center justify-center"
                          title="Ano anterior"
                        >
                          <ChevronLeft className="w-4 h-4 text-gray-600" />
                        </button>
                        <span className="px-3 py-1.5 bg-white rounded-lg shadow-sm font-bold text-gray-900 text-sm min-w-[60px] text-center">
                          {dreYear}
                        </span>
                        <button
                          onClick={() => setDreYear(y => y + 1)}
                          className="p-1.5 sm:p-2 bg-white hover:bg-gray-100 rounded-lg shadow-sm transition border min-w-[36px] min-h-[36px] flex items-center justify-center"
                          title="Próximo ano"
                        >
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Linha 2: Navegação de Mês (quando em modo mês único) */}
                    {dreViewMode === 'month' && dreMonth !== null && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            if (dreMonth === 0) {
                              setDreMonth(11);
                              setDreYear(y => y - 1);
                            } else {
                              setDreMonth(m => (m ?? 0) - 1);
                            }
                          }}
                          className="p-1.5 bg-white hover:bg-gray-100 rounded-lg shadow-sm transition border min-w-[36px] min-h-[36px] flex items-center justify-center"
                          title="Mês anterior"
                        >
                          <ChevronLeft className="w-4 h-4 text-gray-600" />
                        </button>
                        <select
                          value={dreMonth}
                          onChange={(e) => setDreMonth(parseInt(e.target.value))}
                          className="flex-1 max-w-[150px] px-3 py-1.5 bg-white rounded-lg shadow-sm font-bold text-gray-900 border focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value={0}>Janeiro</option>
                          <option value={1}>Fevereiro</option>
                          <option value={2}>Março</option>
                          <option value={3}>Abril</option>
                          <option value={4}>Maio</option>
                          <option value={5}>Junho</option>
                          <option value={6}>Julho</option>
                          <option value={7}>Agosto</option>
                          <option value={8}>Setembro</option>
                          <option value={9}>Outubro</option>
                          <option value={10}>Novembro</option>
                          <option value={11}>Dezembro</option>
                        </select>
                        <button
                          onClick={() => {
                            if (dreMonth === 11) {
                              setDreMonth(0);
                              setDreYear(y => y + 1);
                            } else {
                              setDreMonth(m => (m ?? 0) + 1);
                            }
                          }}
                          className="p-1.5 bg-white hover:bg-gray-100 rounded-lg shadow-sm transition border min-w-[36px] min-h-[36px] flex items-center justify-center"
                          title="Próximo mês"
                        >
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    )}
                    
                    {/* Toggle Esperado - linha separada */}
                    <label className="flex items-center justify-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showExpected}
                        onChange={(e) => setShowExpected(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs sm:text-sm text-gray-600">Mostrar Esperado</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Resumo Mapa Financeiro */}
              {dreData && (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="bg-blue-50 p-2.5 sm:p-3 rounded-lg border border-blue-100">
                    <div className="text-[10px] sm:text-xs text-blue-600 font-medium">Total Receitas</div>
                    <div className="text-sm sm:text-lg font-bold text-blue-900">
                      {formatCurrency(dreData.summary.totalReceitas)}
                    </div>
                  </div>
                  <div className="bg-rose-50 p-2.5 sm:p-3 rounded-lg border border-rose-100">
                    <div className="text-[10px] sm:text-xs text-rose-600 font-medium">Total Despesas</div>
                    <div className="text-sm sm:text-lg font-bold text-rose-900">
                      {formatCurrency(dreData.summary.totalDespesas)}
                    </div>
                  </div>
                  <div className={`p-2.5 sm:p-3 rounded-lg border ${
                    dreData.summary.lucroOperacional >= 0 
                      ? 'bg-green-50 border-green-100' 
                      : 'bg-red-50 border-red-100'
                  }`}>
                    <div className={`text-[10px] sm:text-xs font-medium ${
                      dreData.summary.lucroOperacional >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>Lucro Operacional</div>
                    <div className={`text-sm sm:text-lg font-bold ${
                      dreData.summary.lucroOperacional >= 0 ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {formatCurrency(dreData.summary.lucroOperacional)}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-2.5 sm:p-3 rounded-lg border border-purple-100">
                    <div className="text-[10px] sm:text-xs text-purple-600 font-medium">Margem de Lucro</div>
                    <div className="text-sm sm:text-lg font-bold text-purple-900">
                      {dreData.summary.margemLucro.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Tabela Mapa Financeiro - Desktop: Tabela | Mobile: Cards */}
              {dreData && (() => {
                // Determinar meses a exibir baseado no modo de visualização
                // IMPORTANTE: Usar os nomes de mês do backend (JAN, FEV, etc) para que as chaves correspondam aos dados
                const monthNamesDisplay = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                const backendMonthNames = dreData.months; // ['JAN', 'FEV', ...] - chaves do backend
                
                // Para exibição usamos nomes formatados, mas para acessar dados usamos as chaves do backend
                const displayMonthIndices = dreViewMode === 'month' && dreMonth !== null 
                  ? [dreMonth] // Índice do mês selecionado
                  : backendMonthNames.map((_, i) => i); // Todos os índices
                
                const showYearTotal = dreViewMode === 'year'; // Só mostrar total do ano quando em modo ano
                
                // Função auxiliar para obter a chave do backend pelo índice
                const getBackendMonth = (index: number) => backendMonthNames[index];
                const getDisplayMonth = (index: number) => monthNamesDisplay[index];

                // Função para renderizar um card de categoria (versão mobile)
                const renderMobileCard = (cat: DRERowData, isIncome: boolean) => {
                  const monthIndex = dreViewMode === 'month' && dreMonth !== null ? dreMonth : new Date().getMonth();
                  const month = getBackendMonth(monthIndex);
                  const monthData = cat.months[month] || { esperado: 0, realizado: 0, av: 0, ah: 0 };
                  const hasValue = monthData.realizado > 0 || (showExpected && monthData.esperado > 0);
                  
                  if (!hasValue) return null;
                  
                  return (
                    <div key={cat.id} className="bg-white rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-base">{cat.icon || (isIncome ? '📈' : '📉')}</span>
                          <span className="text-sm font-medium text-gray-900 truncate">{cat.name.replace(new RegExp(`^${cat.icon}\\s*`), '')}</span>
                        </div>
                        {monthData.ah !== 0 && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            isIncome 
                              ? (monthData.ah > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
                              : (monthData.ah > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')
                          }`}>
                            {monthData.ah > 0 ? '+' : ''}{monthData.ah.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        {showExpected && (
                          <div>
                            <span className="text-gray-500 text-xs">Esperado</span>
                            <div className="font-medium text-gray-700">{formatCurrency(monthData.esperado)}</div>
                          </div>
                        )}
                        <div className={showExpected ? 'text-right' : ''}>
                          <span className="text-gray-500 text-xs">Realizado</span>
                          <div className={`font-bold ${isIncome ? 'text-blue-600' : 'text-rose-600'}`}>
                            {formatCurrency(monthData.realizado)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                };

                const expenseGroups = dreData.despesas.expenseGroups?.length
                  ? dreData.despesas.expenseGroups
                  : [{
                      key: 'needs' as const,
                      name: '🏠 NECESSIDADES ESSENCIAIS',
                      targetPercent: 50,
                      description: 'Despesas classificadas como essenciais.',
                      categories: dreData.despesas.categories,
                      monthly: dreData.despesas.monthly,
                      total: dreData.despesas.total,
                      actualPercent: dreData.summary.totalReceitas > 0
                        ? (dreData.despesas.total.realizado / dreData.summary.totalReceitas) * 100
                        : 0,
                      targetAmount: dreData.summary.totalReceitas * 0.5,
                      varianceFromTarget: dreData.despesas.total.realizado - (dreData.summary.totalReceitas * 0.5),
                    }];

                const renderExpenseCategoryRows = (categories: DRERowData[]) => categories.map((cat) => {
                  const isExpanded = expandedDRERows.has(cat.id);
                  const hasChildren = cat.children.length > 0;
                  
                  return (
                    <React.Fragment key={cat.id}>
                      <tr 
                        className={`hover:bg-gray-50 transition cursor-pointer ${hasChildren ? 'font-medium' : ''}`}
                        onClick={() => hasChildren && toggleDRERow(cat.id)}
                      >
                        <td className="sticky left-0 bg-white hover:bg-gray-50 px-3 py-1.5 flex items-center gap-1">
                          {hasChildren && (
                            <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
                          )}
                          <span className="pl-2 text-gray-900 font-medium">{cat.icon} {cat.name.replace(new RegExp(`^${cat.icon}\\s*`), '')}</span>
                        </td>
                        {displayMonthIndices.map(monthIndex => {
                          const month = getBackendMonth(monthIndex);
                          const monthData = cat.months[month] || { esperado: 0, realizado: 0, av: 0, ah: 0 };
                          return (
                            <React.Fragment key={`${cat.id}-${monthIndex}`}>
                              {showExpected && <td className="px-1 py-1.5 text-right border-l border-gray-100 text-gray-600">{monthData.esperado > 0 ? formatCurrency(monthData.esperado) : '-'}</td>}
                              <td className="px-1 py-1.5 text-right text-rose-700 font-medium">{monthData.realizado > 0 ? formatCurrency(monthData.realizado) : '-'}</td>
                              <td className="px-1 py-1.5 text-right text-gray-600 text-xs">{monthData.av > 0 ? `${monthData.av.toFixed(1)}%` : '-'}</td>
                              <td className={`px-1 py-1.5 text-right text-xs ${monthData.ah > 0 ? 'text-red-700' : monthData.ah < 0 ? 'text-green-700' : 'text-gray-500'}`}>
                                {monthData.ah !== 0 ? `${monthData.ah > 0 ? '+' : ''}${monthData.ah.toFixed(1)}%` : '-'}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        {showYearTotal && (
                          <>
                            {showExpected && <td className="px-1 py-1.5 text-right border-l border-gray-200 bg-teal-50/50 text-gray-600">{cat.totalYear.esperado > 0 ? formatCurrency(cat.totalYear.esperado) : '-'}</td>}
                            <td className="px-1 py-1.5 text-right text-rose-700 font-semibold bg-teal-50/50">{cat.totalYear.realizado > 0 ? formatCurrency(cat.totalYear.realizado) : '-'}</td>
                            <td className="px-1 py-1.5 text-right text-gray-600 text-xs bg-teal-50/50">{cat.totalYear.av > 0 ? `${cat.totalYear.av.toFixed(1)}%` : '-'}</td>
                          </>
                        )}
                      </tr>
                      
                      {hasChildren && isExpanded && cat.children.map((child) => (
                        <tr key={child.id} className="bg-gray-50/50 hover:bg-gray-100 transition text-sm">
                          <td className="sticky left-0 bg-gray-50/50 hover:bg-gray-100 px-3 py-1 pl-8 text-gray-800">
                            {child.icon} {child.name.replace(new RegExp(`^${child.icon}\\s*`), '')}
                          </td>
                          {displayMonthIndices.map(monthIndex => {
                            const month = getBackendMonth(monthIndex);
                            const monthData = child.months[month] || { esperado: 0, realizado: 0, av: 0, ah: 0 };
                            return (
                              <React.Fragment key={`${child.id}-${monthIndex}`}>
                                {showExpected && <td className="px-1 py-1 text-right border-l border-gray-100 text-gray-500 text-xs">{monthData.esperado > 0 ? formatCurrency(monthData.esperado) : '-'}</td>}
                                <td className="px-1 py-1 text-right text-rose-600 text-xs">{monthData.realizado > 0 ? formatCurrency(monthData.realizado) : '-'}</td>
                                <td className="px-1 py-1 text-right text-gray-500 text-xs">{monthData.av > 0 ? `${monthData.av.toFixed(1)}%` : '-'}</td>
                                <td className={`px-1 py-1 text-right text-xs ${monthData.ah > 0 ? 'text-red-600' : monthData.ah < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                  {monthData.ah !== 0 ? `${monthData.ah > 0 ? '+' : ''}${monthData.ah.toFixed(1)}%` : '-'}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          {showYearTotal && (
                            <>
                              {showExpected && <td className="px-1 py-1 text-right border-l border-gray-200 bg-teal-50/30 text-gray-500 text-xs">{child.totalYear.esperado > 0 ? formatCurrency(child.totalYear.esperado) : '-'}</td>}
                              <td className="px-1 py-1 text-right text-rose-600 text-xs bg-teal-50/30">{child.totalYear.realizado > 0 ? formatCurrency(child.totalYear.realizado) : '-'}</td>
                              <td className="px-1 py-1 text-right text-gray-500 text-xs bg-teal-50/30">{child.totalYear.av > 0 ? `${child.totalYear.av.toFixed(1)}%` : '-'}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                });
                
                return (
                <>
                  <style jsx global>{`
                    .dre-table table {
                      border-collapse: separate;
                      border-spacing: 0;
                    }

                    .dre-table th,
                    .dre-table td {
                      border-color: #334155 !important;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                    }

                    .dre-table tbody tr:not(.bg-blue-900):not(.bg-orange-100):not(.bg-green-100):not(.h-2) {
                      background-color: #0f172a !important;
                    }

                    .dre-table tbody tr:not(.bg-blue-900):not(.bg-orange-100):not(.bg-green-100):not(.h-2):hover {
                      background-color: #1e293b !important;
                    }

                    .dre-table tbody td {
                      color: #cbd5e1;
                    }

                    .dre-table tbody td.sticky {
                      display: table-cell !important;
                      width: 250px;
                      min-width: 250px;
                      max-width: 250px;
                      background-color: #0f172a !important;
                      color: #f8fafc !important;
                      border-right: 1px solid #334155 !important;
                      z-index: 20;
                    }

                    .dre-table tbody td.sticky span {
                      color: #f8fafc !important;
                    }

                    .dre-table tbody tr.bg-blue-900 td {
                      background-color: #1e3a8a !important;
                      color: #dbeafe !important;
                    }

                    .dre-table tbody tr.bg-orange-100 td {
                      background-color: #ffedd5 !important;
                      color: #7c2d12 !important;
                    }

                    .dre-table tbody tr.bg-green-100 td {
                      background-color: #dcfce7 !important;
                      color: #14532d !important;
                    }

                    .dre-table tbody tr:not(.bg-blue-900):not(.bg-orange-100):not(.bg-green-100):not(.h-2) td[class*="bg-teal"] {
                      background-color: #1e293b !important;
                      color: #cbd5e1 !important;
                    }

                    .dre-table tbody tr:not(.bg-blue-900):not(.bg-orange-100):not(.bg-green-100):not(.h-2) td[class*="bg-teal"].text-blue-700,
                    .dre-table tbody tr:not(.bg-blue-900):not(.bg-orange-100):not(.bg-green-100):not(.h-2) td[class*="bg-teal"].text-blue-500 {
                      color: #60a5fa !important;
                    }

                    .dre-table tbody tr:not(.bg-blue-900):not(.bg-orange-100):not(.bg-green-100):not(.h-2) td[class*="bg-teal"].text-rose-700,
                    .dre-table tbody tr:not(.bg-blue-900):not(.bg-orange-100):not(.bg-green-100):not(.h-2) td[class*="bg-teal"].text-rose-600 {
                      color: #fb7185 !important;
                    }

                    .dre-table .text-gray-900,
                    .dre-table .text-gray-800,
                    .dre-table .text-gray-600,
                    .dre-table .text-gray-500,
                    .dre-table .text-gray-400 {
                      color: #cbd5e1 !important;
                    }

                    .dre-table .text-blue-700,
                    .dre-table .text-blue-500 {
                      color: #60a5fa !important;
                    }

                    .dre-table .text-rose-700,
                    .dre-table .text-rose-600 {
                      color: #fb7185 !important;
                    }

                    .dre-table .text-green-700,
                    .dre-table .text-green-600,
                    .dre-table .text-green-500 {
                      color: #34d399 !important;
                    }

                    .dre-table .text-red-700,
                    .dre-table .text-red-600,
                    .dre-table .text-red-500 {
                      color: #fb7185 !important;
                    }
                  `}</style>
                  {/* Versão Mobile - Cards empilhados */}
                  <div className="sm:hidden space-y-4">
                    {/* Aviso sobre modo de visualização */}
                    {dreViewMode === 'year' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-amber-700">
                          {'📱 No mobile, mostrando dados do mês atual. Alterne para "Mês" para navegar.'}
                        </p>
                      </div>
                    )}
                    
                    {/* Seção Receitas */}
                    <div className="space-y-2">
                      <div className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center justify-between">
                        <span className="font-semibold text-sm">📈 RECEITAS</span>
                        <span className="font-bold text-sm">{formatCurrency(dreData.receitas.total.realizado)}</span>
                      </div>
                      <div className="space-y-2">
                        {dreData.receitas.categories.map(cat => renderMobileCard(cat, true))}
                      </div>
                    </div>
                    
                    {/* Seção Despesas */}
                    <div className="space-y-2">
                      <div className="bg-rose-600 text-white px-3 py-2 rounded-lg flex items-center justify-between">
                        <span className="font-semibold text-sm">📉 DESPESAS</span>
                        <span className="font-bold text-sm">{formatCurrency(dreData.despesas.total.realizado)}</span>
                      </div>
                      <div className="space-y-2">
                        {expenseGroups.map(group => (
                          <div key={group.key} className="space-y-2">
                            <div className="bg-slate-800 text-white px-3 py-2 rounded-lg flex items-center justify-between">
                              <span className="font-semibold text-xs">{group.name}</span>
                              <span className="font-bold text-xs">{group.actualPercent.toFixed(1)}% / {group.targetPercent}%</span>
                            </div>
                            {group.categories.map(cat => renderMobileCard(cat, false))}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Resultado Líquido */}
                    <div className={`p-4 rounded-lg ${
                      dreData.summary.lucroOperacional >= 0 
                        ? 'bg-green-100 border-2 border-green-300' 
                        : 'bg-red-100 border-2 border-red-300'
                    }`}>
                      <div className="text-center">
                        <span className="text-sm font-medium text-gray-600">Resultado Líquido</span>
                        <div className={`text-2xl font-bold mt-1 ${
                          dreData.summary.lucroOperacional >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {formatCurrency(dreData.summary.lucroOperacional)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Versão Desktop - Tabela completa */}
                  <div ref={dreTableRef} className="dre-table hidden sm:block overflow-x-auto border border-slate-700 rounded-lg bg-slate-950">
                    <table className={`w-full ${dreViewMode === 'year' ? 'min-w-[2220px]' : 'min-w-[760px]'} text-sm table-fixed`}>
                      <colgroup>
                        <col className="w-[250px]" />
                        {displayMonthIndices.map(monthIndex => (
                          <React.Fragment key={`cols-${monthIndex}`}>
                            {showExpected && <col className="w-[110px]" />}
                            <col className="w-[110px]" />
                            <col className="w-[64px]" />
                            <col className="w-[64px]" />
                          </React.Fragment>
                        ))}
                        {showYearTotal && (
                          <>
                            {showExpected && <col className="w-[120px]" />}
                            <col className="w-[120px]" />
                            <col className="w-[70px]" />
                          </>
                        )}
                      </colgroup>
                      <thead>
                        {/* Header com meses */}
                        <tr className="bg-gray-800 text-white">
                          <th className="sticky left-0 z-30 bg-gray-800 text-left px-3 py-2 font-semibold min-w-[250px] border-r border-slate-700">
                            <button
                              onClick={expandAllDRE}
                              className="text-gray-300 hover:text-white transition text-xs"
                            >
                              ▶ MOSTRAR CONTAS FILHAS
                            </button>
                          </th>
                          {/* Meses baseado no modo de visualização */}
                          {displayMonthIndices.map(monthIndex => (
                            <th key={monthIndex} colSpan={showExpected ? 4 : 3} className="text-center px-1 py-2 font-semibold border-l border-gray-700">
                              {getDisplayMonth(monthIndex)}
                            </th>
                          ))}
                          {showYearTotal && (
                            <th colSpan={showExpected ? 3 : 2} className="text-center px-1 py-2 font-semibold border-l border-gray-700 bg-teal-700">
                              TOTAL ANO
                            </th>
                          )}
                        </tr>
                        {/* Subheader com Esperado/Realizado/AV/AH */}
                        <tr className="bg-gray-700 text-gray-200 text-xs">
                          <th className="sticky left-0 z-30 bg-gray-700 text-left px-3 py-1 border-r border-slate-700"></th>
                          {displayMonthIndices.map(monthIndex => (
                            <React.Fragment key={`sub-${monthIndex}`}>
                              {showExpected && <th className="px-1 py-1 text-right border-l border-gray-600">ESPERADO</th>}
                              <th className="px-1 py-1 text-right">REALIZADO</th>
                              <th className="px-1 py-1 text-right">AV%</th>
                              <th className="px-1 py-1 text-right">AH%</th>
                            </React.Fragment>
                          ))}
                          {showYearTotal && (
                            <>
                              {showExpected && <th className="px-1 py-1 text-right border-l border-gray-600 bg-teal-800">ESPERADO</th>}
                              <th className="px-1 py-1 text-right border-l border-gray-600 bg-teal-800">REALIZADO</th>
                              <th className="px-1 py-1 text-right bg-teal-800">AV%</th>
                            </>
                          )}
                        </tr>
                    </thead>
                    <tbody>
                      {/* Linha RECEITA/FATURAMENTO */}
                      <tr className="bg-blue-900 font-semibold hover:bg-blue-800 transition">
                        <td className="sticky left-0 z-20 bg-blue-900 hover:bg-blue-800 px-3 py-2 text-white border-r border-slate-700 truncate">
                          ▶ {dreData.linhasCalculadas.RECEITA_FATURAMENTO?.name || '📈 RECEITA/FATURAMENTO'}
                        </td>
                        {displayMonthIndices.map(monthIndex => {
                          const month = getBackendMonth(monthIndex);
                          const data = dreData.linhasCalculadas.RECEITA_FATURAMENTO?.months[month] || { esperado: 0, realizado: 0 };
                          const total = dreData.receitas.monthly[month]?.realizado || 1;
                          const av = total > 0 ? 100 : 0;
                          return (
                            <React.Fragment key={`rec-${monthIndex}`}>
                              {showExpected && <td className="px-1 py-2 text-right border-l border-gray-200">{formatCurrency(data.esperado)}</td>}
                              <td className="px-1 py-2 text-right text-blue-700 font-semibold">{formatCurrency(data.realizado)}</td>
                              <td className="px-1 py-2 text-right text-gray-600">100.0%</td>
                              <td className="px-1 py-2 text-right text-gray-600">-</td>
                            </React.Fragment>
                          );
                        })}
                        {showYearTotal && (
                          <>
                            {showExpected && <td className="px-1 py-2 text-right border-l border-gray-300 bg-teal-50">{formatCurrency(dreData.receitas.total.esperado)}</td>}
                            <td className="px-1 py-2 text-right text-blue-700 font-semibold bg-teal-50">{formatCurrency(dreData.receitas.total.realizado)}</td>
                            <td className="px-1 py-2 text-right text-gray-600 bg-teal-50">100.0%</td>
                          </>
                        )}
                      </tr>

                      {/* Categorias de Receita (expansíveis) */}
                      {dreData.receitas.categories.map((cat) => {
                        const isExpanded = expandedDRERows.has(cat.id);
                        const hasChildren = cat.children.length > 0;
                        
                        return (
                          <React.Fragment key={cat.id}>
                            <tr 
                              className={`hover:bg-gray-50 transition cursor-pointer ${hasChildren ? 'font-medium' : ''}`}
                              onClick={() => hasChildren && toggleDRERow(cat.id)}
                            >
                              <td className="sticky left-0 bg-white hover:bg-gray-50 px-3 py-1.5 flex items-center gap-1">
                                {hasChildren && (
                                  <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
                                )}
                                <span className="pl-2 text-gray-900 font-medium">{cat.icon} {cat.name.replace(new RegExp(`^${cat.icon}\\s*`), '')}</span>
                              </td>
                              {displayMonthIndices.map(monthIndex => {
                                const month = getBackendMonth(monthIndex);
                                const monthData = cat.months[month] || { esperado: 0, realizado: 0, av: 0, ah: 0 };
                                return (
                                  <React.Fragment key={`${cat.id}-${monthIndex}`}>
                                    {showExpected && <td className="px-1 py-1.5 text-right border-l border-gray-100 text-gray-600">{monthData.esperado > 0 ? formatCurrency(monthData.esperado) : '-'}</td>}
                                    <td className="px-1 py-1.5 text-right text-blue-700 font-medium">{monthData.realizado > 0 ? formatCurrency(monthData.realizado) : '-'}</td>
                                    <td className="px-1 py-1.5 text-right text-gray-600 text-xs">{monthData.av > 0 ? `${monthData.av.toFixed(1)}%` : '-'}</td>
                                    <td className={`px-1 py-1.5 text-right text-xs ${monthData.ah > 0 ? 'text-green-700' : monthData.ah < 0 ? 'text-red-700' : 'text-gray-500'}`}>
                                      {monthData.ah !== 0 ? `${monthData.ah > 0 ? '+' : ''}${monthData.ah.toFixed(1)}%` : '-'}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                              {showYearTotal && (
                                <>
                                  {showExpected && <td className="px-1 py-1.5 text-right border-l border-gray-200 bg-teal-50/50 text-gray-600">{cat.totalYear.esperado > 0 ? formatCurrency(cat.totalYear.esperado) : '-'}</td>}
                                  <td className="px-1 py-1.5 text-right text-blue-700 font-semibold bg-teal-50/50">{cat.totalYear.realizado > 0 ? formatCurrency(cat.totalYear.realizado) : '-'}</td>
                                  <td className="px-1 py-1.5 text-right text-gray-600 text-xs bg-teal-50/50">{cat.totalYear.av > 0 ? `${cat.totalYear.av.toFixed(1)}%` : '-'}</td>
                                </>
                              )}
                            </tr>
                            
                            {/* Filhos expandidos */}
                            {hasChildren && isExpanded && cat.children.map((child) => (
                              <tr key={child.id} className="bg-gray-50/50 hover:bg-gray-100 transition text-sm">
                                <td className="sticky left-0 bg-gray-50/50 hover:bg-gray-100 px-3 py-1 pl-8 text-gray-800">
                                  {child.icon} {child.name.replace(new RegExp(`^${child.icon}\\s*`), '')}
                                </td>
                                {displayMonthIndices.map(monthIndex => {
                                  const month = getBackendMonth(monthIndex);
                                  const monthData = child.months[month] || { esperado: 0, realizado: 0, av: 0, ah: 0 };
                                  return (
                                    <React.Fragment key={`${child.id}-${monthIndex}`}>
                                      {showExpected && <td className="px-1 py-1 text-right border-l border-gray-100 text-gray-500 text-xs">{monthData.esperado > 0 ? formatCurrency(monthData.esperado) : '-'}</td>}
                                      <td className="px-1 py-1 text-right text-blue-500 text-xs">{monthData.realizado > 0 ? formatCurrency(monthData.realizado) : '-'}</td>
                                      <td className="px-1 py-1 text-right text-gray-400 text-xs">{monthData.av > 0 ? `${monthData.av.toFixed(1)}%` : '-'}</td>
                                      <td className={`px-1 py-1 text-right text-xs ${monthData.ah > 0 ? 'text-green-500' : monthData.ah < 0 ? 'text-red-500' : 'text-gray-300'}`}>
                                        {monthData.ah !== 0 ? `${monthData.ah > 0 ? '+' : ''}${monthData.ah.toFixed(1)}%` : '-'}
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                                {showYearTotal && (
                                  <>
                                    {showExpected && <td className="px-1 py-1 text-right border-l border-gray-200 bg-teal-50/30 text-gray-400 text-xs">{child.totalYear.esperado > 0 ? formatCurrency(child.totalYear.esperado) : '-'}</td>}
                                    <td className="px-1 py-1 text-right text-blue-500 text-xs bg-teal-50/30">{child.totalYear.realizado > 0 ? formatCurrency(child.totalYear.realizado) : '-'}</td>
                                    <td className="px-1 py-1 text-right text-gray-400 text-xs bg-teal-50/30">{child.totalYear.av > 0 ? `${child.totalYear.av.toFixed(1)}%` : '-'}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}

                      {/* Separador */}
                      <tr className="h-2 bg-gray-200"></tr>

                      {expenseGroups.map((group) => (
                        <React.Fragment key={group.key}>
                          <tr className="bg-orange-100 font-semibold hover:bg-orange-200 transition">
                            <td className="sticky left-0 bg-orange-100 hover:bg-orange-200 px-3 py-2">
                              ▶ {group.name} ({group.actualPercent.toFixed(1)}% / meta {group.targetPercent}%)
                            </td>
                            {displayMonthIndices.map(monthIndex => {
                              const month = getBackendMonth(monthIndex);
                              const data = group.monthly[month] || { esperado: 0, realizado: 0 };
                              return (
                                <React.Fragment key={`${group.key}-${monthIndex}`}>
                                  {showExpected && <td className="px-1 py-2 text-right border-l border-gray-200">{formatCurrency(data.esperado)}</td>}
                                  <td className="px-1 py-2 text-right text-orange-700 font-semibold">{formatCurrency(data.realizado)}</td>
                                  <td className="px-1 py-2 text-right text-gray-600">{group.actualPercent.toFixed(1)}%</td>
                                  <td className={`px-1 py-2 text-right ${group.varianceFromTarget > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                    {formatCurrency(group.varianceFromTarget)}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                            {showYearTotal && (
                              <>
                                {showExpected && <td className="px-1 py-2 text-right border-l border-gray-300 bg-teal-50">{formatCurrency(group.total.esperado)}</td>}
                                <td className="px-1 py-2 text-right text-orange-700 font-semibold bg-teal-50">{formatCurrency(group.total.realizado)}</td>
                                <td className="px-1 py-2 text-right text-gray-600 bg-teal-50">{group.actualPercent.toFixed(1)}%</td>
                              </>
                            )}
                          </tr>
                          {renderExpenseCategoryRows(group.categories)}
                        </React.Fragment>
                      ))}

                      {!expenseGroups.length && (
                        <>
                      {/* Linha CUSTOS VARIÁVEIS */}
                      <tr className="bg-orange-100 font-semibold hover:bg-orange-200 transition">
                        <td className="sticky left-0 bg-orange-100 hover:bg-orange-200 px-3 py-2">
                          ▶ {dreData.linhasCalculadas.CUSTOS_VARIAVEIS?.name || '📊 CUSTOS VARIÁVEIS'}
                        </td>
                        {displayMonthIndices.map(monthIndex => {
                          const month = getBackendMonth(monthIndex);
                          const data = dreData.linhasCalculadas.CUSTOS_VARIAVEIS?.months[month] || { esperado: 0, realizado: 0 };
                          return (
                            <React.Fragment key={`cv-${monthIndex}`}>
                              {showExpected && <td className="px-1 py-2 text-right border-l border-gray-200">{formatCurrency(data.esperado)}</td>}
                              <td className="px-1 py-2 text-right text-orange-700 font-semibold">{formatCurrency(data.realizado)}</td>
                              <td className="px-1 py-2 text-right text-gray-600">-</td>
                              <td className="px-1 py-2 text-right text-gray-600">-</td>
                            </React.Fragment>
                          );
                        })}
                        {showYearTotal && (
                          <>
                            {showExpected && <td className="px-1 py-2 text-right border-l border-gray-300 bg-teal-50">{formatCurrency(dreData.linhasCalculadas.CUSTOS_VARIAVEIS?.totalYear.esperado || 0)}</td>}
                            <td className="px-1 py-2 text-right text-orange-700 font-semibold bg-teal-50">{formatCurrency(dreData.linhasCalculadas.CUSTOS_VARIAVEIS?.totalYear.realizado || 0)}</td>
                            <td className="px-1 py-2 text-right text-gray-600 bg-teal-50">-</td>
                          </>
                        )}
                      </tr>

                      {/* Categorias de Despesa (expansíveis) */}
                      {dreData.despesas.categories.map((cat) => {
                        const isExpanded = expandedDRERows.has(cat.id);
                        const hasChildren = cat.children.length > 0;
                        
                        return (
                          <React.Fragment key={cat.id}>
                            <tr 
                              className={`hover:bg-gray-50 transition cursor-pointer ${hasChildren ? 'font-medium' : ''}`}
                              onClick={() => hasChildren && toggleDRERow(cat.id)}
                            >
                              <td className="sticky left-0 bg-white hover:bg-gray-50 px-3 py-1.5 flex items-center gap-1">
                                {hasChildren && (
                                  <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
                                )}
                                <span className="pl-2 text-gray-900 font-medium">{cat.icon} {cat.name.replace(new RegExp(`^${cat.icon}\\s*`), '')}</span>
                              </td>
                              {displayMonthIndices.map(monthIndex => {
                                const month = getBackendMonth(monthIndex);
                                const monthData = cat.months[month] || { esperado: 0, realizado: 0, av: 0, ah: 0 };
                                return (
                                  <React.Fragment key={`${cat.id}-${monthIndex}`}>
                                    {showExpected && <td className="px-1 py-1.5 text-right border-l border-gray-100 text-gray-600">{monthData.esperado > 0 ? formatCurrency(monthData.esperado) : '-'}</td>}
                                    <td className="px-1 py-1.5 text-right text-rose-700 font-medium">{monthData.realizado > 0 ? formatCurrency(monthData.realizado) : '-'}</td>
                                    <td className="px-1 py-1.5 text-right text-gray-600 text-xs">{monthData.av > 0 ? `${monthData.av.toFixed(1)}%` : '-'}</td>
                                    <td className={`px-1 py-1.5 text-right text-xs ${monthData.ah > 0 ? 'text-red-700' : monthData.ah < 0 ? 'text-green-700' : 'text-gray-500'}`}>
                                      {monthData.ah !== 0 ? `${monthData.ah > 0 ? '+' : ''}${monthData.ah.toFixed(1)}%` : '-'}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                              {showYearTotal && (
                                <>
                                  {showExpected && <td className="px-1 py-1.5 text-right border-l border-gray-200 bg-teal-50/50 text-gray-600">{cat.totalYear.esperado > 0 ? formatCurrency(cat.totalYear.esperado) : '-'}</td>}
                                  <td className="px-1 py-1.5 text-right text-rose-700 font-semibold bg-teal-50/50">{cat.totalYear.realizado > 0 ? formatCurrency(cat.totalYear.realizado) : '-'}</td>
                                  <td className="px-1 py-1.5 text-right text-gray-600 text-xs bg-teal-50/50">{cat.totalYear.av > 0 ? `${cat.totalYear.av.toFixed(1)}%` : '-'}</td>
                                </>
                              )}
                            </tr>
                            
                            {/* Filhos expandidos */}
                            {hasChildren && isExpanded && cat.children.map((child) => (
                              <tr key={child.id} className="bg-gray-50/50 hover:bg-gray-100 transition text-sm">
                                <td className="sticky left-0 bg-gray-50/50 hover:bg-gray-100 px-3 py-1 pl-8 text-gray-800">
                                  {child.icon} {child.name.replace(new RegExp(`^${child.icon}\\s*`), '')}
                                </td>
                                {displayMonthIndices.map(monthIndex => {
                                  const month = getBackendMonth(monthIndex);
                                  const monthData = child.months[month] || { esperado: 0, realizado: 0, av: 0, ah: 0 };
                                  return (
                                    <React.Fragment key={`${child.id}-${monthIndex}`}>
                                      {showExpected && <td className="px-1 py-1 text-right border-l border-gray-100 text-gray-500 text-xs">{monthData.esperado > 0 ? formatCurrency(monthData.esperado) : '-'}</td>}
                                      <td className="px-1 py-1 text-right text-rose-600 text-xs">{monthData.realizado > 0 ? formatCurrency(monthData.realizado) : '-'}</td>
                                      <td className="px-1 py-1 text-right text-gray-500 text-xs">{monthData.av > 0 ? `${monthData.av.toFixed(1)}%` : '-'}</td>
                                      <td className={`px-1 py-1 text-right text-xs ${monthData.ah > 0 ? 'text-red-600' : monthData.ah < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                        {monthData.ah !== 0 ? `${monthData.ah > 0 ? '+' : ''}${monthData.ah.toFixed(1)}%` : '-'}
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                                {showYearTotal && (
                                  <>
                                    {showExpected && <td className="px-1 py-1 text-right border-l border-gray-200 bg-teal-50/30 text-gray-500 text-xs">{child.totalYear.esperado > 0 ? formatCurrency(child.totalYear.esperado) : '-'}</td>}
                                    <td className="px-1 py-1 text-right text-rose-600 text-xs bg-teal-50/30">{child.totalYear.realizado > 0 ? formatCurrency(child.totalYear.realizado) : '-'}</td>
                                    <td className="px-1 py-1 text-right text-gray-500 text-xs bg-teal-50/30">{child.totalYear.av > 0 ? `${child.totalYear.av.toFixed(1)}%` : '-'}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}

                      {/* Separador */}
                      <tr className="h-2 bg-gray-200"></tr>

                      {/* Linha RESULTADO LÍQUIDO */}
                        </>
                      )}

                      <tr className="bg-green-100 font-bold hover:bg-green-200 transition">
                        <td className="sticky left-0 bg-green-100 hover:bg-green-200 px-3 py-2 text-green-800">
                          ✅ {dreData.linhasCalculadas.RESULTADO_LIQUIDO?.name || 'RESULTADO LÍQUIDO'}
                        </td>
                        {displayMonthIndices.map(monthIndex => {
                          const month = getBackendMonth(monthIndex);
                          const data = dreData.linhasCalculadas.RESULTADO_LIQUIDO?.months[month] || { esperado: 0, realizado: 0 };
                          const isPositive = data.realizado >= 0;
                          return (
                            <React.Fragment key={`rl-${monthIndex}`}>
                              {showExpected && <td className="px-1 py-2 text-right border-l border-gray-200">{formatCurrency(data.esperado)}</td>}
                              <td className={`px-1 py-2 text-right font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(data.realizado)}</td>
                              <td className="px-1 py-2 text-right text-gray-600">-</td>
                              <td className="px-1 py-2 text-right text-gray-600">-</td>
                            </React.Fragment>
                          );
                        })}
                        {showYearTotal && (
                          <>
                            {showExpected && <td className="px-1 py-2 text-right border-l border-gray-300 bg-teal-100">{formatCurrency(dreData.linhasCalculadas.RESULTADO_LIQUIDO?.totalYear.esperado || 0)}</td>}
                            <td className={`px-1 py-2 text-right font-bold bg-teal-100 ${dreData.summary.lucroOperacional >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {formatCurrency(dreData.linhasCalculadas.RESULTADO_LIQUIDO?.totalYear.realizado || 0)}
                            </td>
                            <td className="px-1 py-2 text-right text-gray-600 bg-teal-100">-</td>
                          </>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
                </>
                );
              })()}

              {/* Mensagem se não houver dados */}
              {!dreData && (
                <div className="text-center py-8 sm:py-12 text-gray-500">
                  <Table2 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">Carregando DRE...</p>
                </div>
              )}
            </div>
          )}

          {/* Receitas vs Despesas */}
          {activeTab === 'comparison' && incomeVsExpenseData && (
            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-base sm:text-xl font-bold text-gray-900">Comparativo Mensal</h3>
              <div className="w-full -mx-2 sm:mx-0">
                <div className="overflow-x-auto">
                  <div className="min-w-[320px] sm:min-w-[500px] pr-2">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={incomeVsExpenseData.comparison} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} width={55} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar dataKey="income" fill="#10B981" name="Receitas" />
                        <Bar dataKey="expense" fill="#EF4444" name="Despesas" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-6">
                <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                  <div className="text-[10px] sm:text-sm text-blue-600 font-medium">Total Receitas</div>
                  <div className="text-sm sm:text-2xl font-bold text-blue-900">
                    {formatCurrency(incomeVsExpenseData.summary.totalIncome)}
                  </div>
                </div>
                <div className="bg-red-50 p-3 sm:p-4 rounded-lg">
                  <div className="text-[10px] sm:text-sm text-red-600 font-medium">Total Despesas</div>
                  <div className="text-sm sm:text-2xl font-bold text-red-900">
                    {formatCurrency(incomeVsExpenseData.summary.totalExpense)}
                  </div>
                </div>
                <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                  <div className="text-[10px] sm:text-sm text-green-600 font-medium">Taxa Média Economia</div>
                  <div className="text-sm sm:text-2xl font-bold text-green-900">
                    {incomeVsExpenseData.summary.avgSavingsRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orçamentos */}
          {activeTab === 'budgets' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base sm:text-xl font-bold text-gray-900">Análise de Orçamentos</h3>
                <div className="text-xs sm:text-sm text-gray-500">
                  {format(new Date(), 'MMM/yy', { locale: ptBR })}
                </div>
              </div>

              {budgetData.length === 0 ? (
                <div className="text-center py-8 sm:py-12 text-gray-500 bg-gray-50 rounded-lg">
                  <BarChart3 className="w-10 h-10 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-50" />
                  <p className="text-sm sm:text-base mb-2">Nenhum orçamento cadastrado</p>
                  <button
                    onClick={() => router.push('/dashboard/budgets')}
                    className="text-[#1F4FD8] hover:text-[#1A44BF] font-medium text-sm"
                  >
                    Criar orçamento
                  </button>
                </div>
              ) : (
                <>
                  {/* Resumo Geral */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="bg-blue-50 p-2.5 sm:p-4 rounded-lg">
                      <div className="text-[10px] sm:text-sm text-blue-600 font-medium">Total Orçado</div>
                      <div className="text-sm sm:text-2xl font-bold text-blue-900">
                        {formatCurrency(budgetData.reduce((sum, b) => sum + b.amount, 0))}
                      </div>
                    </div>
                    <div className="bg-orange-50 p-2.5 sm:p-4 rounded-lg">
                      <div className="text-[10px] sm:text-sm text-orange-600 font-medium">Total Gasto</div>
                      <div className="text-sm sm:text-2xl font-bold text-orange-900">
                        {formatCurrency(budgetData.reduce((sum, b) => sum + b.spent, 0))}
                      </div>
                    </div>
                    <div className="bg-green-50 p-2.5 sm:p-4 rounded-lg">
                      <div className="text-[10px] sm:text-sm text-green-600 font-medium">Saldo Disponível</div>
                      <div className="text-sm sm:text-2xl font-bold text-green-900">
                        {formatCurrency(budgetData.reduce((sum, b) => sum + Math.max(0, b.remaining), 0))}
                      </div>
                    </div>
                    <div className="bg-purple-50 p-2.5 sm:p-4 rounded-lg">
                      <div className="text-[10px] sm:text-sm text-purple-600 font-medium">Utilização Média</div>
                      <div className="text-xl sm:text-2xl font-bold text-purple-900">
                        {budgetData.length > 0 
                          ? (budgetData.reduce((sum, b) => sum + b.percentage, 0) / budgetData.length).toFixed(1) 
                          : 0}%
                      </div>
                    </div>
                  </div>

                  {/* Gráfico de Barras Comparativo - oculto no mobile pequeno */}
                  <div className="hidden sm:block bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                    <h4 className="font-semibold text-gray-700 mb-3 sm:mb-4 text-sm sm:text-base">Orçado vs Gasto por Categoria</h4>
                    <div className="w-full overflow-x-auto">
                      <div className="min-w-[400px]">
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={budgetData.map(b => ({
                            name: b.category.name.length > 12 ? b.category.name.substring(0, 12) + '...' : b.category.name,
                            fullName: b.category.name,
                            orcado: b.amount,
                            gasto: b.spent
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
                            <YAxis tick={{ fontSize: 10 }} width={55} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                            <Tooltip 
                              formatter={(value) => formatCurrency(Number(value))}
                              labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                            <Bar dataKey="orcado" fill="#3B82F6" name="Orçado" />
                            <Bar dataKey="gasto" fill="#F97316" name="Gasto" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Cards de Orçamentos Individuais - ajustados para mobile */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {budgetData.map((budget) => (
                      <div
                        key={budget.id}
                        className={`bg-white rounded-xl shadow-sm border-2 p-3 sm:p-4 ${
                          budget.status === 'exceeded'
                            ? 'border-red-300 bg-red-50/50'
                            : budget.status === 'warning'
                            ? 'border-yellow-300 bg-yellow-50/50'
                            : 'border-green-300 bg-green-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2 sm:mb-3">
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <div
                              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base sm:text-xl flex-shrink-0"
                              style={{ backgroundColor: (budget.category.color || '#6B7280') + '20' }}
                            >
                              {budget.category.icon || '📊'}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-gray-900 text-sm sm:text-base truncate">{budget.name}</h4>
                              <p className="text-xs text-gray-500">{budget.category.name}</p>
                            </div>
                          </div>
                          <div className={`text-xs font-semibold px-2 py-1 rounded ${
                            budget.status === 'exceeded' ? 'bg-red-100 text-red-700' :
                            budget.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {budget.status === 'exceeded' ? '✗' : 
                             budget.status === 'warning' ? '!' : '✓'}
                          </div>
                        </div>

                        <div className="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3">
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-600">Orçado</span>
                            <span className="font-semibold">{formatCurrency(budget.amount)}</span>
                          </div>
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-600">Gasto</span>
                            <span className={budget.percentage >= 100 ? 'text-red-600 font-bold' : 'font-semibold'}>
                              {formatCurrency(budget.spent)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-600">Restante</span>
                            <span className={budget.remaining < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-semibold'}>
                              {formatCurrency(Math.abs(budget.remaining))}
                              {budget.remaining < 0 && ' (!)'}
                            </span>
                          </div>
                        </div>

                        <div className="relative w-full h-2 sm:h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              budget.percentage >= 100 ? 'bg-red-500' :
                              budget.percentage >= 90 ? 'bg-yellow-500' :
                              budget.percentage >= 70 ? 'bg-blue-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                          />
                        </div>
                        <div className="text-center mt-1.5 sm:mt-2">
                          <span className={`text-base sm:text-lg font-bold ${
                            budget.percentage >= 100 ? 'text-red-600' :
                            budget.percentage >= 90 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {budget.percentage.toFixed(0)}%
                          </span>
                          <span className="text-[10px] sm:text-xs text-gray-500 ml-1">utilizado</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Gráfico de Pizza - Distribuição por Status - oculto no mobile */}
                  <div className="hidden sm:grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-700 mb-4">Status dos Orçamentos</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <RePieChart>
                          <Pie
                            data={[
                              { name: 'Normal', value: budgetData.filter(b => b.status === 'normal').length, color: '#22C55E' },
                              { name: 'Alerta', value: budgetData.filter(b => b.status === 'warning').length, color: '#EAB308' },
                              { name: 'Excedido', value: budgetData.filter(b => b.status === 'exceeded').length, color: '#EF4444' }
                            ].filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {[
                              { name: 'Normal', value: budgetData.filter(b => b.status === 'normal').length, color: '#22C55E' },
                              { name: 'Alerta', value: budgetData.filter(b => b.status === 'warning').length, color: '#EAB308' },
                              { name: 'Excedido', value: budgetData.filter(b => b.status === 'exceeded').length, color: '#EF4444' }
                            ].filter(d => d.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-700 mb-4">Resumo por Período</h4>
                      <div className="space-y-3">
                        {(() => {
                          const byPeriod = budgetData.reduce((acc, b) => {
                            const periodName = b.period === 'monthly' ? 'Mensal' :
                                               b.period === 'quarterly' ? 'Trimestral' :
                                               b.period === 'semester' ? 'Semestral' : 'Anual';
                            if (!acc[periodName]) acc[periodName] = { count: 0, total: 0, spent: 0 };
                            acc[periodName].count++;
                            acc[periodName].total += b.amount;
                            acc[periodName].spent += b.spent;
                            return acc;
                          }, {} as Record<string, { count: number; total: number; spent: number }>);
                          
                          return Object.entries(byPeriod).map(([period, data]) => (
                            <div key={period} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <div className="font-medium text-gray-900">{period}</div>
                                <div className="text-xs text-gray-500">{data.count} orçamento(s)</div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-gray-900">{formatCurrency(data.total)}</div>
                                <div className="text-xs text-orange-600">{formatCurrency(data.spent)} gasto</div>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
