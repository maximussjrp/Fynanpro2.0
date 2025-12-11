'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api';

interface InstallmentForm {
  name: string;
  totalAmount: string;
  numberOfInstallments: string;
  firstDueDate: string;
  categoryId: string;
  bankAccountId: string;
  paymentMethodId: string;
  description: string;
}

interface InstallmentPurchase {
  id: string;
  name: string;
  description?: string;
  totalAmount: string;
  numberOfInstallments: number;
  installmentAmount: string;
  remainingBalance: string;
  paidInstallments: number;
  firstDueDate: string;
  status: string;
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  installments?: any[];
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
}

interface BankAccount {
  id: string;
  name: string;
  balance: string;
}

interface PaymentMethod {
  id: string;
  name: string;
}

const initialForm: InstallmentForm = {
  name: '',
  totalAmount: '',
  numberOfInstallments: '',
  firstDueDate: '',
  categoryId: '',
  bankAccountId: '',
  paymentMethodId: '',
  description: '',
};

export default function useInstallments() {
  const [purchases, setPurchases] = useState<InstallmentPurchase[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<InstallmentForm>(initialForm);

  // Estatísticas
  const totalActive = purchases.filter(p => p.status === 'active').length;
  const totalOwed = purchases
    .filter(p => p.status === 'active')
    .reduce((sum, p) => sum + Number(p.remainingBalance), 0);
  const pendingInstallments = purchases
    .filter(p => p.status === 'active')
    .reduce((sum, p) => sum + (p.numberOfInstallments - p.paidInstallments), 0);

  // Carregar dados iniciais
  const loadData = async () => {
    try {
      setLoading(true);
      const [purchasesRes, categoriesRes, accountsRes, methodsRes] = await Promise.all([
        apiClient.get('/installments'),
        apiClient.get('/categories'),
        apiClient.get('/bank-accounts'),
        apiClient.get('/payment-methods'),
      ]);

      setPurchases(purchasesRes.data.installments || []);
      setCategories(categoriesRes.data || []);
      setBankAccounts(accountsRes.data || []);
      setPaymentMethods(methodsRes.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Criar novo parcelamento
  const handleCreatePurchase = async () => {
    try {
      // Validações
      if (!form.name.trim()) {
        toast.error('Nome da compra é obrigatório');
        return;
      }

      const totalAmount = Number(form.totalAmount);
      if (totalAmount <= 0) {
        toast.error('Valor total deve ser maior que zero');
        return;
      }

      const numberOfInstallments = Number(form.numberOfInstallments);
      if (numberOfInstallments < 2) {
        toast.error('Número de parcelas deve ser no mínimo 2');
        return;
      }

      if (!form.firstDueDate) {
        toast.error('Data da primeira parcela é obrigatória');
        return;
      }

      if (!form.categoryId) {
        toast.error('Categoria é obrigatória');
        return;
      }

      if (!form.bankAccountId) {
        toast.error('Conta bancária é obrigatória');
        return;
      }

      setSubmitting(true);

      const payload = {
        name: form.name.trim(),
        totalAmount,
        numberOfInstallments,
        firstDueDate: form.firstDueDate,
        categoryId: form.categoryId,
        bankAccountId: form.bankAccountId,
        paymentMethodId: form.paymentMethodId || undefined,
        description: form.description.trim() || undefined,
      };

      await apiClient.post('/installments', payload);

      toast.success(`Compra parcelada em ${numberOfInstallments}x criada com sucesso!`);
      
      // Recarregar lista e resetar formulário
      await loadData();
      setForm(initialForm);
      
      return true;
    } catch (error: any) {
      console.error('Erro ao criar parcelamento:', error);
      const message = error.response?.data?.message || 'Erro ao criar parcelamento';
      toast.error(message);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // Pagar uma parcela individual
  const handlePayInstallment = async (purchaseId: string, installmentId: string) => {
    try {
      await apiClient.put(`/installments/${purchaseId}/installments/${installmentId}/pay`);

      toast.success('Parcela marcada como paga!');
      
      // Recarregar lista
      await loadData();
    } catch (error: any) {
      console.error('Erro ao pagar parcela:', error);
      const message = error.response?.data?.message || 'Erro ao pagar parcela';
      toast.error(message);
    }
  };

  // Deletar parcelamento
  const handleDeletePurchase = async (id: string) => {
    try {
      await apiClient.delete(`/installments/${id}`);

      toast.success('Compra parcelada removida com sucesso!');
      
      // Remover da lista localmente
      setPurchases(purchases.filter(p => p.id !== id));
    } catch (error: any) {
      console.error('Erro ao deletar parcelamento:', error);
      const message = error.response?.data?.message || 'Erro ao deletar parcelamento';
      toast.error(message);
    }
  };

  return {
    // Estados
    purchases,
    categories,
    bankAccounts,
    paymentMethods,
    loading,
    submitting,
    form,
    setForm,

    // Estatísticas
    totalActive,
    totalOwed,
    pendingInstallments,

    // Ações
    loadData,
    handleCreatePurchase,
    handlePayInstallment,
    handleDeletePurchase,
  };
}
