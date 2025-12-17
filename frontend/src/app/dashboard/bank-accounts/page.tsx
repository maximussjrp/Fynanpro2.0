'use client';

import { useAuth } from '@/stores/auth';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Wallet, Plus, Edit2, Trash2, ArrowLeftRight, Building2, X, DollarSign } from 'lucide-react';



interface BankAccount {
  id: string;
  name: string;
  type: string;
  institution: string;
  currentBalance: string;
  isActive: boolean;
  createdAt: string;
}

interface AccountForm {
  name: string;
  type: string;
  institution: string;
  initialBalance: string;
}

interface TransferForm {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  description: string;
}

export default function BankAccountsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [accountForm, setAccountForm] = useState<AccountForm>({
    name: '',
    type: 'bank',
    institution: '',
    initialBalance: '0',
  });

  const [transferForm, setTransferForm] = useState<TransferForm>({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    const token = accessToken;
    if (!token) {
      router.push('/');
      return;
    }
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await api.get('/bank-accounts?isActive=true');
      const data = response.data.data || response.data;
      const accountsList = data.accounts || data || [];
      setAccounts(Array.isArray(accountsList) ? accountsList : []);
    } catch (error: any) {
      console.error('Erro ao carregar contas:', error.response?.data || error.message);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post('/bank-accounts', {
        ...accountForm,
        initialBalance: parseFloat(accountForm.initialBalance) || 0,
      });
      
      toast.success('Conta bancária criada com sucesso!');
      setShowCreateModal(false);
      setAccountForm({ name: '', type: 'bank', institution: '', initialBalance: '0' });
      
      // Aguardar um momento e recarregar as contas
      setTimeout(() => {
        loadAccounts();
      }, 300);
    } catch (error: any) {
      console.error('Erro ao criar conta:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || 'Erro ao criar conta bancária';
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setSubmitting(true);

    try {
      await api.put(`/bank-accounts/${editingAccount.id}`, accountForm);
      
      toast.success('Conta bancária atualizada!');
      setShowEditModal(false);
      setEditingAccount(null);
      setAccountForm({ name: '', type: 'bank', institution: '', initialBalance: '0' });
      loadAccounts();
    } catch (error: any) {
      console.error('Erro ao editar conta:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Erro ao editar conta bancária');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta bancária?')) return;

    try {
      await api.delete(`/bank-accounts/${id}`);
      toast.success('Conta bancária excluída!');
      loadAccounts();
    } catch (error: any) {
      console.error('Erro ao excluir conta:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Erro ao excluir conta bancária');
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post('/bank-accounts/transfer/execute', {
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        amount: parseFloat(transferForm.amount),
        description: transferForm.description,
        transactionDate: new Date().toISOString(),
      });
      
      toast.success('Transferência realizada com sucesso!');
      setShowTransferModal(false);
      setTransferForm({ fromAccountId: '', toAccountId: '', amount: '', description: '' });
      loadAccounts();
    } catch (error: any) {
      console.error('Erro ao transferir:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Erro ao realizar transferência');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (account: BankAccount) => {
    setEditingAccount(account);
    setAccountForm({
      name: account.name,
      type: account.type,
      institution: account.institution,
      initialBalance: account.currentBalance,
    });
    setShowEditModal(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getAccountTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      bank: 'Conta Bancária',
      savings: 'Poupança',
      investment: 'Investimento',
      cash: 'Dinheiro',
      other: 'Outro',
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              ←
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                <Wallet className="w-8 h-8" />
                Contas Bancárias
              </h1>
              <p className="text-gray-600 mt-1">Gerencie suas contas e faça transferências</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowTransferModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <ArrowLeftRight className="w-5 h-5" />
              Transferir
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nova Conta
            </button>
          </div>
        </div>

        {/* Cards de Contas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.isArray(accounts) && accounts.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#DBEAFE] rounded-lg">
                    <Building2 className="w-6 h-6 text-[#1F4FD8]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-800">{account.name}</h3>
                    <p className="text-sm text-gray-500">{account.institution}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${account.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {account.isActive ? 'Ativa' : 'Inativa'}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">{getAccountTypeLabel(account.type)}</p>
                <p className="text-2xl font-bold text-gray-800">
                  {formatCurrency(Number(account.currentBalance))}
                </p>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => openEditModal(account)}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteAccount(account.id)}
                  className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>

        {accounts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg">
            <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nenhuma conta bancária cadastrada</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-6 py-2 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] transition-colors"
            >
              Criar primeira conta
            </button>
          </div>
        )}
      </div>

      {/* Modal Criar Conta */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Nova Conta Bancária</h2>
              <button onClick={() => setShowCreateModal(false)} title="Fechar" aria-label="Fechar modal" className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Conta *</label>
                <input
                  type="text"
                  required
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                  placeholder="Ex: Nubank, Inter, Bradesco..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                <select
                  required
                  value={accountForm.type}
                  onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}
                  aria-label="Tipo de conta"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                >
                  <option value="bank">Conta Bancária</option>
                  <option value="wallet">Carteira/Dinheiro</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="investment">Investimento</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Instituição</label>
                <input
                  type="text"
                  value={accountForm.institution}
                  onChange={(e) => setAccountForm({ ...accountForm, institution: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                  placeholder="Ex: Nubank, Banco Inter..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Saldo Inicial *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={accountForm.initialBalance}
                  onChange={(e) => setAccountForm({ ...accountForm, initialBalance: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Criando...' : 'Criar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Conta */}
      {showEditModal && editingAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Editar Conta</h2>
              <button onClick={() => setShowEditModal(false)} title="Fechar" aria-label="Fechar modal" className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEditAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Conta *</label>
                <input
                  type="text"
                  required
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  aria-label="Nome da Conta"
                  placeholder="Digite o nome da conta"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                <select
                  required
                  value={accountForm.type}
                  onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}
                  aria-label="Tipo de Conta"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                >
                  <option value="bank">Conta Bancária</option>
                  <option value="wallet">Carteira/Dinheiro</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="investment">Investimento</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Saldo Inicial *</label>
                <input
                  type="text"
                  value={accountForm.institution}
                  onChange={(e) => setAccountForm({ ...accountForm, institution: e.target.value })}
                  aria-label="Saldo Inicial"
                  placeholder="Digite o saldo inicial"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Transferência */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Transferência entre Contas</h2>
              <button onClick={() => setShowTransferModal(false)} title="Fechar" aria-label="Fechar modal" className="text-gray-500 hover:text-gray-700">
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
                  aria-label="Conta Origem"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                >
                  <option value="">Selecione a conta de origem</option>
                  {Array.isArray(accounts) && accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} - {formatCurrency(Number(account.currentBalance))}
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
                  aria-label="Conta Destino"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                >
                  <option value="">Selecione a conta de destino</option>
                  {Array.isArray(accounts) && accounts
                    .filter((account) => account.id !== transferForm.fromAccountId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} - {formatCurrency(Number(account.currentBalance))}
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                <input
                  type="text"
                  value={transferForm.description}
                  onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                  placeholder="Ex: Transferência para reserva de emergência"
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
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Transferindo...' : 'Transferir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
