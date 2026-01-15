'use client';

import { X, Plus, AlertCircle } from 'lucide-react';
import { useState } from 'react';

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

interface PaymentMethod {
  id: string;
  name: string;
}

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

interface CreateInstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  form: InstallmentForm;
  setForm: (form: InstallmentForm) => void;
  categories: Category[];
  bankAccounts: BankAccount[];
  paymentMethods: PaymentMethod[];
  submitting: boolean;
}

export default function CreateInstallmentModal({
  isOpen,
  onClose,
  onSubmit,
  form,
  setForm,
  categories,
  bankAccounts,
  paymentMethods,
  submitting,
}: CreateInstallmentModalProps) {
  if (!isOpen) return null;

  const handleInputChange = (field: keyof InstallmentForm, value: string) => {
    setForm({ ...form, [field]: value });
  };

  const calculateInstallmentAmount = () => {
    const total = Number(form.totalAmount);
    const count = Number(form.numberOfInstallments);
    if (total > 0 && count >= 2) {
      return (total / count).toFixed(2);
    }
    return '0.00';
  };

  const installmentAmount = calculateInstallmentAmount();
  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header com Gradiente Roxo */}
        <div className="bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Nova Compra Parcelada</h2>
                <p className="text-white/80 text-sm">Divida seus pagamentos em várias parcelas</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-6">
            {/* Nome da Compra */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome da Compra *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Ex: Notebook Dell"
                className="w-full px-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#8B5CF6] transition-colors bg-white text-gray-900 placeholder:text-gray-400"
                required
              />
            </div>

            {/* Grid 2 Colunas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Valor Total */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Valor Total *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.totalAmount}
                    onChange={(e) => handleInputChange('totalAmount', e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-12 pr-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#8B5CF6] transition-colors bg-white text-gray-900 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>

              {/* Número de Parcelas */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Número de Parcelas *
                </label>
                <input
                  type="number"
                  min="2"
                  max="60"
                  value={form.numberOfInstallments}
                  onChange={(e) => handleInputChange('numberOfInstallments', e.target.value)}
                  placeholder="Ex: 12"
                  className="w-full px-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#8B5CF6] transition-colors bg-white text-gray-900 placeholder:text-gray-400"
                  required
                />
              </div>
            </div>

            {/* Calculadora Automática */}
            {Number(form.totalAmount) > 0 && Number(form.numberOfInstallments) >= 2 && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-[#8B5CF6] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] rounded-lg flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Valor por Parcela</p>
                      <p className="text-2xl font-bold text-[#8B5CF6]">
                        R$ {installmentAmount}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {form.numberOfInstallments}x de
                    </p>
                    <p className="text-lg font-semibold text-gray-700">
                      R$ {installmentAmount}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Grid 2 Colunas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Data Primeira Parcela */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Data da Primeira Parcela *
                </label>
                <input
                  type="date"
                  value={form.firstDueDate}
                  onChange={(e) => handleInputChange('firstDueDate', e.target.value)}
                  className="w-full px-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#8B5CF6] transition-colors bg-white text-gray-900"
                  style={{ colorScheme: 'light' }}
                  title="Data da primeira parcela"
                  aria-label="Data da primeira parcela"
                  required
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Categoria *
                </label>
                <select
                  value={form.categoryId}
                  onChange={(e) => handleInputChange('categoryId', e.target.value)}
                  className="w-full px-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#8B5CF6] transition-colors bg-white text-gray-900"
                  required
                >
                  <option value="">Selecione</option>
                  {expenseCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid 2 Colunas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Conta Bancária */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Conta Bancária *
                </label>
                <select
                  value={form.bankAccountId}
                  onChange={(e) => handleInputChange('bankAccountId', e.target.value)}
                  className="w-full px-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#8B5CF6] transition-colors bg-white text-gray-900"
                  required
                >
                  <option value="">Selecione</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Método de Pagamento */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Método de Pagamento
                </label>
                <select
                  value={form.paymentMethodId}
                  onChange={(e) => handleInputChange('paymentMethodId', e.target.value)}
                  className="w-full px-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#8B5CF6] transition-colors bg-white text-gray-900"
                >
                  <option value="">Selecione (opcional)</option>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Descrição Adicional
              </label>
              <textarea
                value={form.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Detalhes sobre a compra..."
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#8B5CF6] transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="px-6 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {submitting ? 'Criando...' : 'Criar Parcelamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
