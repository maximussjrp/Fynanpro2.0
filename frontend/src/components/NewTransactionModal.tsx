'use client';

import { useState, useEffect } from 'react';
import { X, Plus, DollarSign, Calendar, FileText, Tag, CreditCard, Wallet } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  type: string;
  icon?: string;
  color?: string;
  level?: number;
  parentId?: string | null;
  children?: Category[];
}

interface BankAccount {
  id: string;
  name: string;
  type: string;
  institution?: string;
  currentBalance: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
}

interface Transaction {
  id: string;
  amount: string;
  description: string;
  transactionDate: string;
  status: string;
  notes?: string;
  categoryId: string;
  bankAccountId: string;
  paymentMethodId?: string;
  category: Category;
  bankAccount: BankAccount;
  paymentMethod?: PaymentMethod;
  // Campos para parcelas e recorrências
  transactionType?: string; // 'single' | 'recurring' | 'installment'
  parentId?: string | null;
  installmentNumber?: number;
  totalInstallments?: number;
  // Campos para recorrências
  occurrenceNumber?: number;
  totalOccurrences?: number;
  frequency?: string;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transaction?: Transaction | null;
  defaultType?: 'income' | 'expense';
}

export default function TransactionModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  transaction = null,
  defaultType = 'expense' 
}: TransactionModalProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  // Estado para popup de escopo de edição de parcelas
  const [showInstallmentScopePopup, setShowInstallmentScopePopup] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    type: defaultType,
    amount: '',
    description: '',
    transactionDate: new Date().toISOString().split('T')[0],
    categoryId: '',
    bankAccountId: '',
    paymentMethodId: '',
    status: 'completed',
    notes: '',
    totalInstallments: undefined as number | undefined,
  });

  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Estados para criação rápida
  const [showQuickBankAccount, setShowQuickBankAccount] = useState(false);
  const [showQuickPaymentMethod, setShowQuickPaymentMethod] = useState(false);
  const [quickBankAccount, setQuickBankAccount] = useState({ name: '', type: 'bank', institution: '' });
  const [quickPaymentMethod, setQuickPaymentMethod] = useState({ name: '', type: 'pix' });

  useEffect(() => {
    if (isOpen) {
      loadFormData();
      if (transaction) {
        setFormData({
          type: transaction.category.type as 'income' | 'expense',
          amount: transaction.amount,
          description: transaction.description,
          transactionDate: transaction.transactionDate.split('T')[0],
          categoryId: transaction.categoryId,
          bankAccountId: transaction.bankAccountId,
          paymentMethodId: transaction.paymentMethodId || '',
          status: transaction.status,
          notes: transaction.notes || '',
          totalInstallments: undefined,
        });
        setCategorySearch(transaction.category.name);
      } else {
        resetForm();
      }
    }
  }, [isOpen, transaction]);

  const resetForm = () => {
    setFormData({
      type: defaultType,
      amount: '',
      description: '',
      transactionDate: new Date().toISOString().split('T')[0],
      categoryId: '',
      bankAccountId: '',
      paymentMethodId: '',
      status: 'completed',
      notes: '',
      totalInstallments: undefined,
    });
    setCategorySearch('');
  };

  const loadFormData = async () => {
    try {
      const [categoriesRes, accountsRes, paymentsRes] = await Promise.all([
        api.get('/categories?isActive=true'),
        api.get('/bank-accounts?isActive=true'),
        api.get('/payment-methods?isActive=true'),
      ]);

      setCategories(categoriesRes.data.data.categories || []);
      setBankAccounts(accountsRes.data.data.accounts || []);
      setPaymentMethods(paymentsRes.data.data.methods || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados do formulário:', error);
      toast.error('Erro ao carregar dados do formulário');
    }
  };

  // Função para criar conta bancária rapidamente
  const handleQuickCreateBankAccount = async () => {
    if (!quickBankAccount.name || !quickBankAccount.institution) {
      toast.error('Preencha nome e instituição');
      return;
    }
    try {
      const response = await api.post('/bank-accounts', {
        name: quickBankAccount.name,
        type: quickBankAccount.type,
        institution: quickBankAccount.institution,
        initialBalance: 0,
      });
      const newAccount = response.data?.data;
      if (!newAccount || !newAccount.id) {
        toast.error('Erro: resposta inválida da API');
        return;
      }
      setBankAccounts(prev => [...prev, newAccount]);
      setFormData(prev => ({ ...prev, bankAccountId: newAccount.id }));
      setShowQuickBankAccount(false);
      setQuickBankAccount({ name: '', type: 'bank', institution: '' });
      toast.success('Conta criada com sucesso!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao criar conta');
    }
  };

  // Função para criar meio de pagamento rapidamente
  const handleQuickCreatePaymentMethod = async () => {
    if (!quickPaymentMethod.name) {
      toast.error('Preencha o nome do método');
      return;
    }
    try {
      const response = await api.post('/payment-methods', {
        name: quickPaymentMethod.name,
        type: quickPaymentMethod.type,
      });
      const newMethod = response.data?.data;
      if (!newMethod || !newMethod.id) {
        toast.error('Erro: resposta inválida da API');
        return;
      }
      setPaymentMethods(prev => [...prev, newMethod]);
      setFormData(prev => ({ ...prev, paymentMethodId: newMethod.id }));
      setShowQuickPaymentMethod(false);
      setQuickPaymentMethod({ name: '', type: 'pix' });
      toast.success('Método criado com sucesso!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao criar método');
    }
  };

  // Verifica se a transação é uma parcela de um parcelamento
  const isInstallmentChild = () => {
    return transaction && 
           transaction.transactionType === 'installment' && 
           transaction.parentId;
  };

  // Verifica se a transação é uma ocorrência de uma recorrência
  const isRecurringChild = () => {
    return transaction && 
           transaction.transactionType === 'recurring' && 
           transaction.parentId;
  };

  // Verifica se é uma transação que faz parte de um grupo (parcela ou recorrente)
  const isGroupedTransaction = () => {
    return isInstallmentChild() || isRecurringChild();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.description || !formData.categoryId || !formData.bankAccountId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const payload: any = {
      type: formData.type,
      amount: parseFloat(formData.amount.replace(',', '.')),
      description: formData.description,
      transactionDate: formData.transactionDate,
      categoryId: formData.categoryId,
      bankAccountId: formData.bankAccountId,
      paymentMethodId: formData.paymentMethodId || undefined,
      status: formData.status,
      notes: formData.notes || undefined,
    };

    // Se alterou o total de parcelas, incluir no payload
    if (formData.totalInstallments && transaction?.totalInstallments && formData.totalInstallments !== transaction.totalInstallments) {
      payload.totalInstallments = formData.totalInstallments;
    }

    // Se está editando uma parcela OU uma recorrência, mostrar popup de escopo
    if (transaction && isGroupedTransaction()) {
      setPendingFormData(payload);
      setShowInstallmentScopePopup(true);
      return;
    }

    // Caso normal: salvar diretamente
    await saveTransaction(payload);
  };

  // Função para salvar transação com escopo opcional
  const saveTransaction = async (payload: any, scope?: 'this' | 'thisAndFuture' | 'all') => {
    setLoading(true);

    try {
      if (transaction) {
        if (scope && isGroupedTransaction()) {
          // Edição em lote de parcelas ou recorrências
          await api.put(`/transactions/${transaction.id}/batch`, { ...payload, scope });
          const isRecurring = isRecurringChild();
          const scopeLabels = {
            'this': isRecurring ? 'esta ocorrência' : 'esta parcela',
            'thisAndFuture': isRecurring ? 'esta e as próximas ocorrências' : 'esta e as próximas parcelas',
            'all': isRecurring ? 'todas as ocorrências' : 'todas as parcelas'
          };
          toast.success(`Alteração aplicada em ${scopeLabels[scope]}!`);
        } else {
          await api.put(`/transactions/${transaction.id}`, payload);
          toast.success('Transação atualizada com sucesso!');
        }
      } else {
        await api.post('/transactions', payload);
        toast.success('Transação criada com sucesso!');
      }

      onSuccess();
      onClose();
      resetForm();
      setShowInstallmentScopePopup(false);
      setPendingFormData(null);
    } catch (error: any) {
      console.error('Erro ao salvar transação:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar transação');
    } finally {
      setLoading(false);
    }
  };

  // Handler para seleção de escopo no popup
  const handleScopeSelect = (scope: 'this' | 'thisAndFuture' | 'all') => {
    if (pendingFormData) {
      saveTransaction(pendingFormData, scope);
    }
  };

  // Handler para cancelar popup de escopo
  const handleScopeCancel = () => {
    setShowInstallmentScopePopup(false);
    setPendingFormData(null);
  };

  // Função para construir lista hierárquica de categorias
  const buildHierarchicalList = (cats: Category[], searchTerm: string = ''): Array<{ category: Category; level: number; indent: number }> => {
    const result: Array<{ category: Category; level: number; indent: number }> = [];
    const search = searchTerm.toLowerCase().trim();
    
    const addCategoryWithChildren = (cat: Category, indent: number = 0) => {
      // Se há busca, verificar se a categoria ou algum filho corresponde
      const catMatches = cat.name.toLowerCase().includes(search);
      const hasMatchingChildren = cat.children?.some(child => 
        child.name.toLowerCase().includes(search)
      );
      
      // Adicionar categoria se não há busca, ou se ela/filhos correspondem
      if (!search || catMatches || hasMatchingChildren) {
        result.push({ category: cat, level: cat.level || 1, indent });
      }
      
      // Adicionar filhos
      if (cat.children && cat.children.length > 0) {
        cat.children.forEach(child => {
          const childMatches = child.name.toLowerCase().includes(search);
          // Se não há busca, ou filho corresponde, ou pai correspondeu
          if (!search || childMatches || catMatches) {
            result.push({ category: child, level: child.level || 2, indent: indent + 1 });
            
            // Adicionar netos se existirem
            if (child.children && child.children.length > 0) {
              child.children.forEach(grandchild => {
                const grandchildMatches = grandchild.name.toLowerCase().includes(search);
                if (!search || grandchildMatches || childMatches || catMatches) {
                  result.push({ category: grandchild, level: grandchild.level || 3, indent: indent + 2 });
                }
              });
            }
          }
        });
      }
    };
    
    // Adicionar apenas categorias raiz (parentId null ou undefined) e suas filhas
    cats
      .filter(c => !c.parentId && (c.level === 1 || c.level === undefined))
      .forEach(cat => addCategoryWithChildren(cat));
    
    return result;
  };

  // Filtrar por tipo e construir hierarquia com busca
  const categoriesByType = categories.filter(c => c.type === formData.type);
  const filteredCategories = buildHierarchicalList(categoriesByType, categorySearch);

  const handleCategorySelect = (category: Category) => {
    setFormData({ ...formData, categoryId: category.id });
    setCategorySearch(category.name);
    setShowCategoryDropdown(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1F4FD8] to-[#1A44BF] px-6 py-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3 font-poppins">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <DollarSign className="w-6 h-6" />
            </div>
            {transaction ? 'Editar Transação' : 'Nova Transação'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-all text-white"
            aria-label="Fechar modal"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 font-inter">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Valor */}
            <div>
              <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
                Valor *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-[#1F4FD8] font-semibold">R$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-14 pr-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#F9FAFB] text-gray-900 placeholder:text-gray-400"
                  placeholder="0,00"
                  required
                />
              </div>
            </div>

            {/* Data */}
            <div>
              <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
                Data *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Calendar className="w-5 h-5 text-[#1F4FD8]" />
                </div>
                <input
                  type="date"
                  value={formData.transactionDate}
                  onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#F9FAFB] text-gray-900 appearance-none"
                  style={{ colorScheme: 'light' }}
                  required
                  title="Data da transação"
                  aria-label="Data da transação"
                />
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
              Descrição *
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#F9FAFB] text-gray-900 placeholder:text-gray-400"
              placeholder="Ex: Salário, Aluguel, Compras..."
              required
            />
          </div>

          {/* Categoria com busca */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
              Categoria *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Tag className="w-5 h-5 text-[#1F4FD8]" />
              </div>
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => {
                  setCategorySearch(e.target.value);
                  setShowCategoryDropdown(true);
                }}
                onFocus={() => setShowCategoryDropdown(true)}
                className="w-full pl-12 pr-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#F9FAFB] text-gray-900 placeholder:text-gray-400"
                placeholder="Buscar categoria..."
                required
              />
              
              {showCategoryDropdown && filteredCategories.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                  {filteredCategories.map(({ category, level, indent }) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      className="w-full py-3 text-left hover:bg-[#F4F7FB] transition-colors flex items-center gap-3 border-b border-gray-100 last:border-0"
                      style={{ paddingLeft: `${16 + (indent * 24)}px`, paddingRight: '16px' }}
                    >
                      {indent > 0 && (
                        <span className="text-gray-400 text-sm mr-1">
                          {indent === 1 ? '└' : '  └'}
                        </span>
                      )}
                      <span className="text-xl">{category.icon}</span>
                      <div className="flex-1">
                        <p className={`${level === 1 ? 'font-bold' : level === 2 ? 'font-semibold' : 'font-medium'} text-[#1A1A1A]`}>
                          {category.name}
                        </p>
                        {level === 1 && category.children && category.children.length > 0 && (
                          <p className="text-xs text-gray-500 mt-0.5">{category.children.length} subcategorias</p>
                        )}
                      </div>
                      <div
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: category.color }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Conta Bancária */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-[#1A1A1A]">
                  Conta Bancária *
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickBankAccount(!showQuickBankAccount)}
                  className="text-xs text-[#1F4FD8] hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Nova Conta
                </button>
              </div>
              
              {showQuickBankAccount && (
                <div className="mb-3 p-3 bg-[#EFF6FF] border border-blue-200 rounded-lg space-y-2">
                  <input
                    type="text"
                    placeholder="Nome da conta"
                    value={quickBankAccount.name}
                    onChange={(e) => setQuickBankAccount({ ...quickBankAccount, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={quickBankAccount.type}
                      onChange={(e) => setQuickBankAccount({ ...quickBankAccount, type: e.target.value })}
                      className="px-3 py-2 text-sm border rounded-lg"
                      title="Tipo de conta"
                    >
                      <option value="bank">Conta Bancária</option>
                      <option value="wallet">Carteira Digital</option>
                      <option value="investment">Investimento</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Instituição"
                      value={quickBankAccount.institution}
                      onChange={(e) => setQuickBankAccount({ ...quickBankAccount, institution: e.target.value })}
                      className="px-3 py-2 text-sm border rounded-lg"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowQuickBankAccount(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickCreateBankAccount}
                      className="px-3 py-1.5 text-sm bg-[#1F4FD8] text-white rounded hover:bg-[#1A44BF]"
                    >
                      Criar
                    </button>
                  </div>
                </div>
              )}
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Wallet className="w-5 h-5 text-[#1F4FD8]" />
                </div>
                <select
                  value={formData.bankAccountId}
                  onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#F9FAFB] text-gray-900 appearance-none cursor-pointer"
                  required
                  title="Selecione conta bancária"
                  aria-label="Conta Bancária"
                >
                  <option value="">Selecione uma conta</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} - {account.institution}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Meio de Pagamento (opcional) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-[#1A1A1A]">
                  Meio de Pagamento <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickPaymentMethod(!showQuickPaymentMethod)}
                  className="text-xs text-[#1F4FD8] hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Novo Método
                </button>
              </div>
              
              {showQuickPaymentMethod && (
                <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-2">
                  <input
                    type="text"
                    placeholder="Ex: PIX Nubank, Cartão Inter, Dinheiro..."
                    value={quickPaymentMethod.name}
                    onChange={(e) => setQuickPaymentMethod({ ...quickPaymentMethod, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    aria-label="Nome do meio de pagamento"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowQuickPaymentMethod(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickCreatePaymentMethod}
                      className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                      Criar
                    </button>
                  </div>
                </div>
              )}
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <CreditCard className="w-5 h-5 text-[#1F4FD8]" />
                </div>
                <select
                  value={formData.paymentMethodId}
                  onChange={(e) => setFormData({ ...formData, paymentMethodId: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#F9FAFB] text-gray-900 appearance-none cursor-pointer"
                  title="Selecione meio de pagamento"
                  aria-label="Meio de Pagamento"
                >
                  <option value="">Selecione (opcional)</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
              Status
            </label>
            <div className="flex gap-3">
              <label className="flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                formData.status === 'completed'
                  ? 'border-[#2ECC9A] bg-[#DCFCE7]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }">
                <input
                  type="radio"
                  value="completed"
                  checked={formData.status === 'completed'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-5 h-5 text-[#2ECC9A] focus:ring-[#2ECC9A]"
                />
                <span className={`font-semibold ${formData.status === 'completed' ? 'text-[#2ECC9A]' : 'text-gray-700'}`}>Pago</span>
              </label>
              <label className="flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                formData.status === 'pending'
                  ? 'border-[#F59E0B] bg-[#FEF3C7]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }">
                <input
                  type="radio"
                  value="pending"
                  checked={formData.status === 'pending'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-5 h-5 text-[#F59E0B] focus:ring-[#F59E0B]"
                />
                <span className={`font-semibold ${formData.status === 'pending' ? 'text-[#F59E0B]' : 'text-gray-700'}`}>Pendente</span>
              </label>
            </div>
          </div>

          {/* Informações de Parcela (só aparece ao editar uma parcela) */}
          {transaction && isInstallmentChild() && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">💳</span>
                <h4 className="font-semibold text-blue-800">Informações da Parcela</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Parcela Atual
                  </label>
                  <div className="bg-white px-4 py-2 rounded-lg border border-blue-200 text-blue-800 font-semibold">
                    {transaction.installmentNumber} de {transaction.totalInstallments}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Total de Parcelas
                  </label>
                  <input
                    type="number"
                    min={transaction.installmentNumber || 1}
                    max={72}
                    value={formData.totalInstallments || transaction.totalInstallments || ''}
                    onChange={(e) => setFormData({ ...formData, totalInstallments: parseInt(e.target.value) || undefined })}
                    className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all bg-white"
                    placeholder={String(transaction.totalInstallments)}
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    Aumente para adicionar mais parcelas
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
              Observações <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#F9FAFB] text-gray-900 placeholder:text-gray-400 resize-none"
              rows={3}
              placeholder="Adicione notas ou observações..."
            />
          </div>
        </form>

        {/* Footer com Botões */}
        <div className="border-t-2 border-gray-100 px-6 py-4 bg-[#F9FAFB] text-gray-900">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-white hover:shadow-sm transition-all font-semibold"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className={`flex-1 px-6 py-3.5 rounded-xl font-bold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-white ${
                formData.type === 'income'
                  ? 'bg-gradient-to-r from-[#2ECC9A] to-[#27B589] hover:from-[#27B589] hover:to-[#1D9A6B]'
                  : 'bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:from-[#DC2626] hover:to-[#B91C1C]'
              } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              disabled={loading}
            >
              {loading ? 'Salvando...' : transaction ? 'Atualizar Transação' : 'Criar Transação'}
            </button>
          </div>
        </div>
      </div>

      {/* Popup de Escopo para Edição de Parcelas ou Recorrências */}
      {showInstallmentScopePopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header do popup */}
            <div className="bg-gradient-to-r from-[#1F4FD8] to-[#1A44BF] px-6 py-4">
              <h3 className="text-xl font-bold text-white font-poppins">
                {isRecurringChild() 
                  ? `🔄 Editar Ocorrência ${transaction?.occurrenceNumber || ''}${transaction?.totalOccurrences ? `/${transaction.totalOccurrences}` : ''}`
                  : `📝 Editar Parcela ${transaction?.installmentNumber}/${transaction?.totalInstallments}`
                }
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                {isRecurringChild()
                  ? 'Essa é uma ocorrência de uma conta recorrente. Como deseja aplicar as alterações?'
                  : 'Essa é uma parcela de um parcelamento. Como deseja aplicar as alterações?'
                }
              </p>
            </div>

            {/* Opções */}
            <div className="p-6 space-y-3">
              <button
                onClick={() => handleScopeSelect('this')}
                disabled={loading}
                className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-[#1F4FD8] hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 group-hover:bg-[#1F4FD8] rounded-lg flex items-center justify-center transition-all">
                    <span className="text-xl">1️⃣</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {isRecurringChild() ? 'Apenas nesta ocorrência' : 'Apenas nesta parcela'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isRecurringChild() 
                        ? `A alteração será aplicada somente nesta ocorrência`
                        : `A alteração será aplicada somente na parcela ${transaction?.installmentNumber}`
                      }
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleScopeSelect('thisAndFuture')}
                disabled={loading}
                className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-[#F59E0B] hover:bg-amber-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 group-hover:bg-[#F59E0B] rounded-lg flex items-center justify-center transition-all">
                    <span className="text-xl">⏭️</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {isRecurringChild() ? 'Nesta e nas próximas ocorrências' : 'Nesta e nas próximas'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isRecurringChild()
                        ? 'Aplicar desta ocorrência em diante'
                        : `Da parcela ${transaction?.installmentNumber} até a ${transaction?.totalInstallments}`
                      }
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleScopeSelect('all')}
                disabled={loading}
                className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-[#2ECC9A] hover:bg-emerald-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 group-hover:bg-[#2ECC9A] rounded-lg flex items-center justify-center transition-all">
                    <span className="text-xl">🔄</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {isRecurringChild() ? 'Em todas as ocorrências' : 'Em todas as parcelas'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isRecurringChild()
                        ? 'Aplicar em todas as ocorrências desta recorrência'
                        : `Aplicar em todas as ${transaction?.totalInstallments} parcelas`
                      }
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Footer do popup */}
            <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
              <button
                onClick={handleScopeCancel}
                disabled={loading}
                className="w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-white transition-all font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
