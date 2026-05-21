'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  X, DollarSign, Calendar, Tag, CreditCard, Wallet,
  Repeat, CreditCard as CardIcon, ArrowRight, RefreshCw,
  Plus, Edit2, Trash2, ChevronDown, Sparkles, Loader2,
  Lock, Unlock, Layers
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';

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

  const [splitEnabled, setSplitEnabled] = useState(false);
  const [categorySplits, setCategorySplits] = useState<Array<{ categoryId: string; amount: string; note: string }>>([
    { categoryId: '', amount: '', note: '' },
  ]);

  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Estados para sugestão de categoria com IA
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    categoryId: string;
    categoryName: string;
    confidence: number;
    reasoning: string;
  } | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  // Estados para criação rápida de conta bancária e meio de pagamento
  const [showQuickBankAccount, setShowQuickBankAccount] = useState(false);
  const [showQuickPaymentMethod, setShowQuickPaymentMethod] = useState(false);
  const [quickBankAccount, setQuickBankAccount] = useState({ name: '', type: 'bank', institution: '' });
  const [quickPaymentMethod, setQuickPaymentMethod] = useState({ name: '', type: 'pix', lastFourDigits: '' });

  // Estados para dropdown customizado de meios de pagamento
  const [showPaymentMethodDropdown, setShowPaymentMethodDropdown] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null);
  const [showEditPaymentMethodModal, setShowEditPaymentMethodModal] = useState(false);
  const [editPaymentMethodName, setEditPaymentMethodName] = useState('');
  const [showDeletePaymentMethodModal, setShowDeletePaymentMethodModal] = useState(false);
  const [deletingPaymentMethod, setDeletingPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentMethodActionLoading, setPaymentMethodActionLoading] = useState(false);
  const paymentMethodDropdownRef = useRef<HTMLDivElement>(null);

  // Estados para modo Múltiplos Lançamentos
  const [multipleModeEnabled, setMultipleModeEnabled] = useState(false);
  const [lockedFields, setLockedFields] = useState<{
    type: boolean;
    transactionDate: boolean;
    categoryId: boolean;
    bankAccountId: boolean;
    paymentMethodId: boolean;
    status: boolean;
  }>({
    type: false,
    transactionDate: false,
    categoryId: false,
    bankAccountId: false,
    paymentMethodId: false,
    status: false,
  });
  const [transactionCount, setTransactionCount] = useState(0);
  
  // Ref para controlar se o modal já foi inicializado (evitar reset durante re-renders)
  const wasOpenRef = useRef(false);
  
  // Refs para acessar valores atualizados dentro de closures
  const multipleModeEnabledRef = useRef(multipleModeEnabled);
  const lockedFieldsRef = useRef(lockedFields);
  
  // Manter refs sincronizados com states
  multipleModeEnabledRef.current = multipleModeEnabled;
  lockedFieldsRef.current = lockedFields;

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
    if (isOpen && !wasOpenRef.current) {
      // Modal acabou de abrir - fazer reset completo
      wasOpenRef.current = true;
      loadFormData();
      resetForm(false);
      setTransactionCount(0);
      setMultipleModeEnabled(false);
      setLockedFields({
        type: false,
        transactionDate: false,
        categoryId: false,
        bankAccountId: false,
        paymentMethodId: false,
        status: false,
      });
      // Atualizar tab quando initialTab mudar
      if (initialTab) {
        setTransactionType(initialTab);
      }
    } else if (!isOpen && wasOpenRef.current) {
      // Modal fechou - resetar flag
      wasOpenRef.current = false;
    }
  }, [isOpen, initialTab]);

  // Função para alternar bloqueio de campo
  const toggleFieldLock = (field: keyof typeof lockedFields) => {
    setLockedFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Componente de botão de bloqueio
  const LockButton = ({ field, className = '' }: { field: keyof typeof lockedFields; className?: string }) => {
    if (!multipleModeEnabled) return null;
    const isLocked = lockedFields[field];
    return (
      <button
        type="button"
        onClick={() => toggleFieldLock(field)}
        className={`p-1.5 rounded-lg transition-all ${
          isLocked 
            ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' 
            : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
        } ${className}`}
        title={isLocked ? 'Desbloquear campo (será limpo após salvar)' : 'Bloquear campo (será mantido após salvar)'}
      >
        {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
      </button>
    );
  };

  const resetForm = (preserveLocked: boolean = false) => {
    // Usar refs para garantir valores atualizados
    const isMultipleMode = multipleModeEnabledRef.current;
    const currentLockedFields = lockedFieldsRef.current;
    
    console.log('resetForm chamado:', { preserveLocked, isMultipleMode, currentLockedFields });
    
    if (preserveLocked && isMultipleMode) {
      // Preservar campos bloqueados - manter status atual se bloqueado
      setFormData(prev => {
        const newData = {
          type: currentLockedFields.type ? prev.type : defaultType,
          amount: '',
          description: '',
          transactionDate: currentLockedFields.transactionDate ? prev.transactionDate : new Date().toISOString().split('T')[0],
          categoryId: currentLockedFields.categoryId ? prev.categoryId : '',
          bankAccountId: currentLockedFields.bankAccountId ? prev.bankAccountId : '',
          paymentMethodId: currentLockedFields.paymentMethodId ? prev.paymentMethodId : '',
          status: currentLockedFields.status ? prev.status : (transactionType === 'single' ? 'completed' : 'pending'),
          notes: '',
        };
        console.log('Novo formData (preservando bloqueados):', newData);
        return newData;
      });
      // Preservar busca de categoria se bloqueada
      if (!currentLockedFields.categoryId) {
        setCategorySearch('');
      }
    } else {
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
      setCategorySearch('');
    }
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
    setSplitEnabled(false);
    setCategorySplits([{ categoryId: '', amount: '', note: '' }]);
    setShowCategoryDropdown(false);
    setShowPaymentMethodDropdown(false);
    setShowQuickBankAccount(false);
    setShowQuickPaymentMethod(false);
    setShowEditPaymentMethodModal(false);
    setShowDeletePaymentMethodModal(false);
    setEditingPaymentMethod(null);
    setDeletingPaymentMethod(null);
    setAiSuggestion(null);
    if (!preserveLocked) {
      setTransactionType(defaultTransactionType);
    }
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

      // Verificar se IA está disponível
      try {
        const aiStatusRes = await api.get('/transactions/ai-status');
        setAiAvailable(aiStatusRes.data.data?.available || false);
      } catch {
        setAiAvailable(false);
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados do formulário:', error);
      toast.error('Erro ao carregar dados do formulário');
    }
  };

  // Função para sugerir categoria com IA
  const handleAiSuggestCategory = async () => {
    if (!formData.description || formData.description.trim().length < 3) {
      toast.error('Digite uma descrição para sugerir categoria');
      return;
    }

    setAiSuggesting(true);
    setAiSuggestion(null);

    try {
      const response = await api.post('/transactions/suggest-category', {
        description: formData.description,
        amount: formData.amount ? parseFloat(formData.amount.replace(',', '.')) : 0,
        type: formData.type,
      });

      const suggestion = response.data.data?.suggestion;
      if (suggestion) {
        setAiSuggestion(suggestion);
        // Auto-aplicar se confiança alta
        if (suggestion.confidence >= 0.7) {
          setFormData(prev => ({ ...prev, categoryId: suggestion.categoryId }));
          setCategorySearch(suggestion.categoryName);
          toast.success(`Categoria sugerida: ${suggestion.categoryName}`);
        } else {
          toast.info(`Sugestão: ${suggestion.categoryName} (${Math.round(suggestion.confidence * 100)}% confiança)`);
        }
      } else {
        toast.warning('Não foi possível sugerir uma categoria');
      }
    } catch (error: any) {
      console.error('Erro ao sugerir categoria:', error);
      if (error.response?.status === 503) {
        toast.error('Serviço de IA não configurado');
        setAiAvailable(false);
      } else {
        toast.error('Erro ao sugerir categoria');
      }
    } finally {
      setAiSuggesting(false);
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
      const payload: any = {
        name: quickPaymentMethod.name,
        type: quickPaymentMethod.type,
      };
      
      // Adicionar finais do cartão se informado
      if (quickPaymentMethod.lastFourDigits && quickPaymentMethod.lastFourDigits.trim()) {
        payload.lastFourDigits = quickPaymentMethod.lastFourDigits.trim();
      }
      
      console.log('Criando meio de pagamento:', payload);
      const response = await api.post('/payment-methods', payload);
      console.log('Resposta da API:', response.data);
      
      const newMethod = response.data?.data || response.data;
      if (!newMethod || !newMethod.id) {
        console.error('Resposta inválida:', response.data);
        toast.error('Erro: resposta inválida da API');
        return;
      }
      
      console.log('Método criado:', newMethod);
      setPaymentMethods(prev => [...prev, newMethod]);
      setFormData(prev => ({ ...prev, paymentMethodId: newMethod.id }));
      setShowQuickPaymentMethod(false);
      setQuickPaymentMethod({ name: '', type: 'pix', lastFourDigits: '' });
      toast.success('Método criado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar método:', error);
      toast.error(error.response?.data?.message || 'Erro ao criar método');
    }
  };

  // Função para selecionar meio de pagamento
  const handleSelectPaymentMethod = (methodId: string) => {
    setFormData(prev => ({ ...prev, paymentMethodId: methodId }));
    setShowPaymentMethodDropdown(false);
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
  const handleOpenDeletePaymentMethod = (e: React.MouseEvent, method: PaymentMethod) => {
    e.stopPropagation();
    setDeletingPaymentMethod(method);
    setShowPaymentMethodDropdown(false);
    setShowDeletePaymentMethodModal(true);
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
      toast.error(error.response?.data?.message || 'Erro ao excluir meio de pagamento');
    } finally {
      setPaymentMethodActionLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || (!formData.categoryId && !canUseSplits) || !formData.bankAccountId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (canUseSplits && !splitRowsValid) {
      toast.error('A soma das categorias precisa ser igual ao valor total do lançamento.');
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
        categoryId: canUseSplits ? categorySplits[0]?.categoryId : (formData.categoryId || undefined),
        bankAccountId: formData.bankAccountId || undefined,
        paymentMethodId: formData.paymentMethodId || undefined,
        status: formData.status,
        notes: formData.notes || undefined,
        categorySplits: canUseSplits
          ? categorySplits.map(split => ({
              categoryId: split.categoryId,
              amount: parseMoneyInput(split.amount),
              note: split.note || undefined,
            }))
          : undefined,
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
          totalOccurrences: recurringData.hasEndDate && recurringData.totalOccurrences 
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

      console.log('Enviando payload:', { endpoint, payload });
      const response = await api.post(endpoint, payload);

      // Incrementar contador de transações
      setTransactionCount(prev => prev + 1);

      if (transactionType === 'recurring') {
        toast.success('Transação recorrente criada! Continue lançando...');
      } else if (transactionType === 'installment') {
        toast.success(`Transação parcelada em ${installmentData.totalInstallments}x criada! Continue lançando...`);
      } else {
        toast.success('Transação criada com sucesso! Continue lançando...');
      }

      resetForm(true); // Preservar campos bloqueados
      onSuccess();
      // Modal permanece aberto para continuar lançando
    } catch (error: any) {
      console.error('Erro ao salvar transação:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar transação');
    } finally {
      setLoading(false);
    }
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

  // Calcular valor total das parcelas (parcela x quantidade)
  const calculateInstallmentTotal = () => {
    if (!formData.amount || !installmentData.totalInstallments) return 0;
    const installmentValue = parseFloat(formData.amount.replace(',', '.'));
    const downPayment = installmentData.hasDownPayment && installmentData.downPaymentAmount 
      ? parseFloat(installmentData.downPaymentAmount.replace(',', '.'))
      : 0;
    // Valor informado e o valor da parcela, calcular total
    const numInstallments = installmentData.hasDownPayment 
      ? installmentData.totalInstallments - 1 
      : installmentData.totalInstallments;
    return (installmentValue * numInstallments) + downPayment;
  };

  const parseMoneyInput = (value: string) => Number(value.replace(',', '.')) || 0;
  const toCents = (value: number) => Math.round(value * 100);
  const transactionAmount = parseMoneyInput(formData.amount);
  const splitTotal = categorySplits.reduce((sum, split) => sum + parseMoneyInput(split.amount), 0);
  const splitDifference = transactionAmount - splitTotal;
  const splitDifferenceCents = toCents(splitDifference);
  const canUseSplits = splitEnabled && transactionType !== 'installment';
  const splitRowsValid = !canUseSplits || (
    categorySplits.length > 0 &&
    categorySplits.every(split => split.categoryId && toCents(parseMoneyInput(split.amount)) > 0) &&
    splitDifferenceCents === 0
  );

  const updateCategorySplit = (index: number, field: 'categoryId' | 'amount' | 'note', value: string) => {
    setCategorySplits(prev => prev.map((split, i) => i === index ? { ...split, [field]: value } : split));
  };

  const addCategorySplit = () => {
    setCategorySplits(prev => [...prev, { categoryId: '', amount: '', note: '' }]);
  };

  const removeCategorySplit = (index: number) => {
    setCategorySplits(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[#151B2E] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300 border border-[#2A3F5F]/30">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1F4FD8] to-[#1A44BF] px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3 font-poppins">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <DollarSign className="w-6 h-6" />
              </div>
              Nova Transação
            </h2>
            {transactionCount > 0 && (
              <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-white">
                {transactionCount} criada{transactionCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle Múltiplos Lançamentos */}
            <button
              type="button"
              onClick={() => {
                setMultipleModeEnabled(!multipleModeEnabled);
                if (multipleModeEnabled) {
                  // Ao desativar, limpar todos os bloqueios
                  setLockedFields({
                    type: false,
                    transactionDate: false,
                    categoryId: false,
                    bankAccountId: false,
                    paymentMethodId: false,
                    status: false,
                  });
                }
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                multipleModeEnabled
                  ? 'bg-amber-500 text-white shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title={multipleModeEnabled 
                ? 'Modo Múltiplos Lançamentos ATIVO - Clique nos cadeados para bloquear campos' 
                : 'Ativar Modo Múltiplos Lançamentos'}
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Múltiplos</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-all text-white"
              aria-label="Fechar modal"
              title="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Banner de Múltiplos Lançamentos */}
        {multipleModeEnabled && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-amber-700">
                <Layers className="w-5 h-5" />
                <span className="font-semibold text-sm">Modo Múltiplos Lançamentos</span>
              </div>
              <span className="text-amber-600 text-sm">
                Clique nos <Lock className="w-3.5 h-3.5 inline mx-0.5" /> ao lado dos campos para mantê-los nas próximas transações
              </span>
            </div>
          </div>
        )}

        {/* Tabs de Tipo */}
        <div className="border-b border-[#2A3F5F]/30 bg-[#0B1020] text-[#F5F7FB] px-6">
          <div className="flex gap-1 -mb-px">
            <button
              type="button"
              onClick={() => {
                setTransactionType('single');
                // Não alterar status se estiver bloqueado no modo múltiplos
                if (!multipleModeEnabled || !lockedFields.status) {
                  setFormData(prev => ({ ...prev, status: 'completed' }));
                }
              }}
              className={`flex items-center gap-2 px-4 py-3 font-semibold transition-all border-b-2 ${
                transactionType === 'single'
                  ? 'border-[#1F4FD8] text-[#1F4FD8] bg-[#151B2E]'
                  : 'border-transparent text-[#94A3B8] hover:text-[#F5F7FB] hover:bg-[#1A2332]'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Única
            </button>
            <button
              type="button"
              onClick={() => {
                setTransactionType('recurring');
                // Não alterar status se estiver bloqueado no modo múltiplos
                if (!multipleModeEnabled || !lockedFields.status) {
                  setFormData(prev => ({ ...prev, status: 'pending' }));
                }
              }}
              className={`flex items-center gap-2 px-4 py-3 font-semibold transition-all border-b-2 ${
                transactionType === 'recurring'
                  ? 'border-[#1F4FD8] text-[#1F4FD8] bg-[#151B2E]'
                  : 'border-transparent text-[#94A3B8] hover:text-[#F5F7FB] hover:bg-[#1A2332]'
              }`}
            >
              <Repeat className="w-4 h-4" />
              Recorrente
            </button>
            <button
              type="button"
              onClick={() => {
                setTransactionType('installment');
                // Não alterar status se estiver bloqueado no modo múltiplos
                if (!multipleModeEnabled || !lockedFields.status) {
                  setFormData(prev => ({ ...prev, status: 'pending' }));
                }
              }}
              className={`flex items-center gap-2 px-4 py-3 font-semibold transition-all border-b-2 ${
                transactionType === 'installment'
                  ? 'border-[#1F4FD8] text-[#1F4FD8] bg-[#151B2E]'
                  : 'border-transparent text-[#94A3B8] hover:text-[#F5F7FB] hover:bg-[#1A2332]'
              }`}
            >
              <CardIcon className="w-4 h-4" />
              Parcelada
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 font-inter bg-[#0B1020]">
          {/* Toggle Receita/Despesa */}
          <div className="flex items-center gap-2">
            <div className="flex bg-[#1A2332]/50 p-1 rounded-xl flex-1 border border-[#2A3F5F]/30">
              <button
                type="button"
                onClick={() => !lockedFields.type && setFormData({ ...formData, type: 'income', categoryId: '' })}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${
                  formData.type === 'income'
                    ? 'bg-[#2ECC9A] text-white shadow-md'
                    : 'text-[#94A3B8] hover:text-[#F5F7FB]'
                } ${lockedFields.type ? 'opacity-75 cursor-not-allowed' : ''}`}
                disabled={lockedFields.type}
              >
                Receita
              </button>
              <button
                type="button"
                onClick={() => !lockedFields.type && setFormData({ ...formData, type: 'expense', categoryId: '' })}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${
                  formData.type === 'expense'
                    ? 'bg-[#EF4444] text-white shadow-md'
                    : 'text-[#94A3B8] hover:text-[#F5F7FB]'
                } ${lockedFields.type ? 'opacity-75 cursor-not-allowed' : ''}`}
                disabled={lockedFields.type}
              >
                Despesa
              </button>
            </div>
            <LockButton field="type" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Valor */}
            <div>
              <label className="block text-sm font-semibold text-[#F5F7FB] mb-2">
                {transactionType === 'installment' ? 'Valor da Parcela *' : 'Valor *'}
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
                  className="w-full pl-14 pr-4 py-3 min-h-[44px] border-2 border-[#2A3F5F]/50 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#1A2332] text-[#F5F7FB] placeholder:text-[#475569]"
                  placeholder={transactionType === 'installment' ? 'Valor de cada parcela' : '0,00'}
                  required
                />
              </div>
            </div>

            {/* Data */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-[#F5F7FB]">
                  {transactionType === 'recurring' ? 'Data Início *' : transactionType === 'installment' ? 'Primeira Parcela *' : 'Data *'}
                </label>
                <LockButton field="transactionDate" />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Calendar className="w-5 h-5 text-[#1F4FD8]" />
                </div>
                <input
                  type="date"
                  value={formData.transactionDate}
                  onChange={(e) => !lockedFields.transactionDate && setFormData({ ...formData, transactionDate: e.target.value })}
                  className={`w-full pl-12 pr-4 py-3 min-h-[44px] border-2 border-[#2A3F5F]/50 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#1A2332] text-[#F5F7FB] appearance-none ${
                    lockedFields.transactionDate ? 'bg-[#2A3F5F]/20 border-[#2A3F5F]/70' : ''
                  }`}
                  style={{ colorScheme: 'dark' }}
                  required
                  title="Data da transação"
                  aria-label="Data da transação"
                  disabled={lockedFields.transactionDate}
                />
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-[#F5F7FB]">
                Descrição
              </label>
              {aiAvailable && (
                <button
                  type="button"
                  onClick={handleAiSuggestCategory}
                  disabled={aiSuggesting || !formData.description || formData.description.length < 3}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#1F4FD8] hover:text-[#1A44BF] disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  title="Sugerir categoria com IA"
                >
                  {aiSuggesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {aiSuggesting ? 'Analisando...' : 'Sugerir categoria'}
                </button>
              )}
            </div>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                setAiSuggestion(null); // Limpar sugestão ao mudar descrição
              }}
              className="w-full px-4 py-3 min-h-[44px] border-2 border-[#2A3F5F]/50 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#1A2332] text-[#F5F7FB] placeholder:text-[#475569]"
              placeholder="Ex: Salário, Aluguel, Compras... (opcional)"
            />
            {/* Mostrar sugestão da IA */}
            {aiSuggestion && (
              <div className="mt-2 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-blue-300">
                        {aiSuggestion.categoryName}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        aiSuggestion.confidence >= 0.8 
                          ? 'bg-green-900/50 text-green-300' 
                          : aiSuggestion.confidence >= 0.5 
                            ? 'bg-yellow-900/50 text-yellow-300'
                            : 'bg-red-900/50 text-red-300'
                      }`}>
                        {Math.round(aiSuggestion.confidence * 100)}% confiança
                      </span>
                    </div>
                    <p className="text-xs text-blue-400 mt-1">{aiSuggestion.reasoning}</p>
                    {formData.categoryId !== aiSuggestion.categoryId && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, categoryId: aiSuggestion.categoryId }));
                          setCategorySearch(aiSuggestion.categoryName);
                          toast.success('Categoria aplicada!');
                        }}
                        className="mt-2 text-xs font-medium text-blue-300 hover:text-blue-200 underline"
                      >
                        Aplicar esta categoria
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* === CAMPOS ESPECÍFICOS RECORRENTE === */}
          {transactionType === 'recurring' && (
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-blue-400 flex items-center gap-2">
                <Repeat className="w-5 h-5" />
                Configurações de Recorrência
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#F5F7FB] mb-1">
                    Frequência *
                  </label>
                  <select
                    value={recurringData.frequency}
                    onChange={(e) => setRecurringData({ ...recurringData, frequency: e.target.value as Frequency })}
                    className="w-full px-3 py-2.5 min-h-[44px] border-2 border-[#2A3F5F]/50 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] bg-[#1A2332] text-[#F5F7FB]"
                    title="Frequência da recorrência"
                  >
                    {FREQUENCY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#F5F7FB] mb-1">
                    A cada
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={recurringData.frequencyInterval}
                      onChange={(e) => setRecurringData({ ...recurringData, frequencyInterval: parseInt(e.target.value) || 1 })}
                      className="w-20 px-3 py-2.5 border-2 border-[#2A3F5F]/50 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] bg-[#1A2332] text-[#F5F7FB]"
                      title="Intervalo de frequência"
                      aria-label="Intervalo de frequência"
                    />
                    <span className="text-[#94A3B8]">período(s)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="hasEndDate"
                  checked={recurringData.hasEndDate}
                  onChange={(e) => setRecurringData({ ...recurringData, hasEndDate: e.target.checked })}
                  className="w-5 h-5 text-[#1F4FD8] rounded focus:ring-[#1F4FD8] bg-[#1A2332] border-[#2A3F5F]/50"
                />
                <label htmlFor="hasEndDate" className="text-sm font-medium text-[#F5F7FB]">
                  Definir data de término
                </label>
              </div>

              {recurringData.hasEndDate && (
                <div>
                  <label className="block text-sm font-medium text-[#F5F7FB] mb-1">
                    Número de ocorrências
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={recurringData.totalOccurrences || ''}
                    onChange={(e) => setRecurringData({ ...recurringData, totalOccurrences: parseInt(e.target.value) || undefined })}
                    className="w-32 px-3 py-2.5 border-2 border-[#2A3F5F]/50 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] bg-[#1A2332] text-[#F5F7FB]"
                    placeholder="Ex: 12"
                  />
                </div>
              )}
            </div>
          )}

          {/* === CAMPOS ESPECÍFICOS PARCELADO === */}
          {transactionType === 'installment' && (
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-blue-400 flex items-center gap-2">
                <CardIcon className="w-5 h-5" />
                Configurações de Parcelamento
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-[#F5F7FB] mb-1">
                  Número de Parcelas *
                </label>
                <select
                  value={installmentData.totalInstallments}
                  onChange={(e) => setInstallmentData({ ...installmentData, totalInstallments: parseInt(e.target.value) })}
                  className="w-full px-3 py-2.5 border-2 border-[#2A3F5F]/50 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] bg-[#1A2332] text-[#F5F7FB]"
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
                  className="w-5 h-5 text-[#1F4FD8] rounded focus:ring-[#1F4FD8] bg-[#1A2332] border-[#2A3F5F]/50"
                />
                <label htmlFor="hasDownPayment" className="text-sm font-medium text-[#F5F7FB]">
                  Tem entrada (1 + parcelas)
                </label>
              </div>

              {installmentData.hasDownPayment && (
                <div>
                  <label className="block text-sm font-medium text-[#F5F7FB] mb-1">
                    Valor da Entrada
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-blue-400 font-semibold">R$</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={installmentData.downPaymentAmount}
                      onChange={(e) => setInstallmentData({ ...installmentData, downPaymentAmount: e.target.value })}
                      className="w-full pl-12 pr-4 py-2.5 border-2 border-[#2A3F5F]/50 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] bg-[#1A2332] text-[#F5F7FB]"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              )}

              {/* Preview do total */}
              {formData.amount && (
                <div className="bg-[#1A2332]/50 p-3 rounded-lg border border-[#2A3F5F]/50">
                  <div className="text-sm text-[#94A3B8] space-y-1">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      <span>
                        {installmentData.hasDownPayment && installmentData.downPaymentAmount && (
                          <span className="font-semibold text-[#F5F7FB]">
                            Entrada: R$ {parseFloat(installmentData.downPaymentAmount).toFixed(2)} + {' '}
                          </span>
                        )}
                        <span className="font-semibold text-blue-400">
                          {installmentData.hasDownPayment ? installmentData.totalInstallments - 1 : installmentData.totalInstallments}x 
                          de R$ {parseFloat(formData.amount.replace(',', '.')).toFixed(2)}
                        </span>
                      </span>
                    </div>
                    <div className="font-bold text-blue-300 text-base">
                      Total: R$ {calculateInstallmentTotal().toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Categoria */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-[#F5F7FB]">
                Categoria *
              </label>
              <LockButton field="categoryId" />
            </div>
            <div className="relative" ref={categoryDropdownRef}>
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Tag className="w-5 h-5 text-[#1F4FD8]" />
              </div>
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => {
                  if (!lockedFields.categoryId) {
                    setCategorySearch(e.target.value);
                    setShowCategoryDropdown(true);
                  }
                }}
                onFocus={() => !lockedFields.categoryId && setShowCategoryDropdown(true)}
                className={`w-full pl-12 pr-4 py-3 min-h-[44px] border-2 border-[#2A3F5F]/50 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#1A2332] text-[#F5F7FB] placeholder:text-[#475569] ${
                  lockedFields.categoryId ? 'bg-[#2A3F5F]/20 border-[#2A3F5F]/70 cursor-not-allowed' : ''
                }`}
                placeholder="Buscar categoria..."
                required
                disabled={lockedFields.categoryId}
              />
              
              {showCategoryDropdown && filteredCategories.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-[#151B2E] border-2 border-[#2A3F5F]/50 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                  {filteredCategories.map(({ category, level, indent }) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      className="w-full py-3 text-left hover:bg-[#1A2332] transition-colors flex items-center gap-3 border-b border-[#2A3F5F]/30 last:border-0"
                      style={{ paddingLeft: `${16 + (indent * 24)}px`, paddingRight: '16px' }}
                    >
                      {indent > 0 && (
                        <span className="text-[#475569] text-sm mr-1">↳</span>
                      )}
                      <span className="text-xl">{category.icon}</span>
                      <div className="flex-1">
                        <p className={`${level === 1 ? 'font-bold' : 'font-medium'} text-[#F5F7FB]`}>
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

          {transactionType !== 'installment' && (
            <div className="border border-[#2A3F5F]/50 rounded-xl bg-[#151B2E]/60 p-4 space-y-3">
              <label className="flex items-center gap-3 text-sm font-semibold text-[#F5F7FB] cursor-pointer">
                <input
                  type="checkbox"
                  checked={splitEnabled}
                  onChange={(e) => setSplitEnabled(e.target.checked)}
                  className="w-4 h-4 text-[#1F4FD8] focus:ring-[#1F4FD8] rounded"
                />
                Dividir lançamento
              </label>

              {splitEnabled && (
                <div className="space-y-3">
                  {categorySplits.map((split, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_140px_44px] gap-2 items-center">
                      <select
                        value={split.categoryId}
                        onChange={(e) => updateCategorySplit(index, 'categoryId', e.target.value)}
                        className="w-full px-3 py-2.5 min-h-[44px] border-2 border-[#2A3F5F]/50 rounded-lg bg-[#1A2332] text-[#F5F7FB]"
                        aria-label="Categoria do rateio"
                      >
                        <option value="">Categoria</option>
                        {filteredCategories.map(({ category, indent }) => (
                          <option key={category.id} value={category.id}>
                            {indent > 0 ? `${'  '.repeat(indent)}-> ` : ''}{category.icon} {category.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={split.amount}
                        onChange={(e) => updateCategorySplit(index, 'amount', e.target.value)}
                        className="w-full px-3 py-2.5 min-h-[44px] border-2 border-[#2A3F5F]/50 rounded-lg bg-[#1A2332] text-[#F5F7FB] placeholder:text-[#475569]"
                        placeholder="0,00"
                        aria-label="Valor do rateio"
                      />
                      <button
                        type="button"
                        onClick={() => removeCategorySplit(index)}
                        disabled={categorySplits.length === 1}
                        className="h-11 rounded-lg border border-[#2A3F5F]/60 text-red-300 hover:bg-red-950/30 disabled:opacity-40"
                        title="Remover categoria"
                      >
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addCategorySplit}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1A2332] text-[#93C5FD] hover:bg-[#22304A] text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar categoria
                  </button>

                  <div className="rounded-lg bg-[#0B1020] border border-[#2A3F5F]/50 p-3 text-sm space-y-1">
                    <div className="flex justify-between text-[#94A3B8]"><span>Valor total</span><span>R$ {transactionAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between text-[#94A3B8]"><span>Dividido</span><span>R$ {splitTotal.toFixed(2)}</span></div>
                    <div className={`flex justify-between font-semibold ${splitDifferenceCents === 0 ? 'text-[#2ECC9A]' : 'text-[#F59E0B]'}`}>
                      <span>{splitDifferenceCents === 0 ? 'Diferença' : splitDifferenceCents > 0 ? 'Falta dividir' : 'Passou do total'}</span>
                      <span>R$ {Math.abs(splitDifference).toFixed(2)}</span>
                    </div>
                    {!splitRowsValid && (
                      <p className="text-xs text-red-300 pt-1">A soma das categorias precisa ser igual ao valor total do lançamento.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Conta Bancária */}
            <div>
              <div className="flex items-center justify-between mb-2">


                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-[#F5F7FB]">
                    Conta Bancária *
                  </label>
                  <LockButton field="bankAccountId" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickBankAccount(!showQuickBankAccount)}
                  className="text-xs text-[#1F4FD8] hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Nova Conta
                </button>
              </div>
              
              {showQuickBankAccount && (
                <div className="mb-3 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg space-y-2">
                  <input
                    type="text"
                    placeholder="Nome da conta"
                    value={quickBankAccount.name}
                    onChange={(e) => setQuickBankAccount({ ...quickBankAccount, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#2A3F5F]/50 rounded-lg bg-[#1A2332] text-[#F5F7FB] placeholder:text-[#475569]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={quickBankAccount.type}
                      onChange={(e) => setQuickBankAccount({ ...quickBankAccount, type: e.target.value })}
                      className="px-3 py-2 text-sm border border-[#2A3F5F]/50 rounded-lg bg-[#1A2332] text-[#F5F7FB]"
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
                      className="px-3 py-2 text-sm border border-[#2A3F5F]/50 rounded-lg bg-[#1A2332] text-[#F5F7FB] placeholder:text-[#475569]"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowQuickBankAccount(false)}
                      className="px-3 py-1.5 text-sm text-[#94A3B8] hover:bg-[#1A2332] rounded"
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
                  onChange={(e) => !lockedFields.bankAccountId && setFormData({ ...formData, bankAccountId: e.target.value })}
                  className={`w-full pl-12 pr-4 py-3 min-h-[44px] border-2 border-[#2A3F5F]/50 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#1A2332] text-[#F5F7FB] appearance-none cursor-pointer ${
                    lockedFields.bankAccountId ? 'bg-[#2A3F5F]/20 border-[#2A3F5F]/70 cursor-not-allowed' : ''
                  }`}
                  required
                  title="Selecione a conta bancária"
                  disabled={lockedFields.bankAccountId}
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-[#F5F7FB]">
                    Meio de Pagamento <span className="text-[#94A3B8] font-normal">(opcional)</span>
                  </label>
                  <LockButton field="paymentMethodId" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickPaymentMethod(!showQuickPaymentMethod)}
                  className="text-xs text-[#1F4FD8] hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Novo Método
                </button>
              </div>
              
              {showQuickPaymentMethod && (
                <div className="mb-3 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg space-y-2">
                  <input
                    type="text"
                    placeholder="Ex: PIX Nubank, Cartão Inter, Dinheiro..."
                    value={quickPaymentMethod.name}
                    onChange={(e) => setQuickPaymentMethod({ ...quickPaymentMethod, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#2A3F5F]/50 rounded-lg bg-[#1A2332] text-[#F5F7FB] placeholder:text-[#475569]"
                    aria-label="Nome do meio de pagamento"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowQuickPaymentMethod(false)}
                      className="px-3 py-1.5 text-sm text-[#94A3B8] hover:bg-[#1A2332] rounded"
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
                  onClick={() => !lockedFields.paymentMethodId && setShowPaymentMethodDropdown(!showPaymentMethodDropdown)}
                  className={`w-full pl-12 pr-10 py-3 min-h-[44px] border-2 border-[#2A3F5F]/50 rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#1A2332] text-[#F5F7FB] text-left cursor-pointer ${
                    lockedFields.paymentMethodId ? 'bg-[#2A3F5F]/20 border-[#2A3F5F]/70 cursor-not-allowed' : ''
                  }`}
                  aria-label="Meio de Pagamento"
                  aria-expanded={showPaymentMethodDropdown}
                  disabled={lockedFields.paymentMethodId}
                >
                  {formData.paymentMethodId 
                    ? paymentMethods.find(m => m.id === formData.paymentMethodId)?.name || 'Selecione (opcional)'
                    : 'Selecione (opcional)'}
                </button>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <ChevronDown className={`w-5 h-5 text-[#94A3B8] transition-transform ${showPaymentMethodDropdown ? 'rotate-180' : ''}`} />
                </div>
                
                {/* Dropdown customizado */}
                {showPaymentMethodDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-[#151B2E] border-2 border-[#2A3F5F]/50 rounded-xl shadow-lg max-h-60 overflow-auto">
                    {/* Opção para limpar seleção */}
                    <div
                      onClick={() => handleSelectPaymentMethod('')}
                      className="px-4 py-3 cursor-pointer hover:bg-[#1A2332] transition-colors border-b border-[#2A3F5F]/30"
                    >
                      <span className="text-[#94A3B8]">Selecione (opcional)</span>
                    </div>
                    
                    {/* Lista de meios de pagamento */}
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className={`px-4 py-2.5 cursor-pointer transition-colors flex items-center justify-between ${
                          formData.paymentMethodId === method.id ? 'bg-blue-900/30' : 'hover:bg-[#1A2332]'
                        }`}
                      >
                        <span 
                          onClick={() => handleSelectPaymentMethod(method.id)}
                          className={`flex-1 ${formData.paymentMethodId === method.id ? 'text-[#1F4FD8] font-medium' : 'text-[#F5F7FB]'}`}
                        >
                          {method.name}
                        </span>
                        
                        {/* Ícones de editar/excluir - sempre visíveis */}
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditPaymentMethod(e, method)}
                            className="p-1.5 rounded-lg bg-blue-900/30 hover:bg-blue-900/50 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4 text-blue-400" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenDeletePaymentMethod(e, method)}
                            className="p-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {paymentMethods.length === 0 && (
                      <div className="px-4 py-3 text-[#94A3B8] text-center">
                        Nenhum meio de pagamento cadastrado
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status - apenas para transação única */}
          {transactionType === 'single' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-[#F5F7FB]">
                  Status
                </label>
                <LockButton field="status" />
              </div>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-xl transition-all hover:shadow-md ${
                  formData.status === 'completed'
                    ? 'border-[#2ECC9A] bg-[#2ECC9A]/10'
                    : 'border-[#2A3F5F]/50 bg-[#1A2332] hover:border-[#2A3F5F]/70'
                } ${lockedFields.status ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
                  <input
                    type="radio"
                    value="completed"
                    checked={formData.status === 'completed'}
                    onChange={(e) => !lockedFields.status && setFormData({ ...formData, status: e.target.value })}
                    className="w-5 h-5 text-[#2ECC9A] focus:ring-[#2ECC9A]"
                    disabled={lockedFields.status}
                  />
                  <span className={`font-semibold ${formData.status === 'completed' ? 'text-[#2ECC9A]' : 'text-[#F5F7FB]'}`}>Pago</span>
                </label>
                <label className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-xl transition-all hover:shadow-md ${
                  formData.status === 'pending'
                    ? 'border-[#F59E0B] bg-[#F59E0B]/10'
                    : 'border-[#2A3F5F]/50 bg-[#1A2332] hover:border-[#2A3F5F]/70'
                } ${lockedFields.status ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
                  <input
                    type="radio"
                    value="pending"
                    checked={formData.status === 'pending'}
                    onChange={(e) => !lockedFields.status && setFormData({ ...formData, status: e.target.value })}
                    className="w-5 h-5 text-[#F59E0B] focus:ring-[#F59E0B]"
                    disabled={lockedFields.status}
                  />
                  <span className={`font-semibold ${formData.status === 'pending' ? 'text-[#F59E0B]' : 'text-[#F5F7FB]'}`}>Pendente</span>
                </label>
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-semibold text-[#F5F7FB] mb-2">
              Observações <span className="text-[#94A3B8] font-normal">(opcional)</span>
            </label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="min-h-[44px] border-2 border-[#2A3F5F]/50 bg-[var(--v2-bg-surface-2)] text-[var(--v2-text-primary)] placeholder:text-[#475569] resize-none"
              rows={2}
              placeholder="Adicione notas ou observações..."
            />
          </div>
        </form>

        {/* Footer com Botões */}
        <div className="border-t-2 border-[#2A3F5F]/30 px-6 py-4 bg-[#0B1020] text-[#F5F7FB]">
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              size="lg"
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              variant={formData.type === 'income' ? 'success' : 'danger'}
              size="lg"
              className="flex-1"
              disabled={loading || (canUseSplits && !splitRowsValid)}
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
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Edição de Meio de Pagamento */}
      {showEditPaymentMethodModal && editingPaymentMethod && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-[#151B2E] rounded-2xl shadow-2xl w-full max-w-md p-6 border border-[#2A3F5F]/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#F5F7FB]">Editar Meio de Pagamento</h3>
              <button
                onClick={() => {
                  setShowEditPaymentMethodModal(false);
                  setEditingPaymentMethod(null);
                  setEditPaymentMethodName('');
                }}
                className="p-2 hover:bg-[#1A2332] rounded-full"
                title="Fechar"
              >
                <X className="w-5 h-5 text-[#94A3B8]" />
              </button>
            </div>
            <input
              type="text"
              value={editPaymentMethodName}
              onChange={(e) => setEditPaymentMethodName(e.target.value)}
              placeholder="Nome do meio de pagamento"
              className="w-full px-4 py-3 border-2 border-[#2A3F5F]/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-[#1A2332] text-[#F5F7FB] placeholder:text-[#475569]"
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <Button
                onClick={() => {
                  setShowEditPaymentMethodModal(false);
                  setEditingPaymentMethod(null);
                  setEditPaymentMethodName('');
                }}
                variant="secondary"
                className="flex-1"
                disabled={paymentMethodActionLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEditPaymentMethod}
                variant="primary"
                className="flex-1"
                disabled={paymentMethodActionLoading}
              >
                {paymentMethodActionLoading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão de Meio de Pagamento */}
      {showDeletePaymentMethodModal && deletingPaymentMethod && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-[#151B2E] rounded-2xl shadow-2xl w-full max-w-md p-6 border border-[#2A3F5F]/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#F5F7FB]">Excluir Meio de Pagamento</h3>
              <button
                onClick={() => {
                  setShowDeletePaymentMethodModal(false);
                  setDeletingPaymentMethod(null);
                }}
                className="p-2 hover:bg-[#1A2332] rounded-full"
                title="Fechar"
              >
                <X className="w-5 h-5 text-[#94A3B8]" />
              </button>
            </div>
            <p className="text-[#F5F7FB] mb-4">
              Tem certeza que deseja excluir o meio de pagamento <strong className="text-[#F5F7FB]">{deletingPaymentMethod.name}</strong>?
            </p>
            <p className="text-sm text-amber-400 bg-amber-900/20 p-3 rounded-lg mb-4 border border-amber-700/30">
              ⚠️ Se houver transações vinculadas, a exclusão será bloqueada. Nesse caso, você pode inativar o meio de pagamento.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowDeletePaymentMethodModal(false);
                  setDeletingPaymentMethod(null);
                }}
                variant="secondary"
                className="flex-1"
                disabled={paymentMethodActionLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmDeletePaymentMethod}
                variant="danger"
                className="flex-1"
                disabled={paymentMethodActionLoading}
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






