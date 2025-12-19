'use client';

import { useAuth } from '@/stores/auth';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import TransactionModal from '@/components/NewTransactionModal';
import UnifiedTransactionModal from '@/components/UnifiedTransactionModal';
import { Receipt, Filter, Edit2, Trash2, Calendar, TrendingDown, TrendingUp, CheckCircle, XCircle, Clock, Plus, ArrowLeft, Repeat, CreditCard, ChevronUp, ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react';

interface Transaction {
  id: string;
  amount: string;
  description: string;
  transactionDate: string;
  type: 'income' | 'expense' | 'transfer';
  dueDate?: string; // Para ocorrências
  paidDate?: string; // Data real do pagamento
  isPaidEarly?: boolean;
  isPaidLate?: boolean;
  daysEarlyLate?: number;
  status: string;
  notes?: string;
  categoryId: string;
  bankAccountId: string;
  paymentMethodId?: string;
  isRecurringOccurrence?: boolean; // Flag para identificar ocorrências
  recurringBillId?: string;
  // Campos para parcelas e recorrências
  transactionType?: string; // 'single' | 'recurring' | 'installment'
  parentId?: string | null;
  installmentNumber?: number;
  totalInstallments?: number;
  // Campos para recorrências
  occurrenceNumber?: number;
  totalOccurrences?: number;
  frequency?: string;
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
    type: string;
    currentBalance: number;
    institution?: string;
  };
  paymentMethod?: {
    id: string;
    name: string;
    type: string;
  };
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  level?: number;
  parentId?: string | null;
  parent?: { id: string; name: string; icon?: string } | null;
  children?: Category[];
}

interface BankAccount {
  id: string;
  name: string;
}

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // Ler parâmetros da URL para filtros iniciais
  const urlType = searchParams.get('type') as 'income' | 'expense' | null;
  const urlStatus = searchParams.get('status');
  const urlStartDate = searchParams.get('startDate');
  const urlEndDate = searchParams.get('endDate');
  
  // Filtros de coluna (inline)
  const [columnFilters, setColumnFilters] = useState<{
    categories: string[];
    accounts: string[];
    statuses: string[];
    paymentMethods: string[];
  }>({
    categories: [],
    accounts: [],
    statuses: urlStatus ? [urlStatus] : [],
    paymentMethods: [],
  });
  
  // Popover states
  const [activePopover, setActivePopover] = useState<'category' | 'account' | 'status' | 'paymentMethod' | null>(null);
  const [popoverSearch, setPopoverSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  
  // Fechar popover ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setActivePopover(null);
        setPopoverSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Filtros principais (apenas datas e tipo)
  const [filters, setFilters] = useState({
    startDate: urlStartDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: urlEndDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    type: (urlType || 'all') as 'all' | 'income' | 'expense',
  });
  
  // Estados temporários para os inputs de data (só aplica ao clicar no botão)
  const [tempStartDate, setTempStartDate] = useState(urlStartDate || filters.startDate);
  const [tempEndDate, setTempEndDate] = useState(urlEndDate || filters.endDate);
  
  const handleApplyDateFilter = () => {
    setFilters({ ...filters, startDate: tempStartDate, endDate: tempEndDate });
  };

  // Ordenação
  type SortField = 'date' | 'description' | 'category' | 'account' | 'amount' | 'status';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-[#1F4FD8]" />
      : <ChevronDown className="w-4 h-4 text-[#1F4FD8]" />;
  };

  // Ordenar e filtrar transações
  const filteredAndSortedTransactions = [...transactions]
    // Aplicar filtros de coluna
    .filter(t => {
      // Filtro de categorias
      if (columnFilters.categories.length > 0) {
        if (!t.category || !columnFilters.categories.includes(t.category.id)) {
          return false;
        }
      }
      // Filtro de contas
      if (columnFilters.accounts.length > 0) {
        if (!t.bankAccount || !columnFilters.accounts.includes(t.bankAccount.id)) {
          return false;
        }
      }
      // Filtro de status
      if (columnFilters.statuses.length > 0) {
        if (!columnFilters.statuses.includes(t.status)) {
          return false;
        }
      }
      // Filtro de meios de pagamento
      if (columnFilters.paymentMethods.length > 0) {
        const paymentName = t.paymentMethod?.name || 'Não informado';
        if (!columnFilters.paymentMethods.includes(paymentName)) {
          return false;
        }
      }
      return true;
    })
    // Ordenar
    .sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'date':
        comparison = new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
        break;
      case 'description':
        comparison = a.description.localeCompare(b.description);
        break;
      case 'category':
        comparison = (a.category?.name || '').localeCompare(b.category?.name || '');
        break;
      case 'account':
        comparison = (a.bankAccount?.name || '').localeCompare(b.bankAccount?.name || '');
        break;
      case 'amount':
        comparison = Number(a.amount) - Number(b.amount);
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });
  
  // Obter lista única de meios de pagamento das transações
  const uniquePaymentMethods = [...new Set(transactions.map(t => t.paymentMethod?.name || 'Não informado'))].sort();
  
  // Contar filtros ativos
  const activeFiltersCount = columnFilters.categories.length + columnFilters.accounts.length + columnFilters.statuses.length + columnFilters.paymentMethods.length;
  
  // Limpar todos os filtros de coluna
  const clearAllColumnFilters = () => {
    setColumnFilters({ categories: [], accounts: [], statuses: [], paymentMethods: [] });
  };

  // Verificar se há data na URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    
    if (dateParam) {
      // Filtrar pelo dia específico
      setFilters(prev => ({
        ...prev,
        startDate: dateParam,
        endDate: dateParam
      }));
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    loadData();
  }, [filters, isAuthenticated]);

  const loadData = async () => {
    try {
      setLoading(true);

      const params: any = {
        startDate: filters.startDate,
        endDate: filters.endDate,
      };

      if (filters.type !== 'all') params.type = filters.type;

      // Buscar transações realizadas + ocorrências pendentes
      const [transactionsRes, occurrencesRes, categoriesRes, accountsRes] = await Promise.all([
        api.get('/transactions', { params }),
        api.get('/recurring-bills/occurrences', { params }),
        api.get('/categories?isActive=true'),
        api.get('/bank-accounts?isActive=true'),
      ]);

      // Combinar transações com ocorrências de recorrências
      const transactionsList = transactionsRes.data.data.transactions || [];
      const occurrencesList = occurrencesRes.data.data?.occurrences || [];

      // Mapear ocorrências PENDENTES para formato de transação (ignorar as já pagas)
      const mappedOccurrences = occurrencesList
        .filter((occ: any) => occ.status === 'pending') // ✅ Só mostrar pendentes
        .map((occ: any) => ({
          id: occ.id,
          amount: occ.amount.toString(),
          description: occ.recurringBill?.name || 'Recorrência',
          transactionDate: occ.dueDate,
          dueDate: occ.dueDate,
          status: occ.status,
          notes: occ.notes,
          categoryId: occ.recurringBill?.categoryId,
          bankAccountId: occ.recurringBill?.bankAccountId,
          paymentMethodId: occ.recurringBill?.paymentMethodId,
          isRecurringOccurrence: true,
          recurringBillId: occ.recurringBillId,
          category: occ.recurringBill?.category || { id: '', name: 'Sem categoria', type: 'expense', icon: '❓', color: '#999' },
          bankAccount: occ.recurringBill?.bankAccount || { id: '', name: 'Sem conta', type: 'bank', currentBalance: 0 },
          paymentMethod: occ.recurringBill?.paymentMethod,
          createdAt: occ.createdAt,
      }));

      // Combinar e ordenar por data
      const allTransactions = [...transactionsList, ...mappedOccurrences].sort((a, b) => {
        const dateA = new Date(a.dueDate || a.transactionDate).getTime();
        const dateB = new Date(b.dueDate || b.transactionDate).getTime();
        return dateB - dateA;
      });

      setTransactions(allTransactions);
      setCategories(categoriesRes.data.data.categories || []);
      setBankAccounts(accountsRes.data.data.accounts || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;

    try {
      await api.delete(`/transactions/${id}`);
      toast.success('Transação excluída com sucesso!');
      loadData();
    } catch (error: any) {
      console.error('Erro ao excluir transação:', error);
      toast.error('Erro ao excluir transação');
    }
  };

  const togglePaidStatus = async (transaction: Transaction) => {
    try {
      // Se for ocorrência de recorrência, usar endpoint específico
      if (transaction.isRecurringOccurrence && transaction.recurringBillId) {
        await api.post(`/recurring-bills/${transaction.recurringBillId}/occurrences/${transaction.id}/pay`, {
          paidDate: new Date().toISOString(),
          paidAmount: transaction.amount,
        });
        toast.success('Recorrência paga com sucesso!');
      } else {
        // Transação normal
        const newStatus = transaction.status === 'completed' ? 'pending' : 'completed';
        await api.put(`/transactions/${transaction.id}`, {
          status: newStatus,
        });
        toast.success(`Status alterado para ${newStatus === 'completed' ? 'Pago' : 'Pendente'}`);
      }
      
      loadData();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingTransaction(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingTransaction(null);
  };

  const handleModalSuccess = () => {
    loadData();
  };

  const handleUnifiedModalSuccess = () => {
    loadData();
    setShowUnifiedModal(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    // Parse date string as local date to avoid timezone issues
    const dateOnly = dateString.split('T')[0];
    const [year, month, day] = dateOnly.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
  };

  const getTotals = () => {
    // Usar o type da transação, ou fallback para o sinal do amount
    // Transferências são neutras (não afetam receita nem despesa total)
    const getTransactionType = (t: any) => {
      if (t.type === 'transfer') return 'transfer';
      if (t.type === 'income') return 'income';
      if (t.type === 'expense') return 'expense';
      // Fallback: usar categoria se disponível
      if (t.category?.type) return t.category.type;
      // Último fallback: usar sinal do amount
      return Number(t.amount) >= 0 ? 'income' : 'expense';
    };

    // Receitas realizadas (completadas) - excluindo transferências
    const completedIncome = transactions
      .filter(t => getTransactionType(t) === 'income' && t.status === 'completed')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    
    // Receitas pendentes
    const pendingIncome = transactions
      .filter(t => getTransactionType(t) === 'income' && t.status === 'pending')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    
    // Despesas realizadas (completadas) - excluindo transferências
    const completedExpense = transactions
      .filter(t => getTransactionType(t) === 'expense' && t.status === 'completed')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    
    // Despesas pendentes
    const pendingExpense = transactions
      .filter(t => getTransactionType(t) === 'expense' && t.status === 'pending')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const totalIncome = completedIncome + pendingIncome;
    const totalExpense = completedExpense + pendingExpense;
    const realizedBalance = completedIncome - completedExpense;
    const projectedBalance = totalIncome - totalExpense;

    return { 
      income: totalIncome, 
      expense: totalExpense, 
      balance: projectedBalance,
      completedIncome,
      pendingIncome,
      completedExpense,
      pendingExpense,
      realizedBalance
    };
  };

  const totals = getTotals();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1F4FD8] mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando transações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Voltar ao Dashboard"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                <Receipt className="w-8 h-8" />
                Histórico de Transações
              </h1>
              <p className="text-gray-600 mt-1">
                {filteredAndSortedTransactions.length === transactions.length 
                  ? `${transactions.length} transações encontradas`
                  : `${filteredAndSortedTransactions.length} de ${transactions.length} transações`
                }
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAddNew}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              title="Transação simples"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Simples</span>
            </button>
            <button
              onClick={() => setShowUnifiedModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-[#1F4FD8] to-[#1A44BF] text-white rounded-lg hover:from-[#1A44BF] hover:to-[#1539A6] transition-all flex items-center gap-2 shadow-md"
              title="Nova transação com opções avançadas"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Nova Transação</span>
            </button>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 font-medium">Receitas</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.income)}</p>
                {totals.pendingIncome > 0 && (
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-green-700">Realizado: {formatCurrency(totals.completedIncome)}</span>
                    <span className="text-gray-500">Pendente: {formatCurrency(totals.pendingIncome)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-red-100 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 font-medium">Despesas</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.expense)}</p>
                {totals.pendingExpense > 0 && (
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-red-700">Realizado: {formatCurrency(totals.completedExpense)}</span>
                    <span className="text-gray-500">Pendente: {formatCurrency(totals.pendingExpense)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-[#DBEAFE] rounded-lg">
                <Receipt className="w-6 h-6 text-[#1F4FD8]" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 font-medium">Saldo</p>
                <p className={`text-2xl font-bold ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totals.balance)}
                </p>
                {(totals.pendingIncome > 0 || totals.pendingExpense > 0) && (
                  <div className="text-xs mt-1">
                    <span className={totals.realizedBalance >= 0 ? 'text-green-700' : 'text-red-700'}>
                      Realizado: {formatCurrency(totals.realizedBalance)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Barra de filtros compacta */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <input
              type="date"
              value={tempStartDate}
              onChange={(e) => setTempStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-transparent text-sm"
              title="Data inicial"
            />
            <span className="text-gray-400">até</span>
            <input
              type="date"
              value={tempEndDate}
              onChange={(e) => setTempEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-transparent text-sm"
              title="Data final"
            />
            <button
              onClick={handleApplyDateFilter}
              className="px-3 py-2 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] text-sm font-medium"
              title="Aplicar filtro de data"
            >
              Filtrar
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-transparent text-sm"
              title="Tipo"
            >
              <option value="all">Todos os tipos</option>
              <option value="income">Receitas</option>
              <option value="expense">Despesas</option>
            </select>
          </div>
          
          {/* Indicador de filtros ativos */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-[#1F4FD8] font-medium">
                {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''} ativo{activeFiltersCount > 1 ? 's' : ''}
              </span>
              <button
                onClick={clearAllColumnFilters}
                className="px-3 py-1 text-sm bg-[#DBEAFE] text-[#1A44BF] rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Limpar
              </button>
            </div>
          )}
        </div>

        {/* Lista de Transações */}
        <div className="bg-white rounded-lg shadow-md" style={{ minHeight: '400px' }}>
          {transactions.length > 0 ? (
            <div className="overflow-x-auto" style={{ overflow: 'visible' }}>
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      onClick={() => handleSort('date')}
                    >
                      <div className="flex items-center gap-1">
                        Data
                        <SortIcon field="date" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      onClick={() => handleSort('description')}
                    >
                      <div className="flex items-center gap-1">
                        Descrição
                        <SortIcon field="description" />
                      </div>
                    </th>
                    
                    {/* Categoria com filtro inline */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative">
                      <div className="flex items-center gap-2">
                        <div 
                          className="flex items-center gap-1 cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('category')}
                        >
                          Categoria
                          <SortIcon field="category" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePopover(activePopover === 'category' ? null : 'category');
                            setPopoverSearch('');
                          }}
                          className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                            columnFilters.categories.length > 0 ? 'text-[#1F4FD8] bg-[#DBEAFE]' : 'text-gray-400'
                          }`}
                          title="Filtrar categorias"
                        >
                          <Filter className="w-4 h-4" />
                          {columnFilters.categories.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#1F4FD8] text-white text-[10px] rounded-full flex items-center justify-center">
                              {columnFilters.categories.length}
                            </span>
                          )}
                        </button>
                      </div>
                      
                      {/* Popover de filtro */}
                      {activePopover === 'category' && (
                        <div 
                          ref={popoverRef}
                          className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-fadeIn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-3 border-b border-gray-100">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Buscar categoria..."
                                value={popoverSearch}
                                onChange={(e) => setPopoverSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1F4FD8] focus:border-transparent"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-64 overflow-y-auto p-2">
                            {/* Organizar categorias hierarquicamente */}
                            {(() => {
                              // Filtrar categorias pela busca
                              const filteredCategories = categories.filter(c => 
                                c.name.toLowerCase().includes(popoverSearch.toLowerCase())
                              );
                              
                              // Se está buscando, mostrar lista flat filtrada
                              if (popoverSearch.trim()) {
                                return filteredCategories.sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
                                  <label
                                    key={cat.id}
                                    className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={columnFilters.categories.includes(cat.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setColumnFilters(prev => ({
                                            ...prev,
                                            categories: [...prev.categories, cat.id]
                                          }));
                                        } else {
                                          setColumnFilters(prev => ({
                                            ...prev,
                                            categories: prev.categories.filter(id => id !== cat.id)
                                          }));
                                        }
                                      }}
                                      className="w-4 h-4 text-[#1F4FD8] rounded border-gray-300 focus:ring-[#1F4FD8]"
                                    />
                                    <span className="text-sm">{cat.icon}</span>
                                    <span className="text-sm text-gray-700">
                                      {cat.parent ? `${cat.parent.name} > ${cat.name}` : cat.name}
                                    </span>
                                  </label>
                                ));
                              }
                              
                              // Separar por níveis
                              const level1 = categories.filter(c => c.level === 1 || (!c.level && !c.parentId));
                              
                              // Renderizar hierarquia
                              return level1.sort((a, b) => a.name.localeCompare(b.name)).map(l1 => {
                                // Filhos de L1 (level 2)
                                const l1Children = categories.filter(c => c.parentId === l1.id);
                                
                                return (
                                  <div key={l1.id} className="mb-1">
                                    {/* Categoria L1 */}
                                    <label
                                      className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer font-medium"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={columnFilters.categories.includes(l1.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setColumnFilters(prev => ({
                                              ...prev,
                                              categories: [...prev.categories, l1.id]
                                            }));
                                          } else {
                                            setColumnFilters(prev => ({
                                              ...prev,
                                              categories: prev.categories.filter(id => id !== l1.id)
                                            }));
                                          }
                                        }}
                                        className="w-4 h-4 text-[#1F4FD8] rounded border-gray-300 focus:ring-[#1F4FD8]"
                                      />
                                      <span className="text-sm">{l1.icon}</span>
                                      <span className="text-sm text-gray-700">{l1.name}</span>
                                    </label>
                                    
                                    {/* Subcategorias L2 */}
                                    {l1Children.sort((a, b) => a.name.localeCompare(b.name)).map(l2 => {
                                      // Filhos de L2 (level 3)
                                      const l2Children = categories.filter(c => c.parentId === l2.id);
                                      
                                      return (
                                        <div key={l2.id}>
                                          <label
                                            className="flex items-center gap-2 px-2 py-1.5 ml-4 hover:bg-gray-50 rounded-lg cursor-pointer text-gray-600"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={columnFilters.categories.includes(l2.id)}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setColumnFilters(prev => ({
                                                    ...prev,
                                                    categories: [...prev.categories, l2.id]
                                                  }));
                                                } else {
                                                  setColumnFilters(prev => ({
                                                    ...prev,
                                                    categories: prev.categories.filter(id => id !== l2.id)
                                                  }));
                                                }
                                              }}
                                              className="w-4 h-4 text-[#1F4FD8] rounded border-gray-300 focus:ring-[#1F4FD8]"
                                            />
                                            <span className="text-sm">{l2.icon}</span>
                                            <span className="text-sm">{l2.name}</span>
                                          </label>
                                          
                                          {/* Subcategorias L3 */}
                                          {l2Children.sort((a, b) => a.name.localeCompare(b.name)).map(l3 => (
                                            <label
                                              key={l3.id}
                                              className="flex items-center gap-2 px-2 py-1 ml-8 hover:bg-gray-50 rounded-lg cursor-pointer text-gray-500 text-xs"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={columnFilters.categories.includes(l3.id)}
                                                onChange={(e) => {
                                                  if (e.target.checked) {
                                                    setColumnFilters(prev => ({
                                                      ...prev,
                                                      categories: [...prev.categories, l3.id]
                                                    }));
                                                  } else {
                                                    setColumnFilters(prev => ({
                                                      ...prev,
                                                      categories: prev.categories.filter(id => id !== l3.id)
                                                    }));
                                                  }
                                                }}
                                                className="w-3 h-3 text-[#1F4FD8] rounded border-gray-300 focus:ring-[#1F4FD8]"
                                              />
                                              <span className="text-xs">{l3.icon}</span>
                                              <span className="text-xs">{l3.name}</span>
                                            </label>
                                          ))}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              });
                            })()}
                            {categories.filter(c => c.name.toLowerCase().includes(popoverSearch.toLowerCase())).length === 0 && (
                              <p className="text-sm text-gray-500 text-center py-2">Nenhuma categoria encontrada</p>
                            )}
                          </div>
                          {columnFilters.categories.length > 0 && (
                            <div className="p-2 border-t border-gray-100">
                              <button
                                onClick={() => setColumnFilters(prev => ({ ...prev, categories: [] }))}
                                className="w-full px-3 py-2 text-sm text-[#1F4FD8] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                              >
                                Limpar seleção
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </th>
                    
                    {/* Conta com filtro inline */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative">
                      <div className="flex items-center gap-2">
                        <div 
                          className="flex items-center gap-1 cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('account')}
                        >
                          Conta
                          <SortIcon field="account" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePopover(activePopover === 'account' ? null : 'account');
                            setPopoverSearch('');
                          }}
                          className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                            columnFilters.accounts.length > 0 ? 'text-[#1F4FD8] bg-[#DBEAFE]' : 'text-gray-400'
                          }`}
                          title="Filtrar contas"
                        >
                          <Filter className="w-4 h-4" />
                          {columnFilters.accounts.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#1F4FD8] text-white text-[10px] rounded-full flex items-center justify-center">
                              {columnFilters.accounts.length}
                            </span>
                          )}
                        </button>
                      </div>
                      
                      {/* Popover de filtro */}
                      {activePopover === 'account' && (
                        <div 
                          ref={popoverRef}
                          className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-fadeIn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-3 border-b border-gray-100">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Buscar conta..."
                                value={popoverSearch}
                                onChange={(e) => setPopoverSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1F4FD8] focus:border-transparent"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto p-2">
                            {bankAccounts
                              .filter(acc => acc.name.toLowerCase().includes(popoverSearch.toLowerCase()))
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(acc => (
                                <label
                                  key={acc.id}
                                  className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={columnFilters.accounts.includes(acc.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setColumnFilters(prev => ({
                                          ...prev,
                                          accounts: [...prev.accounts, acc.id]
                                        }));
                                      } else {
                                        setColumnFilters(prev => ({
                                          ...prev,
                                          accounts: prev.accounts.filter(id => id !== acc.id)
                                        }));
                                      }
                                    }}
                                    className="w-4 h-4 text-[#1F4FD8] rounded border-gray-300 focus:ring-[#1F4FD8]"
                                  />
                                  <span className="text-sm text-gray-700">{acc.name}</span>
                                </label>
                              ))}
                            {bankAccounts.filter(acc => acc.name.toLowerCase().includes(popoverSearch.toLowerCase())).length === 0 && (
                              <p className="text-sm text-gray-500 text-center py-2">Nenhuma conta encontrada</p>
                            )}
                          </div>
                          {columnFilters.accounts.length > 0 && (
                            <div className="p-2 border-t border-gray-100">
                              <button
                                onClick={() => setColumnFilters(prev => ({ ...prev, accounts: [] }))}
                                className="w-full px-3 py-2 text-sm text-[#1F4FD8] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                              >
                                Limpar seleção
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </th>
                    
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      onClick={() => handleSort('amount')}
                    >
                      <div className="flex items-center gap-1">
                        Valor
                        <SortIcon field="amount" />
                      </div>
                    </th>
                    
                    {/* Status com filtro inline */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative">
                      <div className="flex items-center gap-2">
                        <div 
                          className="flex items-center gap-1 cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('status')}
                        >
                          Status
                          <SortIcon field="status" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePopover(activePopover === 'status' ? null : 'status');
                          }}
                          className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                            columnFilters.statuses.length > 0 ? 'text-[#1F4FD8] bg-[#DBEAFE]' : 'text-gray-400'
                          }`}
                          title="Filtrar status"
                        >
                          <Filter className="w-4 h-4" />
                          {columnFilters.statuses.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#1F4FD8] text-white text-[10px] rounded-full flex items-center justify-center">
                              {columnFilters.statuses.length}
                            </span>
                          )}
                        </button>
                      </div>
                      
                      {/* Popover de filtro */}
                      {activePopover === 'status' && (
                        <div 
                          ref={popoverRef}
                          className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-fadeIn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-2">
                            <label className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={columnFilters.statuses.includes('completed')}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setColumnFilters(prev => ({
                                      ...prev,
                                      statuses: [...prev.statuses, 'completed']
                                    }));
                                  } else {
                                    setColumnFilters(prev => ({
                                      ...prev,
                                      statuses: prev.statuses.filter(s => s !== 'completed')
                                    }));
                                  }
                                }}
                                className="w-4 h-4 text-[#1F4FD8] rounded border-gray-300 focus:ring-[#1F4FD8]"
                              />
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-gray-700">Pago</span>
                            </label>
                            <label className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={columnFilters.statuses.includes('pending')}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setColumnFilters(prev => ({
                                      ...prev,
                                      statuses: [...prev.statuses, 'pending']
                                    }));
                                  } else {
                                    setColumnFilters(prev => ({
                                      ...prev,
                                      statuses: prev.statuses.filter(s => s !== 'pending')
                                    }));
                                  }
                                }}
                                className="w-4 h-4 text-[#1F4FD8] rounded border-gray-300 focus:ring-[#1F4FD8]"
                              />
                              <Clock className="w-4 h-4 text-yellow-600" />
                              <span className="text-sm text-gray-700">Pendente</span>
                            </label>
                          </div>
                          {columnFilters.statuses.length > 0 && (
                            <div className="p-2 border-t border-gray-100">
                              <button
                                onClick={() => setColumnFilters(prev => ({ ...prev, statuses: [] }))}
                                className="w-full px-3 py-2 text-sm text-[#1F4FD8] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                              >
                                Limpar seleção
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </th>
                    
                    {/* Meio de Pagamento com filtro inline */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative">
                      <div className="flex items-center gap-2">
                        <span>Pagamento</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePopover(activePopover === 'paymentMethod' ? null : 'paymentMethod');
                            setPopoverSearch('');
                          }}
                          className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                            columnFilters.paymentMethods.length > 0 ? 'text-[#1F4FD8] bg-[#DBEAFE]' : 'text-gray-400'
                          }`}
                          title="Filtrar meio de pagamento"
                        >
                          <Filter className="w-4 h-4" />
                          {columnFilters.paymentMethods.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#1F4FD8] text-white text-[10px] rounded-full flex items-center justify-center">
                              {columnFilters.paymentMethods.length}
                            </span>
                          )}
                        </button>
                      </div>
                      
                      {/* Popover de filtro */}
                      {activePopover === 'paymentMethod' && (
                        <div 
                          ref={popoverRef}
                          className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-fadeIn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Buscar..."
                                value={popoverSearch}
                                onChange={(e) => setPopoverSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4FD8]"
                                aria-label="Buscar meio de pagamento"
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto p-2">
                            {uniquePaymentMethods
                              .filter(pm => pm.toLowerCase().includes(popoverSearch.toLowerCase()))
                              .map((pm) => (
                                <label key={pm} className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={columnFilters.paymentMethods.includes(pm)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setColumnFilters(prev => ({
                                          ...prev,
                                          paymentMethods: [...prev.paymentMethods, pm]
                                        }));
                                      } else {
                                        setColumnFilters(prev => ({
                                          ...prev,
                                          paymentMethods: prev.paymentMethods.filter(p => p !== pm)
                                        }));
                                      }
                                    }}
                                    className="w-4 h-4 text-[#1F4FD8] rounded border-gray-300 focus:ring-[#1F4FD8]"
                                  />
                                  <CreditCard className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm text-gray-700 truncate">{pm}</span>
                                </label>
                              ))}
                            {uniquePaymentMethods.filter(pm => pm.toLowerCase().includes(popoverSearch.toLowerCase())).length === 0 && (
                              <p className="text-sm text-gray-500 text-center py-2">Nenhum encontrado</p>
                            )}
                          </div>
                          {columnFilters.paymentMethods.length > 0 && (
                            <div className="p-2 border-t border-gray-100">
                              <button
                                onClick={() => setColumnFilters(prev => ({ ...prev, paymentMethods: [] }))}
                                className="w-full px-3 py-2 text-sm text-[#1F4FD8] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                              >
                                Limpar seleção
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </th>
                    
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {formatDate(transaction.transactionDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex flex-col gap-1">
                          <p className="font-medium text-gray-800">{transaction.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {transaction.isRecurringOccurrence && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 w-fit">
                                <Clock className="w-3 h-3" />
                                Recorrência
                              </span>
                            )}
                            {transaction.isPaidEarly && transaction.daysEarlyLate && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 w-fit">
                                ⏰ Antecipado ({transaction.daysEarlyLate}d)
                              </span>
                            )}
                            {transaction.isPaidLate && transaction.daysEarlyLate && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 w-fit">
                                ⚠️ Atrasado ({transaction.daysEarlyLate}d)
                              </span>
                            )}
                          </div>
                          {transaction.notes && (
                            <p className="text-xs text-gray-500 mt-1">{transaction.notes}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          {transaction.category ? (
                            <>
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: transaction.category.color }}
                              />
                              <span>{transaction.category.icon}</span>
                              <span>{transaction.category.name}</span>
                            </>
                          ) : (
                            <span className="text-gray-400 italic">Sem categoria</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {transaction.bankAccount?.name || 'Não informada'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                        {(() => {
                          const amount = Number(transaction.amount);
                          // Para transferências, usar o sinal do valor
                          if (transaction.type === 'transfer') {
                            const isPositive = amount >= 0;
                            return (
                              <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                                {isPositive ? '' : '- '}{formatCurrency(Math.abs(amount))}
                              </span>
                            );
                          }
                          // Para income/expense, usar o type
                          const isIncome = transaction.type === 'income' || transaction.category?.type === 'income';
                          return (
                            <span className={isIncome ? 'text-green-600' : 'text-red-600'}>
                              {isIncome ? '' : '- '}{formatCurrency(Math.abs(amount))}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => togglePaidStatus(transaction)}
                          className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-colors hover:opacity-80 ${
                            transaction.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {transaction.status === 'completed' ? (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              Paga
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              Pendente
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-gray-400" />
                          <span>{transaction.paymentMethod?.name || 'Não informado'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {!transaction.isRecurringOccurrence && (
                            <>
                              <button
                                onClick={() => handleEdit(transaction)}
                                className="p-2 hover:bg-[#DBEAFE] rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4 text-[#1F4FD8]" />
                              </button>
                              <button
                                onClick={() => handleDelete(transaction.id)}
                                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </>
                          )}
                          {transaction.isRecurringOccurrence && transaction.status === 'pending' && (
                            <button
                              onClick={() => togglePaidStatus(transaction)}
                              className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
                            >
                              Pagar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Nenhuma transação encontrada</p>
              <p className="text-gray-400 text-sm mt-2">Ajuste os filtros ou adicione novas transações</p>
              <button
                onClick={() => setShowUnifiedModal(true)}
                className="mt-4 px-6 py-3 bg-gradient-to-r from-[#1F4FD8] to-[#1A44BF] text-white rounded-lg hover:from-[#1A44BF] hover:to-[#1539A6] transition-all inline-flex items-center gap-2 shadow-md"
              >
                <Plus className="w-5 h-5" />
                Adicionar Primeira Transação
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Transação Simples */}
      <TransactionModal
        isOpen={showModal}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        transaction={editingTransaction}
      />

      {/* Modal de Transação Unificado (Única/Recorrente/Parcelada) */}
      <UnifiedTransactionModal
        isOpen={showUnifiedModal}
        onClose={() => setShowUnifiedModal(false)}
        onSuccess={handleUnifiedModalSuccess}
      />
    </div>
  );
}
