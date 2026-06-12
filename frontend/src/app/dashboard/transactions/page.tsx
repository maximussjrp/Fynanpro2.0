'use client';

import { useAuth } from '@/stores/auth';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import EditTransactionModal from '@/components/NewTransactionModal';
import CreateTransactionModal from '@/components/UnifiedTransactionModal';
import TransactionCategoryDisplay from '@/components/TransactionCategoryDisplay';
import { applyTransactionTableFiltersAndSort, getEffectiveStatus } from '@/lib/transaction-table-filters';
import { DueFilter, getDuePeriod } from '@/lib/dashboard-due-reminders';
import { Receipt, Filter, Edit2, Trash2, Calendar, CheckCircle, XCircle, Clock, Plus, ArrowLeft, ChevronUp, ChevronDown, Check, User, ArrowRightLeft, Search, X, Tag, Eye, EyeOff , Loader2 } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  document?: string;
  documentType: 'PF' | 'PJ';
  avatar?: string;
  color?: string;
}

interface Transaction {
  id: string;
  amount: string;
  description: string;
  type: 'income' | 'expense' | 'transfer';
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
  categorySplits?: Array<{
    id?: string;
    categoryId: string;
    amount: string;
    note?: string;
    category?: {
      id: string;
      name: string;
      type?: string;
      icon?: string;
      color?: string;
    };
  }>;
  userProfileId?: string;
  isRecurringOccurrence?: boolean; // Flag para identificar ocorrências
  recurringBillId?: string;
  isInstallment?: boolean; // Flag para identificar parcelas individuais
  installmentPurchaseId?: string;
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
  userProfile?: UserProfile;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  color?: string;
  level?: number;
  parentId?: string | null;
  isActive?: boolean;
  children?: Category[];
  _count?: {
    transactions: number;
  };
}

interface CategoryForm {
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  parentId: string | null;
}

interface BankAccount {
  id: string;
  name: string;
  currentBalance?: number;
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
  const [loadingTransactionId, setLoadingTransactionId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    mode: 'single' | 'bulk';
    transaction?: Transaction;
  }>({ open: false, mode: 'single' });
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
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
  const [dateColumnFilter, setDateColumnFilter] = useState<{ startDate: string; endDate: string } | null>(null);
  // Draft para filtro de data da coluna (evita filtrar ao navegar no calendário)
  const [draftDateColumnFilter, setDraftDateColumnFilter] = useState<{ startDate: string; endDate: string } | null>(null);
  const [descriptionColumnFilter, setDescriptionColumnFilter] = useState('');
  const [amountColumnFilter, setAmountColumnFilter] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    description: '',
    transactionDate: new Date().toISOString().split('T')[0],
  });
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Estados para modal de categorias
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({
    name: '',
    type: 'expense',
    icon: '📝',
    color: '#3B82F6',
    parentId: null,
  });

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
        setColumnFilterSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
        setColumnFilterSearch('');
        setDraftDateColumnFilter(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);
  
  // Helper para obter datas do mês atual
  const getDefaultDateRange = () => {
    const now = new Date();
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    };
  };

  const defaultRange = getDefaultDateRange();

  // Filtros APLICADOS (usados para buscar dados da API)
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
    categoryId: '',
    bankAccountId: '',
    paymentMethodId: '',
    type: 'all' as 'all' | 'income' | 'expense' | 'transfer',
    status: 'all' as 'all' | 'completed' | 'pending' | 'overdue',
  });

  // Filtros DRAFT (o que o usuário está escolhendo no formulário)
  const [draftDateRange, setDraftDateRange] = useState({
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
  });

  // Flag para indicar se o draft é diferente do aplicado
  const dateFilterPending = draftDateRange.startDate !== appliedFilters.startDate || 
                            draftDateRange.endDate !== appliedFilters.endDate;

  // Função para aplicar o filtro de data
  const applyDateFilter = () => {
    setAppliedFilters(prev => ({
      ...prev,
      startDate: draftDateRange.startDate,
      endDate: draftDateRange.endDate,
    }));
  };

  // Atalho: Aplicar "Hoje"
  const applyToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDraftDateRange({ startDate: today, endDate: today });
    setAppliedFilters(prev => ({ ...prev, startDate: today, endDate: today }));
  };

  // Atalho: Aplicar "Este Mês"
  const applyThisMonth = () => {
    const range = getDefaultDateRange();
    setDraftDateRange(range);
    setAppliedFilters(prev => ({ ...prev, ...range }));
  };

  // Atalho: Aplicar "Mês Anterior"
  const applyLastMonth = () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    setDraftDateRange({ startDate, endDate });
    setAppliedFilters(prev => ({ ...prev, startDate, endDate }));
  };

  // Referência ao antigo estado "filters" (agora aponta para appliedFilters para compatibilidade)
  const filters = appliedFilters;
  const setFilters = (valueOrUpdater: typeof appliedFilters | ((prev: typeof appliedFilters) => typeof appliedFilters)) => {
    if (typeof valueOrUpdater === 'function') {
      setAppliedFilters(prev => {
        const newVal = valueOrUpdater(prev);
        // Sincronizar draft se datas mudaram
        if (newVal.startDate !== prev.startDate || newVal.endDate !== prev.endDate) {
          setDraftDateRange({ startDate: newVal.startDate, endDate: newVal.endDate });
        }
        return newVal;
      });
    } else {
      // Sincronizar draft se datas mudaram
      if (valueOrUpdater.startDate !== appliedFilters.startDate || valueOrUpdater.endDate !== appliedFilters.endDate) {
        setDraftDateRange({ startDate: valueOrUpdater.startDate, endDate: valueOrUpdater.endDate });
      }
      setAppliedFilters(valueOrUpdater);
    }
  };

  // Verificar se há parâmetros na URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    const typeParam = urlParams.get('type');
    const statusParam = urlParams.get('status');
    const dueParam = urlParams.get('due');
    const startDateParam = urlParams.get('startDate');
    const endDateParam = urlParams.get('endDate');
    const dueFilter = dueParam && ['today', 'week', 'month'].includes(dueParam)
      ? dueParam as DueFilter
      : null;
    const duePeriod = dueFilter ? getDuePeriod(dueFilter) : null;
    const statusValues = (statusParam || '')
      .split(',')
      .map(status => status.trim().toLowerCase())
      .filter(Boolean);
    
    if (dateParam || typeParam || statusParam || duePeriod || startDateParam || endDateParam) {
      // Data de hoje formatada
      const today = new Date().toISOString().split('T')[0];
      
      // Se status for overdue, expandir range para pegar transações antigas (últimos 2 anos até hoje)
      const isOverdue = statusValues.length === 1 && statusValues[0] === 'overdue';
      const useColumnStatusFilter = statusValues.includes('overdue') || statusValues.length > 1;
      const overdueStartDate = new Date();
      overdueStartDate.setFullYear(overdueStartDate.getFullYear() - 2);
      
      setFilters(prev => ({
        ...prev,
        // Se for overdue, expandir range para últimos 2 anos até hoje
        ...(isOverdue && { 
          startDate: overdueStartDate.toISOString().split('T')[0], 
          endDate: today 
        }),
        // Se tiver date específico, usa como start e end
        ...(!isOverdue && dateParam && { startDate: dateParam, endDate: dateParam }),
        // Filtro rapido de vencimento vindo do dashboard
        ...(!isOverdue && duePeriod && { startDate: duePeriod.startDate, endDate: duePeriod.endDate }),
        // Se tiver startDate e endDate, usa eles
        ...(!isOverdue && !duePeriod && startDateParam && { startDate: startDateParam }),
        ...(!isOverdue && !duePeriod && endDateParam && { endDate: endDateParam }),
        // Tipo: INCOME, EXPENSE ou TRANSFER
        ...(typeParam && { type: typeParam.toLowerCase() as 'all' | 'income' | 'expense' | 'transfer' }),
        // Status: completed ou pending (se for overdue, deixa all para filtrar por coluna)
        ...(statusValues.length === 1 && !useColumnStatusFilter && ['completed', 'pending'].includes(statusValues[0]) && {
          status: statusValues[0] as 'completed' | 'pending',
        })
      }));
      
      // Status composto usa filtro de coluna para nao depender de suporte novo no backend.
      if (useColumnStatusFilter) {
        setColumnFilters(prev => ({ ...prev, statuses: statusValues.filter(status => ['pending', 'overdue', 'completed'].includes(status)) }));
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
        limit: 10000, // Buscar todas as transações do período (sem limite prático)
      };

      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.bankAccountId) params.bankAccountId = filters.bankAccountId;
      if (filters.paymentMethodId) params.paymentMethodId = filters.paymentMethodId;
      if (filters.type !== 'all') params.type = filters.type;
      if (filters.status !== 'all') params.status = filters.status;

      // Buscar transações realizadas + ocorrências pendentes + parcelas
      const [transactionsRes, occurrencesRes, installmentsRes, categoriesRes, accountsRes, paymentMethodsRes] = await Promise.all([
        api.get('/transactions', { params }),
        api.get('/recurring-bills/occurrences', { params }),
        api.get('/installments'),
        api.get('/categories?isActive=true'),
        api.get('/bank-accounts?isActive=true'),
        api.get('/payment-methods?isActive=true'),
      ]);

      // Combinar transações com ocorrências de recorrências
      const transactionsList = transactionsRes.data.data.transactions || [];
      const occurrencesList = occurrencesRes.data.data?.occurrences || [];
      const purchasesList = installmentsRes.data?.data?.purchases || installmentsRes.data?.purchases || [];
      const startDate = new Date(`${filters.startDate}T00:00:00`);
      const endDate = new Date(`${filters.endDate}T23:59:59`);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const matchesMergedFilters = (item: {
        type?: string;
        status?: string;
        dueDate?: string;
        transactionDate?: string;
        categoryId?: string;
        bankAccountId?: string;
        paymentMethodId?: string;
      }) => {
        const itemDate = new Date(item.dueDate || item.transactionDate || '');
        if (Number.isNaN(itemDate.getTime()) || itemDate < startDate || itemDate > endDate) {
          return false;
        }

        if (filters.type !== 'all' && item.type !== filters.type) return false;
        if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
        if (filters.bankAccountId && item.bankAccountId !== filters.bankAccountId) return false;
        if (filters.paymentMethodId && item.paymentMethodId !== filters.paymentMethodId) return false;

        if (filters.status !== 'all') {
          const isOverdue = item.status !== 'completed' && itemDate < todayStart;
          const effectiveStatus = item.status === 'completed' ? 'completed' : (isOverdue ? 'overdue' : 'pending');
          if (effectiveStatus !== filters.status) return false;
        }

        return true;
      };

      // Mapear ocorrências PENDENTES para formato de transação (ignorar as já pagas)
      const mappedOccurrences = occurrencesList
        .filter((occ: any) => occ.status === 'pending') // ✅ Só mostrar pendentes
        .map((occ: any) => ({
          id: occ.id,
          amount: occ.amount.toString(),
          description: occ.recurringBill?.name || 'Recorrência',
          type: occ.recurringBill?.type || 'expense',
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
      }))
        .filter(matchesMergedFilters);

      // Mapear PARCELAS individuais (Installments) para formato de transação
      const mappedInstallments = purchasesList.flatMap((p: any) =>
        (p.installments || [])
          .filter((inst: any) => inst.status === 'pending')
          .map((inst: any) => ({
            id: inst.id,
            amount: inst.amount.toString(),
            description: `${p.name} (${inst.installmentNumber}/${p.numberOfInstallments})`,
            transactionDate: inst.dueDate,
            dueDate: inst.dueDate,
            status: inst.status,
            notes: inst.notes,
            type: 'expense',
            categoryId: p.category?.id,
            bankAccountId: inst.bankAccount?.id || inst.bankAccountId,
            paymentMethodId: inst.paymentMethod?.id || inst.paymentMethodId,
            isInstallment: true,
            installmentPurchaseId: p.id,
            installmentNumber: inst.installmentNumber,
            totalInstallments: p.numberOfInstallments,
            category: p.category || { id: '', name: 'Sem categoria', type: 'expense', icon: '❓', color: '#999' },
            bankAccount: inst.bankAccount || { id: '', name: 'Sem conta', type: 'bank', currentBalance: 0 },
            paymentMethod: inst.paymentMethod,
            createdAt: inst.createdAt,
          }))
          .filter(matchesMergedFilters)
      );

      // Combinar listas
      const combined = [...transactionsList, ...mappedOccurrences, ...mappedInstallments];
      
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
      setPaymentMethods(paymentMethodsRes.data.data.methods || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const isPayableTransaction = (transaction: Transaction) => transaction.status !== 'completed';

  const payTransaction = async (transaction: Transaction, paidDate: string) => {
    const paidDateIso = new Date(`${paidDate}T12:00:00`).toISOString();

    if (transaction.isRecurringOccurrence && transaction.recurringBillId && !transaction.parentId) {
      await api.post(`/recurring-bills/${transaction.recurringBillId}/occurrences/${transaction.id}/pay`, {
        paidDate: paidDateIso,
        paidAmount: Number(transaction.amount),
      });
      return;
    }

    if (transaction.isInstallment && transaction.installmentPurchaseId) {
      await api.post(`/installments/${transaction.installmentPurchaseId}/installments/${transaction.id}/pay`, {
        paidDate: paidDateIso,
        paidAmount: Number(transaction.amount),
      });
      return;
    }

    await api.patch(`/transactions/${transaction.id}/status`, {
      status: 'completed',
      paidDate: paidDateIso,
      paidAmount: Number(transaction.amount),
    });
  };

  const openPaymentModal = (mode: 'single' | 'bulk', transaction?: Transaction) => {
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentModal({ open: true, mode, transaction });
  };

  const closePaymentModal = () => {
    setPaymentModal({ open: false, mode: 'single' });
    setPaymentDate(new Date().toISOString().split('T')[0]);
  };

  const confirmPayment = async () => {
    const targets = paymentModal.mode === 'single'
      ? (paymentModal.transaction ? [paymentModal.transaction] : [])
      : transactions.filter(transaction =>
          selectedTransactionIds.includes(transaction.id) && isPayableTransaction(transaction)
        );

    if (targets.length === 0) {
      toast.error('Selecione pelo menos um lançamento pendente');
      return;
    }

    setBulkLoading(true);
    if (paymentModal.mode === 'single' && paymentModal.transaction) {
      setLoadingTransactionId(paymentModal.transaction.id);
    }

    try {
      await Promise.all(targets.map(transaction => payTransaction(transaction, paymentDate)));
      toast.success(
        targets.length === 1
          ? 'Lançamento marcado como pago'
          : `${targets.length} lançamentos marcados como pagos`
      );
      setSelectedTransactionIds(prev => prev.filter(id => !targets.some(target => target.id === id)));
      closePaymentModal();
      loadData();
    } catch (error: any) {
      console.error('Erro ao registrar pagamento:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao registrar pagamento');
    } finally {
      setBulkLoading(false);
      setLoadingTransactionId(null);
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    try {
      const isLegacyRecurringOccurrence = !!transaction.isRecurringOccurrence && !transaction.parentId;
      const isLegacyInstallment = !!transaction.isInstallment && !!transaction.installmentPurchaseId;

      if (isLegacyRecurringOccurrence || isLegacyInstallment) {
        toast.error('Este lançamento foi gerado por uma recorrência/parcela. A exclusão individual ainda não está disponível com segurança para este tipo.');
        return;
      }

      if (!confirm('Tem certeza que deseja excluir esta transação?')) return;

      await api.delete(`/transactions/${transaction.id}`);
      toast.success('Transação excluída com sucesso!');
      
      loadData();
    } catch (error: any) {
      console.error('Erro ao excluir transação:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao excluir transação');
    }
  };

  const togglePaidStatus = async (transaction: Transaction) => {
    if (loadingTransactionId === transaction.id) return;
    if (transaction.status !== 'completed') {
      openPaymentModal('single', transaction);
      return;
    }

    setLoadingTransactionId(transaction.id);
    try {
      await api.patch(`/transactions/${transaction.id}/status`, {
        status: 'pending',
      });
      toast.success('Status alterado para Pendente');
      
      loadData();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setLoadingTransactionId(null);
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

  // Funções para gerenciar categorias
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error('Nome da categoria é obrigatório');
      return;
    }
    setSubmittingCategory(true);
    try {
      await api.post('/categories', categoryForm);
      toast.success('Categoria criada com sucesso!');
      setShowCategoryModal(false);
      setCategoryForm({ name: '', type: 'expense', icon: '📝', color: '#3B82F6', parentId: null });
      loadData(); // Recarrega categorias
    } catch (error: any) {
      console.error('Erro ao criar categoria:', error);
      toast.error(error.response?.data?.message || 'Erro ao criar categoria');
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setSubmittingCategory(true);
    try {
      await api.put(`/categories/${editingCategory.id}`, categoryForm);
      toast.success('Categoria atualizada com sucesso!');
      setShowEditCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', type: 'expense', icon: '📝', color: '#3B82F6', parentId: null });
      loadData();
    } catch (error: any) {
      console.error('Erro ao editar categoria:', error);
      toast.error(error.response?.data?.message || 'Erro ao editar categoria');
    } finally {
      setSubmittingCategory(false);
    }
  };

  const openEditCategoryModal = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      type: category.type as 'income' | 'expense',
      icon: category.icon || '📝',
      color: category.color || '#3B82F6',
      parentId: category.parentId || null,
    });
    setShowEditCategoryModal(true);
  };

  const toggleCategoryStatus = async (category: Category) => {
    try {
      await api.put(`/categories/${category.id}`, { isActive: !category.isActive });
      toast.success(category.isActive ? 'Categoria desativada' : 'Categoria ativada');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao alterar status');
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!confirm(`Tem certeza que deseja excluir a categoria "${category.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/categories/${category.id}`);
      toast.success('Categoria excluída com sucesso!');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir categoria');
    }
  };

  // Obter categorias pai candidatas para subcategoria
  const getParentCandidates = (type: 'income' | 'expense', excludeId?: string) => {
    return categories.filter(cat => 
      cat.type === type && 
      (cat.level === 1 || cat.level === 2) &&
      cat.id !== excludeId
    );
  };

  // Função para realizar transferência
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      toast.error('Conta de origem e destino não podem ser iguais');
      return;
    }

    // Verificar se o saldo ficará negativo
    const fromAccount = bankAccounts.find(acc => acc.id === transferForm.fromAccountId);
    const amount = parseFloat(transferForm.amount);
    const currentBalance = Number(fromAccount?.currentBalance) || 0;
    const newBalance = currentBalance - amount;

    if (newBalance < 0) {
      const formatValue = (val: number) => val.toFixed(2).replace('.', ',');
      const confirmed = confirm(
        `⚠️ ATENÇÃO: O saldo da conta "${fromAccount?.name}" ficará NEGATIVO!\n\n` +
        `Saldo atual: R$ ${formatValue(currentBalance)}\n` +
        `Valor da transferência: R$ ${formatValue(amount)}\n` +
        `Saldo após transferência: R$ ${formatValue(newBalance)}\n\n` +
        `Deseja continuar mesmo assim?`
      );
      if (!confirmed) {
        return;
      }
    }

    setSubmittingTransfer(true);
    try {
      await api.post('/bank-accounts/transfer/execute', {
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        amount: amount,
        description: transferForm.description || 'Transferência entre contas',
        transactionDate: transferForm.transactionDate,
      });
      toast.success('Transferência realizada com sucesso!');
      setShowTransferModal(false);
      setTransferForm({
        fromAccountId: '',
        toAccountId: '',
        amount: '',
        description: '',
        transactionDate: new Date().toISOString().split('T')[0],
      });
      loadData();
    } catch (error: any) {
      console.error('Erro ao transferir:', error);
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.message || 
                          'Erro ao realizar transferência';
      toast.error(errorMessage);
    } finally {
      setSubmittingTransfer(false);
    }
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
  const uniqueCategories = [...new Map([
    ...transactions
      .filter(t => t.category?.id)
      .map(t => [t.category!.id, t.category] as const),
    ...transactions.flatMap(t =>
      (t.categorySplits || [])
        .filter(split => split.category?.id)
        .map(split => [split.category!.id, split.category] as const)
    ),
  ]).values()].filter(Boolean);
  const uniqueAccounts = [...new Map(transactions.map(t => [t.bankAccount?.id, t.bankAccount])).values()].filter(Boolean);
  const uniquePaymentMethods = [...new Map(transactions.map(t => [t.paymentMethod?.id, t.paymentMethod])).values()].filter(Boolean);
  const uniqueStatuses = [
    { id: 'completed', name: 'Paga' },
    { id: 'pending', name: 'Pendente' },
    { id: 'overdue', name: 'Atrasado' },
  ];

  const hasGeneralFiltersActive = useMemo(() => {
    return (
      filters.categoryId !== '' ||
      filters.bankAccountId !== '' ||
      filters.paymentMethodId !== '' ||
      filters.type !== 'all' ||
      filters.status !== 'all' ||
      filters.startDate !== defaultRange.startDate ||
      filters.endDate !== defaultRange.endDate
    );
  }, [filters, defaultRange.startDate, defaultRange.endDate]);

  const activeGeneralFilterCount = useMemo(() => {
    let count = 0;
    if (filters.categoryId) count++;
    if (filters.bankAccountId) count++;
    if (filters.paymentMethodId) count++;
    if (filters.type !== 'all') count++;
    if (filters.status !== 'all') count++;
    if (filters.startDate !== defaultRange.startDate || filters.endDate !== defaultRange.endDate) count++;
    return count;
  }, [filters, defaultRange.startDate, defaultRange.endDate]);

  const hasColumnFiltersActive = useMemo(() => {
    return (
      !!dateColumnFilter ||
      columnFilters.categories.length > 0 ||
      columnFilters.accounts.length > 0 ||
      columnFilters.paymentMethods.length > 0 ||
      columnFilters.statuses.length > 0 ||
      !!descriptionColumnFilter.trim() ||
      !!amountColumnFilter.trim()
    );
  }, [dateColumnFilter, columnFilters, descriptionColumnFilter, amountColumnFilter]);

  const clearColumnAndSortState = () => {
    setDateColumnFilter(null);
    setDraftDateColumnFilter(null);
    setDescriptionColumnFilter('');
    setAmountColumnFilter('');
    setColumnFilters({
      categories: [],
      accounts: [],
      paymentMethods: [],
      statuses: [],
    });
    setSortConfig(null);
    setOpenDropdown(null);
    setColumnFilterSearch('');
  };

  const filteredTransactions = useMemo(
    () => applyTransactionTableFiltersAndSort(transactions, columnFilters, dateColumnFilter, sortConfig, {
      descriptionQuery: descriptionColumnFilter,
      amountQuery: amountColumnFilter,
    }),
    [transactions, columnFilters, dateColumnFilter, sortConfig, descriptionColumnFilter, amountColumnFilter],
  );
  const payableFilteredTransactions = filteredTransactions.filter(isPayableTransaction);
  const selectedTransactions = transactions.filter(transaction => selectedTransactionIds.includes(transaction.id));
  const selectedPayableTransactions = selectedTransactions.filter(isPayableTransaction);
  const allPayableFilteredSelected = payableFilteredTransactions.length > 0 &&
    payableFilteredTransactions.every(transaction => selectedTransactionIds.includes(transaction.id));

  useEffect(() => {
    setSelectedTransactionIds(prev => prev.filter(id => transactions.some(transaction => transaction.id === id)));
  }, [transactions]);

  const toggleTransactionSelection = (transaction: Transaction) => {
    if (!isPayableTransaction(transaction)) return;
    setSelectedTransactionIds(prev =>
      prev.includes(transaction.id)
        ? prev.filter(id => id !== transaction.id)
        : [...prev, transaction.id]
    );
  };

  const toggleAllPayableSelection = () => {
    const visiblePayableIds = payableFilteredTransactions.map(transaction => transaction.id);
    if (allPayableFilteredSelected) {
      setSelectedTransactionIds(prev => prev.filter(id => !visiblePayableIds.includes(id)));
      return;
    }

    setSelectedTransactionIds(prev => Array.from(new Set([...prev, ...visiblePayableIds])));
  };

  // Calcular o total das transações filtradas
  const totalFiltered = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => {
      const amount = Number(t.amount);
      return sum + (t.type === 'income' ? amount : -Math.abs(amount));
    }, 0);
  }, [filteredTransactions]);

  // Componente de cabeçalho de coluna com ordenação e filtro
  const ColumnHeader = ({ 
    label, 
    sortKey, 
    filterType,
    filterOptions,
    selectedFilters,
    isDateFilter,
    textFilterValue,
    onTextFilterChange,
    onTextFilterClear,
    textFilterPlaceholder,
    textFilterInputLabel,
  }: { 
    label: string; 
    sortKey?: string;
    filterType?: 'categories' | 'accounts' | 'paymentMethods' | 'statuses' | 'description' | 'amount' | 'date';
    filterOptions?: { id: string; name: string; icon?: string; color?: string }[];
    selectedFilters?: string[];
    isDateFilter?: boolean;
    textFilterValue?: string;
    onTextFilterChange?: (value: string) => void;
    onTextFilterClear?: () => void;
    textFilterPlaceholder?: string;
    textFilterInputLabel?: string;
  }) => {
    const isOpen = openDropdown === (filterType || sortKey);
    const isTextFilter = filterType === 'description' || filterType === 'amount';
    const isCheckboxFilterType =
      filterType === 'categories' ||
      filterType === 'accounts' ||
      filterType === 'paymentMethods' ||
      filterType === 'statuses';
    const hasActiveFilter = isDateFilter
      ? !!dateColumnFilter
      : isTextFilter
        ? !!textFilterValue?.trim()
        : !!(selectedFilters && selectedFilters.length > 0);

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
              aria-label={`Ordenar por ${label}`}
            >
              <div className="flex flex-col">
                <ChevronUp className={`w-3 h-3 -mb-1 ${sortConfig?.key === sortKey && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                <ChevronDown className={`w-3 h-3 ${sortConfig?.key === sortKey && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
            </button>
          )}
          
          {/* Botão de filtro de data */}
          {isDateFilter && (
            <button
              onClick={() => setOpenDropdown(isOpen ? null : 'date')}
              className={`p-1 hover:bg-gray-200 rounded transition-colors ${hasActiveFilter ? 'text-blue-600' : 'text-gray-400'}`}
              title="Filtrar por data"
              aria-label={`Filtrar coluna ${label}`}
            >
              <Filter className="w-3 h-3" />
            </button>
          )}
          
          {/* Botão de filtro */}
          {filterType && !isDateFilter && (
            <button
              onClick={() => setOpenDropdown(isOpen ? null : filterType)}
              className={`p-1 hover:bg-gray-200 rounded transition-colors ${hasActiveFilter ? 'text-blue-600' : 'text-gray-400'}`}
              title={`Filtrar por ${label}`}
              aria-label={`Filtrar coluna ${label}`}
            >
              <Filter className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Dropdown de filtro */}
        {isOpen && filterType && filterOptions && !isDateFilter && (
          <div 
            ref={dropdownRef}
            className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[250px] max-h-[350px] flex flex-col"
            onKeyDown={(e) => e.stopPropagation()}
          >
            {/* Campo de busca */}
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={columnFilterSearch}
                  onChange={(e) => setColumnFilterSearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                {columnFilterSearch && (
                  <button
                    onClick={() => setColumnFilterSearch('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Limpar busca do filtro"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="p-2 border-b border-gray-100">
              <button
                onClick={() => {
                  if (!isCheckboxFilterType) return;
                  toggleAllColumnFilter(
                    filterType,
                    filterOptions
                      .filter(o => o.name.toLowerCase().includes(columnFilterSearch.toLowerCase()))
                      .map(o => o.id),
                  );
                }}
                className="flex items-center gap-2 w-full px-2 py-1 text-sm hover:bg-gray-100 rounded"
              >
                <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedFilters?.length === filterOptions.length ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {selectedFilters?.length === filterOptions.length && <Check className="w-3 h-3 text-white" />}
                </div>
                <span>Selecionar Todos</span>
              </button>
            </div>
            <div className="p-2 overflow-auto flex-1">
              {filterOptions
                .filter(option => option.name.toLowerCase().includes(columnFilterSearch.toLowerCase()))
                .map(option => (
                <button
                  key={option.id}
                  onClick={() => {
                    if (!isCheckboxFilterType) return;
                    toggleColumnFilter(filterType, option.id);
                  }}
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
                  onClick={() => clearColumnFilter(filterType as 'categories' | 'accounts' | 'paymentMethods' | 'statuses')}
                  className="w-full px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  Limpar Filtro
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dropdown de filtro de texto/valor */}
        {isOpen && filterType && !isDateFilter && !filterOptions && isTextFilter && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[260px] p-3"
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  aria-label={textFilterInputLabel || `Filtro de ${label}`}
                  placeholder={textFilterPlaceholder || 'Buscar...'}
                  value={textFilterValue || ''}
                  onChange={(e) => onTextFilterChange?.(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                {!!textFilterValue?.trim() && (
                  <button
                    onClick={() => onTextFilterClear?.()}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={`Limpar filtro de ${label}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => onTextFilterClear?.()}
                disabled={!textFilterValue?.trim()}
                className="w-full px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                Limpar Filtro
              </button>
            </div>
          </div>
        )}

        {/* Dropdown de filtro de data */}
        {isOpen && isDateFilter && (
          <div 
            ref={dropdownRef}
            className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[300px] p-3"
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="space-y-3">
              <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded-lg border border-blue-100">
                {'💡 Digite as datas e clique em "Aplicar Filtro"'}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data Inicial</label>
                <input
                  type="text"
                  placeholder="DD/MM/AAAA"
                  value={(() => {
                    const val = draftDateColumnFilter?.startDate || dateColumnFilter?.startDate || '';
                    if (!val) return '';
                    const [y, m, d] = val.split('-');
                    return `${d}/${m}/${y}`;
                  })()}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    let formatted = '';
                    if (val.length >= 1) formatted = val.slice(0, 2);
                    if (val.length >= 3) formatted += '/' + val.slice(2, 4);
                    if (val.length >= 5) formatted += '/' + val.slice(4, 8);
                    e.target.value = formatted;
                    
                    if (val.length === 8) {
                      const day = val.slice(0, 2);
                      const month = val.slice(2, 4);
                      const year = val.slice(4, 8);
                      const isoDate = `${year}-${month}-${day}`;
                      setDraftDateColumnFilter(prev => ({
                        startDate: isoDate,
                        endDate: prev?.endDate || dateColumnFilter?.endDate || isoDate
                      }));
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    draftDateColumnFilter && (draftDateColumnFilter.startDate !== dateColumnFilter?.startDate || draftDateColumnFilter.endDate !== dateColumnFilter?.endDate)
                      ? 'border-amber-400 bg-amber-50' : 'border-gray-200'
                  }`}
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data Final</label>
                <input
                  type="text"
                  placeholder="DD/MM/AAAA"
                  value={(() => {
                    const val = draftDateColumnFilter?.endDate || dateColumnFilter?.endDate || '';
                    if (!val) return '';
                    const [y, m, d] = val.split('-');
                    return `${d}/${m}/${y}`;
                  })()}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    let formatted = '';
                    if (val.length >= 1) formatted = val.slice(0, 2);
                    if (val.length >= 3) formatted += '/' + val.slice(2, 4);
                    if (val.length >= 5) formatted += '/' + val.slice(4, 8);
                    e.target.value = formatted;
                    
                    if (val.length === 8) {
                      const day = val.slice(0, 2);
                      const month = val.slice(2, 4);
                      const year = val.slice(4, 8);
                      const isoDate = `${year}-${month}-${day}`;
                      setDraftDateColumnFilter(prev => ({
                        startDate: prev?.startDate || dateColumnFilter?.startDate || isoDate,
                        endDate: isoDate
                      }));
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    draftDateColumnFilter && (draftDateColumnFilter.startDate !== dateColumnFilter?.startDate || draftDateColumnFilter.endDate !== dateColumnFilter?.endDate)
                      ? 'border-amber-400 bg-amber-50' : 'border-gray-200'
                  }`}
                  maxLength={10}
                />
              </div>
              {/* Botão Aplicar - sempre visível se há dados no draft */}
              <button
                onClick={() => {
                  if (draftDateColumnFilter) {
                    setDateColumnFilter(draftDateColumnFilter);
                    setDraftDateColumnFilter(null);
                  }
                }}
                disabled={!draftDateColumnFilter || (draftDateColumnFilter.startDate === dateColumnFilter?.startDate && draftDateColumnFilter.endDate === dateColumnFilter?.endDate)}
                className={`w-full px-3 py-2 text-sm rounded-lg transition-colors font-medium ${
                  draftDateColumnFilter && (draftDateColumnFilter.startDate !== dateColumnFilter?.startDate || draftDateColumnFilter.endDate !== dateColumnFilter?.endDate)
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                ✓ Aplicar Filtro
              </button>
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setDateColumnFilter({ startDate: today, endDate: today });
                    setDraftDateColumnFilter(null);
                  }}
                  className="flex-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
                >
                  Hoje
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
                    setDateColumnFilter({ startDate: startOfMonth, endDate: endOfMonth });
                    setDraftDateColumnFilter(null);
                  }}
                  className="flex-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
                >
                  Este Mês
                </button>
              </div>
              {dateColumnFilter && (
                <button
                  onClick={() => {
                    setDateColumnFilter(null);
                    setDraftDateColumnFilter(null);
                    setOpenDropdown(null);
                  }}
                  className="w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  Limpar Filtro
                </button>
              )}
            </div>
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
    <div className="h-screen bg-gray-50 p-4 md:p-6 flex flex-col overflow-hidden">
      <div className="w-full flex flex-col flex-1 overflow-hidden">
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
                {hasColumnFiltersActive && (
                  <span className="text-blue-600 ml-2">(filtradas)</span>
                )}
                <span className="mx-2">•</span>
                <span className="font-semibold">
                  Total: 
                  <span className={`ml-1 ${totalFiltered >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalFiltered >= 0 ? '+' : '-'} {formatCurrency(Math.abs(totalFiltered))}
                  </span>
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                showFilters 
                  ? 'bg-blue-600 text-white' 
                  : hasGeneralFiltersActive
                    ? 'bg-blue-50 border-2 border-blue-600 text-blue-700 hover:bg-blue-100'
                    : 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
              }`}
              aria-label="Abrir filtros gerais"
            >
              <Filter className="w-5 h-5" />
              Filtros
              {activeGeneralFilterCount > 0 && (
                <span className="ml-1 min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">
                  {activeGeneralFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowTransferModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              title="Transferência entre contas"
            >
              <ArrowRightLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Transferir</span>
            </button>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
              title="Gerenciar Categorias"
            >
              <Tag className="w-5 h-5" />
              <span className="hidden sm:inline">Categorias</span>
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

        {/* Filtros */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow-md p-3 mb-3 animate-fadeIn">
            <div className="flex flex-col lg:flex-row lg:items-end lg:gap-2 gap-2 mb-2">
              <span className="text-base font-semibold text-gray-700 mr-2 mb-0 lg:mb-0">Filtros</span>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                <div className="col-span-2 flex items-end gap-1">
                  <div className="flex flex-col flex-1 min-w-[100px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Período</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={draftDateRange.startDate}
                        onChange={(e) => setDraftDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                        className={`w-full px-2 py-1 min-h-[32px] border rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white appearance-none text-xs ${dateFilterPending ? 'border-amber-400' : 'border-gray-300'}`}
                        style={{ colorScheme: 'light' }}
                        title="Data inicial do filtro"
                        aria-label="Data inicial"
                      />
                      <span className="text-gray-500 text-xs">até</span>
                      <input
                        type="date"
                        value={draftDateRange.endDate}
                        onChange={(e) => setDraftDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                        className={`w-full px-2 py-1 min-h-[32px] border rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white appearance-none text-xs ${dateFilterPending ? 'border-amber-400' : 'border-gray-300'}`}
                        style={{ colorScheme: 'light' }}
                        title="Data final do filtro"
                        aria-label="Data final"
                      />
                      <button
                        onClick={applyDateFilter}
                        disabled={!dateFilterPending}
                        className={`px-2 py-1 rounded transition-colors flex items-center gap-1 min-h-[32px] text-xs ${
                          dateFilterPending 
                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        title={dateFilterPending ? 'Aplicar filtro de data' : 'Filtro já aplicado'}
                      >
                        <Filter className="w-3 h-3" />
                        Aplicar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <button onClick={applyToday} className="px-2 py-0.5 text-[11px] bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors">Hoje</button>
                      <button onClick={applyThisMonth} className="px-2 py-0.5 text-[11px] bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors">Este Mês</button>
                      <button onClick={applyLastMonth} className="px-2 py-0.5 text-[11px] bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors">Mês Anterior</button>
                      {dateFilterPending && (
                        <span className="flex items-center text-[11px] text-amber-600 font-medium ml-2">{'⚠️ Clique em "Aplicar"'}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    value={filters.categoryId}
                    onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                    className="w-full px-2 py-1 min-h-[32px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white text-xs"
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Conta</label>
                  <select
                    value={filters.bankAccountId}
                    onChange={(e) => setFilters({ ...filters, bankAccountId: e.target.value })}
                    className="w-full px-2 py-1 min-h-[32px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white text-xs"
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Meio de Pagamento</label>
                  <select
                    value={filters.paymentMethodId}
                    onChange={(e) => setFilters({ ...filters, paymentMethodId: e.target.value })}
                    className="w-full px-2 py-1 min-h-[32px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white text-xs"
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
                    className="w-full px-2 py-1 min-h-[32px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white text-xs"
                    title="Filtrar por tipo"
                  >
                    <option value="all">Todas</option>
                    <option value="income">Receitas</option>
                    <option value="expense">Despesas</option>
                    <option value="transfer">Transferências</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                    className="w-full px-2 py-1 min-h-[32px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white text-xs"
                    title="Filtrar por status"
                  >
                    <option value="all">Todas</option>
                    <option value="completed">Pagas</option>
                    <option value="pending">Pendentes</option>
                    <option value="overdue">Vencidas</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  // Ver Tudo: amplia período e limpa filtros para exibir todo o histórico
                  const twoYearsAgo = new Date();
                  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
                  const twoYearsLater = new Date();
                  twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2);
                  const startDate = twoYearsAgo.toISOString().split('T')[0];
                  const endDate = twoYearsLater.toISOString().split('T')[0];
                  setDraftDateRange({ startDate, endDate });
                  setAppliedFilters({
                    startDate,
                    endDate,
                    categoryId: '',
                    bankAccountId: '',
                    paymentMethodId: '',
                    type: 'all',
                    status: 'all',
                  });
                  clearColumnAndSortState();
                }}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Ver Tudo
              </button>
              <button
                onClick={() => {
                  // Limpar Filtros: reseta filtros para padrão (mês atual)
                  const today = new Date();
                  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
                  setDraftDateRange({ startDate: startOfMonth, endDate: endOfMonth });
                  setAppliedFilters({
                    startDate: startOfMonth,
                    endDate: endOfMonth,
                    categoryId: '',
                    bankAccountId: '',
                    paymentMethodId: '',
                    type: 'all',
                    status: 'all'
                  });
                  clearColumnAndSortState();
                }}
                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Limpar Filtros
              </button>
            </div>
          </div>
        )}

        {/* Lista de Transações */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden flex-1 flex flex-col">
          {selectedPayableTransactions.length > 0 && (
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-blue-900">
                <span className="font-semibold">{selectedPayableTransactions.length}</span>
                {' lançamento(s) pendente(s) selecionado(s)'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => openPaymentModal('bulk')}
                  disabled={bulkLoading}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium inline-flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Marcar como pago
                </button>
                <button
                  onClick={() => setSelectedTransactionIds([])}
                  className="px-3 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Limpar seleção
                </button>
              </div>
            </div>
          )}
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allPayableFilteredSelected}
                      onChange={toggleAllPayableSelection}
                      disabled={payableFilteredTransactions.length === 0}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                      title="Selecionar lançamentos pendentes visíveis"
                    />
                  </th>
                  <ColumnHeader label="Data" sortKey="date" isDateFilter />
                  <ColumnHeader
                    label="Descrição"
                    sortKey="description"
                    filterType="description"
                    textFilterValue={descriptionColumnFilter}
                    onTextFilterChange={setDescriptionColumnFilter}
                    onTextFilterClear={() => setDescriptionColumnFilter('')}
                    textFilterPlaceholder="Buscar descrição..."
                    textFilterInputLabel="Filtro de descrição"
                  />
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Perfil
                  </th>
                  <ColumnHeader 
                    label="Meio de Pagamento" 
                    sortKey="paymentMethod" 
                    filterType="paymentMethods"
                    filterOptions={uniquePaymentMethods.map(p => ({ id: p?.id || '', name: p?.name || '' }))}
                    selectedFilters={columnFilters.paymentMethods}
                  />
                  <ColumnHeader
                    label="Valor"
                    sortKey="amount"
                    filterType="amount"
                    textFilterValue={amountColumnFilter}
                    onTextFilterChange={setAmountColumnFilter}
                    onTextFilterClear={() => setAmountColumnFilter('')}
                    textFilterPlaceholder="Buscar valor..."
                    textFilterInputLabel="Filtro de valor"
                  />
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
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedTransactionIds.includes(transaction.id)}
                          onChange={() => toggleTransactionSelection(transaction)}
                          disabled={!isPayableTransaction(transaction)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30"
                          title={isPayableTransaction(transaction) ? 'Selecionar lançamento' : 'Lançamento já pago'}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {formatDate(transaction.status === 'completed' && transaction.paidDate ? transaction.paidDate : transaction.transactionDate)}
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
                        <TransactionCategoryDisplay
                          category={transaction.category}
                          categorySplits={transaction.categorySplits}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {transaction.bankAccount?.name || 'Não informada'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {transaction.userProfile ? (
                          <div className="flex items-center gap-2">
                            {transaction.userProfile.avatar ? (
                              <img 
                                src={transaction.userProfile.avatar} 
                                alt={transaction.userProfile.name}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div 
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                                style={{ backgroundColor: transaction.userProfile.color || '#1F4FD8' }}
                              >
                                {transaction.userProfile.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-gray-700">{transaction.userProfile.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {transaction.paymentMethod?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                        <span className={
                          transaction.type === 'income' 
                            ? 'text-green-600' 
                            : transaction.type === 'transfer' 
                              ? 'text-blue-600' 
                              : 'text-red-600'
                        }>
                          {transaction.type === 'income' ? '+' : transaction.type === 'transfer' ? '↔' : '-'} {formatCurrency(Math.abs(Number(transaction.amount)))}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(() => {
                          const effectiveStatus = getEffectiveStatus(transaction as any);
                          
                          const isLoading = loadingTransactionId === transaction.id;
                          return (
                            <button
                              onClick={() => togglePaidStatus(transaction)}
                              disabled={isLoading}
                              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${
                                isLoading
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:opacity-80'
                              } ${
                                effectiveStatus === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : effectiveStatus === 'overdue'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                              }`}
                              title={isLoading ? 'Atualizando status...' : 'Clique para alternar status'}
                            >
                              {isLoading ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  Atualizando...
                                </>
                              ) : effectiveStatus === 'completed' ? (
                                <>
                                  <CheckCircle className="w-3 h-3" />
                                  Paga
                                </>
                              ) : effectiveStatus === 'overdue' ? (
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
                          <>
                            {!transaction.isRecurringOccurrence && (
                              <button
                                onClick={() => handleEdit(transaction)}
                                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4 text-blue-600" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(transaction)}
                              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </>
                          {transaction.isRecurringOccurrence && transaction.status === 'pending' && (
                            <>
                              <button
                                onClick={() => togglePaidStatus(transaction)}
                                className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
                              >
                                Pagar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Receipt className="w-16 h-16 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg">Nenhuma transação encontrada</p>
                        <p className="text-gray-400 text-sm mt-2">Limpe os filtros nas colunas acima ou adicione novas transações</p>
                        <button
                          onClick={handleAddNew}
                          className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                        >
                          <Plus className="w-5 h-5" />
                          Adicionar Transação
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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

      {paymentModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Confirmar pagamento
              </h2>
              <button
                onClick={closePaymentModal}
                disabled={bulkLoading}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-gray-700">
                {paymentModal.mode === 'single' && paymentModal.transaction ? (
                  <span>
                    Marcar <strong>{paymentModal.transaction.description}</strong> como pago.
                  </span>
                ) : (
                  <span>
                    Marcar <strong>{selectedPayableTransactions.length}</strong> lançamento(s) selecionado(s) como pago(s).
                  </span>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data do pagamento</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 bg-white"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Essa data será aplicada apenas aos lançamentos selecionados. Vencimentos futuros de parcelas e recorrências permanecem iguais.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  disabled={bulkLoading}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmPayment}
                  disabled={bulkLoading || !paymentDate}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                >
                  {bulkLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Transferência */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <ArrowRightLeft className="w-6 h-6" />
                Transferência entre Contas
              </h2>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-all text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Conta Origem *</label>
                <select
                  required
                  value={transferForm.fromAccountId}
                  onChange={(e) => setTransferForm({ ...transferForm, fromAccountId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                >
                  <option value="">Selecione a conta de origem</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Conta Destino *</label>
                <select
                  required
                  value={transferForm.toAccountId}
                  onChange={(e) => setTransferForm({ ...transferForm, toAccountId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                >
                  <option value="">Selecione a conta de destino</option>
                  {bankAccounts
                    .filter((account) => account.id !== transferForm.fromAccountId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data da Transferência *</label>
                <input
                  type="date"
                  required
                  value={transferForm.transactionDate}
                  onChange={(e) => setTransferForm({ ...transferForm, transactionDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                  style={{ colorScheme: 'light' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                <input
                  type="text"
                  value={transferForm.description}
                  onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                  placeholder="Ex: Transferência para reserva"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingTransfer}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {submittingTransfer ? 'Transferindo...' : 'Transferir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Categorias */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <Tag className="w-6 h-6" />
                Gerenciar Categorias
              </h2>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-all text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Formulário de Nova Categoria */}
              <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Nova Categoria</h3>
                <form onSubmit={handleCreateCategory} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                      <input
                        type="text"
                        required
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white"
                        placeholder="Nome da categoria"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                      <select
                        required
                        value={categoryForm.type}
                        onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value as 'income' | 'expense' })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white"
                      >
                        <option value="expense">Despesa</option>
                        <option value="income">Receita</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Categoria Pai</label>
                      <select
                        value={categoryForm.parentId || ''}
                        onChange={(e) => setCategoryForm({ ...categoryForm, parentId: e.target.value || null })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white"
                      >
                        <option value="">Nenhuma (Categoria Principal)</option>
                        {getParentCandidates(categoryForm.type).map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Ícone</label>
                      <input
                        type="text"
                        value={categoryForm.icon}
                        onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white"
                        placeholder="Ex: 🏠, 🚗, 💰"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                      <input
                        type="color"
                        value={categoryForm.color}
                        onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                        className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={submittingCategory}
                        className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        {submittingCategory ? 'Criando...' : 'Criar Categoria'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Lista de Categorias */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Categorias Existentes</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {categories.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Nenhuma categoria encontrada</p>
                  ) : (
                    categories.map((category) => (
                      <div
                        key={category.id}
                        className={`p-3 rounded-lg border ${category.isActive !== false ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-300 opacity-60'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                              style={{ backgroundColor: category.color || (category.type === 'income' ? '#dcfce7' : category.type === 'patrimonial' ? '#e0f2fe' : '#fee2e2') }}
                            >
                              {category.icon || (category.type === 'income' ? '💰' : category.type === 'patrimonial' ? '↔' : '💸')}
                            </span>
                            <div>
                              <span className="font-medium text-gray-800">{category.name}</span>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className={`px-2 py-0.5 rounded-full ${category.type === 'income' ? 'bg-green-100 text-green-700' : category.type === 'patrimonial' ? 'bg-sky-100 text-sky-700' : 'bg-red-100 text-red-700'}`}>
                                  {category.type === 'income' ? 'Receita' : category.type === 'patrimonial' ? 'Patrimonial' : 'Despesa'}
                                </span>
                                {category.level && category.level > 0 && (
                                  <span className="text-gray-400">Subcategoria</span>
                                )}
                                {category._count?.transactions !== undefined && (
                                  <span className="text-gray-400">{category._count.transactions} transações</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleCategoryStatus(category)}
                              className={`p-2 rounded-lg transition-colors ${category.isActive !== false ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-green-100 text-green-600'}`}
                              title={category.isActive !== false ? 'Desativar' : 'Ativar'}
                            >
                              {category.isActive !== false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => openEditCategoryModal(category)}
                              className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4 text-blue-600" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(category)}
                              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </div>
                        {/* Subcategorias */}
                        {category.children && category.children.length > 0 && (
                          <div className="mt-2 ml-8 space-y-1">
                            {category.children.map((sub) => (
                              <div
                                key={sub.id}
                                className={`p-2 rounded-lg border ${sub.isActive !== false ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-gray-300 opacity-60'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{sub.icon || '📁'}</span>
                                    <span className="text-sm text-gray-700">{sub.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => toggleCategoryStatus(sub)}
                                      className={`p-1 rounded transition-colors ${sub.isActive !== false ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-green-100 text-green-600'}`}
                                      title={sub.isActive !== false ? 'Desativar' : 'Ativar'}
                                    >
                                      {sub.isActive !== false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    </button>
                                    <button
                                      onClick={() => openEditCategoryModal(sub)}
                                      className="p-1 hover:bg-blue-100 rounded transition-colors"
                                      title="Editar"
                                    >
                                      <Edit2 className="w-3 h-3 text-blue-600" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCategory(sub)}
                                      className="p-1 hover:bg-red-100 rounded transition-colors"
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-3 h-3 text-red-600" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Editar Categoria */}
      {showEditCategoryModal && editingCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <Edit2 className="w-6 h-6" />
                Editar Categoria
              </h2>
              <button
                onClick={() => setShowEditCategoryModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-all text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEditCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="Nome da categoria"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                <select
                  required
                  value={categoryForm.type}
                  onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value as 'income' | 'expense', parentId: '' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoria Pai</label>
                <select
                  value={categoryForm.parentId || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, parentId: e.target.value || null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="">Nenhuma (Categoria Principal)</option>
                  {getParentCandidates(categoryForm.type, editingCategory.id).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ícone</label>
                <input
                  type="text"
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="Ex: 🏠, 🚗, 💰"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                <input
                  type="color"
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditCategoryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingCategory}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submittingCategory ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


