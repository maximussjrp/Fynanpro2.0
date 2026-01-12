'use client';

import { useAuth } from '@/stores/auth';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import EditTransactionModal from '@/components/NewTransactionModal';
import CreateTransactionModal from '@/components/UnifiedTransactionModal';
import { Receipt, Filter, Edit2, Trash2, Calendar, TrendingDown, TrendingUp, CheckCircle, XCircle, Clock, Plus, ArrowLeft, ChevronUp, ChevronDown, Check } from 'lucide-react';

interface Transaction {
  id: string;
  amount: string;
  description: string;
  type: 'income' | 'expense';
  transactionDate: string;
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
  parentId?: string; // ID do template pai (para transações filhas de recorrentes/parcelamentos)
  frequency?: string; // Frequência da recorrência (daily, weekly, monthly, yearly)
  transactionType?: 'single' | 'recurring' | 'installment'; // Tipo de transação
  installmentNumber?: number; // Número da parcela atual
  totalInstallments?: number; // Total de parcelas
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
}

interface BankAccount {
  id: string;
  name: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
}

export default function TransactionsPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Ordenação e Filtros por Coluna
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<{
    categories: string[];
    accounts: string[];
    paymentMethods: string[];
    statuses: string[];
  }>({
    categories: [],
    accounts: [],
    paymentMethods: [],
    statuses: [],
  });
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Filtros
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    categoryId: '',
    bankAccountId: '',
    paymentMethodId: '',
    type: 'all' as 'all' | 'income' | 'expense',
    status: 'all' as 'all' | 'completed' | 'pending',
  });

  // Verificar se há parâmetros na URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    const typeParam = urlParams.get('type');
    const statusParam = urlParams.get('status');
    const startDateParam = urlParams.get('startDate');
    const endDateParam = urlParams.get('endDate');
    
    if (dateParam || typeParam || statusParam || startDateParam || endDateParam) {
      // Data de hoje formatada
      const today = new Date().toISOString().split('T')[0];
      
      setFilters(prev => ({
        ...prev,
        // Se tiver date específico, usa como start e end
        ...(dateParam && { startDate: dateParam, endDate: dateParam }),
        // Se tiver startDate e endDate, usa eles
        ...(startDateParam && { startDate: startDateParam }),
        ...(endDateParam && { endDate: endDateParam }),
        // Tipo: INCOME ou EXPENSE
        ...(typeParam && { type: typeParam.toLowerCase() as 'all' | 'income' | 'expense' }),
        // Status: completed ou pending (se for overdue, deixa all para filtrar por coluna)
        ...(statusParam && statusParam !== 'overdue' && { status: statusParam.toLowerCase() as 'all' | 'completed' | 'pending' })
      }));
      
      // Se status for overdue, aplicar filtro de coluna
      if (statusParam === 'overdue') {
        setColumnFilters(prev => ({ ...prev, statuses: ['overdue'] }));
      }
      
      setShowFilters(true);
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

      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.bankAccountId) params.bankAccountId = filters.bankAccountId;
      if (filters.paymentMethodId) params.paymentMethodId = filters.paymentMethodId;
      if (filters.type !== 'all') params.type = filters.type;
      if (filters.status !== 'all') params.status = filters.status;

      // Buscar transações realizadas + ocorrências pendentes
      const [transactionsRes, occurrencesRes, categoriesRes, accountsRes, paymentMethodsRes] = await Promise.all([
        api.get('/transactions', { params }),
        api.get('/recurring-bills/occurrences', { params }),
        api.get('/categories?isActive=true'),
        api.get('/bank-accounts?isActive=true'),
        api.get('/payment-methods?isActive=true'),
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

      // Combinar listas
      const combined = [...transactionsList, ...mappedOccurrences];
      
      // Remover duplicatas: se uma transação tem parentId, ela é filha de recorrente
      // e NÃO deve aparecer como occurrence também
      const uniqueTransactions = combined.reduce((acc: Transaction[], curr) => {
        // Se for occurrence, verificar se já existe uma transaction com mesmo ID ou mesma data+descrição
        if (curr.isRecurringOccurrence) {
          const isDuplicate = acc.some(t => 
            // Mesmo ID
            t.id === curr.id ||
            // Ou mesma data + descrição (transação filha já existe)
            (t.description === curr.description && 
             new Date(t.transactionDate).toDateString() === new Date(curr.transactionDate).toDateString())
          );
          
          if (!isDuplicate) {
            acc.push(curr);
          }
        } else {
          // Transações normais sempre adicionar
          acc.push(curr);
        }
        return acc;
      }, []);
      
      // Ordenar por data
      const allTransactions = uniqueTransactions.sort((a, b) => {
        const dateA = new Date(a.dueDate || a.transactionDate).getTime();
        const dateB = new Date(b.dueDate || b.transactionDate).getTime();
        return dateB - dateA;
      });

      setTransactions(allTransactions);
      setCategories(categoriesRes.data.data.categories || []);
      setBankAccounts(accountsRes.data.data.accounts || []);
      setPaymentMethods(paymentMethodsRes.data.data.paymentMethods || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    try {
      // Verificar se é uma transação recorrente (tem frequency ou parentId com transactionType = recurring)
      const isRecurring = transaction.frequency || (transaction.parentId && transaction.transactionType === 'recurring');
      
      // Verificar se é parcelamento (tem parentId com transactionType = installment ou installmentNumber)
      const isInstallment = (transaction.parentId && transaction.transactionType === 'installment') || 
                           (transaction.installmentNumber && transaction.totalInstallments);
      
      if (isRecurring || isInstallment) {
        // Para recorrentes/parcelamentos, usar o parentId se existir, senão usar o próprio id (é o template)
        const parentId = transaction.parentId || transaction.id;
        const typeLabel = isInstallment ? 'parcelamento' : 'recorrência';
        
        // Verificar se há transações pagas
        const checkResponse = await api.get(`/transactions/${parentId}/check-paid`);
        const hasPaidTransactions = checkResponse.data.data?.hasPaidTransactions || false;
        
        if (hasPaidTransactions) {
          // Mostrar modal perguntando o que fazer
          const deleteAll = confirm(
            `Este ${typeLabel} possui transações pagas. Deseja excluir:\n\n` +
            'OK = Todas (incluindo pagas)\n' +
            'Cancelar = Apenas as pendentes'
          );
          
          const deleteMode = deleteAll ? 'all' : 'pending';
          await api.delete(`/transactions/${parentId}?cascade=true&deleteMode=${deleteMode}`);
          
          if (deleteMode === 'all') {
            toast.success(`Todas as transações do ${typeLabel} foram excluídas!`);
          } else {
            toast.success('Transações pendentes excluídas. As pagas foram mantidas.');
          }
        } else {
          // Sem transações pagas, apenas confirmar exclusão
          if (!confirm(`Tem certeza que deseja excluir todas as ${isInstallment ? 'parcelas deste parcelamento' : 'ocorrências desta recorrência'}?`)) return;
          
          await api.delete(`/transactions/${parentId}?cascade=true&deleteMode=all`);
          toast.success(`${isInstallment ? 'Parcelamento' : 'Recorrência'} excluído(a) com sucesso!`);
        }
      } else {
        // Transação normal
        if (!confirm('Tem certeza que deseja excluir esta transação?')) return;
        await api.delete(`/transactions/${transaction.id}`);
        toast.success('Transação excluída com sucesso!');
      }
      
      loadData();
    } catch (error: any) {
      console.error('Erro ao excluir transação:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao excluir transação');
    }
  };

  const togglePaidStatus = async (transaction: Transaction) => {
    try {
      // Se for ocorrência do modelo ANTIGO (RecurringBillOccurrence), usar endpoint específico
      // Identificamos pelo campo isRecurringOccurrence que vem do mapeamento de /recurring-bills/occurrences
      if (transaction.isRecurringOccurrence && transaction.recurringBillId && !transaction.parentId) {
        await api.post(`/recurring-bills/${transaction.recurringBillId}/occurrences/${transaction.id}/pay`, {
          paidDate: new Date().toISOString(),
          paidAmount: transaction.amount,
        });
        toast.success('Recorrência paga com sucesso!');
      } else {
        // Transação normal ou transação do modelo NOVO (com parentId)
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
    setIsCreating(false);
    setEditingTransaction(transaction);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setIsCreating(true);
    setEditingTransaction(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingTransaction(null);
    setIsCreating(false);
  };

  const handleModalSuccess = () => {
    loadData();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getTotals = () => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return { income, expense, balance: income - expense };
  };

  const totals = getTotals();

  // Função para ordenar
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Função para toggle de filtro checkbox
  const toggleColumnFilter = (filterType: 'categories' | 'accounts' | 'paymentMethods' | 'statuses', value: string) => {
    setColumnFilters(prev => {
      const current = prev[filterType];
      if (current.includes(value)) {
        return { ...prev, [filterType]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [filterType]: [...current, value] };
      }
    });
  };

  // Selecionar/Deselecionar todos
  const toggleAllColumnFilter = (filterType: 'categories' | 'accounts' | 'paymentMethods' | 'statuses', allValues: string[]) => {
    setColumnFilters(prev => {
      if (prev[filterType].length === allValues.length) {
        return { ...prev, [filterType]: [] };
      } else {
        return { ...prev, [filterType]: allValues };
      }
    });
  };

  // Limpar filtro de coluna
  const clearColumnFilter = (filterType: 'categories' | 'accounts' | 'paymentMethods' | 'statuses') => {
    setColumnFilters(prev => ({ ...prev, [filterType]: [] }));
  };

  // Obter valores únicos para filtros
  const uniqueCategories = [...new Map(transactions.map(t => [t.category?.id, t.category])).values()].filter(Boolean);
  const uniqueAccounts = [...new Map(transactions.map(t => [t.bankAccount?.id, t.bankAccount])).values()].filter(Boolean);
  const uniquePaymentMethods = [...new Map(transactions.map(t => [t.paymentMethod?.id, t.paymentMethod])).values()].filter(Boolean);
  const uniqueStatuses = [
    { id: 'completed', name: 'Paga' },
    { id: 'pending', name: 'Pendente' },
    { id: 'overdue', name: 'Atrasado' },
  ];

  // Aplicar filtros e ordenação
  const getFilteredAndSortedTransactions = () => {
    let result = [...transactions];

    // Aplicar filtros de checkbox
    if (columnFilters.categories.length > 0) {
      result = result.filter(t => columnFilters.categories.includes(t.category?.id || ''));
    }
    if (columnFilters.accounts.length > 0) {
      result = result.filter(t => columnFilters.accounts.includes(t.bankAccount?.id || ''));
    }
    if (columnFilters.paymentMethods.length > 0) {
      result = result.filter(t => columnFilters.paymentMethods.includes(t.paymentMethod?.id || ''));
    }
    if (columnFilters.statuses.length > 0) {
      result = result.filter(t => {
        const isOverdue = t.status !== 'completed' && 
          new Date(t.dueDate || t.transactionDate) < new Date(new Date().setHours(0, 0, 0, 0));
        const statusId = t.status === 'completed' ? 'completed' : (isOverdue ? 'overdue' : 'pending');
        return columnFilters.statuses.includes(statusId);
      });
    }

    // Aplicar ordenação
    if (sortConfig) {
      result.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'date':
            aValue = new Date(a.dueDate || a.transactionDate).getTime();
            bValue = new Date(b.dueDate || b.transactionDate).getTime();
            break;
          case 'description':
            aValue = a.description.toLowerCase();
            bValue = b.description.toLowerCase();
            break;
          case 'category':
            aValue = a.category?.name?.toLowerCase() || '';
            bValue = b.category?.name?.toLowerCase() || '';
            break;
          case 'account':
            aValue = a.bankAccount?.name?.toLowerCase() || '';
            bValue = b.bankAccount?.name?.toLowerCase() || '';
            break;
          case 'paymentMethod':
            aValue = a.paymentMethod?.name?.toLowerCase() || '';
            bValue = b.paymentMethod?.name?.toLowerCase() || '';
            break;
          case 'amount':
            aValue = Number(a.amount);
            bValue = Number(b.amount);
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  };

  const filteredTransactions = getFilteredAndSortedTransactions();

  // Componente de cabeçalho de coluna com ordenação e filtro
  const ColumnHeader = ({ 
    label, 
    sortKey, 
    filterType,
    filterOptions,
    selectedFilters,
  }: { 
    label: string; 
    sortKey?: string;
    filterType?: 'categories' | 'accounts' | 'paymentMethods' | 'statuses';
    filterOptions?: { id: string; name: string; icon?: string; color?: string }[];
    selectedFilters?: string[];
  }) => {
    const isOpen = openDropdown === (filterType || sortKey);
    const hasActiveFilter = selectedFilters && selectedFilters.length > 0;

    return (
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative">
        <div className="flex items-center gap-1">
          <span>{label}</span>
          
          {/* Botão de ordenação */}
          {sortKey && (
            <button
              onClick={() => handleSort(sortKey)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title={`Ordenar por ${label}`}
            >
              <div className="flex flex-col">
                <ChevronUp className={`w-3 h-3 -mb-1 ${sortConfig?.key === sortKey && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                <ChevronDown className={`w-3 h-3 ${sortConfig?.key === sortKey && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
            </button>
          )}
          
          {/* Botão de filtro */}
          {filterType && filterOptions && (
            <button
              onClick={() => setOpenDropdown(isOpen ? null : filterType)}
              className={`p-1 hover:bg-gray-200 rounded transition-colors ${hasActiveFilter ? 'text-blue-600' : 'text-gray-400'}`}
              title={`Filtrar por ${label}`}
            >
              <Filter className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Dropdown de filtro */}
        {isOpen && filterType && filterOptions && (
          <div 
            ref={dropdownRef}
            className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-auto"
          >
            <div className="p-2 border-b border-gray-100">
              <button
                onClick={() => toggleAllColumnFilter(filterType, filterOptions.map(o => o.id))}
                className="flex items-center gap-2 w-full px-2 py-1 text-sm hover:bg-gray-100 rounded"
              >
                <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedFilters?.length === filterOptions.length ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {selectedFilters?.length === filterOptions.length && <Check className="w-3 h-3 text-white" />}
                </div>
                <span>Selecionar Todos</span>
              </button>
            </div>
            <div className="p-2">
              {filterOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => toggleColumnFilter(filterType, option.id)}
                  className="flex items-center gap-2 w-full px-2 py-1 text-sm hover:bg-gray-100 rounded"
                >
                  <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedFilters?.includes(option.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {selectedFilters?.includes(option.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {option.color && (
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: option.color }} />
                  )}
                  {option.icon && <span>{option.icon}</span>}
                  <span className="truncate">{option.name}</span>
                </button>
              ))}
            </div>
            {selectedFilters && selectedFilters.length > 0 && (
              <div className="p-2 border-t border-gray-100">
                <button
                  onClick={() => clearColumnFilter(filterType)}
                  className="w-full px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  Limpar Filtro
                </button>
              </div>
            )}
          </div>
        )}
      </th>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
                {filteredTransactions.length} de {transactions.length} transações
                {(columnFilters.categories.length > 0 || columnFilters.accounts.length > 0 || columnFilters.paymentMethods.length > 0 || columnFilters.statuses.length > 0) && (
                  <span className="text-blue-600 ml-2">(filtradas)</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                showFilters 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
              }`}
            >
              <Filter className="w-5 h-5" />
              Filtros
            </button>
            <button
              onClick={handleAddNew}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
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
              <div>
                <p className="text-sm text-gray-500 font-medium">Receitas</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.income)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-red-100 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Despesas</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.expense)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Receipt className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Saldo</p>
                <p className={`text-2xl font-bold ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totals.balance)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6 animate-fadeIn">
            <h3 className="text-lg font-semibold mb-4">Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Inicial</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white appearance-none"
                  style={{ colorScheme: 'light' }}
                  title="Data inicial do filtro"
                  aria-label="Data inicial"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Final</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white appearance-none"
                  style={{ colorScheme: 'light' }}
                  title="Data final do filtro"
                  aria-label="Data final"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                <select
                  value={filters.categoryId}
                  onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                  className="w-full px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  title="Filtrar por categoria"
                >
                  <option value="">Todas</option>
                  {categories.filter(c => c.type === filters.type || filters.type === 'all').map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Conta</label>
                <select
                  value={filters.bankAccountId}
                  onChange={(e) => setFilters({ ...filters, bankAccountId: e.target.value })}
                  className="w-full px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  title="Filtrar por conta"
                >
                  <option value="">Todas</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Meio de Pagamento</label>
                <select
                  value={filters.paymentMethodId}
                  onChange={(e) => setFilters({ ...filters, paymentMethodId: e.target.value })}
                  className="w-full px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  title="Filtrar por meio de pagamento"
                >
                  <option value="">Todos</option>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
                  className="w-full px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  title="Filtrar por tipo"
                >
                  <option value="all">Todas</option>
                  <option value="income">Receitas</option>
                  <option value="expense">Despesas</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                  className="w-full px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  title="Filtrar por status"
                >
                  <option value="all">Todas</option>
                  <option value="completed">Pagas</option>
                  <option value="pending">Pendentes</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Transações */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden min-h-[400px]">
          {filteredTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <ColumnHeader label="Data" sortKey="date" />
                    <ColumnHeader label="Descrição" sortKey="description" />
                    <ColumnHeader 
                      label="Categoria" 
                      sortKey="category" 
                      filterType="categories"
                      filterOptions={uniqueCategories.map(c => ({ id: c?.id || '', name: c?.name || '', icon: c?.icon, color: c?.color }))}
                      selectedFilters={columnFilters.categories}
                    />
                    <ColumnHeader 
                      label="Conta" 
                      sortKey="account" 
                      filterType="accounts"
                      filterOptions={uniqueAccounts.map(a => ({ id: a?.id || '', name: a?.name || '' }))}
                      selectedFilters={columnFilters.accounts}
                    />
                    <ColumnHeader 
                      label="Meio de Pagamento" 
                      sortKey="paymentMethod" 
                      filterType="paymentMethods"
                      filterOptions={uniquePaymentMethods.map(p => ({ id: p?.id || '', name: p?.name || '' }))}
                      selectedFilters={columnFilters.paymentMethods}
                    />
                    <ColumnHeader label="Valor" sortKey="amount" />
                    <ColumnHeader 
                      label="Status" 
                      sortKey="status" 
                      filterType="statuses"
                      filterOptions={uniqueStatuses}
                      selectedFilters={columnFilters.statuses}
                    />
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTransactions.map((transaction) => (
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {transaction.paymentMethod?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                        <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                          {transaction.type === 'income' ? '+' : '-'} {formatCurrency(Number(transaction.amount))}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(() => {
                          const isOverdue = transaction.status !== 'completed' && 
                            new Date(transaction.dueDate || transaction.transactionDate) < new Date(new Date().setHours(0, 0, 0, 0));
                          
                          return (
                            <button
                              onClick={() => togglePaidStatus(transaction)}
                              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-colors hover:opacity-80 ${
                                transaction.status === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : isOverdue
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {transaction.status === 'completed' ? (
                                <>
                                  <CheckCircle className="w-3 h-3" />
                                  Paga
                                </>
                              ) : isOverdue ? (
                                <>
                                  <XCircle className="w-3 h-3" />
                                  Atrasado
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3" />
                                  Pendente
                                </>
                              )}
                            </button>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {!transaction.isRecurringOccurrence && (
                            <>
                              <button
                                onClick={() => handleEdit(transaction)}
                                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4 text-blue-600" />
                              </button>
                              <button
                                onClick={() => handleDelete(transaction)}
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
            <div className="flex flex-col items-center justify-center py-16 min-h-[350px]">
              <Receipt className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">Nenhuma transação encontrada</p>
              <p className="text-gray-400 text-sm mt-2">Ajuste os filtros ou adicione novas transações</p>
              <button
                onClick={handleAddNew}
                className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Adicionar Primeira Transação
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Criar - com tabs Única/Recorrente/Parcelada */}
      {isCreating && (
        <CreateTransactionModal
          isOpen={showModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Modal de Editar - formulário simples */}
      {!isCreating && editingTransaction && (
        <EditTransactionModal
          isOpen={showModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          transaction={editingTransaction}
        />
      )}
    </div>
  );
}
