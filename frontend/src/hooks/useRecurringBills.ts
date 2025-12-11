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
      const [recurringBillsRes, categoriesRes, accountsRes, methodsRes] = await Promise.all([
        api.get('/recurring-bills'),
        api.get('/categories'),
        api.get('/bank-accounts?isActive=true'),
        api.get('/payment-methods?isActive=true'),
      ]);

      setRecurringBills(recurringBillsRes.data.data.recurringBills || []);
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
  const totalActive = recurringBills.filter(b => b.status === 'active').length;
  
  const totalMonthly = recurringBills
    .filter(b => b.status === 'active')
    .reduce((sum, bill) => {
      const amount = parseFloat(bill.amount);
      if (bill.type === 'expense') return sum + amount;
      return sum;
    }, 0);

  const nextDueCount = recurringBills.filter(b => {
    if (b.status !== 'active') return false;
    // Lógica simplificada - contas que vencem nos próximos 7 dias
    // Você pode melhorar isso calculando as datas reais
    return true;
  }).length;

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
    // Estatísticas
    totalActive,
    totalMonthly,
    nextDueCount,
  };
}
