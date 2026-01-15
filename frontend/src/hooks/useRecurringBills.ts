'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface RecurringBill {
  id: string;
  name: string;
  description?: string;
  type: string;
  amount: string;
  frequency: string;
  firstDueDate?: string;
  endDate?: string;
  dueDay: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  status: string;
  category?: {
    id: string;
    name: string;
    type: string;
    icon: string;
    color: string;
  } | null;
  bankAccount?: {
    id: string;
    name: string;
  } | null;
  paymentMethod?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    occurrences: number;
  };
  nextOccurrence?: string;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  isActive: boolean;
}

interface BankAccount {
  id: string;
  name: string;
}

interface PaymentMethod {
  id: string;
  name: string;
}

interface RecurringBillForm {
  name: string;
  description: string;
  type: string;
  amount: string;
  frequency: string;
  startDate: string;
  endDate: string;
  dayOfMonth: string;
  dayOfWeek: string;
  categoryId: string;
  bankAccountId: string;
  paymentMethodId: string;
  notes: string;
}

interface DeleteModalState {
  isOpen: boolean;
  billId: string | null;
  billName: string;
  paidCount: number;
  pendingCount: number;
  isFromTransaction: boolean;
}

export function useRecurringBills() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const [deleteModalState, setDeleteModalState] = useState<DeleteModalState>({
    isOpen: false,
    billId: null,
    billName: '',
    paidCount: 0,
    pendingCount: 0,
    isFromTransaction: false,
  });

  const [recurringBillForm, setRecurringBillForm] = useState<RecurringBillForm>({
    name: '',
    description: '',
    type: 'expense',
    amount: '',
    frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    dayOfMonth: '1',
    dayOfWeek: '1',
    categoryId: '',
    bankAccountId: '',
    paymentMethodId: '',
    notes: '',
  });

  const loadData = async () => {
    try {
      // Buscar tanto do modelo antigo quanto do novo (transações unificadas)
      const [recurringBillsRes, transactionsRes, categoriesRes, accountsRes, methodsRes] = await Promise.all([
        api.get('/recurring-bills'),
        api.get('/transactions?transactionType=recurring&limit=1000'), // Buscar transações recorrentes
        api.get('/categories'),
        api.get('/bank-accounts?isActive=true'),
        api.get('/payment-methods?isActive=true'),
      ]);

      const oldRecurringBills = recurringBillsRes.data.data.recurringBills || [];
      
      // Converter transações recorrentes para o formato de RecurringBill
      const transactions = transactionsRes.data.data?.transactions || [];
      
      // Agrupar por parentId para encontrar transações "pai" (recorrentes)
      const parentTransactions = transactions.filter((t: any) => !t.parentId);
      const childTransactions = transactions.filter((t: any) => t.parentId);
      
      // Criar um mapa de parent -> filhos
      const childrenByParent = childTransactions.reduce((acc: any, t: any) => {
        if (!acc[t.parentId]) acc[t.parentId] = [];
        acc[t.parentId].push(t);
        return acc;
      }, {});
      
      // Converter transações pai para formato de RecurringBill
      const convertedRecurringBills = parentTransactions.map((t: any) => {
        const children = childrenByParent[t.id] || [];
        const nextOccurrence = children.find((c: any) => c.status === 'pending')?.transactionDate;
        
        return {
          id: t.id,
          name: t.description,
          description: t.notes || '',
          type: t.type === 'income' ? 'income' : 'expense',
          amount: t.amount?.toString() || '0',
          frequency: t.frequency || 'monthly',
          firstDueDate: t.transactionDate,
          dueDay: new Date(t.transactionDate).getDate(),
          dayOfMonth: new Date(t.transactionDate).getDate(),
          status: 'active',
          category: t.category,
          bankAccount: t.bankAccount,
          paymentMethod: t.paymentMethod,
          _count: { occurrences: children.length },
          nextOccurrence,
          createdAt: t.createdAt,
          isFromTransaction: true, // Marcador para saber que veio de Transaction
        };
      });
      
      // Também incluir transações recorrentes que são filhas (ocorrências) como "bills" se não têm parent
      const standaloneRecurring = childTransactions
        .filter((t: any) => {
          // Verificar se o parent existe na lista
          const parentExists = parentTransactions.some((p: any) => p.id === t.parentId);
          return !parentExists;
        })
        .reduce((acc: any, t: any) => {
          if (!acc[t.parentId]) {
            acc[t.parentId] = {
              id: t.parentId,
              name: t.description,
              description: t.notes || '',
              type: t.type === 'income' ? 'income' : 'expense',
              amount: t.amount?.toString() || '0',
              frequency: t.frequency || 'monthly',
              firstDueDate: t.transactionDate,
              dueDay: new Date(t.transactionDate).getDate(),
              dayOfMonth: new Date(t.transactionDate).getDate(),
              status: 'active',
              category: t.category,
              bankAccount: t.bankAccount,
              paymentMethod: t.paymentMethod,
              _count: { occurrences: 0 },
              createdAt: t.createdAt,
              isFromTransaction: true,
              children: [],
            };
          }
          acc[t.parentId].children.push(t);
          acc[t.parentId]._count.occurrences++;
          return acc;
        }, {});
      
      const standaloneList = Object.values(standaloneRecurring).map((item: any) => {
        const nextOcc = item.children.find((c: any) => c.status === 'pending')?.transactionDate;
        return { ...item, nextOccurrence: nextOcc, children: undefined };
      });

      // Combinar todos
      const allRecurringBills = [...oldRecurringBills, ...convertedRecurringBills, ...standaloneList];
      
      // Remover duplicatas por ID
      const uniqueBills = allRecurringBills.reduce((acc: any[], bill: any) => {
        if (!acc.find(b => b.id === bill.id)) {
          acc.push(bill);
        }
        return acc;
      }, []);

      // FILTRO: Remover itens que parecem ser parcelamentos
      // Padrão: "Nome - Parcela X/Y" ou nomes que terminam com "X/Y"
      const installmentPattern = /parcela\s*\d+\s*\/\s*\d+|\d+\s*\/\s*\d+\s*$/i;
      const filteredBills = uniqueBills.filter((bill: any) => {
        const name = bill.name || '';
        // Se o nome parece ser um parcelamento, não mostrar nas recorrentes
        return !installmentPattern.test(name);
      });

      setRecurringBills(filteredBills);
      setCategories((categoriesRes.data.data.categories || []).filter((c: Category) => c.isActive));
      setBankAccounts(accountsRes.data.data.accounts || []);
      setPaymentMethods(methodsRes.data.data.paymentMethods || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error.response?.data || error.message);
      toast.error('Erro ao carregar dados das contas recorrentes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Extrair dueDay da startDate para frequência mensal
      const startDateObj = new Date(recurringBillForm.startDate + 'T00:00:00');
      let dueDay: number;
      
      if (recurringBillForm.frequency === 'monthly') {
        dueDay = startDateObj.getDate(); // Dia do mês extraído da data de início
      } else if (recurringBillForm.frequency === 'weekly') {
        dueDay = parseInt(recurringBillForm.dayOfWeek);
      } else {
        dueDay = 1; // Default para outras frequências
      }

      const payload: any = {
        name: recurringBillForm.name,
        description: recurringBillForm.description || undefined,
        type: recurringBillForm.type,
        amount: parseFloat(recurringBillForm.amount),
        frequency: recurringBillForm.frequency,
        dueDay,
        firstDueDate: new Date(recurringBillForm.startDate).toISOString(),
        categoryId: recurringBillForm.categoryId,
        bankAccountId: recurringBillForm.bankAccountId,
        notes: recurringBillForm.notes || undefined,
      };

      if (recurringBillForm.paymentMethodId) {
        payload.paymentMethodId = recurringBillForm.paymentMethodId;
      }

      if (recurringBillForm.endDate) {
        payload.endDate = new Date(recurringBillForm.endDate).toISOString();
      }

      await api.post('/recurring-bills', payload);
      
      toast.success('Conta recorrente criada com sucesso!');
      resetForm();
      await loadData();
      return true;
    } catch (error: any) {
      console.error('Erro ao criar conta recorrente:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Erro ao criar conta recorrente');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBill) return false;
    setSubmitting(true);

    try {
      // Verificar se é uma transação ou RecurringBill real
      const isFromTransaction = (editingBill as any).isFromTransaction;
      
      if (isFromTransaction) {
        // Se veio de Transaction, usar a API de transactions
        const payload: any = {
          description: recurringBillForm.name,
          type: recurringBillForm.type,
          amount: parseFloat(recurringBillForm.amount),
          categoryId: recurringBillForm.categoryId,
          bankAccountId: recurringBillForm.bankAccountId,
          notes: recurringBillForm.notes || undefined,
        };

        if (recurringBillForm.paymentMethodId) {
          payload.paymentMethodId = recurringBillForm.paymentMethodId;
        }

        await api.put(`/transactions/${editingBill.id}`, payload);
        toast.success('Conta recorrente atualizada com sucesso!');
      } else {
        // Se é RecurringBill real, usar a API de recurring-bills
        // Extrair dueDay da startDate para frequência mensal (EDIT)
        const startDateObj = new Date(recurringBillForm.startDate + 'T00:00:00');
        let dueDay: number;
        
        if (recurringBillForm.frequency === 'monthly') {
          dueDay = startDateObj.getDate(); // Dia do mês extraído da data de início
        } else if (recurringBillForm.frequency === 'weekly') {
          dueDay = parseInt(recurringBillForm.dayOfWeek);
        } else {
          dueDay = 1; // Default para outras frequências
        }

        const payload: any = {
          name: recurringBillForm.name,
          description: recurringBillForm.description || undefined,
          type: recurringBillForm.type,
          amount: parseFloat(recurringBillForm.amount),
          frequency: recurringBillForm.frequency,
          dueDay,
          categoryId: recurringBillForm.categoryId,
          bankAccountId: recurringBillForm.bankAccountId,
          notes: recurringBillForm.notes || undefined,
        };

        if (recurringBillForm.paymentMethodId) {
          payload.paymentMethodId = recurringBillForm.paymentMethodId;
        }

        if (recurringBillForm.endDate) {
          payload.endDate = new Date(recurringBillForm.endDate).toISOString();
        }

        await api.put(`/recurring-bills/${editingBill.id}`, payload);
        toast.success('Conta recorrente atualizada com sucesso!');
      }
      
      setEditingBill(null);
      resetForm();
      await loadData();
      return true;
    } catch (error: any) {
      console.error('Erro ao editar conta recorrente:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Erro ao editar conta recorrente');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBillStatus = async (bill: RecurringBill) => {
    try {
      // Verificar se é uma transação ou RecurringBill real
      const isFromTransaction = (bill as any).isFromTransaction;
      
      if (isFromTransaction) {
        // Para transações, alternar entre 'completed' e 'pending'
        const newStatus = bill.status === 'active' ? 'pending' : 'completed';
        await api.put(`/transactions/${bill.id}`, {
          status: newStatus,
        });
        toast.success(
          newStatus === 'pending' 
            ? 'Conta recorrente marcada como pendente!' 
            : 'Conta recorrente marcada como paga!'
        );
      } else {
        // Para RecurringBill real
        await api.put(`/recurring-bills/${bill.id}`, {
          status: bill.status === 'active' ? 'paused' : 'active',
        });
        toast.success(
          bill.status === 'active' 
            ? 'Conta recorrente pausada com sucesso!' 
            : 'Conta recorrente ativada com sucesso!'
        );
      }
      await loadData();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Erro ao alterar status da conta recorrente');
    }
  };

  const handleDeleteBill = async (id: string) => {
    try {
      // Verificar se é uma transação ou RecurringBill real
      const bill = recurringBills.find(b => b.id === id);
      
      if (!bill) {
        toast.error('Receita recorrente não encontrada');
        return;
      }

      const isFromTransaction = (bill as any).isFromTransaction;

      // Verificar se existem transações/ocorrências pagas
      let checkResponse;
      if (isFromTransaction) {
        checkResponse = await api.get(`/transactions/${id}/check-paid`);
      } else {
        checkResponse = await api.get(`/recurring-bills/${id}/check-paid`);
      }

      const { hasPaidOccurrences, paidCount, pendingCount } = checkResponse.data.data;

      // Se não há transações pagas, excluir diretamente
      if (!hasPaidOccurrences || paidCount === 0) {
        if (isFromTransaction) {
          await api.delete(`/transactions/${id}?cascade=true&deleteMode=all`);
        } else {
          await api.delete(`/recurring-bills/${id}?deleteMode=all`);
        }
        toast.success('Receita recorrente excluída com sucesso!');
        await loadData();
        return;
      }

      // Se há transações pagas, abrir modal para perguntar ao usuário
      setDeleteModalState({
        isOpen: true,
        billId: id,
        billName: bill.name,
        paidCount,
        pendingCount,
        isFromTransaction,
      });
    } catch (error: any) {
      console.error('Erro ao excluir conta recorrente:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Erro ao excluir conta recorrente');
    }
  };

  const handleConfirmDelete = async (deleteMode: 'all' | 'pending') => {
    try {
      const { billId, isFromTransaction } = deleteModalState;
      
      if (!billId) {
        toast.error('ID da receita recorrente não encontrado');
        return;
      }

      if (isFromTransaction) {
        await api.delete(`/transactions/${billId}?cascade=true&deleteMode=${deleteMode}`);
      } else {
        await api.delete(`/recurring-bills/${billId}?deleteMode=${deleteMode}`);
      }

      if (deleteMode === 'all') {
        toast.success('Receita recorrente e todas as transações excluídas com sucesso!');
      } else {
        toast.success('Receita recorrente excluída. Transações realizadas foram mantidas.');
      }

      // Fechar modal e recarregar dados
      setDeleteModalState({
        isOpen: false,
        billId: null,
        billName: '',
        paidCount: 0,
        pendingCount: 0,
        isFromTransaction: false,
      });
      
      await loadData();
    } catch (error: any) {
      console.error('Erro ao excluir conta recorrente:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Erro ao excluir conta recorrente');
    }
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalState({
      isOpen: false,
      billId: null,
      billName: '',
      paidCount: 0,
      pendingCount: 0,
      isFromTransaction: false,
    });
  };

  const handleGenerateOccurrences = async (id: string) => {
    try {
      // Verificar se é uma transação ou RecurringBill real
      const bill = recurringBills.find(b => b.id === id);
      
      if (bill && (bill as any).isFromTransaction) {
        // Transações recorrentes já têm suas ocorrências geradas
        toast.info('Esta conta já possui todas as ocorrências geradas.');
        return;
      }
      
      const response = await api.post(`/recurring-bills/${id}/generate-occurrences`, {});
      toast.success(`${response.data.data.count} ocorrências geradas com sucesso!`);
      await loadData();
    } catch (error: any) {
      console.error('Erro ao gerar ocorrências:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Erro ao gerar ocorrências');
    }
  };

  const openEditModal = (bill: RecurringBill) => {
    setEditingBill(bill);
    setRecurringBillForm({
      name: bill.name || '',
      description: bill.description || '',
      type: bill.type || 'expense',
      amount: bill.amount?.toString() || '0',
      frequency: bill.frequency || 'monthly',
      startDate: bill.firstDueDate ? new Date(bill.firstDueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: bill.endDate ? new Date(bill.endDate).toISOString().split('T')[0] : '',
      dayOfMonth: (bill.dayOfMonth || bill.dueDay)?.toString() || '1',
      dayOfWeek: (bill.dayOfWeek || 0)?.toString() || '0',
      categoryId: bill.category?.id || '',
      bankAccountId: bill.bankAccount?.id || '',
      paymentMethodId: bill.paymentMethod?.id || '',
      notes: '',
    });
  };

  const resetForm = () => {
    setRecurringBillForm({
      name: '',
      description: '',
      type: 'expense',
      amount: '',
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      dayOfMonth: '1',
      dayOfWeek: '1',
      categoryId: '',
      bankAccountId: '',
      paymentMethodId: '',
      notes: '',
    });
  };

  // Estatísticas calculadas
  const activeBills = recurringBills.filter(b => b.status === 'active');
  const totalActive = activeBills.length;
  
  // Total mensal de despesas fixas
  const totalMonthlyExpenses = activeBills
    .filter(b => b.type === 'expense')
    .reduce((sum, bill) => sum + parseFloat(bill.amount), 0);
    
  // Total mensal de receitas fixas
  const totalMonthlyIncome = activeBills
    .filter(b => b.type === 'income')
    .reduce((sum, bill) => sum + parseFloat(bill.amount), 0);

  // Saldo fixo mensal (receitas - despesas)
  const netFixedMonthly = totalMonthlyIncome - totalMonthlyExpenses;
  
  // % de comprometimento da renda fixa com despesas fixas
  const incomeCommitmentPercent = totalMonthlyIncome > 0 
    ? Math.round((totalMonthlyExpenses / totalMonthlyIncome) * 100)
    : 0;

  // Contagem de despesas que vencem nos próximos 7 dias
  const today = new Date();
  const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextDueCount = activeBills.filter(b => {
    const dueDay = b.dayOfMonth || b.dueDay;
    if (!dueDay) return false;
    
    const thisMonthDue = new Date(today.getFullYear(), today.getMonth(), dueDay);
    const nextMonthDue = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
    
    return (thisMonthDue >= today && thisMonthDue <= next7Days) ||
           (nextMonthDue >= today && nextMonthDue <= next7Days);
  }).length;
  
  // Breakdown por categoria (top 5)
  const categoryBreakdown = activeBills
    .filter(b => b.type === 'expense' && b.category)
    .reduce((acc, bill) => {
      const catName = bill.category?.name || 'Sem categoria';
      const catIcon = bill.category?.icon || '📋';
      if (!acc[catName]) {
        acc[catName] = { name: catName, icon: catIcon, total: 0, count: 0 };
      }
      acc[catName].total += parseFloat(bill.amount);
      acc[catName].count += 1;
      return acc;
    }, {} as Record<string, { name: string; icon: string; total: number; count: number }>);
    
  const topCategories = Object.values(categoryBreakdown)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map(cat => ({
      ...cat,
      percent: totalMonthlyExpenses > 0 ? Math.round((cat.total / totalMonthlyExpenses) * 100) : 0
    }));

  // Separação por tipo
  const expenseBills = activeBills.filter(b => b.type === 'expense');
  const incomeBills = activeBills.filter(b => b.type === 'income');

  return {
    loading,
    submitting,
    recurringBills,
    categories,
    bankAccounts,
    paymentMethods,
    editingBill,
    recurringBillForm,
    setRecurringBillForm,
    loadData,
    handleCreateBill,
    handleEditBill,
    toggleBillStatus,
    handleDeleteBill,
    handleGenerateOccurrences,
    openEditModal,
    resetForm,
    setEditingBill,
    // Estatísticas básicas
    totalActive,
    totalMonthly: totalMonthlyExpenses, // Mantém compatibilidade
    nextDueCount,
    // Novas estatísticas
    totalMonthlyExpenses,
    totalMonthlyIncome,
    netFixedMonthly,
    incomeCommitmentPercent,
    topCategories,
    expenseBills,
    incomeBills,
    // Modal de exclusão
    deleteModalState,
    handleConfirmDelete,
    handleCloseDeleteModal,
  };
}
