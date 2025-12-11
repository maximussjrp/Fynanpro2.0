'use client';

import { useState, useEffect } from 'react';
import { 
  X, DollarSign, Calendar, Tag, CreditCard, Wallet,
  Repeat, CreditCard as CardIcon, ArrowRight, RefreshCw
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

// ==================== INTERFACES ====================

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

interface UnifiedTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: 'income' | 'expense';
  defaultTransactionType?: 'single' | 'recurring' | 'installment';
  initialTab?: 'single' | 'recurring' | 'installment';
}

type TransactionType = 'single' | 'recurring' | 'installment';
type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'yearly';

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'bimonthly', label: 'Bimestral' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'yearly', label: 'Anual' },
];

// ==================== COMPONENTE PRINCIPAL ====================

export default function UnifiedTransactionModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  defaultType = 'expense',
  defaultTransactionType = 'single',
  initialTab
}: UnifiedTransactionModalProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  // Tab atual (única, recorrente, parcelada)
  const [transactionType, setTransactionType] = useState<TransactionType>(initialTab || defaultTransactionType);
  
  // Dados do formulário base
  const [formData, setFormData] = useState({
    type: defaultType as 'income' | 'expense',
    amount: '',
    description: '',
    transactionDate: new Date().toISOString().split('T')[0],
    categoryId: '',
    bankAccountId: '',
    paymentMethodId: '',
    status: 'completed',
    notes: '',
  });

  // Dados específicos de recorrente
  const [recurringData, setRecurringData] = useState({
    frequency: 'monthly' as Frequency,
    frequencyInterval: 1,
    hasEndDate: false,
    endDate: '',
    totalOccurrences: undefined as number | undefined,
  });

  // Dados específicos de parcelado
  const [installmentData, setInstallmentData] = useState({
    totalInstallments: 2,
    hasDownPayment: false,
    downPaymentAmount: '',
  });

  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFormData();
      resetForm();
      // Atualizar tab quando initialTab mudar
      if (initialTab) {
        setTransactionType(initialTab);
      }
    }
  }, [isOpen, initialTab]);

  const resetForm = () => {
    setFormData({
      type: defaultType,
      amount: '',
      description: '',
      transactionDate: new Date().toISOString().split('T')[0],
      categoryId: '',
      bankAccountId: '',
      paymentMethodId: '',
      status: transactionType === 'single' ? 'completed' : 'pending',
      notes: '',
    });
    setRecurringData({
      frequency: 'monthly',
      frequencyInterval: 1,
      hasEndDate: false,
      endDate: '',
      totalOccurrences: undefined,
    });
    setInstallmentData({
      totalInstallments: 2,
      hasDownPayment: false,
      downPaymentAmount: '',
    });
    setCategorySearch('');
    setTransactionType(defaultTransactionType);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.description || !formData.categoryId || !formData.bankAccountId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validações específicas
    if (transactionType === 'installment' && installmentData.totalInstallments < 2) {
      toast.error('Número de parcelas deve ser maior que 1');
      return;
    }

    if (transactionType === 'installment' && installmentData.totalInstallments > 72) {
      toast.error('Número máximo de parcelas é 72');
      return;
    }

    setLoading(true);

    try {
      const basePayload = {
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

      let endpoint = '/transactions';
      let payload: any = basePayload;

      if (transactionType === 'recurring') {
        endpoint = '/transactions/recurring';
        payload = {
          ...basePayload,
          transactionType: 'recurring',
          frequency: recurringData.frequency,
          frequencyInterval: recurringData.frequencyInterval,
          totalInstallments: recurringData.hasEndDate && recurringData.totalOccurrences 
            ? recurringData.totalOccurrences 
            : undefined,
        };
      } else if (transactionType === 'installment') {
        endpoint = '/transactions/installment';
        payload = {
          ...basePayload,
          transactionType: 'installment',
          totalInstallments: installmentData.totalInstallments,
          hasDownPayment: installmentData.hasDownPayment,
          downPaymentAmount: installmentData.hasDownPayment && installmentData.downPaymentAmount
            ? parseFloat(installmentData.downPaymentAmount.replace(',', '.'))
            : undefined,
        };
      }

      const response = await api.post(endpoint, payload);

      if (transactionType === 'recurring') {
        toast.success('Transação recorrente criada com sucesso!');
      } else if (transactionType === 'installment') {
        toast.success(`Transação parcelada em ${installmentData.totalInstallments}x criada!`);
      } else {
        toast.success('Transação criada com sucesso!');
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Erro ao salvar transação:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar transação');
    } finally {
      setLoading(false);
    }
  };

  // Função para construir lista hierárquica de categorias
  const buildHierarchicalList = (cats: Category[]): Array<{ category: Category; level: number; indent: number }> => {
    const result: Array<{ category: Category; level: number; indent: number }> = [];
    
    const addCategoryWithChildren = (cat: Category, indent: number = 0) => {
      result.push({ category: cat, level: cat.level || 1, indent });
      
      if (cat.children && cat.children.length > 0) {
        cat.children.forEach(child => addCategoryWithChildren(child, indent + 1));
      }
    };
    
    cats.filter(c => !c.parentId).forEach(cat => addCategoryWithChildren(cat));
    
    return result;
  };

  const filteredCategoriesFlat = categories.filter(
    c => c.type === formData.type && 
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );
  
  const filteredCategories = buildHierarchicalList(filteredCategoriesFlat);

  const handleCategorySelect = (category: Category) => {
    setFormData({ ...formData, categoryId: category.id });
    setCategorySearch(category.name);
    setShowCategoryDropdown(false);
  };

  // Calcular valor da parcela para preview
  const calculateInstallmentAmount = () => {
    if (!formData.amount || !installmentData.totalInstallments) return 0;
    const total = parseFloat(formData.amount.replace(',', '.'));
    const downPayment = installmentData.hasDownPayment && installmentData.downPaymentAmount 
      ? parseFloat(installmentData.downPaymentAmount.replace(',', '.'))
      : 0;
    const remaining = total - downPayment;
    const numInstallments = installmentData.hasDownPayment 
      ? installmentData.totalInstallments - 1 
      : installmentData.totalInstallments;
    return numInstallments > 0 ? remaining / numInstallments : 0;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1C6DD0] to-[#1557A8] px-6 py-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3 font-poppins">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <DollarSign className="w-6 h-6" />
            </div>
            Nova Transação
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

        {/* Tabs de Tipo */}
        <div className="border-b border-gray-200 bg-[#F9FAFB] px-6">
          <div className="flex gap-1 -mb-px">
            <button
              type="button"
              onClick={() => {
                setTransactionType('single');
                setFormData(prev => ({ ...prev, status: 'completed' }));
              }}
              className={`flex items-center gap-2 px-4 py-3 font-semibold transition-all border-b-2 ${
                transactionType === 'single'
                  ? 'border-[#1C6DD0] text-[#1C6DD0] bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Única
            </button>
            <button
              type="button"
              onClick={() => {
                setTransactionType('recurring');
                setFormData(prev => ({ ...prev, status: 'pending' }));
              }}
              className={`flex items-center gap-2 px-4 py-3 font-semibold transition-all border-b-2 ${
                transactionType === 'recurring'
                  ? 'border-[#1C6DD0] text-[#1C6DD0] bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Repeat className="w-4 h-4" />
              Recorrente
            </button>
            <button
              type="button"
              onClick={() => {
                setTransactionType('installment');
                setFormData(prev => ({ ...prev, status: 'pending' }));
              }}
              className={`flex items-center gap-2 px-4 py-3 font-semibold transition-all border-b-2 ${
                transactionType === 'installment'
                  ? 'border-[#1C6DD0] text-[#1C6DD0] bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <CardIcon className="w-4 h-4" />
              Parcelada
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 font-inter">
          {/* Toggle Receita/Despesa */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'income', categoryId: '' })}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${
                formData.type === 'income'
                  ? 'bg-[#22C39A] text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              💰 Receita
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'expense', categoryId: '' })}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${
                formData.type === 'expense'
                  ? 'bg-[#E74C3C] text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              💸 Despesa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Valor */}
            <div>
              <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
                {transactionType === 'installment' ? 'Valor Total *' : 'Valor *'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-[#1C6DD0] font-semibold">R$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-14 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] transition-all bg-[#F9FAFB]"
                  placeholder="0,00"
                  required
                />
              </div>
            </div>

            {/* Data */}
            <div>
              <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
                {transactionType === 'recurring' ? 'Data Início *' : transactionType === 'installment' ? 'Primeira Parcela *' : 'Data *'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Calendar className="w-5 h-5 text-[#1C6DD0]" />
                </div>
                <input
                  type="date"
                  value={formData.transactionDate}
                  onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] transition-all bg-[#F9FAFB]"
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] transition-all bg-[#F9FAFB]"
              placeholder="Ex: Salário, Aluguel, Compras..."
              required
            />
          </div>

          {/* === CAMPOS ESPECÍFICOS RECORRENTE === */}
          {transactionType === 'recurring' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-[#1C6DD0] flex items-center gap-2">
                <Repeat className="w-5 h-5" />
                Configurações de Recorrência
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frequência *
                  </label>
                  <select
                    value={recurringData.frequency}
                    onChange={(e) => setRecurringData({ ...recurringData, frequency: e.target.value as Frequency })}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] bg-white"
                    title="Frequência da recorrência"
                  >
                    {FREQUENCY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    A cada
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={recurringData.frequencyInterval}
                      onChange={(e) => setRecurringData({ ...recurringData, frequencyInterval: parseInt(e.target.value) || 1 })}
                      className="w-20 px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] bg-white"
                      title="Intervalo de frequência"
                      aria-label="Intervalo de frequência"
                    />
                    <span className="text-gray-600">período(s)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="hasEndDate"
                  checked={recurringData.hasEndDate}
                  onChange={(e) => setRecurringData({ ...recurringData, hasEndDate: e.target.checked })}
                  className="w-5 h-5 text-[#1C6DD0] rounded focus:ring-[#1C6DD0]"
                />
                <label htmlFor="hasEndDate" className="text-sm font-medium text-gray-700">
                  Definir data de término
                </label>
              </div>

              {recurringData.hasEndDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de ocorrências
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={recurringData.totalOccurrences || ''}
                    onChange={(e) => setRecurringData({ ...recurringData, totalOccurrences: parseInt(e.target.value) || undefined })}
                    className="w-32 px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] bg-white"
                    placeholder="Ex: 12"
                  />
                </div>
              )}
            </div>
          )}

          {/* === CAMPOS ESPECÍFICOS PARCELADO === */}
          {transactionType === 'installment' && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-purple-700 flex items-center gap-2">
                <CardIcon className="w-5 h-5" />
                Configurações de Parcelamento
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Parcelas *
                </label>
                <select
                  value={installmentData.totalInstallments}
                  onChange={(e) => setInstallmentData({ ...installmentData, totalInstallments: parseInt(e.target.value) })}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                  title="Número de parcelas"
                >
                  {Array.from({ length: 71 }, (_, i) => i + 2).map(num => (
                    <option key={num} value={num}>{num}x</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="hasDownPayment"
                  checked={installmentData.hasDownPayment}
                  onChange={(e) => setInstallmentData({ ...installmentData, hasDownPayment: e.target.checked })}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="hasDownPayment" className="text-sm font-medium text-gray-700">
                  Tem entrada (1 + parcelas)
                </label>
              </div>

              {installmentData.hasDownPayment && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor da Entrada
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-purple-600 font-semibold">R$</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={installmentData.downPaymentAmount}
                      onChange={(e) => setInstallmentData({ ...installmentData, downPaymentAmount: e.target.value })}
                      className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              )}

              {/* Preview das parcelas */}
              {formData.amount && (
                <div className="bg-white p-3 rounded-lg border border-purple-200">
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    <span>
                      {installmentData.hasDownPayment && installmentData.downPaymentAmount && (
                        <span className="font-semibold">
                          Entrada: R$ {parseFloat(installmentData.downPaymentAmount).toFixed(2)} + {' '}
                        </span>
                      )}
                      <span className="font-semibold text-purple-700">
                        {installmentData.hasDownPayment ? installmentData.totalInstallments - 1 : installmentData.totalInstallments}x 
                        de R$ {calculateInstallmentAmount().toFixed(2)}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Categoria */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
              Categoria *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Tag className="w-5 h-5 text-[#1C6DD0]" />
              </div>
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => {
                  setCategorySearch(e.target.value);
                  setShowCategoryDropdown(true);
                }}
                onFocus={() => setShowCategoryDropdown(true)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] transition-all bg-[#F9FAFB]"
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
                        <span className="text-gray-400 text-sm mr-1">└</span>
                      )}
                      <span className="text-xl">{category.icon}</span>
                      <div className="flex-1">
                        <p className={`${level === 1 ? 'font-bold' : 'font-medium'} text-[#1A1A1A]`}>
                          {category.name}
                        </p>
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
              <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
                Conta Bancária *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Wallet className="w-5 h-5 text-[#1C6DD0]" />
                </div>
                <select
                  value={formData.bankAccountId}
                  onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] transition-all bg-[#F9FAFB] appearance-none cursor-pointer"
                  required
                  title="Selecione a conta bancária"
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

            {/* Meio de Pagamento */}
            <div>
              <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
                Meio de Pagamento <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <CreditCard className="w-5 h-5 text-[#1C6DD0]" />
                </div>
                <select
                  value={formData.paymentMethodId}
                  onChange={(e) => setFormData({ ...formData, paymentMethodId: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] transition-all bg-[#F9FAFB] appearance-none cursor-pointer"
                  title="Selecione o meio de pagamento"
                >
                  <option value="">Selecione (opcional)</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name} ({method.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Status - apenas para transação única */}
          {transactionType === 'single' && (
            <div>
              <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
                Status
              </label>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                  formData.status === 'completed'
                    ? 'border-[#22C39A] bg-[#E8F9F4]'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    value="completed"
                    checked={formData.status === 'completed'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-5 h-5 text-[#22C39A] focus:ring-[#22C39A]"
                  />
                  <span className={`font-semibold ${formData.status === 'completed' ? 'text-[#22C39A]' : 'text-gray-700'}`}>Pago</span>
                </label>
                <label className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                  formData.status === 'pending'
                    ? 'border-[#F59E0B] bg-[#FEF3C7]'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
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
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
              Observações <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] transition-all bg-[#F9FAFB] resize-none"
              rows={2}
              placeholder="Adicione notas ou observações..."
            />
          </div>
        </form>

        {/* Footer com Botões */}
        <div className="border-t-2 border-gray-100 px-6 py-4 bg-[#F9FAFB]">
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
                  ? 'bg-gradient-to-r from-[#22C39A] to-[#1EA87E] hover:from-[#1EA87E] hover:to-[#16865C]'
                  : 'bg-gradient-to-r from-[#E74C3C] to-[#C0392B] hover:from-[#C0392B] hover:to-[#A93226]'
              } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  {transactionType === 'recurring' && <Repeat className="w-5 h-5" />}
                  {transactionType === 'installment' && <CardIcon className="w-5 h-5" />}
                  {transactionType === 'single' && <DollarSign className="w-5 h-5" />}
                  Criar {transactionType === 'recurring' ? 'Recorrente' : transactionType === 'installment' ? 'Parcelada' : 'Transação'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
