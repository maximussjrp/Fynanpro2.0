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
  });

  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.description || !formData.categoryId || !formData.bankAccountId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);

    try {
      const payload = {
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

      if (transaction) {
        await api.put(`/transactions/${transaction.id}`, payload);
        toast.success('Transação atualizada com sucesso!');
      } else {
        await api.post('/transactions', payload);
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
    
    // Adicionar apenas categorias raiz (nível 1) e suas filhas
    cats.filter(c => !c.parentId).forEach(cat => addCategoryWithChildren(cat));
    
    return result;
  };

  // Filtrar e construir hierarquia
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
                Data *
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

          {/* Categoria com busca */}
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
                  title="Selecione meio de pagamento"
                  aria-label="Meio de Pagamento"
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

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
              Status
            </label>
            <div className="flex gap-3">
              <label className="flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                formData.status === 'completed'
                  ? 'border-[#22C39A] bg-[#E8F9F4]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }">
                <input
                  type="radio"
                  value="completed"
                  checked={formData.status === 'completed'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-5 h-5 text-[#22C39A] focus:ring-[#22C39A]"
                />
                <span className={`font-semibold ${formData.status === 'completed' ? 'text-[#22C39A]' : 'text-gray-700'}`}>Pago</span>
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

          {/* Observações */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
              Observações <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] transition-all bg-[#F9FAFB] resize-none"
              rows={3}
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
              } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              disabled={loading}
            >
              {loading ? 'Salvando...' : transaction ? 'Atualizar Transação' : 'Criar Transação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
