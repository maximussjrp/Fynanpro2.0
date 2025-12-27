'use client';

import { Trash2, Calendar, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

interface InstallmentPurchase {
  id: string;
  name: string;
  description?: string;
  totalAmount: string;
  numberOfInstallments: number;
  installmentAmount: string;
  remainingBalance: string;
  paidInstallments: number;
  firstDueDate: string;
  status: string;
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  installments?: Installment[];
}

interface Installment {
  id: string;
  installmentNumber: number;
  amount: string;
  dueDate: string;
  status: string;
  bankAccount?: {
    id: string;
    name: string;
  };
}

interface InstallmentCardProps {
  purchase: InstallmentPurchase;
  onDelete: (id: string) => void;
  onPayInstallment: (purchaseId: string, installmentId: string) => void;
}

export default function InstallmentCard({
  purchase,
  onDelete,
  onPayInstallment,
}: InstallmentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    // Parse date string as local date to avoid timezone issues
    const dateOnly = dateString.split('T')[0];
    const [year, month, day] = dateOnly.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const progress = (purchase.paidInstallments / purchase.numberOfInstallments) * 100;
  const pendingInstallments = purchase.installments?.filter(i => i.status === 'pending').length || 0;

  return (
    <div className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100">
      {/* Header com Gradiente Roxo */}
      <div className="bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-4xl">{purchase.category.icon}</span>
            <div>
              <h3 className="text-white font-bold text-xl">{purchase.name}</h3>
              <p className="text-white/90 text-sm">{purchase.category.name}</p>
            </div>
          </div>
          <button
            onClick={() => onDelete(purchase.id)}
            className="p-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
          >
            <Trash2 className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Corpo do Card */}
      <div className="p-6 space-y-4">
        {/* Valores Principais */}
        <div className="grid grid-cols-3 gap-2">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 mb-1">Valor Total</p>
            <p className="text-base lg:text-lg font-bold text-gray-900 truncate">
              {formatCurrency(Number(purchase.totalAmount))}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 mb-1">Por Parcela</p>
            <p className="text-base lg:text-lg font-bold text-gray-900 truncate">
              {formatCurrency(Number(purchase.installmentAmount))}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 mb-1">Restante</p>
            <p className="text-base lg:text-lg font-bold text-[#EF4444] truncate">
              {formatCurrency(Number(purchase.remainingBalance))}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 font-medium">
              {purchase.paidInstallments} de {purchase.numberOfInstallments} parcelas pagas
            </span>
            <span className="font-bold text-[#8B5CF6]">{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] h-full rounded-full transition-all duration-500 shadow-md"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Informações Adicionais */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-[#8B5CF6]" />
            <span>Início: {formatDate(purchase.firstDueDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              pendingInstallments > 0
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {pendingInstallments > 0 ? `${pendingInstallments} pendentes` : 'Concluída'}
            </span>
          </div>
        </div>

        {/* Botão Expandir */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center gap-2 text-gray-700 font-semibold transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-5 h-5" />
              Ocultar Parcelas
            </>
          ) : (
            <>
              <ChevronDown className="w-5 h-5" />
              Ver Todas as Parcelas
            </>
          )}
        </button>
      </div>

      {/* Lista de Parcelas Expandida */}
      {expanded && purchase.installments && (
        <div className="border-t border-gray-200 bg-gray-50 p-6">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-[#8B5CF6]" />
            Cronograma de Parcelas
          </h4>
          <div className="space-y-2">
            {purchase.installments.map((inst) => (
              <div
                key={inst.id}
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  inst.status === 'paid'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-white border-gray-200 hover:border-[#8B5CF6]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    inst.status === 'paid'
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  }`}>
                    {inst.status === 'paid' ? (
                      <CheckCircle className="w-6 h-6 text-white" />
                    ) : (
                      <span className="font-bold text-gray-600">{inst.installmentNumber}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      Parcela {inst.installmentNumber}/{purchase.numberOfInstallments}
                    </p>
                    <p className="text-sm text-gray-500">
                      Vencimento: {formatDate(inst.dueDate)}
                    </p>
                    {inst.bankAccount && (
                      <p className="text-xs text-gray-400">
                        {inst.bankAccount.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(Number(inst.amount))}
                  </p>
                  {inst.status === 'pending' && (() => {
                    const dueDate = new Date(inst.dueDate.split('T')[0] + 'T00:00:00');
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isOverdue = dueDate < today;
                    
                    return isOverdue ? (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          Atrasado
                        </span>
                        <button
                          onClick={() => onPayInstallment(purchase.id, inst.id)}
                          className="px-4 py-2 bg-gradient-to-r from-[#2ECC9A] to-[#22C55E] text-white rounded-lg hover:shadow-lg transition-all duration-200 text-sm font-semibold"
                        >
                          Pagar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onPayInstallment(purchase.id, inst.id)}
                        className="px-4 py-2 bg-gradient-to-r from-[#2ECC9A] to-[#22C55E] text-white rounded-lg hover:shadow-lg transition-all duration-200 text-sm font-semibold"
                      >
                        Pagar
                      </button>
                    );
                  })()}
                  {inst.status === 'paid' && (
                    <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-semibold">
                      ✓ Pago
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
