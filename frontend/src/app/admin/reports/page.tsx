'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  CreditCard,
  BarChart3,
  PieChart,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';

interface RevenueData {
  mrr: number;
  arr: number;
  totalRevenue: number;
  monthlyRevenue: { month: string; value: number }[];
  subscriptionsByPlan: { plan: string; count: number }[];
}

interface ChurnData {
  month: string;
  activeAtStart: number;
  newSubscriptions: number;
  cancelled: number;
  churnRate: number;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [churnData, setChurnData] = useState<ChurnData[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [period, setPeriod] = useState<number>(6); // meses

  useEffect(() => {
    fetchAllData();
  }, [period]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [revenue, churn, dashboard] = await Promise.all([
        api.get('/admin/reports/revenue'),
        api.get('/admin/reports/churn', { params: { months: period } }),
        api.get('/admin/dashboard')
      ]);

      if (revenue.data.success) setRevenueData(revenue.data.data);
      if (churn.data.success) setChurnData(churn.data.data);
      if (dashboard.data.success) setDashboardStats(dashboard.data.data);
    } catch (error) {
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  };

  const getPlanColor = (plan: string) => {
    const colors: Record<string, string> = {
      trial: 'bg-gray-400',
      basic: 'bg-blue-500',
      plus: 'bg-purple-500',
      premium: 'bg-yellow-500',
      business: 'bg-green-500'
    };
    return colors[plan] || 'bg-gray-400';
  };

  const maxRevenue = revenueData?.monthlyRevenue 
    ? Math.max(...revenueData.monthlyRevenue.map(m => m.value), 1) 
    : 1;

  const totalSubscriptions = revenueData?.subscriptionsByPlan
    ? revenueData.subscriptionsByPlan.reduce((sum, p) => sum + p.count, 0)
    : 0;

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
          <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>
          <p className="text-gray-500">Métricas de receita e crescimento</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
          >
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </select>
          <button
            onClick={fetchAllData}
            className="p-2 border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">MRR (Receita Mensal)</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatCurrency(revenueData?.mrr || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">ARR (Receita Anual)</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatCurrency(revenueData?.arr || 0)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Assinaturas Ativas</p>
              <p className="text-2xl font-bold text-gray-800">
                {dashboardStats?.activeSubscriptions || 0}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Taxa de Conversão</p>
              <p className="text-2xl font-bold text-gray-800">
                {dashboardStats?.conversionRate || 0}%
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Users className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            Receita Mensal
          </h3>
          <div className="h-64 flex items-end gap-2">
            {revenueData?.monthlyRevenue.map((month, index) => (
              <div key={month.month} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-[#6C5CE7] rounded-t hover:bg-[#5B4BD5] transition-colors cursor-pointer relative group"
                  style={{ height: `${(month.value / maxRevenue) * 100}%`, minHeight: '4px' }}
                >
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                    {formatCurrency(month.value)}
                  </div>
                </div>
                <span className="text-xs text-gray-500 mt-2">{formatMonth(month.month)}</span>
              </div>
            ))}
            {(!revenueData?.monthlyRevenue || revenueData.monthlyRevenue.length === 0) && (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                Sem dados de receita
              </div>
            )}
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-gray-400" />
            Distribuição por Plano
          </h3>
          <div className="space-y-3">
            {revenueData?.subscriptionsByPlan.map((item) => (
              <div key={item.plan}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize">{item.plan}</span>
                  <span className="text-gray-500">
                    {item.count} ({totalSubscriptions > 0 ? Math.round((item.count / totalSubscriptions) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getPlanColor(item.plan)} rounded-full`}
                    style={{ width: `${totalSubscriptions > 0 ? (item.count / totalSubscriptions) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {(!revenueData?.subscriptionsByPlan || revenueData.subscriptionsByPlan.length === 0) && (
              <div className="text-center text-gray-400 py-8">
                Sem dados de planos
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Churn Analysis */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-gray-400" />
          Análise de Churn
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Mês</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Ativos no Início</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Novas Assinaturas</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Cancelamentos</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Taxa de Churn</th>
              </tr>
            </thead>
            <tbody>
              {churnData.map((row) => (
                <tr key={row.month} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{formatMonth(row.month)}</td>
                  <td className="px-4 py-3 text-right">{row.activeAtStart}</td>
                  <td className="px-4 py-3 text-right text-green-600">+{row.newSubscriptions}</td>
                  <td className="px-4 py-3 text-right text-red-600">-{row.cancelled}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      row.churnRate <= 2 ? 'bg-green-100 text-green-700' :
                      row.churnRate <= 5 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {row.churnRate}%
                    </span>
                  </td>
                </tr>
              ))}
              {churnData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Sem dados de churn
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dashboard Stats Summary */}
      {dashboardStats && (
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Resumo do Mês Atual</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-800">{dashboardStats.newTenantsMonth}</p>
              <p className="text-sm text-gray-500">Novos Workspaces</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-800">{dashboardStats.newUsersMonth}</p>
              <p className="text-sm text-gray-500">Novos Usuários</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{formatCurrency(dashboardStats.revenueMonth)}</p>
              <p className="text-sm text-gray-500">Receita do Mês</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{dashboardStats.cancelledMonth}</p>
              <p className="text-sm text-gray-500">Cancelamentos</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
