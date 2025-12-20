'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  Settings,
  CreditCard,
  Mail,
  Bell,
  Shield,
  Save,
  RefreshCw,
  Edit,
  Check,
  X,
  Plus,
  Trash2
} from 'lucide-react';

interface PlanConfig {
  id: string;
  name: string;
  price: number;
  priceYearly: number;
  features: string[];
  limits: {
    transactions: number;
    bankAccounts: number;
    users: number;
  };
  isActive: boolean;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plans' | 'payment' | 'notifications'>('plans');
  const [saving, setSaving] = useState(false);

  // Plans Configuration
  const [plans, setPlans] = useState<PlanConfig[]>([
    {
      id: 'trial',
      name: 'Trial',
      price: 0,
      priceYearly: 0,
      features: ['Acesso básico', 'Suporte por email'],
      limits: { transactions: 50, bankAccounts: 1, users: 1 },
      isActive: true
    },
    {
      id: 'basic',
      name: 'Basic',
      price: 9.90,
      priceYearly: 99,
      features: ['500 transações/mês', '2 contas bancárias', 'Relatórios básicos'],
      limits: { transactions: 500, bankAccounts: 2, users: 1 },
      isActive: true
    },
    {
      id: 'plus',
      name: 'Plus',
      price: 19.90,
      priceYearly: 199,
      features: ['2.000 transações/mês', '5 contas bancárias', 'Relatórios avançados', 'Metas financeiras'],
      limits: { transactions: 2000, bankAccounts: 5, users: 2 },
      isActive: true
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 34.90,
      priceYearly: 349,
      features: ['10.000 transações/mês', '10 contas bancárias', 'API access', 'Suporte prioritário'],
      limits: { transactions: 10000, bankAccounts: 10, users: 5 },
      isActive: true
    },
    {
      id: 'business',
      name: 'Business',
      price: 99.00,
      priceYearly: 990,
      features: ['Transações ilimitadas', 'Contas ilimitadas', 'White label', 'Gerente dedicado'],
      limits: { transactions: -1, bankAccounts: -1, users: -1 },
      isActive: true
    },
  ]);

  const [editingPlan, setEditingPlan] = useState<string | null>(null);

  // Payment Settings
  const [paymentSettings, setPaymentSettings] = useState({
    asaasSandbox: true,
    asaasApiKey: '',
    asaasWebhookToken: '',
    enablePix: true,
    enableBoleto: true,
    enableCreditCard: true,
    trialDays: 14
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    sendWelcomeEmail: true,
    sendTrialEndingEmail: true,
    sendPaymentConfirmation: true,
    sendPaymentFailure: true,
    adminEmailAlerts: true,
    adminEmail: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Carregar configurações do backend
      const response = await api.get('/admin/config');
      if (response.data.success) {
        const configs = response.data.data;
        
        // Mapear configurações
        configs.forEach((config: any) => {
          switch (config.key) {
            case 'plans':
              if (config.value) setPlans(config.value);
              break;
            case 'payment':
              if (config.value) setPaymentSettings(prev => ({ ...prev, ...config.value }));
              break;
            case 'notifications':
              if (config.value) setNotificationSettings(prev => ({ ...prev, ...config.value }));
              break;
          }
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (key: string, value: any) => {
    setSaving(true);
    try {
      await api.put(`/admin/config/${key}`, { value });
      toast.success('Configuração salva!');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const savePlans = () => saveConfig('plans', plans);
  const savePayment = () => saveConfig('payment', paymentSettings);
  const saveNotifications = () => saveConfig('notifications', notificationSettings);

  const updatePlan = (planId: string, field: string, value: any) => {
    setPlans(plans.map(p => 
      p.id === planId ? { ...p, [field]: value } : p
    ));
  };

  const updatePlanLimit = (planId: string, limitField: string, value: number) => {
    setPlans(plans.map(p => 
      p.id === planId 
        ? { ...p, limits: { ...p.limits, [limitField]: value } } 
        : p
    ));
  };

  const addPlanFeature = (planId: string) => {
    const feature = prompt('Digite a nova feature:');
    if (feature) {
      setPlans(plans.map(p => 
        p.id === planId 
          ? { ...p, features: [...p.features, feature] } 
          : p
      ));
    }
  };

  const removePlanFeature = (planId: string, index: number) => {
    setPlans(plans.map(p => 
      p.id === planId 
        ? { ...p, features: p.features.filter((_, i) => i !== index) } 
        : p
    ));
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
        <h1 className="text-2xl font-bold text-gray-800">Configurações do Sistema</h1>
        <p className="text-gray-500">Gerencie planos, pagamentos e notificações</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'plans' 
              ? 'border-[#6C5CE7] text-[#6C5CE7]' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          Planos
        </button>
        <button
          onClick={() => setActiveTab('payment')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'payment' 
              ? 'border-[#6C5CE7] text-[#6C5CE7]' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Shield className="w-5 h-5" />
          Pagamentos
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'notifications' 
              ? 'border-[#6C5CE7] text-[#6C5CE7]' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bell className="w-5 h-5" />
          Notificações
        </button>
      </div>

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {plan.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingPlan(editingPlan === plan.id ? null : plan.id)}
                    className="p-2 hover:bg-gray-200 rounded"
                  >
                    {editingPlan === plan.id ? (
                      <X className="w-5 h-5" />
                    ) : (
                      <Edit className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {editingPlan === plan.id ? (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preço Mensal (R$)
                      </label>
                      <input
                        type="number"
                        value={plan.price}
                        onChange={(e) => updatePlan(plan.id, 'price', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preço Anual (R$)
                      </label>
                      <input
                        type="number"
                        value={plan.priceYearly}
                        onChange={(e) => updatePlan(plan.id, 'priceYearly', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 mt-6 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={plan.isActive}
                          onChange={(e) => updatePlan(plan.id, 'isActive', e.target.checked)}
                          className="w-4 h-4 text-[#6C5CE7] rounded"
                        />
                        <span className="text-sm">Plano Ativo</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Limite de Transações (-1 = ilimitado)
                      </label>
                      <input
                        type="number"
                        value={plan.limits.transactions}
                        onChange={(e) => updatePlanLimit(plan.id, 'transactions', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Limite de Contas Bancárias
                      </label>
                      <input
                        type="number"
                        value={plan.limits.bankAccounts}
                        onChange={(e) => updatePlanLimit(plan.id, 'bankAccounts', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Limite de Usuários
                      </label>
                      <input
                        type="number"
                        value={plan.limits.users}
                        onChange={(e) => updatePlanLimit(plan.id, 'users', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Features
                    </label>
                    <div className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="flex-1 text-sm">{feature}</span>
                          <button
                            onClick={() => removePlanFeature(plan.id, index)}
                            className="p-1 hover:bg-red-50 rounded text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addPlanFeature(plan.id)}
                        className="flex items-center gap-1 text-sm text-[#6C5CE7] hover:underline"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar feature
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <span>R$ {plan.price.toFixed(2)}/mês</span>
                    <span>R$ {plan.priceYearly.toFixed(2)}/ano</span>
                    <span>{plan.limits.transactions === -1 ? '∞' : plan.limits.transactions} transações</span>
                    <span>{plan.limits.bankAccounts === -1 ? '∞' : plan.limits.bankAccounts} contas</span>
                    <span>{plan.limits.users === -1 ? '∞' : plan.limits.users} usuários</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            onClick={savePlans}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-[#6C5CE7] text-white rounded-lg hover:bg-[#5B4BD5] disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Salvando...' : 'Salvar Planos'}
          </button>
        </div>
      )}

      {/* Payment Tab */}
      {activeTab === 'payment' && (
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <div>
            <h3 className="font-semibold mb-4">Configurações do Asaas</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={paymentSettings.asaasApiKey}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, asaasApiKey: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  placeholder="$aact_..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Webhook Token
                </label>
                <input
                  type="text"
                  value={paymentSettings.asaasWebhookToken}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, asaasWebhookToken: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  placeholder="Token de segurança do webhook"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentSettings.asaasSandbox}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, asaasSandbox: e.target.checked })}
                  className="w-4 h-4 text-[#6C5CE7] rounded"
                />
                <span className="text-sm">Modo Sandbox (testes)</span>
              </label>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Métodos de Pagamento</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentSettings.enablePix}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, enablePix: e.target.checked })}
                  className="w-4 h-4 text-[#6C5CE7] rounded"
                />
                <span className="text-sm">Habilitar PIX</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentSettings.enableBoleto}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, enableBoleto: e.target.checked })}
                  className="w-4 h-4 text-[#6C5CE7] rounded"
                />
                <span className="text-sm">Habilitar Boleto</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentSettings.enableCreditCard}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, enableCreditCard: e.target.checked })}
                  className="w-4 h-4 text-[#6C5CE7] rounded"
                />
                <span className="text-sm">Habilitar Cartão de Crédito</span>
              </label>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Trial</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dias de Trial
              </label>
              <input
                type="number"
                value={paymentSettings.trialDays}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, trialDays: parseInt(e.target.value) })}
                className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                min="0"
              />
            </div>
          </div>

          <button
            onClick={savePayment}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-[#6C5CE7] text-white rounded-lg hover:bg-[#5B4BD5] disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <div>
            <h3 className="font-semibold mb-4">Emails para Usuários</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSettings.sendWelcomeEmail}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, sendWelcomeEmail: e.target.checked })}
                  className="w-4 h-4 text-[#6C5CE7] rounded"
                />
                <span className="text-sm">Enviar email de boas-vindas</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSettings.sendTrialEndingEmail}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, sendTrialEndingEmail: e.target.checked })}
                  className="w-4 h-4 text-[#6C5CE7] rounded"
                />
                <span className="text-sm">Aviso de fim de trial (3 dias antes)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSettings.sendPaymentConfirmation}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, sendPaymentConfirmation: e.target.checked })}
                  className="w-4 h-4 text-[#6C5CE7] rounded"
                />
                <span className="text-sm">Confirmação de pagamento</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSettings.sendPaymentFailure}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, sendPaymentFailure: e.target.checked })}
                  className="w-4 h-4 text-[#6C5CE7] rounded"
                />
                <span className="text-sm">Aviso de falha no pagamento</span>
              </label>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Alertas para Administrador</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSettings.adminEmailAlerts}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, adminEmailAlerts: e.target.checked })}
                  className="w-4 h-4 text-[#6C5CE7] rounded"
                />
                <span className="text-sm">Receber alertas por email</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email do Administrador
                </label>
                <input
                  type="email"
                  value={notificationSettings.adminEmail}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, adminEmail: e.target.value })}
                  className="w-full max-w-md px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  placeholder="admin@suaempresa.com"
                />
              </div>
            </div>
          </div>

          <button
            onClick={saveNotifications}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-[#6C5CE7] text-white rounded-lg hover:bg-[#5B4BD5] disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      )}
    </div>
  );
}
