'use client';

import { Plus, TrendingDown, CreditCard, Calendar } from 'lucide-react';

interface InstallmentsHeaderProps {
  totalActive: number;
  totalOwed: number;
  pendingInstallments: number;
  onCreateNew: () => void;
}

export default function InstallmentsHeader({
  totalActive,
  totalOwed,
  pendingInstallments,
  onCreateNew,
}: InstallmentsHeaderProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="mb-8">
      {/* Título e Botão */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 font-['Poppins']">
            Compras Parceladas
          </h1>
          <p className="text-gray-600 mt-2 font-['Inter']">
            Controle suas compras divididas em várias parcelas
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          Nova Compra Parcelada
        </button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Compras Ativas */}
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#8B5CF6]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Compras Ativas</p>
              <p className="text-3xl font-bold text-gray-900">{totalActive}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-[#8B5CF6]" />
            </div>
          </div>
        </div>

        {/* Total a Pagar */}
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#E74C3C]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total a Pagar</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalOwed)}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-[#E74C3C]" />
            </div>
          </div>
        </div>

        {/* Parcelas Pendentes */}
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#F59E0B]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Parcelas Pendentes</p>
              <p className="text-3xl font-bold text-gray-900">{pendingInstallments}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#F59E0B]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
