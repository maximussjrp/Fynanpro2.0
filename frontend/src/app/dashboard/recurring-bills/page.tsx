'use client';

import { useAuth } from '@/stores/auth';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRecurringBills } from '@/hooks/useRecurringBills';
import RecurringBillsHeader from '@/components/recurring-bills/RecurringBillsHeader';
import BillsGrid from '@/components/recurring-bills/BillsGrid';
import CreateBillModal from '@/components/recurring-bills/CreateBillModal';
import EditBillModal from '@/components/recurring-bills/EditBillModal';
import ConfirmationModal from '@/components/recurring-bills/ConfirmationModal';

export default function RecurringBillsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  
  const {
    loading,
    submitting,
    recurringBills,
    categories,
    bankAccounts,
    paymentMethods,
    editingBill,
    recurringBillForm,
    setRecurringBillForm,
    loadData,
    handleCreateBill,
    handleEditBill,
    toggleBillStatus,
    handleDeleteBill,
    handleGenerateOccurrences,
    openEditModal,
    setEditingBill,
    totalActive,
    totalMonthly,
    nextDueCount,
  } = useRecurringBills();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);

  useEffect(() => {
    const token = accessToken;
    if (!token) {
      router.push('/');
      return;
    }
    loadData();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    const success = await handleCreateBill(e);
    if (success) {
      setShowCreateModal(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    const success = await handleEditBill(e);
    if (success) {
      setShowEditModal(false);
    }
  };

  const handleEditClick = (bill: any) => {
    openEditModal(bill);
    setShowEditModal(true);
  };

  const handleDeleteClick = (id: string) => {
    setBillToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (billToDelete) {
      await handleDeleteBill(billToDelete);
      setShowDeleteModal(false);
      setBillToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F4F7FB] to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1C6DD0] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F4F7FB] to-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header com Estatísticas */}
        <RecurringBillsHeader
          totalActive={totalActive}
          totalMonthly={totalMonthly}
          nextDueCount={nextDueCount}
          onCreateNew={() => setShowCreateModal(true)}
        />

        {/* Grid de Contas */}
        <BillsGrid
          bills={recurringBills}
          loading={loading}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onToggleStatus={toggleBillStatus}
          onGenerateOccurrences={handleGenerateOccurrences}
          onCreateNew={() => setShowCreateModal(true)}
        />

        {/* Modal Criar */}
        <CreateBillModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSubmit}
          form={recurringBillForm}
          setForm={setRecurringBillForm}
          categories={categories}
          bankAccounts={bankAccounts}
          paymentMethods={paymentMethods}
          submitting={submitting}
        />

        {/* Modal Editar */}
        <EditBillModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingBill(null);
          }}
          onSubmit={handleEditSubmit}
          form={recurringBillForm}
          setForm={setRecurringBillForm}
          categories={categories}
          bankAccounts={bankAccounts}
          paymentMethods={paymentMethods}
          submitting={submitting}
        />

        {/* Modal de Confirmação de Exclusão */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setBillToDelete(null);
          }}
          onConfirm={confirmDelete}
          title="Excluir Conta Recorrente"
          message="Tem certeza que deseja excluir esta conta recorrente? Esta ação não pode ser desfeita."
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          type="danger"
        />
      </div>
    </div>
  );
}
