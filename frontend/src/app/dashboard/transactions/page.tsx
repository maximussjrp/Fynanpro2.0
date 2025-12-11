'use client';

import { useAuth } from '@/stores/auth';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import TransactionModal from '@/components/NewTransactionModal';
import UnifiedTransactionModal from '@/components/UnifiedTransactionModal';
import { Receipt, Filter, Edit2, Trash2, Calendar, TrendingDown, TrendingUp, CheckCircle, XCircle, Clock, Plus, ArrowLeft, Repeat, CreditCard } from 'lucide-react';

interface Transaction {
  id: string;
  amount: string;
  description: string;
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

export default function TransactionsPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // Filtros
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    categoryId: '',
    bankAccountId: '',
    type: 'all' as 'all' | 'income' | 'expense',
    status: 'all' as 'all' | 'completed' | 'pending',
  });

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
      if (filters.type !== 'all') params.type = filters.type;
      if (filters.status !== 'all') params.status = filters.status;

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
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getTotals = () => {
    // Receitas realizadas (completadas)
    const completedIncome = transactions
      .filter(t => t.category && t.category.type === 'income' && t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    // Receitas pendentes
    const pendingIncome = transactions
      .filter(t => t.category && t.category.type === 'income' && t.status === 'pending')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    // Despesas realizadas (completadas)
    const completedExpense = transactions
      .filter(t => t.category && t.category.type === 'expense' && t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    // Despesas pendentes
    const pendingExpense = transactions
      .filter(t => t.category && t.category.type === 'expense' && t.status === 'pending')
      .reduce((sum, t) => sum + Number(t.amount), 0);

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
              <p className="text-gray-600 mt-1">{transactions.length} transações encontradas</p>
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
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              title="Transação simples"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Simples</span>
            </button>
            <button
              onClick={() => setShowUnifiedModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-[#1C6DD0] to-[#1557A8] text-white rounded-lg hover:from-[#1557A8] hover:to-[#0E4A8A] transition-all flex items-center gap-2 shadow-md"
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
              <div className="p-3 bg-blue-100 rounded-lg">
                <Receipt className="w-6 h-6 text-blue-600" />
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  title="Data inicial do filtro"
                  aria-label="Data inicial do filtro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Final</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  title="Data final do filtro"
                  aria-label="Data final do filtro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                <select
                  value={filters.categoryId}
                  onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  title="Filtrar por conta bancária"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  title="Filtrar por tipo de transação"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
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
                        <span className={transaction.category?.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                          {transaction.category?.type === 'income' ? '+' : '-'} {formatCurrency(Number(transaction.amount))}
                        </span>
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
                className="mt-4 px-6 py-3 bg-gradient-to-r from-[#1C6DD0] to-[#1557A8] text-white rounded-lg hover:from-[#1557A8] hover:to-[#0E4A8A] transition-all inline-flex items-center gap-2 shadow-md"
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
