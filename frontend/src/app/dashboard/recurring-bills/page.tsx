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
    totalMonthlyExpenses,
    totalMonthlyIncome,
    netFixedMonthly,
    incomeCommitmentPercent,
    topCategories,
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
          <div className="w-16 h-16 border-4 border-[#1F4FD8] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F4F7FB] to-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Banner de Migração */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <p className="font-semibold text-blue-800">Nova experiência de transações!</p>
                <p className="text-sm text-[#1F4FD8]">Agora você pode criar transações recorrentes diretamente na página de transações.</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard/transactions')}
              className="px-4 py-2 bg-gradient-to-r from-[#1F4FD8] to-[#1A44BF] text-white rounded-lg hover:from-[#1A44BF] hover:to-[#1539A6] transition-all text-sm font-medium"
            >
              Ir para Transações
            </button>
          </div>
        </div>

        {/* Header com Estatísticas */}
        <RecurringBillsHeader
          totalActive={totalActive}
          totalMonthly={totalMonthly}
          nextDueCount={nextDueCount}
          totalMonthlyExpenses={totalMonthlyExpenses}
          totalMonthlyIncome={totalMonthlyIncome}
          netFixedMonthly={netFixedMonthly}
          incomeCommitmentPercent={incomeCommitmentPercent}
          topCategories={topCategories}
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
