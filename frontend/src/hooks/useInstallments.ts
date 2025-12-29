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

  // Estatísticas básicas
  const activePurchases = purchases.filter(p => p.status === 'active');
  const totalActive = activePurchases.length;
  const totalOwed = activePurchases
    .reduce((sum, p) => sum + Number(p.remainingBalance), 0);
  const pendingInstallments = activePurchases
    .reduce((sum, p) => sum + (p.numberOfInstallments - p.paidInstallments), 0);
    
  // Novas estatísticas
  // Total já pago
  const totalPaid = activePurchases
    .reduce((sum, p) => sum + (Number(p.totalAmount) - Number(p.remainingBalance)), 0);
    
  // Total geral (pago + restante)
  const totalOverall = activePurchases
    .reduce((sum, p) => sum + Number(p.totalAmount), 0);
    
  // Gasto mensal com parcelas (soma de todas as parcelas ativas)
  const monthlyInstallmentSpend = activePurchases
    .reduce((sum, p) => sum + Number(p.installmentAmount), 0);
    
  // Previsão de quitação total (última data de término)
  const payoffDate = activePurchases.reduce((latest, p) => {
    if (!p.firstDueDate || !p.numberOfInstallments) return latest;
    
    const firstDate = new Date(p.firstDueDate.split('T')[0]);
    const lastDate = new Date(firstDate);
    lastDate.setMonth(lastDate.getMonth() + p.numberOfInstallments - 1);
    
    return !latest || lastDate > latest ? lastDate : latest;
  }, null as Date | null);
  
  // Meses restantes até quitação total
  const monthsUntilPayoff = payoffDate 
    ? Math.max(0, Math.ceil((payoffDate.getTime() - new Date().getTime()) / (30 * 24 * 60 * 60 * 1000)))
    : 0;

  // Progresso geral (%)
  const overallProgress = totalOverall > 0 
    ? Math.round((totalPaid / totalOverall) * 100)
    : 0;

  // Breakdown por categoria
  const categoryBreakdown = activePurchases
    .filter(p => p.category)
    .reduce((acc, p) => {
      const catName = p.category?.name || 'Sem categoria';
      const catIcon = p.category?.icon || '📋';
      if (!acc[catName]) {
        acc[catName] = { name: catName, icon: catIcon, total: 0, remaining: 0, count: 0 };
      }
      acc[catName].total += Number(p.totalAmount);
      acc[catName].remaining += Number(p.remainingBalance);
      acc[catName].count += 1;
      return acc;
    }, {} as Record<string, { name: string; icon: string; total: number; remaining: number; count: number }>);
    
  const topCategories = Object.values(categoryBreakdown)
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 5)
    .map(cat => ({
      ...cat,
      percent: totalOwed > 0 ? Math.round((cat.remaining / totalOwed) * 100) : 0
    }));

  // Carregar dados iniciais
  const loadData = async () => {
    try {
      setLoading(true);
      // Buscar tanto do modelo antigo quanto do novo (transações unificadas)
      // Também buscar RecurringBills que podem ser parcelamentos mal classificados
      const [purchasesRes, transactionsRes, recurringBillsRes, categoriesRes, accountsRes, methodsRes] = await Promise.all([
        apiClient.get('/installments'),
        apiClient.get('/transactions?transactionType=installment&limit=1000'), // Buscar parcelamentos
        apiClient.get('/recurring-bills'), // Buscar recorrentes que podem ser parcelamentos
        apiClient.get('/categories'),
        apiClient.get('/bank-accounts'),
        apiClient.get('/payment-methods'),
      ]);

      const oldPurchases = purchasesRes.data.installments || [];
      
      // NOVO: Extrair RecurringBills que parecem parcelamentos
      // Padrão: "Nome - Parcela X/Y" ou nomes que terminam com "X/Y"
      const installmentPattern = /parcela\s*(\d+)\s*\/\s*(\d+)|(\d+)\s*\/\s*(\d+)\s*$/i;
      const recurringBills = recurringBillsRes.data?.data?.recurringBills || [];
      
      // Agrupar RecurringBills de parcelamentos pelo nome base
      const recurringInstallmentsMap: Record<string, any[]> = {};
      recurringBills.forEach((bill: any) => {
        const match = (bill.name || '').match(installmentPattern);
        if (match) {
          // Extrair nome base (sem "Parcela X/Y")
          const baseName = (bill.name || '').replace(installmentPattern, '').replace(/\s*-\s*$/, '').trim();
          if (!recurringInstallmentsMap[baseName]) {
            recurringInstallmentsMap[baseName] = [];
          }
          recurringInstallmentsMap[baseName].push({
            ...bill,
            currentInstallment: parseInt(match[1] || match[3]) || 1,
            totalInstallments: parseInt(match[2] || match[4]) || 1,
          });
        }
      });
      
      // Converter grupos de RecurringBills em InstallmentPurchases
      const purchasesFromRecurring = Object.entries(recurringInstallmentsMap).map(([baseName, bills]) => {
        // Ordenar por número da parcela
        const sortedBills = bills.sort((a, b) => a.currentInstallment - b.currentInstallment);
        const firstBill = sortedBills[0];
        const totalInstallments = firstBill.totalInstallments;
        const installmentAmount = Number(firstBill.amount) || 0;
        const totalAmount = installmentAmount * totalInstallments;
        
        // Contar parcelas pagas (status !== 'active' ou já passaram)
        const paidInstallments = sortedBills.filter((b: any) => b.status !== 'active').length;
        const remainingBalance = installmentAmount * (totalInstallments - paidInstallments);
        
        return {
          id: `recurring-group-${firstBill.id}`,
          name: baseName || firstBill.name,
          description: firstBill.description || '',
          totalAmount: totalAmount.toString(),
          numberOfInstallments: totalInstallments,
          installmentAmount: installmentAmount.toString(),
          remainingBalance: remainingBalance.toString(),
          paidInstallments,
          firstDueDate: firstBill.firstDueDate,
          status: paidInstallments >= totalInstallments ? 'completed' : 'active',
          category: firstBill.category || { id: '', name: 'Sem categoria', icon: '📋', color: '#gray' },
          installments: sortedBills.map((b: any) => ({
            id: b.id,
            installmentNumber: b.currentInstallment,
            amount: b.amount?.toString() || '0',
            dueDate: b.firstDueDate,
            status: b.status === 'active' ? 'pending' : 'paid',
          })),
          isFromRecurringBill: true,
        };
      });
      
      // Converter transações parceladas para o formato de InstallmentPurchase
      const transactions = transactionsRes.data.data?.transactions || [];
      
      // Agrupar por parentId para encontrar grupos de parcelas
      const parentTransactions = transactions.filter((t: any) => !t.parentId && t.transactionType === 'installment');
      const childTransactions = transactions.filter((t: any) => t.parentId && t.transactionType === 'installment');
      
      // Criar um mapa de parent -> parcelas
      const installmentsByParent = childTransactions.reduce((acc: any, t: any) => {
        if (!acc[t.parentId]) acc[t.parentId] = [];
        acc[t.parentId].push(t);
        return acc;
      }, {});
      
      // Também agrupar órfãos (parcelas sem parent na lista)
      const orphanGroups = childTransactions
        .filter((t: any) => !parentTransactions.some((p: any) => p.id === t.parentId))
        .reduce((acc: any, t: any) => {
          if (!acc[t.parentId]) acc[t.parentId] = [];
          acc[t.parentId].push(t);
          return acc;
        }, {});
      
      // Converter transações pai para formato de InstallmentPurchase
      const convertFromParent = (parent: any, installments: any[]) => {
        const sortedInstallments = installments.sort((a: any, b: any) => 
          (a.installmentNumber || 0) - (b.installmentNumber || 0)
        );
        
        const paidInstallments = sortedInstallments.filter((i: any) => i.status === 'completed').length;
        const totalInstallments = parent.totalInstallments || sortedInstallments.length || 1;
        const installmentAmount = Number(parent.amount) || 0;
        const totalAmount = installmentAmount * totalInstallments;
        const remainingBalance = installmentAmount * (totalInstallments - paidInstallments);
        
        return {
          id: parent.id,
          name: parent.description,
          description: parent.notes || '',
          totalAmount: totalAmount.toString(),
          numberOfInstallments: totalInstallments,
          installmentAmount: installmentAmount.toString(),
          remainingBalance: remainingBalance.toString(),
          paidInstallments,
          firstDueDate: parent.transactionDate || sortedInstallments[0]?.transactionDate,
          status: paidInstallments >= totalInstallments ? 'completed' : 'active',
          category: parent.category || sortedInstallments[0]?.category || { id: '', name: 'Sem categoria', icon: '📋', color: '#gray' },
          installments: sortedInstallments.map((i: any) => ({
            id: i.id,
            installmentNumber: i.installmentNumber || 1,
            amount: i.amount?.toString() || '0',
            dueDate: i.transactionDate,
            status: i.status === 'completed' ? 'paid' : 'pending',
            bankAccount: i.bankAccount,
          })),
          isFromTransaction: true,
        };
      };
      
      // Converter parentes com filhos
      const convertedFromParents = parentTransactions.map((parent: any) => {
        const installments = installmentsByParent[parent.id] || [];
        return convertFromParent(parent, installments);
      });
      
      // Converter órfãos (parcelas sem parent)
      const convertedFromOrphans = Object.entries(orphanGroups).map(([parentId, installments]: [string, any]) => {
        const sortedInstallments = installments.sort((a: any, b: any) => 
          (a.installmentNumber || 0) - (b.installmentNumber || 0)
        );
        const first = sortedInstallments[0];
        
        const paidInstallments = sortedInstallments.filter((i: any) => i.status === 'completed').length;
        const totalInstallments = first.totalInstallments || sortedInstallments.length;
        const installmentAmount = Number(first.amount) || 0;
        const totalAmount = installmentAmount * totalInstallments;
        const remainingBalance = installmentAmount * (totalInstallments - paidInstallments);
        
        return {
          id: parentId,
          name: first.description,
          description: first.notes || '',
          totalAmount: totalAmount.toString(),
          numberOfInstallments: totalInstallments,
          installmentAmount: installmentAmount.toString(),
          remainingBalance: remainingBalance.toString(),
          paidInstallments,
          firstDueDate: first.transactionDate,
          status: paidInstallments >= totalInstallments ? 'completed' : 'active',
          category: first.category || { id: '', name: 'Sem categoria', icon: '📋', color: '#gray' },
          installments: sortedInstallments.map((i: any) => ({
            id: i.id,
            installmentNumber: i.installmentNumber || 1,
            amount: i.amount?.toString() || '0',
            dueDate: i.transactionDate,
            status: i.status === 'completed' ? 'paid' : 'pending',
            bankAccount: i.bankAccount,
          })),
          isFromTransaction: true,
        };
      });

      // Combinar todos (inclui parcelamentos de RecurringBills)
      const allPurchases = [...oldPurchases, ...convertedFromParents, ...convertedFromOrphans, ...purchasesFromRecurring];
      
      // Remover duplicatas por ID e por nome base (evitar duplicação se existir em ambos modelos)
      const uniquePurchases = allPurchases.reduce((acc: any[], purchase: any) => {
        // Verificar se já existe por ID
        if (acc.find(p => p.id === purchase.id)) {
          return acc;
        }
        // Verificar se já existe por nome similar (para evitar duplicatas entre modelos)
        const normalizedName = (purchase.name || '').toLowerCase().trim();
        if (acc.find(p => (p.name || '').toLowerCase().trim() === normalizedName)) {
          return acc;
        }
        acc.push(purchase);
        return acc;
      }, []);

      setPurchases(uniquePurchases);
      setCategories(categoriesRes.data?.data?.categories || categoriesRes.data || []);
      setBankAccounts(accountsRes.data?.data?.accounts || accountsRes.data || []);
      setPaymentMethods(methodsRes.data?.data?.paymentMethods || methodsRes.data || []);
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

    // Estatísticas básicas
    totalActive,
    totalOwed,
    pendingInstallments,
    
    // Novas estatísticas
    totalPaid,
    totalOverall,
    monthlyInstallmentSpend,
    payoffDate,
    monthsUntilPayoff,
    overallProgress,
    topCategories,

    // Ações
    loadData,
    handleCreatePurchase,
    handlePayInstallment,
    handleDeletePurchase,
  };
}
