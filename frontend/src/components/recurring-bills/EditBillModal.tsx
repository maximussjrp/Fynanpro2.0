'use client';

import { X, Edit, DollarSign, Calendar, Tag, Building, CreditCard } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  isActive: boolean;
}

interface BankAccount {
  id: string;
  name: string;
}

interface PaymentMethod {
  id: string;
  name: string;
}

interface RecurringBillForm {
  name: string;
  description: string;
  type: string;
  amount: string;
  frequency: string;
  startDate: string;
  endDate: string;
  dayOfMonth: string;
  dayOfWeek: string;
  categoryId: string;
  bankAccountId: string;
  paymentMethodId: string;
  notes: string;
}

interface EditBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: RecurringBillForm;
  setForm: (form: RecurringBillForm) => void;
  categories: Category[];
  bankAccounts: BankAccount[];
  paymentMethods: PaymentMethod[];
  submitting: boolean;
}

export default function EditBillModal({
  isOpen,
  onClose,
  onSubmit,
  form,
  setForm,
  categories,
  bankAccounts,
  paymentMethods,
  submitting,
}: EditBillModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header com Gradiente */}
        <div className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Edit className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white font-['Poppins']">
                  Editar Conta Recorrente
                </h2>
                <p className="text-white/90 text-sm mt-1">
                  Atualize as informações desta conta
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Nome e Descrição */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Tag className="w-4 h-4 inline mr-1 text-[#F59E0B]" />
                  Nome da Conta *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent bg-[#F9FAFB] transition-all"
                  placeholder="Ex: Aluguel, Netflix, Salário..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent bg-[#F9FAFB] transition-all"
                  placeholder="Detalhes adicionais..."
                />
              </div>
            </div>

            {/* Tipo de Transação */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Tipo de Transação *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'expense' })}
                  className={`px-6 py-4 rounded-xl border-2 font-semibold transition-all duration-200 ${
                    form.type === 'expense'
                      ? 'border-[#EF4444] bg-red-50 text-[#EF4444] shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl mr-2">💸</span>
                  Despesa
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'income' })}
                  className={`px-6 py-4 rounded-xl border-2 font-semibold transition-all duration-200 ${
                    form.type === 'income'
                      ? 'border-[#2ECC9A] bg-green-50 text-[#2ECC9A] shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl mr-2">💰</span>
                  Receita
                </button>
              </div>
            </div>

            {/* Valor e Frequência */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1 text-[#F59E0B]" />
                  Valor *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent bg-[#F9FAFB] transition-all"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1 text-[#F59E0B]" />
                  Frequência *
                </label>
                <select
                  required
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent bg-[#F9FAFB] transition-all"
                >
                  <option value="daily">📅 Diário</option>
                  <option value="weekly">📅 Semanal</option>
                  <option value="monthly">📅 Mensal</option>
                  <option value="yearly">📅 Anual</option>
                </select>
              </div>
            </div>

            {/* Dia da Semana (apenas para semanal) */}
            {form.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Dia da Semana *
                </label>
                <select
                  required
                  value={form.dayOfWeek}
                  onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent bg-[#F9FAFB] transition-all"
                >
                  <option value="0">Domingo</option>
                  <option value="1">Segunda-feira</option>
                  <option value="2">Terça-feira</option>
                  <option value="3">Quarta-feira</option>
                  <option value="4">Quinta-feira</option>
                  <option value="5">Sexta-feira</option>
                  <option value="6">Sábado</option>
                </select>
              </div>
            )}

            {/* Data Início e Fim */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {form.frequency === 'monthly' ? 'Data de Início (define o dia mensal) *' : 'Data de Início *'}
                </label>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent bg-[#F9FAFB] text-gray-900 transition-all"
                  style={{ colorScheme: 'light' }}
                  title="Data de início da recorrência"
                  aria-label="Data de início"
                />
                {form.frequency === 'monthly' && form.startDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Repetirá todo dia {new Date(form.startDate + 'T00:00:00').getDate()} de cada mês
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Data de Fim (opcional)
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full px-4 py-3 min-h-[44px] border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent bg-[#F9FAFB] text-gray-900 transition-all"
                  style={{ colorScheme: 'light' }}
                  title="Data de fim da recorrência"
                  aria-label="Data de fim"
                />
              </div>
            </div>

            {/* Categoria, Conta e Método */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Tag className="w-4 h-4 inline mr-1 text-[#F59E0B]" />
                  Categoria *
                </label>
                <select
                  required
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent bg-[#F9FAFB] transition-all"
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Building className="w-4 h-4 inline mr-1 text-[#F59E0B]" />
                  Conta Bancária *
                </label>
                <select
                  required
                  value={form.bankAccountId}
                  onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent bg-[#F9FAFB] transition-all"
                >
                  <option value="">Selecione uma conta</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <CreditCard className="w-4 h-4 inline mr-1 text-[#F59E0B]" />
                  Meio de Pagamento (opcional)
                </label>
                <select
                  value={form.paymentMethodId}
                  onChange={(e) => setForm({ ...form, paymentMethodId: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent bg-[#F9FAFB] transition-all"
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

            {/* Observações */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent bg-[#F9FAFB] transition-all resize-none"
                rows={3}
                placeholder="Informações adicionais sobre esta conta recorrente..."
              />
            </div>
          </div>
        </form>

        {/* Footer Fixo */}
        <div className="flex gap-3 p-6 bg-[#F9FAFB] border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-all duration-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={onSubmit}
            disabled={submitting}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
          >
            {submitting ? 'Atualizando...' : 'Atualizar Conta Recorrente'}
          </button>
        </div>
      </div>
    </div>
  );
}
