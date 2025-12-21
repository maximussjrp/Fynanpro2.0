'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  Users, Search, Filter, MoreVertical, 
  Mail, Phone, Calendar, Shield, 
  UserCheck, UserX, Edit, Trash2, Eye,
  ChevronLeft, ChevronRight
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  tenant?: {
    id: string;
    name: string;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [pagination.page, filterRole, filterStatus]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (filterRole !== 'all') params.append('role', filterRole);
      if (filterStatus !== 'all') params.append('isActive', filterStatus);
      if (search) params.append('search', search);

      const response = await api.get(`/admin/users?${params}`);
      
      if (response.data.success) {
        setUsers(response.data.data.users || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.data.total || 0,
          totalPages: response.data.data.totalPages || 0
        }));
      }
    } catch (error: any) {
      console.error('Erro ao carregar usuários:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    loadUsers();
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await api.put(`/admin/users/${userId}/status`, { isActive: !currentStatus });
      loadUsers();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja REMOVER o usuário "${userName}"?\n\nEssa ação é IRREVERSÍVEL!\nO usuário poderá se cadastrar novamente com o mesmo email.`)) {
      return;
    }
    
    try {
      await api.delete(`/admin/users/${userId}`);
      alert('Usuário removido com sucesso!');
      loadUsers();
    } catch (error: any) {
      console.error('Erro ao deletar usuário:', error);
      alert(error.response?.data?.message || 'Erro ao remover usuário');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      'super_admin': 'bg-purple-100 text-purple-800',
      'admin': 'bg-blue-100 text-blue-800',
      'user': 'bg-gray-100 text-gray-800'
    };
    const labels: Record<string, string> = {
      'super_admin': 'Super Admin',
      'admin': 'Admin',
      'user': 'Usuário'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[role] || styles.user}`}>
        {labels[role] || role}
      </span>
    );
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1F4FD8]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Users className="w-8 h-8 text-[#1F4FD8]" />
          Gerenciar Usuários
        </h1>
        <p className="text-gray-600 mt-1">Visualize e gerencie todos os usuários do sistema</p>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] text-gray-900"
            />
          </div>
          
          <div className="flex gap-3">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] text-gray-900 bg-white"
            >
              <option value="all">Todos os perfis</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="user">Usuário</option>
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] text-gray-900 bg-white"
            >
              <option value="all">Todos os status</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
            
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1a3fb0] transition-colors flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filtrar
            </button>
          </div>
        </form>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Perfil
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhum usuário encontrado</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1F4FD8] to-[#2ECC9A] flex items-center justify-center text-white font-semibold">
                          {user.fullName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.fullName}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-700">{user.tenant?.name || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? (
                          <>
                            <UserCheck className="w-3 h-3" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <UserX className="w-3 h-3" />
                            Inativo
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserModal(true);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user.id, user.isActive)}
                          className={`p-2 rounded-lg transition-colors ${
                            user.isActive 
                              ? 'hover:bg-red-50 text-red-600' 
                              : 'hover:bg-green-50 text-green-600'
                          }`}
                          title={user.isActive ? 'Desativar' : 'Ativar'}
                        >
                          {user.isActive ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteUser(user.id, user.fullName)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                          title="Remover usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} usuários
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Usuário */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Detalhes do Usuário</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1F4FD8] to-[#2ECC9A] flex items-center justify-center text-white text-2xl font-bold">
                  {selectedUser.fullName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedUser.fullName}</h3>
                  <p className="text-gray-500">{selectedUser.email}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div>
                  <p className="text-sm text-gray-500">Tenant</p>
                  <p className="font-medium text-gray-900">{selectedUser.tenant?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Perfil</p>
                  <div className="mt-1">{getRoleBadge(selectedUser.role)}</div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className={`font-medium ${selectedUser.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedUser.isActive ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Criado em</p>
                  <p className="font-medium text-gray-900">{formatDate(selectedUser.createdAt)}</p>
                </div>
                {selectedUser.phone && (
                  <div>
                    <p className="text-sm text-gray-500">Telefone</p>
                    <p className="font-medium text-gray-900">{selectedUser.phone}</p>
                  </div>
                )}
                {selectedUser.lastLogin && (
                  <div>
                    <p className="text-sm text-gray-500">Último acesso</p>
                    <p className="font-medium text-gray-900">{formatDate(selectedUser.lastLogin)}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
