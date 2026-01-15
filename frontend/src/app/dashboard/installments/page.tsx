'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InstallmentsHeader from '@/components/installments/InstallmentsHeader';
import InstallmentsGrid from '@/components/installments/InstallmentsGrid';
import ConfirmationModal from '@/components/recurring-bills/ConfirmationModal';
import UnifiedTransactionModal from '@/components/UnifiedTransactionModal';
import useInstallments from '@/hooks/useInstallments';

export default function InstallmentsPage() {
  const router = useRouter();
  const [showNewTransactionModal, setShowNewTransactionModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    purchases,
    loading,
    totalActive,
    totalOwed,
    pendingInstallments,
    totalPaid,
    totalOverall,
    monthlyInstallmentSpend,
    payoffDate,
    monthsUntilPayoff,
    overallProgress,
    topCategories,
    monthlyReductions,
    biggestReductionMonth,
    handlePayInstallment,
    handleDeletePurchase,
    loadData,
  } = useInstallments();

  const handleOpenCreate = () => {
    setShowNewTransactionModal(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmId) {
      await handleDeletePurchase(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F4F7FB] to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Botão Nova Transação */}
        <div className="mb-6">
          <button
            onClick={() => setShowNewTransactionModal(true)}
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] border border-[#C9A962] rounded-xl hover:shadow-lg transition-all group"
          >
            <div className="w-12 h-12 rounded-lg bg-[#C9A962]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-2xl">+</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Nova Transação</p>
              <p className="text-xs text-white/80">Receita ou Despesa</p>
            </div>
          </button>
        </div>

        {/* Banner de Migração */}
        <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💳</span>
              <div>
                <p className="font-semibold text-green-800">Nova experiência de parcelamentos!</p>
                <p className="text-sm text-green-600">Agora você pode criar compras parceladas diretamente na página de transações.</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard/transactions')}
              className="px-4 py-2 bg-gradient-to-r from-[#10B981] to-[#059669] text-white rounded-lg hover:from-[#059669] hover:to-[#047857] transition-all text-sm font-medium"
            >
              Ir para Transações
            </button>
          </div>
        </div>

        {/* Header com Estatísticas */}
        <InstallmentsHeader
          totalActive={totalActive}
          totalOwed={totalOwed}
          pendingInstallments={pendingInstallments}
          totalPaid={totalPaid}
          totalOverall={totalOverall}
          monthlyInstallmentSpend={monthlyInstallmentSpend}
          payoffDate={payoffDate}
          monthsUntilPayoff={monthsUntilPayoff}
          overallProgress={overallProgress}
          topCategories={topCategories}
          monthlyReductions={monthlyReductions}
          biggestReductionMonth={biggestReductionMonth}
          onCreateNew={handleOpenCreate}
        />

        {/* Grid de Parcelamentos */}
        <InstallmentsGrid
          purchases={purchases}
          loading={loading}
          onDelete={handleDeleteClick}
          onPayInstallment={handlePayInstallment}
          onCreateNew={handleOpenCreate}
        />

        {/* Modal Confirmação de Exclusão */}
        <ConfirmationModal
          isOpen={deleteConfirmId !== null}
          title="Confirmar Exclusão"
          message="Tem certeza que deseja excluir esta compra parcelada? Todas as parcelas associadas também serão removidas."
          confirmText="Excluir"
          cancelText="Cancelar"
          type="danger"
          onConfirm={handleConfirmDelete}
          onClose={handleCancelDelete}
        />

        {/* Modal Nova Transação */}
        <UnifiedTransactionModal
          isOpen={showNewTransactionModal}
          onClose={() => setShowNewTransactionModal(false)}
          onSuccess={() => {
            loadData();
          }}
          defaultType="expense"
          initialTab="installment"
        />
      </div>
    </div>
  );
}
