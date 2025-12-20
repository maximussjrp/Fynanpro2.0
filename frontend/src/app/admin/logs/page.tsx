'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  Search,
  Filter,
  FileText,
  User,
  Calendar,
  Tag,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Eye
} from 'lucide-react';

interface AdminLog {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  description: string;
  previousValue: any;
  newValue: any;
  ipAddress?: string;
  createdAt: string;
  admin?: {
    id: string;
    fullName: string;
    email: string;
  };
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  coupon_create: { label: 'Cupom Criado', color: 'bg-green-100 text-green-700' },
  coupon_update: { label: 'Cupom Atualizado', color: 'bg-blue-100 text-blue-700' },
  coupon_delete: { label: 'Cupom Deletado', color: 'bg-red-100 text-red-700' },
  coupon_activate: { label: 'Cupom Ativado', color: 'bg-green-100 text-green-700' },
  coupon_deactivate: { label: 'Cupom Desativado', color: 'bg-gray-100 text-gray-600' },
  subscription_cancel: { label: 'Assinatura Cancelada', color: 'bg-red-100 text-red-700' },
  plan_change: { label: 'Plano Alterado', color: 'bg-purple-100 text-purple-700' },
  trial_extend: { label: 'Trial Estendido', color: 'bg-blue-100 text-blue-700' },
  user_block: { label: 'Usuário Bloqueado', color: 'bg-red-100 text-red-700' },
  user_unblock: { label: 'Usuário Desbloqueado', color: 'bg-green-100 text-green-700' },
  password_reset_force: { label: 'Reset Senha Forçado', color: 'bg-yellow-100 text-yellow-700' },
  impersonate: { label: 'Login como Usuário', color: 'bg-orange-100 text-orange-700' },
  config_update: { label: 'Config Atualizada', color: 'bg-blue-100 text-blue-700' },
  announcement_create: { label: 'Anúncio Criado', color: 'bg-green-100 text-green-700' },
};

const TARGET_LABELS: Record<string, string> = {
  coupon: 'Cupom',
  subscription: 'Assinatura',
  tenant: 'Workspace',
  user: 'Usuário',
  system_config: 'Configuração',
  announcement: 'Anúncio',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  
  // Filters
  const [actionFilter, setActionFilter] = useState<string>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, targetTypeFilter, dateFrom, dateTo]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (actionFilter) params.action = actionFilter;
      if (targetTypeFilter) params.targetType = targetTypeFilter;
      if (dateFrom) params.startDate = new Date(dateFrom).toISOString();
      if (dateTo) params.endDate = new Date(dateTo).toISOString();

      const response = await api.get('/admin/logs', { params });
      if (response.data.success) {
        setLogs(response.data.data.logs);
        setTotal(response.data.data.total);
      }
    } catch (error) {
      toast.error('Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setActionFilter('');
    setTargetTypeFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const toggleExpand = (logId: string) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  const uniqueActions = Array.from(new Set(Object.keys(ACTION_LABELS)));
  const uniqueTargetTypes = Array.from(new Set(Object.keys(TARGET_LABELS)));

  if (loading && logs.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-800">Logs de Auditoria</h1>
          <p className="text-gray-500">Histórico de ações administrativas</p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="font-medium">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
          >
            <option value="">Todas as ações</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>
                {ACTION_LABELS[action]?.label || action}
              </option>
            ))}
          </select>
          <select
            value={targetTypeFilter}
            onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
          >
            <option value="">Todos os tipos</option>
            {uniqueTargetTypes.map(type => (
              <option key={type} value={type}>
                {TARGET_LABELS[type] || type}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
            placeholder="Data inicial"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
            placeholder="Data final"
          />
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <span className="text-sm text-gray-500">
            {total} log{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </span>
        </div>
        
        <div className="divide-y">
          {logs.map((log) => (
            <div key={log.id} className="hover:bg-gray-50">
              <div 
                className="px-4 py-3 flex items-center gap-4 cursor-pointer"
                onClick={() => toggleExpand(log.id)}
              >
                <button className="p-1">
                  {expandedLog === log.id ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      ACTION_LABELS[log.action]?.color || 'bg-gray-100 text-gray-600'
                    }`}>
                      {ACTION_LABELS[log.action]?.label || log.action}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {TARGET_LABELS[log.targetType] || log.targetType}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 truncate">{log.description}</p>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {log.admin?.fullName || 'Admin'}
                  </span>
                  <span className="flex items-center gap-1 hidden sm:flex">
                    <Calendar className="w-4 h-4" />
                    {formatDate(log.createdAt)}
                  </span>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedLog === log.id && (
                <div className="px-4 py-3 bg-gray-50 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Detalhes</p>
                      <div className="space-y-1 text-gray-600">
                        <p><strong>ID do Alvo:</strong> {log.targetId}</p>
                        <p><strong>Admin:</strong> {log.admin?.email}</p>
                        <p><strong>IP:</strong> {log.ipAddress || 'N/A'}</p>
                        <p><strong>Data:</strong> {formatDate(log.createdAt)}</p>
                      </div>
                    </div>
                    
                    {(log.previousValue || log.newValue) && (
                      <div>
                        <p className="font-medium text-gray-700 mb-1">Alterações</p>
                        <div className="grid grid-cols-2 gap-2">
                          {log.previousValue && (
                            <div className="p-2 bg-red-50 rounded">
                              <p className="text-xs font-medium text-red-700 mb-1">Antes</p>
                              <pre className="text-xs text-red-600 overflow-auto max-h-32">
                                {JSON.stringify(log.previousValue, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.newValue && (
                            <div className="p-2 bg-green-50 rounded">
                              <p className="text-xs font-medium text-green-700 mb-1">Depois</p>
                              <pre className="text-xs text-green-600 overflow-auto max-h-32">
                                {JSON.stringify(log.newValue, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {logs.length === 0 && (
            <div className="px-4 py-12 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Nenhum log encontrado</p>
              <p className="text-sm">As ações administrativas aparecerão aqui</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > 50 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Página {page} de {Math.ceil(total / 50)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 50)}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
