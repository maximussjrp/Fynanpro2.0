'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { 
  Search,
  CreditCard,
  XCircle,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  ChevronDown
} from 'lucide-react';

interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  billingCycle: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    owner: {
      id: string;
      fullName: string;
      email: string;
    };
  };
  payments: any[];
}

const PLANS = [
  { id: 'trial', name: 'Trial', price: 0 },
  { id: 'basic', name: 'Basic', price: 9.90 },
  { id: 'plus', name: 'Plus', price: 19.90 },
  { id: 'premium', name: 'Premium', price: 34.90 },
  { id: 'business', name: 'Business', price: 99.00 },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativo', color: 'bg-green-100 text-green-700' },
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
  overdue: { label: 'Inadimplente', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-600' },
  expired: { label: 'Expirado', color: 'bg-gray-100 text-gray-600' },
};

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  
  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  
  // Form states
  const [cancelReason, setCancelReason] = useState('');
  const [newPlan, setNewPlan] = useState('');
  const [planReason, setPlanReason] = useState('');
  const [trialDays, setTrialDays] = useState(7);
  const [trialReason, setTrialReason] = useState('');

  useEffect(() => {
    fetchSubscriptions();
  }, [statusFilter, planFilter]);

  const fetchSubscriptions = async () => {
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (planFilter !== 'all') params.planId = planFilter;

      const response = await api.get('/admin/subscriptions', { params });
      if (response.data.success) {
        setSubscriptions(response.data.data.subscriptions);
      }
    } catch (error) {
      toast.error('Erro ao carregar assinaturas');
    } finally {
      setLoading(false);
    }
  };

  const openCancelModal = (sub: Subscription) => {
    setSelectedSub(sub);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const openPlanModal = (sub: Subscription) => {
    setSelectedSub(sub);
    setNewPlan(sub.planId);
    setPlanReason('');
    setShowPlanModal(true);
  };

  const openTrialModal = (sub: Subscription) => {
    setSelectedSub(sub);
    setTrialDays(7);
    setTrialReason('');
    setShowTrialModal(true);
  };

  const handleCancel = async () => {
    if (!selectedSub || !cancelReason.trim()) {
      toast.error('Informe o motivo do cancelamento');
      return;
    }

    try {
      await api.post(`/admin/subscriptions/${selectedSub.id}/cancel`, {
        reason: cancelReason
      });
      toast.success('Assinatura cancelada!');
      setShowCancelModal(false);
      fetchSubscriptions();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao cancelar');
    }
  };

  const handleChangePlan = async () => {
    if (!selectedSub || !newPlan || !planReason.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      await api.post(`/admin/tenants/${selectedSub.tenantId}/change-plan`, {
        planId: newPlan,
        reason: planReason
      });
      toast.success('Plano alterado com sucesso!');
      setShowPlanModal(false);
      fetchSubscriptions();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao alterar plano');
    }
  };

  const handleExtendTrial = async () => {
    if (!selectedSub || !trialReason.trim()) {
      toast.error('Informe o motivo da extensão');
      return;
    }

    try {
      await api.post(`/admin/tenants/${selectedSub.tenantId}/extend-trial`, {
        days: trialDays,
        reason: trialReason
      });
      toast.success(`Trial estendido em ${trialDays} dias!`);
      setShowTrialModal(false);
      fetchSubscriptions();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao estender trial');
    }
  };

  const filteredSubs = subscriptions.filter(sub => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      sub.tenant?.name?.toLowerCase().includes(term) ||
      sub.tenant?.owner?.email?.toLowerCase().includes(term) ||
      sub.tenant?.owner?.fullName?.toLowerCase().includes(term)
    );
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'overdue': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-gray-400" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6C5CE7]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Gestão de Assinaturas</h1>
        <p className="text-gray-500">Gerencie assinaturas, planos e trials</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por workspace, email ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="pending">Pendentes</option>
          <option value="overdue">Inadimplentes</option>
          <option value="cancelled">Cancelados</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
        >
          <option value="all">Todos os planos</option>
          {PLANS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Subscriptions List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workspace</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proprietário</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plano</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSubs.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{sub.tenant?.name || 'N/A'}</p>
                    <p className="text-sm text-gray-500">{sub.tenant?.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{sub.tenant?.owner?.fullName || 'N/A'}</p>
                    <p className="text-sm text-gray-500">{sub.tenant?.owner?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      sub.planId === 'trial' ? 'bg-gray-100 text-gray-600' :
                      sub.planId === 'basic' ? 'bg-blue-100 text-blue-700' :
                      sub.planId === 'plus' ? 'bg-purple-100 text-purple-700' :
                      sub.planId === 'premium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {sub.planId.charAt(0).toUpperCase() + sub.planId.slice(1)}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">{sub.billingCycle}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      STATUS_LABELS[sub.status]?.color || 'bg-gray-100'
                    }`}>
                      {getStatusIcon(sub.status)}
                      {STATUS_LABELS[sub.status]?.label || sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {sub.currentPeriodEnd ? (
                      <>
                        <span>Até </span>
                        <span className="font-medium">
                          {new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR')}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative group">
                      <button className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">
                        Ações <ChevronDown className="w-4 h-4" />
                      </button>
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        <button
                          onClick={() => openPlanModal(sub)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-50"
                        >
                          <ArrowUpRight className="w-4 h-4 text-blue-500" />
                          Alterar Plano
                        </button>
                        <button
                          onClick={() => openTrialModal(sub)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-50"
                        >
                          <Calendar className="w-4 h-4 text-purple-500" />
                          Estender Trial
                        </button>
                        {sub.status !== 'cancelled' && (
                          <button
                            onClick={() => openCancelModal(sub)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-red-50 text-red-600"
                          >
                            <XCircle className="w-4 h-4" />
                            Cancelar Assinatura
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSubs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma assinatura encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && selectedSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-red-600">Cancelar Assinatura</h2>
              <button onClick={() => setShowCancelModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-700">
                  <strong>Atenção:</strong> Esta ação irá cancelar a assinatura de "{selectedSub.tenant?.name}" 
                  e reverter o workspace para o plano gratuito.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo do Cancelamento *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="Descreva o motivo do cancelamento..."
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Voltar
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Confirmar Cancelamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {showPlanModal && selectedSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Alterar Plano</h2>
              <button onClick={() => setShowPlanModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  Workspace: <strong>{selectedSub.tenant?.name}</strong><br />
                  Plano atual: <strong>{selectedSub.planId}</strong>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Novo Plano
                </label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                >
                  {PLANS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - R$ {p.price.toFixed(2)}/mês
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo da Alteração *
                </label>
                <textarea
                  value={planReason}
                  onChange={(e) => setPlanReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  rows={3}
                  placeholder="Descreva o motivo da alteração..."
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleChangePlan}
                  className="flex-1 px-4 py-2 bg-[#6C5CE7] text-white rounded-lg hover:bg-[#5B4BD5]"
                >
                  Alterar Plano
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extend Trial Modal */}
      {showTrialModal && selectedSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Estender Trial</h2>
              <button onClick={() => setShowTrialModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-700">
                  Workspace: <strong>{selectedSub.tenant?.name}</strong><br />
                  Esta ação irá adicionar dias extras ao período de trial.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dias a adicionar
                </label>
                <input
                  type="number"
                  value={trialDays}
                  onChange={(e) => setTrialDays(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  min="1"
                  max="365"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo da Extensão *
                </label>
                <textarea
                  value={trialReason}
                  onChange={(e) => setTrialReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  rows={3}
                  placeholder="Descreva o motivo da extensão..."
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTrialModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExtendTrial}
                  className="flex-1 px-4 py-2 bg-[#6C5CE7] text-white rounded-lg hover:bg-[#5B4BD5]"
                >
                  Estender Trial
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
