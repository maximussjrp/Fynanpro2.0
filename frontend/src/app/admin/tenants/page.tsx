'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { 
  Search,
  Building2,
  Users,
  Crown,
  Clock,
  CheckCircle,
  AlertCircle,
  Gift,
  CreditCard,
  Calendar,
  RefreshCw,
  ChevronDown,
  X
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  stripeSubscriptionId: string | null;
  stripeCurrentPeriodEnd: string | null;
  createdAt: string;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  _count?: {
    users: number;
    transactions: number;
  };
}

const PLANS = [
  { id: 'trial', name: 'Trial (Grátis)', price: 0 },
  { id: 'monthly', name: 'Mensal', price: 39.90 },
  { id: 'quarterly', name: 'Trimestral', price: 107.70 },
  { id: 'semiannual', name: 'Semestral', price: 191.40 },
  { id: 'yearly', name: 'Anual', price: 335.00 },
];

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: 'Ativo', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  trial: { label: 'Trial', color: 'bg-blue-100 text-blue-700', icon: Clock },
  expired: { label: 'Expirado', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-600', icon: X },
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal states
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  
  // Form states
  const [newPlan, setNewPlan] = useState('');
  const [trialDays, setTrialDays] = useState(30);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, [statusFilter]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await api.get('/admin/tenants', { params });
      if (response.data.success) {
        setTenants(response.data.data.tenants || response.data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar tenants:', error);
      toast.error('Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!selectedTenant || !newPlan) return;
    
    setProcessing(true);
    try {
      await api.post(`/admin/tenants/${selectedTenant.id}/change-plan`, {
        newPlan
      });
      toast.success(`Plano alterado para ${PLANS.find(p => p.id === newPlan)?.name}`);
      setShowPlanModal(false);
      setNewPlan('');
      fetchTenants();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao alterar plano');
    } finally {
      setProcessing(false);
    }
  };

  const handleExtendTrial = async () => {
    if (!selectedTenant || trialDays <= 0) return;
    
    setProcessing(true);
    try {
      await api.post(`/admin/tenants/${selectedTenant.id}/extend-trial`, {
        days: trialDays
      });
      toast.success(`Trial estendido em ${trialDays} dias`);
      setShowTrialModal(false);
      setTrialDays(30);
      fetchTenants();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao estender trial');
    } finally {
      setProcessing(false);
    }
  };

  const openPlanModal = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setNewPlan(tenant.subscriptionPlan);
    setShowPlanModal(true);
  };

  const openTrialModal = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setTrialDays(30);
    setShowTrialModal(true);
  };

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = 
      tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.owner?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.owner?.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getPlanName = (planId: string) => {
    return PLANS.find(p => p.id === planId)?.name || planId;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Building2 className="w-8 h-8 text-purple-600" />
          Gerenciar Empresas
        </h1>
        <p className="text-gray-600 mt-1">
          Gerencie planos, trials e assinaturas das empresas
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativos</option>
            <option value="trial">Em Trial</option>
            <option value="expired">Expirados</option>
            <option value="cancelled">Cancelados</option>
          </select>

          <button
            onClick={fetchTenants}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{tenants.length}</div>
          <div className="text-sm text-gray-500">Total de Empresas</div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {tenants.filter(t => t.subscriptionStatus === 'active').length}
          </div>
          <div className="text-sm text-gray-500">Ativos</div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="text-2xl font-bold text-blue-600">
            {tenants.filter(t => t.subscriptionPlan === 'trial').length}
          </div>
          <div className="text-sm text-gray-500">Em Trial</div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="text-2xl font-bold text-red-600">
            {tenants.filter(t => t.subscriptionStatus === 'expired').length}
          </div>
          <div className="text-sm text-gray-500">Expirados</div>
        </div>
      </div>

      {/* Tenants List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            Carregando...
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhuma empresa encontrada
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Empresa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Plano
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Validade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Criado em
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTenants.map((tenant) => {
                  const status = STATUS_LABELS[tenant.subscriptionStatus] || STATUS_LABELS.trial;
                  const StatusIcon = status.icon;
                  const daysRemaining = getDaysRemaining(tenant.trialEndsAt || tenant.stripeCurrentPeriodEnd);
                  
                  return (
                    <tr key={tenant.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{tenant.name}</div>
                          <div className="text-sm text-gray-500">{tenant.owner?.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          <Crown className="w-3 h-3" />
                          {getPlanName(tenant.subscriptionPlan)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {daysRemaining !== null ? (
                          <div className={`text-sm ${daysRemaining <= 3 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                            {daysRemaining > 0 ? `${daysRemaining} dias` : 'Expirado'}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(tenant.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openTrialModal(tenant)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Dar dias grátis"
                          >
                            <Gift className="w-3.5 h-3.5" />
                            + Dias
                          </button>
                          <button
                            onClick={() => openPlanModal(tenant)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                            title="Alterar plano"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            Plano
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Alterar Plano */}
      {showPlanModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Alterar Plano</h3>
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {selectedTenant.name} - {selectedTenant.owner?.email}
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione o novo plano
                </label>
                <div className="space-y-2">
                  {PLANS.map((plan) => (
                    <label
                      key={plan.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        newPlan === plan.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="plan"
                          value={plan.id}
                          checked={newPlan === plan.id}
                          onChange={(e) => setNewPlan(e.target.value)}
                          className="text-purple-600"
                        />
                        <span className="font-medium">{plan.name}</span>
                      </div>
                      <span className="text-gray-500">
                        {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2)}`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end rounded-b-2xl">
              <button
                onClick={() => setShowPlanModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangePlan}
                disabled={processing || !newPlan}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {processing ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Estender Trial */}
      {showTrialModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Gift className="w-5 h-5 text-blue-600" />
                  Dar Dias Grátis
                </h3>
                <button
                  onClick={() => setShowTrialModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {selectedTenant.name} - {selectedTenant.owner?.email}
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantos dias deseja adicionar?
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[7, 15, 30, 60, 90].map((days) => (
                    <button
                      key={days}
                      onClick={() => setTrialDays(days)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        trialDays === days
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {days} dias
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ou digite um valor personalizado
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={trialDays}
                  onChange={(e) => setTrialDays(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Resultado:</strong> O período de trial será estendido em{' '}
                  <span className="font-bold">{trialDays} dias</span> a partir da data atual de expiração.
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end rounded-b-2xl">
              <button
                onClick={() => setShowTrialModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExtendTrial}
                disabled={processing || trialDays <= 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Gift className="w-4 h-4" />
                {processing ? 'Processando...' : `Adicionar ${trialDays} dias`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
