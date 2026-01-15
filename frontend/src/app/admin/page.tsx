'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@/stores/auth';
import api from '@/lib/api';
import { Toaster, toast } from 'sonner';
import { 
  Users, 
  Building2, 
  CreditCard, 
  TrendingUp,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  RefreshCw,
  LogOut,
  Shield,
  Calendar,
  DollarSign,
  Activity
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  createdAt: string;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  _count: {
    tenantUsers: number;
    transactions: number;
    bankAccounts: number;
    categories: number;
    recurringBills: number;
  };
}

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  _count: {
    ownedTenants: number;
  };
}

interface AdminStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  activeUsers: number;
  totalTransactions: number;
  totalRevenue: number;
  newUsersThisMonth: number;
  newTenantsThisMonth: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuth();
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'users'>('overview');
  
  // Data
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    
    // Verificar se é super_master
    if (user?.role !== 'super_master') {
      toast.error('Acesso negado. Apenas administradores.');
      router.push('/dashboard');
      return;
    }
    
    loadAdminData();
  }, [isAuthenticated, user]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      
      const response = await api.get('/admin/overview');
      
      if (response.data.success) {
        setStats(response.data.data.stats);
        setTenants(response.data.data.tenants);
        setUsers(response.data.data.users);
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados admin:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'trial': return 'bg-gray-100 text-gray-700';
      case 'basic': return 'bg-[#DBEAFE] text-[#1A44BF]';
      case 'plus': return 'bg-purple-100 text-purple-700';
      case 'premium': return 'bg-yellow-100 text-yellow-700';
      case 'enterprise': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'suspended': return 'bg-red-100 text-red-700';
      case 'cancelled': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.owner.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = planFilter === 'all' || t.subscriptionPlan === planFilter;
    return matchesSearch && matchesPlan;
  });

  const filteredUsers = users.filter(u => {
    return u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           u.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1F4FD8] mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando painel administrativo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1F4FD8] to-[#2ECC9A] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-xl">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">UTOP Admin</h1>
                <p className="text-sm text-white/80">Painel Master</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-white/80">
                Olá, <span className="font-medium text-white">{user?.fullName}</span>
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'overview' 
                ? 'bg-[#1F4FD8] text-white' 
                : 'bg-white text-[#475569] hover:bg-[#F8FAFC]'
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'tenants' 
                ? 'bg-[#1F4FD8] text-white' 
                : 'bg-white text-[#475569] hover:bg-[#F8FAFC]'
            }`}
          >
            Workspaces ({tenants.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'users' 
                ? 'bg-[#1F4FD8] text-white' 
                : 'bg-white text-[#475569] hover:bg-[#F8FAFC]'
            }`}
          >
            Usuários ({users.length})
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-[#1F4FD8]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#475569]">Total Workspaces</p>
                    <p className="text-3xl font-bold text-[#0F172A]">{stats.totalTenants}</p>
                    <p className="text-xs text-[#22C55E] mt-1">+{stats.newTenantsThisMonth} este mês</p>
                  </div>
                  <div className="bg-[#DBEAFE] p-3 rounded-full">
                    <Building2 className="w-6 h-6 text-[#1F4FD8]" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Usuários</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                    <p className="text-xs text-green-600 mt-1">+{stats.newUsersThisMonth} este mês</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-full">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Transações Totais</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalTransactions.toLocaleString()}</p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-full">
                    <Activity className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-yellow-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Ativos</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.activeTenants}</p>
                    <p className="text-xs text-gray-500 mt-1">workspaces ativos</p>
                  </div>
                  <div className="bg-yellow-100 p-3 rounded-full">
                    <TrendingUp className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button 
                  onClick={() => setActiveTab('tenants')}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Building2 className="w-8 h-8 text-[#1F4FD8]" />
                  <span className="text-sm font-medium">Ver Workspaces</span>
                </button>
                <button 
                  onClick={() => setActiveTab('users')}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Users className="w-8 h-8 text-green-600" />
                  <span className="text-sm font-medium">Ver Usuários</span>
                </button>
                <button 
                  onClick={loadAdminData}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-8 h-8 text-purple-600" />
                  <span className="text-sm font-medium">Atualizar Dados</span>
                </button>
                <button 
                  onClick={() => router.push('/dashboard')}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <DollarSign className="w-8 h-8 text-yellow-600" />
                  <span className="text-sm font-medium">Ir ao Dashboard</span>
                </button>
              </div>
            </div>

            {/* Recent Tenants */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Workspaces Recentes</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Workspace</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Proprietário</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Plano</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Transações</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.slice(0, 5).map(tenant => (
                      <tr key={tenant.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{tenant.name}</p>
                            <p className="text-xs text-gray-500">{tenant.slug}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm text-gray-900">{tenant.owner.fullName}</p>
                            <p className="text-xs text-gray-500">{tenant.owner.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlanBadgeColor(tenant.subscriptionPlan)}`}>
                            {tenant.subscriptionPlan}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {tenant._count.transactions}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {formatDate(tenant.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-transparent"
                  />
                </div>
              </div>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                title="Filtrar por plano"
              >
                <option value="all">Todos os planos</option>
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="plus">Plus</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <button
                onClick={loadAdminData}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </button>
            </div>

            {/* Tenants Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Workspace</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Proprietário</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Plano</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-center py-4 px-6 text-sm font-medium text-gray-500">Transações</th>
                    <th className="text-center py-4 px-6 text-sm font-medium text-gray-500">Contas</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Criado em</th>
                    <th className="text-center py-4 px-6 text-sm font-medium text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map(tenant => (
                    <tr key={tenant.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-medium text-gray-900">{tenant.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{tenant.id.slice(0, 8)}...</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="text-sm text-gray-900">{tenant.owner.fullName}</p>
                          <p className="text-xs text-gray-500">{tenant.owner.email}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlanBadgeColor(tenant.subscriptionPlan)}`}>
                          {tenant.subscriptionPlan}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(tenant.subscriptionStatus)}`}>
                          {tenant.subscriptionStatus}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center text-sm text-gray-900">
                        {tenant._count.transactions}
                      </td>
                      <td className="py-4 px-6 text-center text-sm text-gray-900">
                        {tenant._count.bankAccounts}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        {formatDate(tenant.createdAt)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => toast.success('Funcionalidade em breve')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => toast.success('Funcionalidade em breve')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4 text-blue-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredTenants.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  Nenhum workspace encontrado
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-transparent"
                  />
                </div>
              </div>
              <button
                onClick={loadAdminData}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Usuário</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Email</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Role</th>
                    <th className="text-center py-4 px-6 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-center py-4 px-6 text-sm font-medium text-gray-500">Workspaces</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Último Login</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Criado em</th>
                    <th className="text-center py-4 px-6 text-sm font-medium text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#DBEAFE] rounded-full flex items-center justify-center">
                            <span className="text-[#1F4FD8] font-medium">
                              {user.fullName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.fullName}</p>
                            <p className="text-xs text-gray-500 font-mono">{user.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-900">
                        {user.email}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'super_master' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-[#DBEAFE] text-[#1A44BF]'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {user.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center text-sm text-gray-900">
                        {user._count.ownedTenants}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Nunca'}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => toast.success('Funcionalidade em breve')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => toast.success('Funcionalidade em breve')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4 text-blue-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredUsers.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  Nenhum usuário encontrado
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
