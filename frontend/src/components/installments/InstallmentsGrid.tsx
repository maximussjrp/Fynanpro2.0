'use client';

import InstallmentCard from './InstallmentCard';
import { CreditCard } from 'lucide-react';

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
  installments?: any[];
}

interface InstallmentsGridProps {
  purchases: InstallmentPurchase[];
  loading: boolean;
  onDelete: (id: string) => void;
  onPayInstallment: (purchaseId: string, installmentId: string) => void;
  onCreateNew: () => void;
}

export default function InstallmentsGrid({
  purchases,
  loading,
  onDelete,
  onPayInstallment,
  onCreateNew,
}: InstallmentsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-2xl shadow-xl overflow-hidden animate-pulse">
            <div className="bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] h-32" />
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="h-12 bg-gray-200 rounded" />
                <div className="h-12 bg-gray-200 rounded" />
                <div className="h-12 bg-gray-200 rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded-full" />
              </div>
              <div className="h-10 bg-gray-200 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-32 h-32 bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-full flex items-center justify-center mb-6 shadow-2xl">
          <CreditCard className="w-16 h-16 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Nenhuma compra parcelada ainda
        </h3>
        <p className="text-gray-600 text-center max-w-md mb-8">
          Comece registrando suas compras parceladas para acompanhar as parcelas e manter suas finanças organizadas.
        </p>
        <button
          onClick={onCreateNew}
          className="px-8 py-4 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
        >
          Cadastrar Primeira Compra
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {purchases.map((purchase) => (
        <InstallmentCard
          key={purchase.id}
          purchase={purchase}
          onDelete={onDelete}
          onPayInstallment={onPayInstallment}
        />
      ))}
    </div>
  );
}
