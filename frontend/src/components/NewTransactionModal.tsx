'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus, DollarSign, Calendar, FileText, Tag, CreditCard, Wallet, Edit2, Trash2, AlertTriangle, ChevronDown } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Textarea from '@/components/ui/Textarea';

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
  type?: 'income' | 'expense' | 'transfer'; // Tipo direto da transação
  transactionDate: string;
  status: string;
  notes?: string;
  categoryId: string;
  bankAccountId: string;
  paymentMethodId?: string;
  categorySplits?: Array<{
    id?: string;
    categoryId: string;
    amount: string | number;
    note?: string;
    category?: {
      id: string;
      name: string;
      type?: string;
      icon?: string;
      color?: string;
    };
  }>;
  category?: Category; // Pode ser nulo em transações sem categoria
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
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [categorySplits, setCategorySplits] = useState<Array<{ categoryId: string; amount: string; note: string }>>([
    { categoryId: '', amount: '', note: '' },
  ]);

  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Estados para criação rápida
  const [showQuickBankAccount, setShowQuickBankAccount] = useState(false);
  const [showQuickPaymentMethod, setShowQuickPaymentMethod] = useState(false);
  const [quickBankAccount, setQuickBankAccount] = useState({ name: '', type: 'bank', institution: '' });
  const [quickPaymentMethod, setQuickPaymentMethod] = useState({ name: '', type: 'pix' });

  // Estados para dropdown customizado de meios de pagamento
  const [showPaymentMethodDropdown, setShowPaymentMethodDropdown] = useState(false);
  const [hoveredPaymentMethodId, setHoveredPaymentMethodId] = useState<string | null>(null);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null);
  const [showEditPaymentMethodModal, setShowEditPaymentMethodModal] = useState(false);
  const [editPaymentMethodName, setEditPaymentMethodName] = useState('');
  const [showDeletePaymentMethodModal, setShowDeletePaymentMethodModal] = useState(false);
  const [deletingPaymentMethod, setDeletingPaymentMethod] = useState<PaymentMethod | null>(null);
  const [deletingPaymentMethodTransactionCount, setDeletingPaymentMethodTransactionCount] = useState(0);
  const [paymentMethodActionLoading, setPaymentMethodActionLoading] = useState(false);
  const paymentMethodDropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (paymentMethodDropdownRef.current && !paymentMethodDropdownRef.current.contains(event.target as Node)) {
        setShowPaymentMethodDropdown(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadFormData();
      if (transaction) {
        // Determinar tipo: usar transaction.type direto se existir, senão inferir da categoria
        const transactionTypeValue = transaction.type || transaction.category?.type || defaultType;
        setFormData({
          type: transactionTypeValue as 'income' | 'expense',
          amount: transaction.amount,
          description: transaction.description,
          transactionDate: transaction.transactionDate.split('T')[0],
          categoryId: transaction.categoryId || '',
          bankAccountId: transaction.bankAccountId,
          paymentMethodId: transaction.paymentMethodId || '',
          status: transaction.status,
          notes: transaction.notes || '',
          totalInstallments: undefined,
        });
        setCategorySearch(transaction.category?.name || '');

        if (Array.isArray(transaction.categorySplits) && transaction.categorySplits.length > 0) {
          setSplitEnabled(true);
          setCategorySplits(
            transaction.categorySplits.map(split => ({
              categoryId: split.categoryId,
              amount: Number(split.amount).toString(),
              note: split.note || '',
            }))
          );
        } else {
          setSplitEnabled(false);
          setCategorySplits([{ categoryId: '', amount: '', note: '' }]);
        }
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
    setSplitEnabled(false);
    setCategorySplits([{ categoryId: '', amount: '', note: '' }]);
  };

  const parseMoneyInput = (value: string): number => {
    if (!value) return 0;
    return Number(value.replace(',', '.')) || 0;
  };

  const toCents = (value: number): number => Math.round(value * 100);

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

  // Função para abrir modal de edição de meio de pagamento
  const handleOpenEditPaymentMethod = (e: React.MouseEvent, method: PaymentMethod) => {
    e.stopPropagation();
    setEditingPaymentMethod(method);
    setEditPaymentMethodName(method.name);
    setShowEditPaymentMethodModal(true);
    setShowPaymentMethodDropdown(false);
  };

  // Função para salvar edição do meio de pagamento
  const handleSaveEditPaymentMethod = async () => {
    if (!editingPaymentMethod || !editPaymentMethodName.trim()) {
      toast.error('Preencha o nome do meio de pagamento');
      return;
    }
    setPaymentMethodActionLoading(true);
    try {
      await api.put(`/payment-methods/${editingPaymentMethod.id}`, {
        name: editPaymentMethodName.trim(),
      });
      setPaymentMethods(prev => 
        prev.map(m => m.id === editingPaymentMethod.id ? { ...m, name: editPaymentMethodName.trim() } : m)
      );
      setShowEditPaymentMethodModal(false);
      setEditingPaymentMethod(null);
      setEditPaymentMethodName('');
      toast.success('Meio de pagamento atualizado!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao atualizar meio de pagamento');
    } finally {
      setPaymentMethodActionLoading(false);
    }
  };

  // Função para abrir modal de exclusão de meio de pagamento
  const handleOpenDeletePaymentMethod = async (e: React.MouseEvent, method: PaymentMethod) => {
    e.stopPropagation();
    setDeletingPaymentMethod(method);
    setShowPaymentMethodDropdown(false);
    setPaymentMethodActionLoading(true);
    
    try {
      // Verificar quantas transações estão vinculadas
      const response = await api.get(`/transactions?paymentMethodId=${method.id}&limit=1`);
      const count = response.data?.data?.pagination?.total || 0;
      setDeletingPaymentMethodTransactionCount(count);
      setShowDeletePaymentMethodModal(true);
    } catch (error: any) {
      console.error('Erro ao verificar transações:', error);
      setDeletingPaymentMethodTransactionCount(0);
      setShowDeletePaymentMethodModal(true);
    } finally {
      setPaymentMethodActionLoading(false);
    }
  };

  // Função para confirmar exclusão do meio de pagamento
  const handleConfirmDeletePaymentMethod = async () => {
    if (!deletingPaymentMethod) return;
    
    setPaymentMethodActionLoading(true);
    try {
      await api.delete(`/payment-methods/${deletingPaymentMethod.id}`);
      
      // Remover da lista e limpar seleção se necessário
      setPaymentMethods(prev => prev.filter(m => m.id !== deletingPaymentMethod.id));
      if (formData.paymentMethodId === deletingPaymentMethod.id) {
        setFormData(prev => ({ ...prev, paymentMethodId: '' }));
      }
      
      setShowDeletePaymentMethodModal(false);
      setDeletingPaymentMethod(null);
      toast.success('Meio de pagamento excluído!');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erro ao excluir meio de pagamento';
      if (errorMessage.includes('transações') || errorMessage.includes('Inative')) {
        toast.error('Este meio de pagamento possui transações vinculadas. Não é possível excluí-lo.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setPaymentMethodActionLoading(false);
    }
  };

  // Função para selecionar meio de pagamento
  const handleSelectPaymentMethod = (methodId: string) => {
    setFormData({ ...formData, paymentMethodId: methodId });
    setShowPaymentMethodDropdown(false);
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

  const splitTotal = categorySplits.reduce((sum, split) => sum + parseMoneyInput(split.amount), 0);
  const splitDifference = parseMoneyInput(formData.amount) - splitTotal;

  const updateSplit = (index: number, field: 'categoryId' | 'amount' | 'note', value: string) => {
    setCategorySplits(prev => prev.map((split, i) => (i === index ? { ...split, [field]: value } : split)));
  };

  const addSplit = () => {
    setCategorySplits(prev => [...prev, { categoryId: '', amount: '', note: '' }]);
  };

  const removeSplit = (index: number) => {
    setCategorySplits(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.description || !formData.bankAccountId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!splitEnabled && !formData.categoryId) {
      toast.error('Categoria é obrigatória');
      return;
    }

    const parsedAmount = parseMoneyInput(formData.amount);
    if (splitEnabled) {
      if (categorySplits.length === 0) {
        toast.error('Adicione ao menos uma categoria no rateio');
        return;
      }

      const hasInvalidSplit = categorySplits.some(split => !split.categoryId || toCents(parseMoneyInput(split.amount)) <= 0);
      if (hasInvalidSplit) {
        toast.error('Preencha categoria e valor em todas as linhas do rateio');
        return;
      }

      const splitTotalCents = categorySplits.reduce((sum, split) => sum + toCents(parseMoneyInput(split.amount)), 0);
      if (splitTotalCents !== toCents(parsedAmount)) {
        toast.error('A soma das categorias precisa ser igual ao valor total do lançamento');
        return;
      }
    }

    const payload: any = {
      type: formData.type,
      amount: parsedAmount,
      description: formData.description,
      transactionDate: formData.transactionDate,
      categoryId: splitEnabled ? (categorySplits[0]?.categoryId || undefined) : formData.categoryId,
      bankAccountId: formData.bankAccountId,
      paymentMethodId: formData.paymentMethodId || undefined,
      status: formData.status,
      notes: formData.notes || undefined,
      categorySplits: splitEnabled
        ? categorySplits.map(split => ({
            categoryId: split.categoryId,
            amount: parseMoneyInput(split.amount),
            note: split.note || undefined,
          }))
        : undefined,
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
        toast.success('Transação criada com sucesso! Continue lançando...');
      }

      onSuccess();
      resetForm();
      setShowInstallmentScopePopup(false);
      setPendingFormData(null);
      
      // Só fecha o modal se for edição, não fecha se for criação
      if (transaction) {
        onClose();
      }
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
  // IMPORTANTE: Só permite selecionar categorias "folha" (sem filhos)
  const buildHierarchicalList = (cats: Category[], searchTerm: string = ''): Array<{ category: Category; level: number; indent: number; hasChildren: boolean }> => {
    const result: Array<{ category: Category; level: number; indent: number; hasChildren: boolean }> = [];
    const search = searchTerm.toLowerCase().trim();
    
    const addCategoryWithChildren = (cat: Category, indent: number = 0) => {
      // Se há busca, verificar se a categoria ou algum filho corresponde
      const catMatches = cat.name.toLowerCase().includes(search);
      const hasChildren = cat.children && cat.children.length > 0;
      const hasMatchingChildren = cat.children?.some(child => 
        child.name.toLowerCase().includes(search)
      );
      
      // Adicionar categoria se não há busca, ou se ela/filhos correspondem
      if (!search || catMatches || hasMatchingChildren) {
        result.push({ category: cat, level: cat.level || 1, indent, hasChildren: !!hasChildren });
      }
      
      // Adicionar filhos
      if (hasChildren) {
        cat.children!.forEach(child => {
          const childMatches = child.name.toLowerCase().includes(search);
          const childHasChildren = child.children && child.children.length > 0;
          // Se não há busca, ou filho corresponde, ou pai correspondeu
          if (!search || childMatches || catMatches) {
            result.push({ category: child, level: child.level || 2, indent: indent + 1, hasChildren: !!childHasChildren });
            
            // Adicionar netos se existirem
            if (childHasChildren) {
              child.children!.forEach(grandchild => {
                const grandchildMatches = grandchild.name.toLowerCase().includes(search);
                const grandchildHasChildren = grandchild.children && grandchild.children.length > 0;
                if (!search || grandchildMatches || childMatches || catMatches) {
                  result.push({ category: grandchild, level: grandchild.level || 3, indent: indent + 2, hasChildren: !!grandchildHasChildren });
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
  const categoriesByType = categories.filter(c => c.type === formData.type || c.type === 'patrimonial');
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
          {/* Tipo: Receita ou Despesa */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Tipo de Transação *
            </label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center justify-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                formData.type === 'expense'
                  ? 'border-[#EF4444] bg-red-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  value="expense"
                  checked={formData.type === 'expense'}
                  onChange={(e) => {
                    setFormData({ ...formData, type: e.target.value as 'income' | 'expense', categoryId: '' });
                    setCategorySearch('');
                  }}
                  className="w-5 h-5 text-[#E11D48] focus:ring-[#E11D48]"
                />
                <span className={`font-semibold ${formData.type === 'expense' ? 'text-[#E11D48]' : 'text-gray-700'}`}>💸 Despesa</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                formData.type === 'income'
                  ? 'border-[#2563EB] bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  value="income"
                  checked={formData.type === 'income'}
                  onChange={(e) => {
                    setFormData({ ...formData, type: e.target.value as 'income' | 'expense', categoryId: '' });
                    setCategorySearch('');
                  }}
                  className="w-5 h-5 text-[#2563EB] focus:ring-[#2563EB]"
                />
                <span className={`font-semibold ${formData.type === 'income' ? 'text-[#2563EB]' : 'text-gray-700'}`}>💰 Receita</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Valor */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
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
                  className="w-full pl-14 pr-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-gray-50 text-gray-900 placeholder:text-gray-400"
                  placeholder="0,00"
                  required
                />
              </div>
            </div>

            {/* Data */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
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
                  className="w-full pl-12 pr-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-gray-50 text-gray-900 appearance-none"
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
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Descrição *
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-gray-50 text-gray-900 placeholder:text-gray-400"
              placeholder="Ex: Salário, Aluguel, Compras..."
              required
            />
          </div>

          {/* Categoria / Rateio */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <input
                type="checkbox"
                checked={splitEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setSplitEnabled(enabled);
                  if (enabled) {
                    setShowCategoryDropdown(false);
                    setCategorySearch('');
                    if (categorySplits.length === 0) {
                      setCategorySplits([{ categoryId: '', amount: '', note: '' }]);
                    }
                  }
                }}
                className="w-4 h-4 text-[#1F4FD8] rounded border-gray-300"
              />
              Dividir lançamento por categoria
            </label>

            {!splitEnabled && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Categoria *
                </label>
                <div className="relative" ref={categoryDropdownRef}>
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
                    className="w-full pl-12 pr-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-gray-50 text-gray-900 placeholder:text-gray-400"
                    placeholder="Buscar categoria..."
                    required={!splitEnabled}
                  />

                  {showCategoryDropdown && filteredCategories.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                      {filteredCategories.map(({ category, level, indent, hasChildren }) => (
                        <div
                          key={category.id}
                          onClick={() => !hasChildren && handleCategorySelect(category)}
                          className={`w-full py-3 text-left flex items-center gap-3 border-b border-gray-100 last:border-0 ${
                            hasChildren
                              ? 'bg-gray-50 cursor-default'
                              : 'hover:bg-[#F4F7FB] transition-colors cursor-pointer'
                          }`}
                          style={{ paddingLeft: `${16 + (indent * 24)}px`, paddingRight: '16px' }}
                        >
                          {indent > 0 && (
                            <span className="text-gray-400 text-sm mr-1">
                              {indent === 1 ? '└' : '  └'}
                            </span>
                          )}
                          <span className="text-xl">{category.icon}</span>
                          <div className="flex-1">
                            <p className={`${level === 1 ? 'font-bold' : level === 2 ? 'font-semibold' : 'font-medium'} ${
                              hasChildren ? 'text-gray-500' : 'text-gray-900'
                            }`}>
                              {category.name}
                            </p>
                            {hasChildren && (
                              <p className="text-xs text-gray-400 mt-0.5">📂 {category.children?.length} subcategorias (selecione uma abaixo)</p>
                            )}
                          </div>
                          {!hasChildren && (
                            <div
                              className="w-3 h-3 rounded-full shadow-sm"
                              style={{ backgroundColor: category.color }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {splitEnabled && (
              <div className="space-y-3 border border-blue-200 bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-800">
                  Dividido em {categorySplits.length} {categorySplits.length === 1 ? 'categoria' : 'categorias'}.
                  A categoria principal será substituída pelo rateio.
                </p>
                {categorySplits.map((split, index) => (
                  <div key={`split-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                    <div className="md:col-span-5">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Categoria do rateio</label>
                      <select
                        value={split.categoryId}
                        onChange={(e) => updateSplit(index, 'categoryId', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                        aria-label="Categoria do rateio"
                      >
                        <option value="">Selecione</option>
                        {categoriesByType.filter(cat => !cat.children || cat.children.length === 0).map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Valor do rateio</label>
                      <input
                        type="number"
                        step="0.01"
                        value={split.amount}
                        onChange={(e) => updateSplit(index, 'amount', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                        aria-label="Valor do rateio"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Observação</label>
                      <input
                        type="text"
                        value={split.note}
                        onChange={(e) => updateSplit(index, 'note', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="md:col-span-1 flex items-end">
                      <button
                        type="button"
                        onClick={() => removeSplit(index)}
                        className="w-full px-2 py-2 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-40"
                        disabled={categorySplits.length === 1}
                      >
                        Rem.
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={addSplit}
                    className="px-3 py-2 text-xs bg-white text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-100"
                  >
                    + Adicionar categoria
                  </button>
                  <div className="text-right">
                    <p className="text-xs text-gray-700">Dividido: R$ {splitTotal.toFixed(2)}</p>
                    <p className={`text-xs font-semibold ${Math.abs(splitDifference) < 0.005 ? 'text-green-700' : 'text-red-700'}`}>
                      {Math.abs(splitDifference) < 0.005 ? 'Rateio completo' : `Falta dividir: R$ ${Math.abs(splitDifference).toFixed(2)}`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Conta Bancária */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-900">
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
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <input
                    type="text"
                    placeholder="Nome da conta"
                    value={quickBankAccount.name}
                    onChange={(e) => setQuickBankAccount({ ...quickBankAccount, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 placeholder:text-gray-400"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={quickBankAccount.type}
                      onChange={(e) => setQuickBankAccount({ ...quickBankAccount, type: e.target.value })}
                      className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900"
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
                      className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 placeholder:text-gray-400"
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
                  className="w-full pl-12 pr-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-gray-50 text-gray-900 appearance-none cursor-pointer"
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
                <label className="text-sm font-semibold text-gray-900">
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
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <input
                    type="text"
                    placeholder="Ex: PIX Nubank, Cartão Inter, Dinheiro..."
                    value={quickPaymentMethod.name}
                    onChange={(e) => setQuickPaymentMethod({ ...quickPaymentMethod, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 placeholder:text-gray-400"
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
                      className="px-3 py-1.5 text-sm bg-[#1F4FD8] text-white rounded hover:bg-[#1A44BF]"
                    >
                      Criar
                    </button>
                  </div>
                </div>
              )}
              
              <div className="relative" ref={paymentMethodDropdownRef}>
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <CreditCard className="w-5 h-5 text-[#1F4FD8]" />
                </div>
                {/* Botão para abrir dropdown customizado */}
                <button
                  type="button"
                  onClick={() => setShowPaymentMethodDropdown(!showPaymentMethodDropdown)}
                  className="w-full pl-12 pr-10 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-gray-50 text-gray-900 text-left cursor-pointer"
                  aria-label="Meio de Pagamento"
                  aria-expanded={showPaymentMethodDropdown}
                >
                  {formData.paymentMethodId 
                    ? paymentMethods.find(m => m.id === formData.paymentMethodId)?.name || 'Selecione (opcional)'
                    : 'Selecione (opcional)'}
                </button>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showPaymentMethodDropdown ? 'rotate-180' : ''}`} />
                </div>
                
                {/* Dropdown customizado */}
                {showPaymentMethodDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                    {/* Opção para limpar seleção */}
                    <div
                      onClick={() => handleSelectPaymentMethod('')}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                    >
                      <span className="text-gray-500">Selecione (opcional)</span>
                    </div>
                    
                    {/* Lista de meios de pagamento */}
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className={`px-4 py-2.5 cursor-pointer transition-colors flex items-center justify-between ${
                          formData.paymentMethodId === method.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span 
                          onClick={() => handleSelectPaymentMethod(method.id)}
                          className={`flex-1 ${formData.paymentMethodId === method.id ? 'text-[#1F4FD8] font-medium' : 'text-gray-900'}`}
                        >
                          {method.name}
                        </span>
                        
                        {/* Ícones de editar/excluir - sempre visíveis */}
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditPaymentMethod(e, method);
                            }}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDeletePaymentMethod(e, method);
                            }}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {paymentMethods.length === 0 && (
                      <div className="px-4 py-3 text-gray-500 text-center">
                        Nenhum meio de pagamento cadastrado
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Status
            </label>
            <div className="flex gap-3">
              <label className="flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                formData.status === 'completed'
                  ? 'border-[#2563EB] bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }">
                <input
                  type="radio"
                  value="completed"
                  checked={formData.status === 'completed'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-5 h-5 text-[#2563EB] focus:ring-[#2563EB]"
                />
                <span className={`font-semibold ${formData.status === 'completed' ? 'text-[#2563EB]' : 'text-gray-700'}`}>Pago</span>
              </label>
              <label className="flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                formData.status === 'pending'
                  ? 'border-[#F59E0B] bg-amber-50'
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
          <FormField
            label={<><span>Observações</span> <span className="text-gray-400 font-normal">(opcional)</span></>}
          >
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="min-h-[44px] border-2 border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 resize-none"
              rows={3}
              placeholder="Adicione notas ou observações..."
            />
          </FormField>
        </form>

        {/* Footer com Botões */}
        <div className="border-t-2 border-gray-100 px-6 py-4 bg-gray-50 text-gray-900">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              variant={formData.type === 'income' ? 'primary' : 'danger'}
              size="lg"
              className="flex-1"
              disabled={loading}
            >
              {loading ? 'Salvando...' : transaction ? 'Atualizar Transação' : 'Criar Transação'}
            </Button>
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
                className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-[#1F4FD8] hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 group-hover:bg-[#1F4FD8] group-hover:text-white rounded-lg flex items-center justify-center transition-all">
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
              <Button
                onClick={handleScopeCancel}
                disabled={loading}
                variant="secondary"
                size="md"
                className="w-full"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Meio de Pagamento */}
      {showEditPaymentMethodModal && editingPaymentMethod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Edit2 className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Editar Meio de Pagamento</h3>
              </div>
              <button
                onClick={() => {
                  setShowEditPaymentMethodModal(false);
                  setEditingPaymentMethod(null);
                  setEditPaymentMethodName('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Fechar"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome do Meio de Pagamento
              </label>
              <input
                type="text"
                value={editPaymentMethodName}
                onChange={(e) => setEditPaymentMethodName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Ex: PIX Nubank, Cartão Itaú..."
                autoFocus
              />
            </div>
            
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <Button
                onClick={() => {
                  setShowEditPaymentMethodModal(false);
                  setEditingPaymentMethod(null);
                  setEditPaymentMethodName('');
                }}
                disabled={paymentMethodActionLoading}
                variant="secondary"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEditPaymentMethod}
                disabled={paymentMethodActionLoading || !editPaymentMethodName.trim()}
                variant="primary"
                className="flex-1"
              >
                {paymentMethodActionLoading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão de Meio de Pagamento */}
      {showDeletePaymentMethodModal && deletingPaymentMethod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Excluir Meio de Pagamento</h3>
              </div>
              <button
                onClick={() => {
                  setShowDeletePaymentMethodModal(false);
                  setDeletingPaymentMethod(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Fechar"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Tem certeza que deseja excluir o meio de pagamento <strong>&quot;{deletingPaymentMethod.name}&quot;</strong>?
              </p>
              
              {deletingPaymentMethodTransactionCount > 0 && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-800 font-semibold">Atenção!</p>
                    <p className="text-amber-700 text-sm mt-1">
                      Este meio de pagamento possui <strong>{deletingPaymentMethodTransactionCount}</strong> {deletingPaymentMethodTransactionCount === 1 ? 'lançamento vinculado' : 'lançamentos vinculados'}.
                      Não será possível excluí-lo enquanto houver transações associadas.
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <Button
                onClick={() => {
                  setShowDeletePaymentMethodModal(false);
                  setDeletingPaymentMethod(null);
                }}
                disabled={paymentMethodActionLoading}
                variant="secondary"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmDeletePaymentMethod}
                disabled={paymentMethodActionLoading || deletingPaymentMethodTransactionCount > 0}
                variant="danger"
                className="flex-1"
              >
                {paymentMethodActionLoading ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

