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

export function useRecurringBills() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);

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

      setRecurringBills(uniqueBills);
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
      await api.put(`/recurring-bills/${bill.id}`, {
        status: bill.status === 'active' ? 'paused' : 'active',
      });
      
      toast.success(
        bill.status === 'active' 
          ? 'Conta recorrente pausada com sucesso!' 
          : 'Conta recorrente ativada com sucesso!'
      );
      await loadData();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Erro ao alterar status da conta recorrente');
    }
  };

  const handleDeleteBill = async (id: string) => {
    try {
      await api.delete(`/recurring-bills/${id}`);
      toast.success('Conta recorrente excluída com sucesso!');
      await loadData();
    } catch (error: any) {
      console.error('Erro ao excluir conta recorrente:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Erro ao excluir conta recorrente');
    }
  };

  const handleGenerateOccurrences = async (id: string) => {
    try {
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
  };
}
