'use client';

import { useState } from 'react';
import InstallmentsHeader from '@/components/installments/InstallmentsHeader';
import InstallmentsGrid from '@/components/installments/InstallmentsGrid';
import CreateInstallmentModal from '@/components/installments/CreateInstallmentModal';
import ConfirmationModal from '@/components/recurring-bills/ConfirmationModal';
import useInstallments from '@/hooks/useInstallments';

export default function InstallmentsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    purchases,
    categories,
    bankAccounts,
    paymentMethods,
    loading,
    submitting,
    form,
    setForm,
    totalActive,
    totalOwed,
    pendingInstallments,
    handleCreatePurchase,
    handlePayInstallment,
    handleDeletePurchase,
  } = useInstallments();

  const handleOpenCreate = () => {
    setShowCreateModal(true);
  };

  const handleCloseCreate = () => {
    setShowCreateModal(false);
  };

  const handleSubmitCreate = async () => {
    const success = await handleCreatePurchase();
    if (success) {
      setShowCreateModal(false);
    }
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
        {/* Header com Estatísticas */}
        <InstallmentsHeader
          totalActive={totalActive}
          totalOwed={totalOwed}
          pendingInstallments={pendingInstallments}
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

        {/* Modal Criar Parcelamento */}
        <CreateInstallmentModal
          isOpen={showCreateModal}
          onClose={handleCloseCreate}
          onSubmit={handleSubmitCreate}
          form={form}
          setForm={setForm}
          categories={categories}
          bankAccounts={bankAccounts}
          paymentMethods={paymentMethods}
          submitting={submitting}
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
          onCancel={handleCancelDelete}
        />
      </div>
    </div>
  );
}
