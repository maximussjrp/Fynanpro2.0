'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Tag, 
  Percent, 
  DollarSign,
  Calendar,
  Users,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit,
  Eye,
  X,
  Copy,
  CheckCircle
} from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses?: number;
  maxUsesPerUser: number;
  usedCount: number;
  validFrom: string;
  validUntil?: string;
  applicablePlans?: string[];
  minAmount?: number;
  firstPurchaseOnly: boolean;
  isActive: boolean;
  createdAt: string;
}

interface CouponFormData {
  code: string;
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses: number | null;
  maxUsesPerUser: number;
  validUntil: string;
  applicablePlans: string[];
  minAmount: number | null;
  firstPurchaseOnly: boolean;
}

const PLANS = [
  { id: 'basic', name: 'Basic' },
  { id: 'plus', name: 'Plus' },
  { id: 'premium', name: 'Premium' },
  { id: 'business', name: 'Business' },
];

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const [formData, setFormData] = useState<CouponFormData>({
    code: '',
    name: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    maxUses: null,
    maxUsesPerUser: 1,
    validUntil: '',
    applicablePlans: [],
    minAmount: null,
    firstPurchaseOnly: false,
  });

  useEffect(() => {
    fetchCoupons();
    fetchStats();
  }, [showInactive]);

  const fetchCoupons = async () => {
    try {
      const response = await api.get('/admin/coupons', {
        params: { includeInactive: showInactive }
      });
      if (response.data.success) {
        setCoupons(response.data.data.coupons);
      }
    } catch (error) {
      toast.error('Erro ao carregar cupons');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/coupons/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      discountType: 'percentage',
      discountValue: 10,
      maxUses: null,
      maxUsesPerUser: 1,
      validUntil: '',
      applicablePlans: [],
      minAmount: null,
      firstPurchaseOnly: false,
    });
    setEditingCoupon(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      maxUses: coupon.maxUses || null,
      maxUsesPerUser: coupon.maxUsesPerUser,
      validUntil: coupon.validUntil ? coupon.validUntil.split('T')[0] : '',
      applicablePlans: coupon.applicablePlans || [],
      minAmount: coupon.minAmount ? Number(coupon.minAmount) : null,
      firstPurchaseOnly: coupon.firstPurchaseOnly,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        validUntil: formData.validUntil ? new Date(formData.validUntil) : null,
        applicablePlans: formData.applicablePlans.length > 0 ? formData.applicablePlans : null,
      };

      if (editingCoupon) {
        await api.put(`/admin/coupons/${editingCoupon.id}`, payload);
        toast.success('Cupom atualizado!');
      } else {
        await api.post('/admin/coupons', payload);
        toast.success('Cupom criado!');
      }

      setShowModal(false);
      resetForm();
      fetchCoupons();
      fetchStats();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar cupom');
    }
  };

  const toggleCoupon = async (coupon: Coupon) => {
    try {
      await api.patch(`/admin/coupons/${coupon.id}/toggle`, {
        isActive: !coupon.isActive
      });
      toast.success(`Cupom ${coupon.isActive ? 'desativado' : 'ativado'}!`);
      fetchCoupons();
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (!confirm(`Tem certeza que deseja excluir o cupom ${coupon.code}?`)) return;

    try {
      await api.delete(`/admin/coupons/${coupon.id}`);
      toast.success('Cupom removido!');
      fetchCoupons();
      fetchStats();
    } catch (error) {
      toast.error('Erro ao excluir cupom');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado!');
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const filteredCoupons = coupons.filter(c =>
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cupons de Desconto</h1>
          <p className="text-gray-500">Gerencie cupons promocionais</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-[#6C5CE7] text-white rounded-lg hover:bg-[#5B4BD5] transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Cupom
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Tag className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total de Cupons</p>
                <p className="text-xl font-bold">{stats.totalCoupons}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Cupons Ativos</p>
                <p className="text-xl font-bold">{stats.activeCoupons}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total de Usos</p>
                <p className="text-xl font-bold">{stats.totalUsages}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Desconto Total</p>
                <p className="text-xl font-bold">R$ {stats.totalDiscountGiven?.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7] focus:border-transparent"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4 text-[#6C5CE7] rounded"
          />
          <span className="text-sm text-gray-600">Mostrar inativos</span>
        </label>
      </div>

      {/* Coupons List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Desconto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validade</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCoupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-100 rounded font-mono text-sm">
                        {coupon.code}
                      </code>
                      <button
                        onClick={() => copyCode(coupon.code)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{coupon.name}</p>
                    {coupon.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs">{coupon.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1">
                      {coupon.discountType === 'percentage' ? (
                        <>
                          <Percent className="w-4 h-4 text-green-500" />
                          {coupon.discountValue}%
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4 text-green-500" />
                          R$ {Number(coupon.discountValue).toFixed(2)}
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">
                      {coupon.usedCount}
                      {coupon.maxUses && ` / ${coupon.maxUses}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {coupon.validUntil ? (
                      <span className={`text-sm ${new Date(coupon.validUntil) < new Date() ? 'text-red-500' : 'text-gray-600'}`}>
                        {new Date(coupon.validUntil).toLocaleDateString('pt-BR')}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Sem limite</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      coupon.isActive 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {coupon.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(coupon)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => toggleCoupon(coupon)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title={coupon.isActive ? 'Desativar' : 'Ativar'}
                      >
                        {coupon.isActive ? (
                          <ToggleRight className="w-4 h-4 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteCoupon(coupon)}
                        className="p-1.5 hover:bg-red-50 rounded"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCoupons.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {searchTerm ? 'Nenhum cupom encontrado' : 'Nenhum cupom cadastrado'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Código */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código do Cupom *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7] uppercase"
                    placeholder="DESCONTO10"
                    required
                    disabled={!!editingCoupon}
                  />
                  {!editingCoupon && (
                    <button
                      type="button"
                      onClick={generateCode}
                      className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Gerar
                    </button>
                  )}
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  placeholder="Desconto de Lançamento"
                  required
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  rows={2}
                  placeholder="Descrição opcional do cupom"
                />
              </div>

              {/* Tipo e Valor do Desconto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Desconto
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  >
                    <option value="percentage">Porcentagem (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor do Desconto
                  </label>
                  <input
                    type="number"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                    min="0"
                    step={formData.discountType === 'percentage' ? '1' : '0.01'}
                    max={formData.discountType === 'percentage' ? '100' : undefined}
                    required
                  />
                </div>
              </div>

              {/* Limites de Uso */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Limite Total de Usos
                  </label>
                  <input
                    type="number"
                    value={formData.maxUses || ''}
                    onChange={(e) => setFormData({ ...formData, maxUses: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                    min="1"
                    placeholder="Ilimitado"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usos por Usuário
                  </label>
                  <input
                    type="number"
                    value={formData.maxUsesPerUser}
                    onChange={(e) => setFormData({ ...formData, maxUsesPerUser: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                    min="1"
                    required
                  />
                </div>
              </div>

              {/* Validade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Expiração
                </label>
                <input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Planos Aplicáveis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Planos Aplicáveis
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLANS.map((plan) => (
                    <label key={plan.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.applicablePlans.includes(plan.id)}
                        onChange={(e) => {
                          const newPlans = e.target.checked
                            ? [...formData.applicablePlans, plan.id]
                            : formData.applicablePlans.filter(p => p !== plan.id);
                          setFormData({ ...formData, applicablePlans: newPlans });
                        }}
                        className="w-4 h-4 text-[#6C5CE7] rounded"
                      />
                      <span className="text-sm">{plan.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Deixe vazio para aplicar a todos os planos
                </p>
              </div>

              {/* Primeira compra apenas */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.firstPurchaseOnly}
                  onChange={(e) => setFormData({ ...formData, firstPurchaseOnly: e.target.checked })}
                  className="w-4 h-4 text-[#6C5CE7] rounded"
                />
                <span className="text-sm text-gray-700">Apenas para primeira assinatura</span>
              </label>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#6C5CE7] text-white rounded-lg hover:bg-[#5B4BD5]"
                >
                  {editingCoupon ? 'Salvar' : 'Criar Cupom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
