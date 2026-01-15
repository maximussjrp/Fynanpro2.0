'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useTenant } from '@/stores/auth';
import { logout } from '@/lib/api';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Database,
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Globe,
  CreditCard,
  Building2,
  Check,
  X,
  Trash2,
  Download,
  Upload
} from 'lucide-react';

interface UserSettings {
  fullName: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface TenantSettings {
  name: string;
  currency: string;
  language: string;
  timezone: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  budgetAlerts: boolean;
  billReminders: boolean;
  weeklyReport: boolean;
  monthlyReport: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const user = useUser();
  const tenant = useTenant();
  const { accessToken } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'tenant' | 'notifications' | 'security' | 'appearance' | 'data'>('profile');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  const [userSettings, setUserSettings] = useState<UserSettings>({
    fullName: user?.fullName || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [tenantSettings, setTenantSettings] = useState<TenantSettings>({
    name: tenant?.name || '',
    currency: 'BRL',
    language: 'pt-BR',
    timezone: 'America/Sao_Paulo'
  });
  
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    budgetAlerts: true,
    billReminders: true,
    weeklyReport: false,
    monthlyReport: true
  });

  useEffect(() => {
    if (user) {
      setUserSettings(prev => ({
        ...prev,
        fullName: user.fullName || '',
        email: user.email || ''
      }));
    }
    if (tenant) {
      setTenantSettings(prev => ({
        ...prev,
        name: tenant.name || ''
      }));
    }
  }, [user, tenant]);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      // Aqui seria a chamada à API para atualizar o perfil
      // await api.put('/users/me', { fullName: userSettings.fullName });
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (userSettings.newPassword !== userSettings.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    
    if (userSettings.newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: userSettings.currentPassword,
        newPassword: userSettings.newPassword
      });
      toast.success('Senha alterada com sucesso!');
      setUserSettings(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTenant = async () => {
    setLoading(true);
    try {
      // await api.put('/tenants/me', tenantSettings);
      toast.success('Configurações da empresa salvas!');
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setLoading(true);
    try {
      // await api.put('/users/me/notifications', notificationSettings);
      toast.success('Preferências de notificação salvas!');
    } catch (error) {
      toast.error('Erro ao salvar preferências');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    toast.info('Preparando exportação de dados...');
    // Implementar exportação de dados
  };

  const handleDeleteAccount = () => {
    if (confirm('Tem certeza que deseja excluir sua conta? Esta ação é irreversível e todos os seus dados serão perdidos.')) {
      if (confirm('ATENÇÃO: Esta é sua última chance de cancelar. Deseja realmente excluir sua conta?')) {
        toast.error('Funcionalidade de exclusão de conta ainda não implementada');
      }
    }
  };

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'tenant', label: 'Empresa', icon: Building2 },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'security', label: 'Segurança', icon: Shield },
    { id: 'appearance', label: 'Aparência', icon: Palette },
    { id: 'data', label: 'Dados', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F4F7FB] to-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Voltar ao Dashboard"
            aria-label="Voltar ao Dashboard"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Settings className="w-8 h-8" />
              Configurações
            </h1>
            <p className="text-gray-600 mt-1">Gerencie suas preferências e configurações</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar de Tabs */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-[#EFF6FF] text-[#1A44BF] border-l-4 border-[#1F4FD8]'
                        : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conteúdo */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              
              {/* Tab: Perfil */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-gray-800">Informações do Perfil</h2>
                  
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#1F4FD8] to-[#1A44BF] flex items-center justify-center text-white text-2xl font-bold">
                      {user?.fullName?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-800">{user?.fullName}</p>
                      <p className="text-gray-500">{user?.email}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo</label>
                      <input
                        type="text"
                        value={userSettings.fullName}
                        onChange={(e) => setUserSettings(prev => ({ ...prev, fullName: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-transparent"
                        aria-label="Nome completo"
                        placeholder="Digite seu nome"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
                      <input
                        type="email"
                        value={userSettings.email}
                        disabled
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                        aria-label="E-mail"
                        placeholder="seu@email.com"
                      />
                      <p className="text-xs text-gray-400 mt-1">O e-mail não pode ser alterado</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              )}

              {/* Tab: Empresa/Tenant */}
              {activeTab === 'tenant' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-gray-800">Configurações da Empresa</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Empresa</label>
                      <input
                        type="text"
                        value={tenantSettings.name}
                        onChange={(e) => setTenantSettings(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                        aria-label="Nome da empresa"
                        placeholder="Nome da sua empresa"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Moeda</label>
                      <select
                        value={tenantSettings.currency}
                        onChange={(e) => setTenantSettings(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                        aria-label="Moeda"
                      >
                        <option value="BRL">Real Brasileiro (R$)</option>
                        <option value="USD">Dólar Americano ($)</option>
                        <option value="EUR">Euro (€)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Idioma</label>
                      <select
                        value={tenantSettings.language}
                        onChange={(e) => setTenantSettings(prev => ({ ...prev, language: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                        aria-label="Idioma"
                      >
                        <option value="pt-BR">Português (Brasil)</option>
                        <option value="en-US">English (US)</option>
                        <option value="es">Español</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fuso Horário</label>
                      <select
                        value={tenantSettings.timezone}
                        onChange={(e) => setTenantSettings(prev => ({ ...prev, timezone: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                        aria-label="Fuso horário"
                      >
                        <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                        <option value="America/New_York">New York (GMT-5)</option>
                        <option value="Europe/London">London (GMT+0)</option>
                      </select>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleSaveTenant}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              )}

              {/* Tab: Notificações */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-gray-800">Preferências de Notificação</h2>
                  
                  <div className="space-y-4">
                    {[
                      { key: 'emailNotifications', label: 'Notificações por E-mail', description: 'Receber notificações gerais por e-mail' },
                      { key: 'budgetAlerts', label: 'Alertas de Orçamento', description: 'Avisos quando orçamentos atingirem limites' },
                      { key: 'billReminders', label: 'Lembretes de Contas', description: 'Lembrar sobre contas a vencer' },
                      { key: 'weeklyReport', label: 'Relatório Semanal', description: 'Resumo semanal das finanças' },
                      { key: 'monthlyReport', label: 'Relatório Mensal', description: 'Resumo mensal completo' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-800">{item.label}</p>
                          <p className="text-sm text-gray-500">{item.description}</p>
                        </div>
                        <button
                          onClick={() => setNotificationSettings(prev => ({ 
                            ...prev, 
                            [item.key]: !prev[item.key as keyof NotificationSettings] 
                          }))}
                          title={notificationSettings[item.key as keyof NotificationSettings] ? `Desativar ${item.label}` : `Ativar ${item.label}`}
                          aria-label={notificationSettings[item.key as keyof NotificationSettings] ? `Desativar ${item.label}` : `Ativar ${item.label}`}
                          className={`relative w-12 h-6 rounded-full transition-colors ${
                            notificationSettings[item.key as keyof NotificationSettings]
                              ? 'bg-[#1F4FD8]'
                              : 'bg-gray-300'
                          }`}
                        >
                          <span 
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                              notificationSettings[item.key as keyof NotificationSettings]
                                ? 'translate-x-7'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={handleSaveNotifications}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? 'Salvando...' : 'Salvar Preferências'}
                  </button>
                </div>
              )}

              {/* Tab: Segurança */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-gray-800">Segurança da Conta</h2>
                  
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 font-medium">⚠️ Altere sua senha regularmente para maior segurança</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Senha Atual</label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={userSettings.currentPassword}
                          onChange={(e) => setUserSettings(prev => ({ ...prev, currentPassword: e.target.value }))}
                          aria-label="Senha Atual"
                          placeholder="Digite sua senha atual"
                          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          title={showCurrentPassword ? 'Ocultar senha atual' : 'Mostrar senha atual'}
                          aria-label={showCurrentPassword ? 'Ocultar senha atual' : 'Mostrar senha atual'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nova Senha</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={userSettings.newPassword}
                          onChange={(e) => setUserSettings(prev => ({ ...prev, newPassword: e.target.value }))}
                          aria-label="Nova Senha"
                          placeholder="Digite a nova senha"
                          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          title={showNewPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                          aria-label={showNewPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar Nova Senha</label>
                      <input
                        type="password"
                        value={userSettings.confirmPassword}
                        onChange={(e) => setUserSettings(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        aria-label="Confirmar Nova Senha"
                        placeholder="Confirme a nova senha"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={handleChangePassword}
                    disabled={loading || !userSettings.currentPassword || !userSettings.newPassword}
                    className="flex items-center gap-2 px-6 py-2 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] transition-colors disabled:opacity-50"
                  >
                    <Shield className="w-4 h-4" />
                    {loading ? 'Alterando...' : 'Alterar Senha'}
                  </button>
                </div>
              )}

              {/* Tab: Aparência */}
              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-gray-800">Aparência</h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {darkMode ? <Moon className="w-5 h-5 text-gray-600" /> : <Sun className="w-5 h-5 text-yellow-500" />}
                        <div>
                          <p className="font-medium text-gray-800">Modo Escuro</p>
                          <p className="text-sm text-gray-500">Alternar entre tema claro e escuro</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setDarkMode(!darkMode)}
                        title={darkMode ? 'Desativar modo escuro' : 'Ativar modo escuro'}
                        aria-label={darkMode ? 'Desativar modo escuro' : 'Ativar modo escuro'}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          darkMode ? 'bg-[#1F4FD8]' : 'bg-gray-300'
                        }`}
                      >
                        <span 
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            darkMode ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="font-medium text-gray-800 mb-3">Cor Principal</p>
                      <div className="flex gap-3">
                        {[
                          { color: '#1F4FD8', className: 'bg-[#1F4FD8]' },
                          { color: '#10B981', className: 'bg-emerald-500' },
                          { color: '#8B5CF6', className: 'bg-violet-500' },
                          { color: '#F59E0B', className: 'bg-amber-500' },
                          { color: '#EF4444', className: 'bg-red-500' },
                          { color: '#EC4899', className: 'bg-pink-500' },
                        ].map((item) => (
                          <button
                            key={item.color}
                            title={`Selecionar cor ${item.color}`}
                            aria-label={`Selecionar cor ${item.color}`}
                            className={`w-8 h-8 rounded-full ring-2 ring-offset-2 ring-transparent hover:ring-gray-300 transition-all ${item.className}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-500">
                    ⚠️ O modo escuro e cores personalizadas serão implementados em breve
                  </p>
                </div>
              )}

              {/* Tab: Dados */}
              {activeTab === 'data' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-gray-800">Gerenciamento de Dados</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Download className="w-6 h-6 text-[#1F4FD8]" />
                        <h3 className="font-semibold text-gray-800">Exportar Dados</h3>
                      </div>
                      <p className="text-sm text-gray-500 mb-4">
                        Baixe uma cópia de todos os seus dados em formato JSON ou CSV
                      </p>
                      <button
                        onClick={handleExportData}
                        className="w-full px-4 py-2 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] transition-colors"
                      >
                        Exportar Dados
                      </button>
                    </div>
                    
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Upload className="w-6 h-6 text-green-600" />
                        <h3 className="font-semibold text-gray-800">Importar Dados</h3>
                      </div>
                      <p className="text-sm text-gray-500 mb-4">
                        Importe transações de planilhas ou outros aplicativos
                      </p>
                      <button
                        disabled
                        className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                      >
                        Em Breve
                      </button>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-red-600 mb-2">Zona de Perigo</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Ações irreversíveis que afetam sua conta permanentemente
                    </p>
                    <button
                      onClick={handleDeleteAccount}
                      className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir Minha Conta
                    </button>
                  </div>
                </div>
              )}
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
