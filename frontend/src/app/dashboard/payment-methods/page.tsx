'use client';

import { useAuth } from '@/stores/auth';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { CreditCard, Plus, Edit2, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';



interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  lastFourDigits?: string;
  cardNetwork?: string;
  expirationDate?: string;
  bankAccount?: {
    id: string;
    name: string;
    currentBalance: string;
  };
  isActive: boolean;
  createdAt: string;
}

interface BankAccount {
  id: string;
  name: string;
  currentBalance: string;
}

interface PaymentMethodForm {
  name: string;
  type: string;
  bankAccountId: string;
  lastFourDigits: string;
  cardNetwork: string;
  expirationDate: string;
}

export default function PaymentMethodsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [methodForm, setMethodForm] = useState<PaymentMethodForm>({
    name: '',
    type: 'pix',
    bankAccountId: '',
    lastFourDigits: '',
    cardNetwork: '',
    expirationDate: '',
  });

  useEffect(() => {
    const token = accessToken;
    if (!token) {
      router.push('/');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [methodsRes, accountsRes] = await Promise.all([
        api.get('/payment-methods'),
        api.get('/bank-accounts?isActive=true'),
      ]);

      setPaymentMethods(methodsRes.data.data.paymentMethods || []);
      setBankAccounts(accountsRes.data.data.accounts || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload: any = {
        name: methodForm.name,
        type: methodForm.type,
      };

      // Campos específicos para cartões
      if (methodForm.type === 'credit_card' || methodForm.type === 'debit_card') {
        if (methodForm.bankAccountId) {
          payload.bankAccountId = methodForm.bankAccountId;
        }
        if (methodForm.lastFourDigits) {
          payload.lastFourDigits = methodForm.lastFourDigits;
        }
        if (methodForm.cardNetwork) {
          payload.cardNetwork = methodForm.cardNetwork;
        }
        if (methodForm.expirationDate) {
          payload.expirationDate = new Date(methodForm.expirationDate).toISOString();
        }
      }

      await api.post('/payment-methods', payload);
      
      toast.success('Meio de pagamento criado com sucesso!');
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Erro ao criar meio de pagamento:', error);
      toast.error(error.response?.data?.message || 'Erro ao criar meio de pagamento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMethod) return;
    setSubmitting(true);

    try {
      const payload: any = {
        name: methodForm.name,
      };

      if (methodForm.type === 'credit_card' || methodForm.type === 'debit_card') {
        if (methodForm.bankAccountId) {
          payload.bankAccountId = methodForm.bankAccountId;
        }
        if (methodForm.lastFourDigits) {
          payload.lastFourDigits = methodForm.lastFourDigits;
        }
        if (methodForm.cardNetwork) {
          payload.cardNetwork = methodForm.cardNetwork;
        }
        if (methodForm.expirationDate) {
          payload.expirationDate = new Date(methodForm.expirationDate).toISOString();
        }
      }

      await api.put(`/payment-methods/${editingMethod.id}`, payload);
      
      toast.success('Meio de pagamento atualizado com sucesso!');
      setShowEditModal(false);
      setEditingMethod(null);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Erro ao editar meio de pagamento:', error);
      toast.error(error.response?.data?.message || 'Erro ao editar meio de pagamento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMethod = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este meio de pagamento?')) return;

    try {
      await api.delete(`/payment-methods/${id}`);
      toast.success('Meio de pagamento excluído com sucesso!');
      loadData();
    } catch (error: any) {
      console.error('Erro ao excluir meio de pagamento:', error);
      toast.error(error.response?.data?.message || 'Erro ao excluir meio de pagamento');
    }
  };

  const openEditModal = (method: PaymentMethod) => {
    setEditingMethod(method);
    setMethodForm({
      name: method.name,
      type: method.type,
      bankAccountId: method.bankAccount?.id || '',
      lastFourDigits: method.lastFourDigits || '',
      cardNetwork: method.cardNetwork || '',
      expirationDate: method.expirationDate ? method.expirationDate.split('T')[0] : '',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setMethodForm({
      name: '',
      type: 'pix',
      bankAccountId: '',
      lastFourDigits: '',
      cardNetwork: '',
      expirationDate: '',
    });
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      pix: 'PIX',
      debit_card: 'Cartão de Débito',
      credit_card: 'Cartão de Crédito',
      bank_slip: 'Boleto',
      cash: 'Dinheiro',
      bank_transfer: 'Transferência',
      other: 'Outro',
    };
    return types[type] || type;
  };

  const getTypeIcon = (type: string) => {
    if (type === 'credit_card' || type === 'debit_card') {
      return <CreditCard className="w-6 h-6" />;
    }
    return <Wallet className="w-6 h-6" />;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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
                <CreditCard className="w-8 h-8" />
                Meios de Pagamento
              </h1>
              <p className="text-gray-600 mt-1">Gerencie seus métodos de pagamento</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Novo Meio de Pagamento
          </button>
        </div>

        {/* Cards de Meios de Pagamento */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
                    {getTypeIcon(method.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-800">
                      {method.name}
                      {method.lastFourDigits && (
                        <span className="ml-2 font-mono text-base text-gray-600">•••• {method.lastFourDigits}</span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {getTypeLabel(method.type)}
                      {method.cardNetwork && <span className="ml-1">• {method.cardNetwork}</span>}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${method.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {method.isActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>



              {method.bankAccount && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Conta vinculada</p>
                  <p className="text-sm font-medium">{method.bankAccount.name}</p>
                  <p className="text-xs text-gray-600">
                    {formatCurrency(Number(method.bankAccount.currentBalance))}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => openEditModal(method)}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteMethod(method.id)}
                  className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>

        {paymentMethods.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg">
            <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nenhum meio de pagamento cadastrado</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Criar primeiro meio de pagamento
            </button>
          </div>
        )}
      </div>

      {/* Modal Criar */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Novo Meio de Pagamento</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMethod} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  value={methodForm.name}
                  onChange={(e) => setMethodForm({ ...methodForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Nubank Crédito, PIX Inter..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                <select
                  required
                  value={methodForm.type}
                  onChange={(e) => setMethodForm({ ...methodForm, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pix">PIX</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="debit_card">Cartão de Débito</option>
                  <option value="bank_slip">Boleto</option>
                  <option value="cash">Dinheiro</option>
                  <option value="bank_transfer">Transferência</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              {(methodForm.type === 'credit_card' || methodForm.type === 'debit_card') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Conta Bancária (opcional)</label>
                    <select
                      value={methodForm.bankAccountId}
                      onChange={(e) => setMethodForm({ ...methodForm, bankAccountId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione a conta</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} - {formatCurrency(Number(account.currentBalance))}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Associe a conta onde este meio será usado na transação</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Últimos 4 dígitos</label>
                    <input
                      type="text"
                      maxLength={4}
                      pattern="[0-9]{4}"
                      value={methodForm.lastFourDigits}
                      onChange={(e) => setMethodForm({ ...methodForm, lastFourDigits: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="1234"
                    />
                    <p className="text-xs text-gray-500 mt-1">Para identificar o cartão (ex: Nubank •••• 2482)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bandeira</label>
                    <select
                      value={methodForm.cardNetwork}
                      onChange={(e) => setMethodForm({ ...methodForm, cardNetwork: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione</option>
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="Elo">Elo</option>
                      <option value="American Express">American Express</option>
                      <option value="Hipercard">Hipercard</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data de Validade</label>
                    <input
                      type="date"
                      value={methodForm.expirationDate}
                      onChange={(e) => setMethodForm({ ...methodForm, expirationDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {showEditModal && editingMethod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Editar Meio de Pagamento</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleEditMethod} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  value={methodForm.name}
                  onChange={(e) => setMethodForm({ ...methodForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {(methodForm.type === 'credit_card' || methodForm.type === 'debit_card') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Conta Bancária *</label>
                    <select
                      required
                      value={methodForm.bankAccountId}
                      onChange={(e) => setMethodForm({ ...methodForm, bankAccountId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione a conta</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Últimos 4 dígitos *</label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      pattern="[0-9]{4}"
                      value={methodForm.lastFourDigits}
                      onChange={(e) => setMethodForm({ ...methodForm, lastFourDigits: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bandeira *</label>
                    <select
                      required
                      value={methodForm.cardNetwork}
                      onChange={(e) => setMethodForm({ ...methodForm, cardNetwork: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione</option>
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="Elo">Elo</option>
                      <option value="American Express">American Express</option>
                      <option value="Hipercard">Hipercard</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data de Validade</label>
                    <input
                      type="date"
                      value={methodForm.expirationDate}
                      onChange={(e) => setMethodForm({ ...methodForm, expirationDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
