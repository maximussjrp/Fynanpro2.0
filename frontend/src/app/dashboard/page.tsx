'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api, { logout } from '@/lib/api';
import { useAuth, useUser, useTenant } from '@/stores/auth';
import CreateTransactionModal from '@/components/UnifiedTransactionModal';
import DashboardLayoutWrapper from '@/components/DashboardLayoutWrapper';
import QuickActions from '@/components/QuickActions';
import OnboardingRecurringBills from '@/components/OnboardingRecurringBills';
import ProfileSelectorModal from '@/components/ProfileSelectorModal';
import { useUserProfiles } from '@/hooks/useUserProfiles';
import { 
  DashboardMetricsSkeleton, 
  ChartSkeleton, 
  RankingCardSkeleton 
} from '@/components/Skeletons';
import TrialBanner from '@/components/TrialBanner';
import { 
  Calendar,
  Filter,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CreditCard,
  PiggyBank,
  Target,
  Zap,
  AlertTriangle,
} from 'lucide-react';

interface DashboardData {
  balanceSummary?: any;
  expenseRanking?: any;
  incomeRanking?: any;
  incomeVsExpenses?: any;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon?: string;
  color?: string;
  level?: number;
  children?: Category[];
}

interface BankAccount {
  id: string;
  name: string;
  type: string;
  institution?: string;
  currentBalance: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
}

interface BankAccountForm {
  name: string;
  type: string;
  institution: string;
  initialBalance: string;
}

interface PaymentMethodForm {
  name: string;
  type: string;
  bankAccountId: string;
  lastFourDigits: string;
  cardNetwork: string;
  expirationDate: string;
}

interface CoverageData {
  validatedPercent: number;
  validatedAmount: number;
  totalExpenseAmount: number;
  pendingCount: number;
}

export default function Dashboard() {
  const router = useRouter();
  const user = useUser();
  const tenant = useTenant();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData>({});
  const [todaySummary, setTodaySummary] = useState<any>(null);
  const [fiscalMovement, setFiscalMovement] = useState<any>(null);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showBankAccountModal, setShowBankAccountModal] = useState(false);
  const [energyCoverage, setEnergyCoverage] = useState<CoverageData | null>(null);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showOnboardingRecurring, setShowOnboardingRecurring] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [submitting, setSubmitting] = useState(false);
  
  // Hook de perfis
  const { 
    profiles, 
    needsSelection, 
    selectProfile, 
    activeProfile,
    isLoading: profilesLoading 
  } = useUserProfiles();
  
  // Dados para formulário
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  // Formulário de conta bancária
  const [bankAccountForm, setBankAccountForm] = useState<BankAccountForm>({
    name: '',
    type: 'bank',
    institution: '',
    initialBalance: '0',
  });
  
  // Formulário de meio de pagamento
  const [paymentMethodForm, setPaymentMethodForm] = useState<PaymentMethodForm>({
    name: '',
    type: 'pix',
    bankAccountId: '',
    lastFourDigits: '',
    cardNetwork: '',
    expirationDate: '',
  });
  
  // Filtros de período
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // Primeiro dia do mês
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0); // Último dia do mês
    return date.toISOString().split('T')[0];
  });
  
  // Estados temporários para o modal de período (evita filtrar enquanto navega no calendário)
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  // Mostrar modal de seleção de perfil quando necessário
  useEffect(() => {
    if (!profilesLoading && needsSelection && profiles.length > 1) {
      setShowProfileSelector(true);
    }
  }, [profilesLoading, needsSelection, profiles.length]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    loadDashboardData();
    loadFormData();
    loadTodaySummary();
    loadEnergyCoverage();
    // ⚠️ MÓDULO e-Financeira SUSPENSO — não chamar até revisão (autorização do Max)
    // loadFiscalMovement();
    
    // DESABILITADO: Wizard de contas recorrentes não é mais utilizado
    // const hasSeenWizard = localStorage.getItem('hasSeenRecurringBillsWizard');
    // if (!hasSeenWizard) {
    //   const timer = setTimeout(() => {
    //     setShowOnboardingRecurring(true);
    //   }, 1000);
    //   return () => clearTimeout(timer);
    // }
  }, [startDate, endDate, isAuthenticated]);

  const loadEnergyCoverage = async () => {
    try {
      const response = await api.get('/reports/top-pending-categories?limit=1');
      if (response.data.success) {
        setEnergyCoverage(response.data.data.coverage);
      }
    } catch (error) {
      // Silenciar erro - feature opcional
      console.error('Erro ao carregar coverage:', error);
    }
  };

  const loadTodaySummary = async () => {
    try {
      const response = await api.get('/dashboard/today-summary');
      setTodaySummary(response.data.data);
    } catch (error: any) {
      console.error('Erro ao carregar resumo do dia:', error.response?.data || error.message);
    }
  };

  const loadFiscalMovement = async () => {
    // ⚠️ SUSPENSO — não chamar. Endpoint desativado até revisão.
    return;
    try {
      const response = await api.get('/dashboard/fiscal-movement');
      setFiscalMovement(response.data.data);
    } catch (error: any) {
      console.error('Erro ao carregar movimentação fiscal:', error.response?.data || error.message);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const params = { startDate, endDate };

      // Carregar todos os dados em paralelo usando API client
      const [balance, expenseRank, incomeRank, incomeVsExp] = await Promise.all([
        api.get('/dashboard/balance-summary', { params }),
        api.get('/dashboard/expense-ranking', { params }),
        api.get('/dashboard/income-ranking', { params }),
        api.get('/dashboard/income-vs-expenses', { params }),
      ]);

      setDashboardData({
        balanceSummary: balance.data.data,
        expenseRanking: expenseRank.data.data,
        incomeRanking: incomeRank.data.data,
        incomeVsExpenses: incomeVsExp.data.data,
      });
    } catch (error: any) {
      console.error('Erro ao carregar dashboard:', error.response?.data || error.message);
      // O interceptor já trata 401 automaticamente
    } finally {
      setLoading(false);
    }
  };

  const loadFormData = async () => {
    try {
      const [categoriesRes, accountsRes, paymentsRes] = await Promise.all([
        api.get('/categories?isActive=true'),
        api.get('/bank-accounts?isActive=true'),
        api.get('/payment-methods?isActive=true'),
      ]);

      setCategories(categoriesRes.data.data.categories || []);
      setBankAccounts(accountsRes.data.data.accounts || []);
      setPaymentMethods(paymentsRes.data.data.paymentMethods || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados do formulário:', error.response?.data || error.message);
    }
  };



  const handleCreateBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const response = await api.post('/bank-accounts', {
        name: bankAccountForm.name,
        type: bankAccountForm.type,
        institution: bankAccountForm.institution,
        initialBalance: parseFloat(bankAccountForm.initialBalance),
      });

      // Fechar modal e recarregar lista de contas
      setShowBankAccountModal(false);
      await loadFormData(); // Recarregar contas
      setBankAccountForm({ name: '', type: 'bank', institution: '', initialBalance: '0' }); // Reset form
      toast.success('Conta bancária criada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar conta bancária:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao criar conta bancária');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      const payload: any = {
        name: paymentMethodForm.name,
        type: paymentMethodForm.type,
      };

      // Adicionar campos específicos para cartões
      if (paymentMethodForm.type === 'credit_card' || paymentMethodForm.type === 'debit_card') {
        payload.bankAccountId = paymentMethodForm.bankAccountId || null;
        payload.lastFourDigits = paymentMethodForm.lastFourDigits || null;
        payload.cardNetwork = paymentMethodForm.cardNetwork || null;
        if (paymentMethodForm.expirationDate) {
          payload.expirationDate = new Date(paymentMethodForm.expirationDate).toISOString();
        }
      } else if (paymentMethodForm.type === 'pix' || paymentMethodForm.type === 'bank_transfer') {
        payload.bankAccountId = paymentMethodForm.bankAccountId || null;
      }

      const response = await api.post('/payment-methods', payload);

      // Fechar modal e recarregar lista de meios de pagamento
      setShowPaymentMethodModal(false);
      await loadFormData(); // Recarregar meios de pagamento
      setPaymentMethodForm({ 
        name: '', 
        type: 'pix', 
        bankAccountId: '', 
        lastFourDigits: '', 
        cardNetwork: '', 
        expirationDate: '' 
      }); // Reset form
      toast.success('Meio de pagamento criado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar meio de pagamento:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao criar meio de pagamento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout(); // Usa função do lib/api.ts que limpa tudo e redireciona
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
    return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  };

  const applyQuickFilter = (type: string) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (type) {
      case 'currentMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'last3Months':
        start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'last6Months':
        start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'currentYear':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setShowPeriodModal(false);
  };

  if (loading) {
    return (
      <DashboardLayoutWrapper showAddButton={false}>
        <div className="p-6">
          <DashboardMetricsSkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <ChartSkeleton height={350} />
            <ChartSkeleton height={350} />
          </div>
        </div>
      </DashboardLayoutWrapper>
    );
  }

  const balance = dashboardData.balanceSummary?.summary;
  const expenseData = dashboardData.expenseRanking;
  const incomeData = dashboardData.incomeRanking;
  const chartData = dashboardData.incomeVsExpenses?.chartData || [];

  // Empty state: nenhuma receita ou despesa registrada no período.
  // Sinaliza que o tenant ainda não usou o sistema → mostra CTA forte
  // em vez de cards zerados que parecem app quebrado.
  const totalIncomeForEmpty = Number(balance?.totalIncome ?? 0);
  const totalExpenseForEmpty = Number(balance?.totalExpense ?? 0);
  const hasNoActivity =
    !loading &&
    totalIncomeForEmpty === 0 &&
    totalExpenseForEmpty === 0 &&
    chartData.length === 0;

  return (
    <DashboardLayoutWrapper>
      {/* Content */}
      <div className="p-6">
        {/* Quick Actions */}
        <QuickActions
          onAddTransaction={() => setShowTransactionModal(true)}
          onOpenCalendar={() => router.push('/dashboard/calendar')}
        />

        {/* TrialBanner ocultado no piloto comercial. */}
        {/* <TrialBanner tenantId={tenant?.id} /> */}

        {/* Empty state forte para usuários sem nenhuma transação */}
        {hasNoActivity && (
          <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#1F4FD8] to-[#2ECC9A] p-6 sm:p-8 text-white shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex-shrink-0 w-14 h-14 rounded-full bg-white/15 flex items-center justify-center">
                <Zap className="text-white" size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold mb-1">
                  Vamos colocar suas finanças no lugar
                </h2>
                <p className="text-sm sm:text-base text-white/90 mb-4">
                  Comece registrando seu primeiro lançamento. Em poucos minutos
                  você já enxerga para onde seu dinheiro vai e quanto sobra.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setShowTransactionModal(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-[#1F4FD8] font-semibold px-4 py-2.5 hover:bg-white/90 transition shadow-sm"
                  >
                    <ArrowUpRight size={18} />
                    Registrar primeiro lançamento
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/bank-accounts')}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 text-white font-medium px-4 py-2.5 hover:bg-white/20 transition border border-white/30"
                  >
                    <Wallet size={18} />
                    Conferir minhas contas
                  </button>
                </div>
                <p className="text-xs text-white/75 mt-3">
                  Você já tem uma <strong>Conta Principal</strong> e categorias
                  prontas para começar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Banner de Onboarding de Energia - quando coverage < 85% */}
        {energyCoverage && energyCoverage.validatedPercent < 85 && (
          <div className={`mb-6 rounded-xl p-4 ${
            energyCoverage.validatedPercent < 50 
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200'
              : 'bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                energyCoverage.validatedPercent < 50 ? 'bg-amber-100' : 'bg-purple-100'
              }`}>
                {energyCoverage.validatedPercent < 50 
                  ? <AlertTriangle className="text-amber-600" size={20} />
                  : <Target className="text-purple-600" size={20} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`font-semibold text-sm ${
                  energyCoverage.validatedPercent < 50 ? 'text-amber-800' : 'text-purple-800'
                }`}>
                  {energyCoverage.validatedPercent < 50 
                    ? 'Diagnóstico financeiro indisponível' 
                    : 'Complete a validação para diagnóstico completo'
                  }
                </h4>
                <p className={`text-xs mt-0.5 ${
                  energyCoverage.validatedPercent < 50 ? 'text-amber-700' : 'text-purple-700'
                }`}>
                  {energyCoverage.validatedPercent.toFixed(0)}% dos gastos validados • 
                  Faltam {(85 - energyCoverage.validatedPercent).toFixed(0)}% para diagnóstico completo
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard/categories?wizard=1')}
                className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition ${
                  energyCoverage.validatedPercent < 50 
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                <Zap size={16} />
                Validar agora
              </button>
            </div>
          </div>
        )}

        {/* Cards do Dia - Resumo HOJE */}
        {todaySummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Receitas a Receber HOJE */}
            <div 
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                router.push(`/dashboard/transactions?type=income&status=pending&date=${today}`);
              }}
              className="bg-white rounded-xl shadow-sm border border-l-4 border-l-[#2563EB] p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600" style={{fontFamily: 'Inter, sans-serif'}}>
                  💰 Receitas a Receber Hoje
                </h3>
                {todaySummary.today?.incomeToReceive?.count > 0 && (
                  <span className="bg-[#DBEAFE] text-[#2563EB] text-xs font-semibold px-2 py-0.5 rounded-full">
                    {todaySummary.today.incomeToReceive.count}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-[#2563EB]" style={{fontFamily: 'Poppins, sans-serif'}}>
                {formatCurrency(todaySummary.today?.incomeToReceive?.total || 0)}
              </p>
              {todaySummary.today?.incomeToReceive?.items?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {todaySummary.today.incomeToReceive.items.slice(0, 2).map((item: any) => (
                    <p key={item.id} className="text-xs text-gray-500 truncate">
                      {item.icon || '📄'} {item.description}
                    </p>
                  ))}
                  {todaySummary.today.incomeToReceive.items.length > 2 && (
                    <p className="text-xs text-gray-400">+{todaySummary.today.incomeToReceive.items.length - 2} mais</p>
                  )}
                </div>
              )}
            </div>

            {/* Despesas a Pagar HOJE */}
            <div 
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                router.push(`/dashboard/transactions?type=expense&status=pending&date=${today}`);
              }}
              className="bg-white rounded-xl shadow-sm border border-l-4 border-l-[#F59E0B] p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600" style={{fontFamily: 'Inter, sans-serif'}}>
                  💸 Despesas a Pagar Hoje
                </h3>
                {todaySummary.today?.expenseToPay?.count > 0 && (
                  <span className="bg-[#FEF3C7] text-[#F59E0B] text-xs font-semibold px-2 py-0.5 rounded-full">
                    {todaySummary.today.expenseToPay.count}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-[#F59E0B]" style={{fontFamily: 'Poppins, sans-serif'}}>
                {formatCurrency(todaySummary.today?.expenseToPay?.total || 0)}
              </p>
              {todaySummary.today?.expenseToPay?.items?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {todaySummary.today.expenseToPay.items.slice(0, 2).map((item: any) => (
                    <p key={item.id} className="text-xs text-gray-500 truncate">
                      {item.icon || '📄'} {item.description}
                    </p>
                  ))}
                  {todaySummary.today.expenseToPay.items.length > 2 && (
                    <p className="text-xs text-gray-400">+{todaySummary.today.expenseToPay.items.length - 2} mais</p>
                  )}
                </div>
              )}
            </div>

            {/* Despesas ATRASADAS */}
            <div 
              onClick={() => router.push('/dashboard/transactions?type=expense&status=overdue')}
              className={`bg-white rounded-xl shadow-sm border border-l-4 p-4 hover:shadow-md transition-shadow cursor-pointer ${
              todaySummary.overdue?.count > 0 ? 'border-l-[#E11D48]' : 'border-l-gray-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600" style={{fontFamily: 'Inter, sans-serif'}}>
                  ⚠️ Despesas Atrasadas
                </h3>
                {todaySummary.overdue?.count > 0 && (
                  <span className="bg-[#FFF1F2] text-[#E11D48] text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse">
                    {todaySummary.overdue.count}
                  </span>
                )}
              </div>
              <p className={`text-2xl font-bold ${todaySummary.overdue?.count > 0 ? 'text-[#E11D48]' : 'text-gray-400'}`} style={{fontFamily: 'Poppins, sans-serif'}}>
                {formatCurrency(todaySummary.overdue?.total || 0)}
              </p>
              {todaySummary.overdue?.items?.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {todaySummary.overdue.items.slice(0, 2).map((item: any) => (
                    <p key={item.id} className="text-xs text-[#E11D48] truncate">
                      {item.icon || '📄'} {item.description} ({item.daysOverdue}d atrás)
                    </p>
                  ))}
                  {todaySummary.overdue.items.length > 2 && (
                    <p className="text-xs text-gray-400">+{todaySummary.overdue.items.length - 2} mais</p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-green-600">✅ Nenhuma despesa atrasada!</p>
              )}
            </div>
          </div>
        )}

        {/* Widget de Movimentação Fiscal - e-Financeira (IN RFB 2.219/2024) */}
        {fiscalMovement && (
          <div className="bg-white rounded-xl shadow-sm border border-l-4 p-4 mb-6" style={{
            borderLeftColor: fiscalMovement.summary?.alertLevel === 'exceeded' ? '#DC2626' :
                            fiscalMovement.summary?.alertLevel === 'danger' ? '#F59E0B' :
                            fiscalMovement.summary?.alertLevel === 'warning' ? '#EAB308' : '#22C55E'
          }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏦</span>
                <h3 className="text-sm font-semibold text-gray-700" style={{fontFamily: 'Inter, sans-serif'}}>
                  Monitoramento Fiscal (e-Financeira)
                </h3>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {fiscalMovement.period?.monthName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Limite {fiscalMovement.accountType}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  fiscalMovement.summary?.alertLevel === 'exceeded' ? 'bg-red-100 text-red-700' :
                  fiscalMovement.summary?.alertLevel === 'danger' ? 'bg-orange-100 text-orange-700' :
                  fiscalMovement.summary?.alertLevel === 'warning' ? 'bg-yellow-100 text-yellow-700' : 
                  'bg-green-100 text-green-700'
                }`}>
                  {fiscalMovement.summary?.alertLevel === 'exceeded' ? '⚠️ EXCEDIDO' :
                   fiscalMovement.summary?.alertLevel === 'danger' ? '🟡 ATENÇÃO' :
                   fiscalMovement.summary?.alertLevel === 'warning' ? '📊 MONITORAR' : 
                   '✅ OK'}
                </span>
              </div>
            </div>

            {/* Barra de Progresso */}
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Movimentação de Receitas</span>
                <span className="text-xs font-medium text-gray-700">
                  {formatCurrency(fiscalMovement.summary?.totalIncome || 0)} de {formatCurrency(fiscalMovement.limit?.monthly || 5000)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    fiscalMovement.summary?.percentOfLimit >= 100 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                    fiscalMovement.summary?.percentOfLimit >= 80 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                    fiscalMovement.summary?.percentOfLimit >= 50 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                    'bg-gradient-to-r from-green-400 to-green-500'
                  }`}
                  style={{ width: `${Math.min(fiscalMovement.summary?.percentOfLimit || 0, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-400">
                  {fiscalMovement.summary?.transactionCount || 0} transações
                </span>
                <span className={`text-xs font-semibold ${
                  fiscalMovement.summary?.percentOfLimit >= 80 ? 'text-orange-600' : 'text-gray-600'
                }`}>
                  {fiscalMovement.summary?.percentOfLimit?.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Alertas */}
            {fiscalMovement.alerts?.length > 0 && (
              <div className="space-y-2 mb-3">
                {fiscalMovement.alerts.map((alert: any, idx: number) => (
                  <div 
                    key={idx}
                    className={`text-xs p-2 rounded-lg ${
                      alert.type === 'danger' ? 'bg-red-50 text-red-700 border border-red-200' :
                      alert.type === 'warning' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                      alert.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      'bg-green-50 text-green-700 border border-green-200'
                    }`}
                  >
                    <p className="font-medium">{alert.message}</p>
                    {alert.detail && <p className="text-xs opacity-80 mt-0.5">{alert.detail}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Informações Adicionais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
              <div className="text-center">
                <p className="text-xs text-gray-400">Restante</p>
                <p className={`text-sm font-bold ${fiscalMovement.summary?.amountRemaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(fiscalMovement.summary?.amountRemaining || 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">Média/Dia</p>
                <p className="text-sm font-bold text-gray-700">
                  {formatCurrency(fiscalMovement.summary?.dailyAverage || 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">Projeção Mês</p>
                <p className={`text-sm font-bold ${fiscalMovement.summary?.projectedOverLimit ? 'text-orange-600' : 'text-gray-700'}`}>
                  {formatCurrency(fiscalMovement.summary?.projectedMonthlyTotal || 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">Limite Mensal</p>
                <p className="text-sm font-bold text-gray-700">
                  {formatCurrency(fiscalMovement.limit?.monthly || 5000)}
                </p>
              </div>
            </div>

            {/* Footer informativo */}
            <div className="mt-3 pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 text-center">
                📋 Referência: IN RFB 2.219/2024 - A Receita Federal monitora movimentações financeiras acima de R$ 5.000/mês (PF) ou R$ 15.000/mês (PJ) via e-Financeira
              </p>
            </div>
          </div>
        )}

        {/* Period Filter */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-gray-600" style={{fontFamily: 'Inter, sans-serif'}}>
            <Calendar className="w-4 h-4" />
            <span className="text-gray-700">
              {new Date(startDate).toLocaleDateString('pt-BR')} - {new Date(endDate).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <button
            onClick={() => { setTempStartDate(startDate); setTempEndDate(endDate); setShowPeriodModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
            style={{fontFamily: 'Inter, sans-serif'}}
          >
            <Filter className="w-4 h-4 text-gray-600" />
            <span>Alterar Período</span>
          </button>
        </div>

        {/* 1. Saldo Final Detalhado */}
        <div className={`rounded-xl p-6 mb-8 text-white shadow-lg ${
          balance?.isPositive 
            ? 'bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] border border-[#C9A962]' 
            : 'bg-gradient-to-r from-[#E11D48] to-[#BE123C]'
        }`}>
          <h2 className="text-lg font-semibold mb-6" style={{fontFamily: 'Poppins, sans-serif'}}>Saldo Final do Período</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* COLUNA RECEITAS */}
            <div className="bg-white/10 rounded-lg p-4 border border-[#2563EB]/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[#93C5FD]">💰 RECEITAS</h3>
                <span 
                  className="text-xs opacity-70 hover:opacity-100 cursor-pointer hover:underline"
                  onClick={() => router.push(`/dashboard/transactions?type=INCOME&startDate=${startDate}&endDate=${endDate}`)}
                >
                  Ver todas →
                </span>
              </div>
              
              <div className="mb-4">
                <p className="text-xs mb-1 text-[#93C5FD]">Total de Receitas</p>
                <p className="text-2xl font-bold">{formatCurrency(balance?.totalIncome || 0)}</p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div 
                  className="flex justify-between items-center cursor-pointer hover:bg-white/10 rounded px-2 py-1 -mx-2 transition-colors"
                  onClick={() => router.push(`/dashboard/transactions?type=INCOME&status=completed&startDate=${startDate}&endDate=${endDate}`)}
                >
                  <span className="text-[#93C5FD]">✅ Receitas Recebidas</span>
                  <span className="font-semibold">{formatCurrency(balance?.receivedIncome || 0)}</span>
                </div>
                <div 
                  className="flex justify-between items-center cursor-pointer hover:bg-white/10 rounded px-2 py-1 -mx-2 transition-colors"
                  onClick={() => router.push(`/dashboard/transactions?type=INCOME&status=pending&startDate=${startDate}&endDate=${endDate}`)}
                >
                  <span className="text-[#93C5FD]">⏳ Receitas a Receber</span>
                  <span className="font-semibold">{formatCurrency(balance?.pendingIncome || 0)}</span>
                </div>
              </div>
            </div>

            {/* COLUNA DESPESAS */}
            <div className="bg-white/10 rounded-lg p-4 border border-[#E11D48]/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[#FDA4AF]">💸 DESPESAS</h3>
                <span 
                  className="text-xs opacity-70 hover:opacity-100 cursor-pointer hover:underline"
                  onClick={() => router.push(`/dashboard/transactions?type=EXPENSE&startDate=${startDate}&endDate=${endDate}`)}
                >
                  Ver todas →
                </span>
              </div>
              
              <div className="mb-4">
                <p className="text-xs mb-1 text-[#FDA4AF]">Total de Despesas</p>
                <p className="text-2xl font-bold">{formatCurrency(balance?.totalExpense || 0)}</p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div 
                  className="flex justify-between items-center cursor-pointer hover:bg-white/10 rounded px-2 py-1 -mx-2 transition-colors"
                  onClick={() => router.push(`/dashboard/transactions?type=EXPENSE&status=completed&startDate=${startDate}&endDate=${endDate}`)}
                >
                  <span className="text-[#FDA4AF]">✅ Despesas Pagas</span>
                  <span className="font-semibold">{formatCurrency(balance?.paidExpense || 0)}</span>
                </div>
                <div 
                  className="flex justify-between items-center cursor-pointer hover:bg-white/10 rounded px-2 py-1 -mx-2 transition-colors"
                  onClick={() => router.push(`/dashboard/transactions?type=EXPENSE&status=pending&startDate=${startDate}&endDate=${endDate}`)}
                >
                  <span className="text-[#FDA4AF]">⏳ Despesas a Pagar</span>
                  <span className="font-semibold">{formatCurrency(balance?.pendingExpense || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SALDO FINAL */}
          <div className="border-t border-white/20 pt-4">
            <div className={`rounded-lg p-4 text-center ${balance?.isPositive ? 'bg-white/20' : 'bg-white/10'}`}>
              <p className="text-sm text-white mb-2 font-medium">Saldo Final (Receitas - Despesas)</p>
              <p className={`text-4xl font-bold ${balance?.isPositive ? 'text-[#60A5FA]' : 'text-[#FCD34D]'}`}>
                {formatCurrency(balance?.finalBalance || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 2. Ranking de Gastos (Pareto 80/20) */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4" style={{fontFamily: 'Poppins, sans-serif'}}>
              Pareto 80/20: Poucos gastos, maior impacto
            </h3>
            {expenseData?.pareto80?.length > 0 ? (
              <div className="space-y-3">
                {expenseData.pareto80.map((item: any) => (
                  <div key={item.rank} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#FFF1F2] rounded-full flex items-center justify-center text-[#E11D48] font-semibold text-sm">
                      {item.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-[#1A1A1A] truncate" style={{fontFamily: 'Inter, sans-serif'}}>{item.name}</p>
                        <p className="text-sm font-semibold text-[#1A1A1A]" style={{fontFamily: 'Inter, sans-serif'}}>{formatCurrency(item.total)}</p>
                      </div>
                      <div className="w-full bg-[#D9D9D9] rounded-full h-2">
                        <div
                          className="bg-[#E11D48] h-2 rounded-full transition-all"
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-[#4F4F4F] mt-1" style={{fontFamily: 'Inter, sans-serif'}}>
                        <span>{item.percentage.toFixed(1)}%</span>
                        <span>Acumulado: {item.accumulatedPercentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#4F4F4F] text-center py-8" style={{fontFamily: 'Inter, sans-serif'}}>Nenhum gasto registrado no período</p>
            )}
          </div>

          {/* 3. Ranking de Receitas */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4" style={{fontFamily: 'Poppins, sans-serif'}}>
              Principais Receitas
            </h3>
            {incomeData?.ranking?.length > 0 ? (
              <div className="space-y-3">
                {incomeData.ranking.slice(0, 8).map((item: any) => (
                  <div key={item.rank} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#DBEAFE] rounded-full flex items-center justify-center text-[#2563EB] font-semibold text-sm">
                      {item.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-[#1A1A1A] truncate" style={{fontFamily: 'Inter, sans-serif'}}>{item.name}</p>
                        <p className="text-sm font-semibold text-[#1A1A1A]" style={{fontFamily: 'Inter, sans-serif'}}>{formatCurrency(item.total)}</p>
                      </div>
                      <div className="w-full bg-[#D9D9D9] rounded-full h-2">
                        <div
                          className="bg-[#2563EB] h-2 rounded-full transition-all"
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-[#4F4F4F] mt-1" style={{fontFamily: 'Inter, sans-serif'}}>{item.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#4F4F4F] text-center py-8" style={{fontFamily: 'Inter, sans-serif'}}>Nenhuma receita registrada no período</p>
            )}
          </div>
        </div>

        {/* 4. Gráfico Receitas x Despesas */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-6" style={{fontFamily: 'Poppins, sans-serif'}}>
            Receitas x Despesas (com gastos provisionados)
          </h3>
          {chartData.length > 0 ? (
            <div className="space-y-6">
              {chartData.map((month: any) => (
                <div key={month.month} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[#1A1A1A]" style={{fontFamily: 'Inter, sans-serif'}}>{formatMonth(month.month)}</span>
                    <span className={`font-semibold ${month.balance >= 0 ? 'text-[#2563EB]' : 'text-[#E11D48]'}`} style={{fontFamily: 'Inter, sans-serif'}}>
                      {formatCurrency(month.balance)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Receitas */}
                    <div>
                      <div className="flex items-center justify-between mb-1 text-xs text-[#4F4F4F]" style={{fontFamily: 'Inter, sans-serif'}}>
                        <span>Receitas (realizado + provisionado)</span>
                        <span className="font-medium">{formatCurrency(month.totalIncome || month.realizedIncome)}</span>
                      </div>
                      <div className="h-8 bg-[#DBEAFE] rounded overflow-hidden">
                        <div className="h-full flex">
                          <div
                            className="bg-[#2563EB]"
                            style={{
                              width: month.totalIncome ? `${(month.realizedIncome / month.totalIncome) * 100}%` : '100%',
                            }}
                            title={`Realizado: ${formatCurrency(month.realizedIncome)}`}
                          ></div>
                          {month.projectedIncome > 0 && (
                            <div
                              className="bg-[#93C5FD]"
                              style={{
                                width: `${((month.projectedIncome || 0) / month.totalIncome) * 100}%`,
                              }}
                              title={`Provisionado: ${formatCurrency(month.projectedIncome || 0)}`}
                            ></div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#4F4F4F]" style={{fontFamily: 'Inter, sans-serif'}}>
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-[#2563EB] rounded"></div>
                          Realizado: {formatCurrency(month.realizedIncome)}
                        </span>
                        {month.projectedIncome > 0 && (
                          <span className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-[#93C5FD] rounded"></div>
                            Provisionado: {formatCurrency(month.projectedIncome || 0)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Despesas */}
                    <div>
                      <div className="flex items-center justify-between mb-1 text-xs text-[#4F4F4F]" style={{fontFamily: 'Inter, sans-serif'}}>
                        <span>Despesas (realizado + provisionado)</span>
                        <span className="font-medium">{formatCurrency(month.totalExpense)}</span>
                      </div>
                      <div className="h-8 bg-[#FFF1F2] rounded overflow-hidden">
                        <div className="h-full flex">
                          <div
                            className="bg-[#E11D48]"
                            style={{
                              width: `${(month.realizedExpense / month.totalExpense) * 100}%`,
                            }}
                            title={`Realizado: ${formatCurrency(month.realizedExpense)}`}
                          ></div>
                          <div
                            className="bg-[#FDA4AF]"
                            style={{
                              width: `${(month.projectedExpense / month.totalExpense) * 100}%`,
                            }}
                            title={`Provisionado: ${formatCurrency(month.projectedExpense)}`}
                          ></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#4F4F4F]" style={{fontFamily: 'Inter, sans-serif'}}>
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-[#E11D48] rounded"></div>
                          Realizado: {formatCurrency(month.realizedExpense)}
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-[#FDA4AF] rounded"></div>
                          Provisionado: {formatCurrency(month.projectedExpense)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#4F4F4F] text-center py-8" style={{fontFamily: 'Inter, sans-serif'}}>Nenhum dado disponível para o período</p>
          )}
        </div>

      {/* Modal de Período */}
      {showPeriodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#1A1A1A]" style={{fontFamily: 'Poppins, sans-serif'}}>Filtrar por Período</h3>
              <button onClick={() => { setTempStartDate(startDate); setTempEndDate(endDate); setShowPeriodModal(false); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-[#4F4F4F]" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-2" style={{fontFamily: 'Inter, sans-serif'}}>Data Inicial</label>
                <input
                  type="date"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  className="w-full px-4 py-2 min-h-[44px] border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] text-gray-900 bg-white"
                  style={{fontFamily: 'Inter, sans-serif', colorScheme: 'light'}}
                  title="Data inicial do período"
                  aria-label="Data inicial"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-2" style={{fontFamily: 'Inter, sans-serif'}}>Data Final</label>
                <input
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  className="w-full px-4 py-2 min-h-[44px] border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] text-gray-900 bg-white"
                  style={{fontFamily: 'Inter, sans-serif', colorScheme: 'light'}}
                  title="Data final do período"
                  aria-label="Data final"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button onClick={() => applyQuickFilter('currentMonth')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium" style={{fontFamily: 'Inter, sans-serif'}}>
                Mês Atual
              </button>
              <button onClick={() => applyQuickFilter('lastMonth')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium" style={{fontFamily: 'Inter, sans-serif'}}>
                Mês Anterior
              </button>
              <button onClick={() => applyQuickFilter('last3Months')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium" style={{fontFamily: 'Inter, sans-serif'}}>
                Últimos 3 Meses
              </button>
              <button onClick={() => applyQuickFilter('last6Months')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium" style={{fontFamily: 'Inter, sans-serif'}}>
                Últimos 6 Meses
              </button>
              <button onClick={() => applyQuickFilter('currentYear')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium col-span-2" style={{fontFamily: 'Inter, sans-serif'}}>
                Ano Atual
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setTempStartDate(startDate); setTempEndDate(endDate); setShowPeriodModal(false); }}
                className="flex-1 px-4 py-2 border border-[#D9D9D9] rounded-lg hover:bg-gray-50"
                style={{fontFamily: 'Inter, sans-serif'}}
              >
                Cancelar
              </button>
              <button
                onClick={() => { setStartDate(tempStartDate); setEndDate(tempEndDate); setShowPeriodModal(false); }}
                className="flex-1 px-4 py-2 bg-[#1C6DD0] text-white rounded-lg hover:bg-[#1557A8] shadow-md"
                style={{fontFamily: 'Inter, sans-serif'}}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal de Criação de Conta Bancária */}
      {showBankAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Wallet className="text-blue-600" size={24} />
                <h2 className="text-xl font-bold text-gray-900">Nova Conta Bancária</h2>
              </div>
              <button
                onClick={() => setShowBankAccountModal(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={submitting}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBankAccount} className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Conta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={bankAccountForm.name}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Conta Corrente Itaú"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={bankAccountForm.type}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bank">Conta Bancária</option>
                  <option value="wallet">Carteira Digital</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="investment">Investimento</option>
                </select>
              </div>

              {/* Instituição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instituição Financeira <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={bankAccountForm.institution}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, institution: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Banco Itaú, Nubank, PicPay..."
                />
              </div>

              {/* Saldo Inicial */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Saldo Inicial <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={bankAccountForm.initialBalance}
                    onChange={(e) => setBankAccountForm({ ...bankAccountForm, initialBalance: e.target.value })}
                    className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBankAccountModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-4 py-2 rounded-lg text-white font-medium bg-blue-600 hover:bg-blue-700 ${
                    submitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={submitting}
                >
                  {submitting ? 'Criando...' : 'Criar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Criação de Meio de Pagamento */}
      {showPaymentMethodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <CreditCard className="text-blue-600" size={24} />
                <h2 className="text-xl font-bold text-gray-900">Novo Meio de Pagamento</h2>
              </div>
              <button
                onClick={() => setShowPaymentMethodModal(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={submitting}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePaymentMethod} className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={paymentMethodForm.name}
                  onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: PIX Nubank, Cartão Itaú, Dinheiro..."
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={paymentMethodForm.type}
                  onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pix">PIX</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="debit_card">Cartão de Débito</option>
                  <option value="boleto">Boleto</option>
                  <option value="cash">Dinheiro</option>
                  <option value="bank_transfer">Transferência Bancária</option>
                  <option value="automatic_debit">Débito Automático</option>
                </select>
              </div>

              {/* Conta Bancária (para PIX, cartões e transferências) */}
              {(paymentMethodForm.type === 'pix' || 
                paymentMethodForm.type === 'credit_card' || 
                paymentMethodForm.type === 'debit_card' || 
                paymentMethodForm.type === 'bank_transfer') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conta Bancária Vinculada {(paymentMethodForm.type === 'credit_card' || paymentMethodForm.type === 'debit_card') && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    required={paymentMethodForm.type === 'credit_card' || paymentMethodForm.type === 'debit_card'}
                    value={paymentMethodForm.bankAccountId}
                    onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, bankAccountId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione uma conta</option>
                    {bankAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {paymentMethodForm.type === 'credit_card' && 'Conta de onde será paga a fatura'}
                    {paymentMethodForm.type === 'debit_card' && 'Conta vinculada ao cartão'}
                    {paymentMethodForm.type === 'pix' && 'Conta do PIX (opcional)'}
                  </p>
                </div>
              )}

              {/* Campos específicos para cartões */}
              {(paymentMethodForm.type === 'credit_card' || paymentMethodForm.type === 'debit_card') && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Últimos 4 dígitos */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Últimos 4 dígitos
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={paymentMethodForm.lastFourDigits}
                        onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, lastFourDigits: e.target.value.replace(/\D/g, '') })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="2277"
                      />
                    </div>

                    {/* Bandeira */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bandeira
                      </label>
                      <select
                        value={paymentMethodForm.cardNetwork}
                        onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, cardNetwork: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecione</option>
                        <option value="visa">Visa</option>
                        <option value="mastercard">Mastercard</option>
                        <option value="elo">Elo</option>
                        <option value="amex">American Express</option>
                        <option value="hipercard">Hipercard</option>
                        <option value="other">Outra</option>
                      </select>
                    </div>
                  </div>

                  {/* Data de Vencimento */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data de Vencimento
                    </label>
                    <input
                      type="month"
                      value={paymentMethodForm.expirationDate}
                      onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, expirationDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentMethodModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-4 py-2 rounded-lg text-white font-medium bg-blue-600 hover:bg-blue-700 ${
                    submitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={submitting}
                >
                  {submitting ? 'Criando...' : 'Criar Meio de Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal de Transação Unificado com Tabs: Única | Recorrente | Parcelada */}
      <CreateTransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        onSuccess={() => {
          loadDashboardData();
          // Modal permanece aberto para continuar lançando transações
        }}
      />

      {/* Wizard de Onboarding de Contas Recorrentes */}
      <OnboardingRecurringBills
        isOpen={showOnboardingRecurring}
        onClose={() => {
          setShowOnboardingRecurring(false);
          localStorage.setItem('hasSeenRecurringBillsWizard', 'true');
        }}
        onComplete={() => {
          setShowOnboardingRecurring(false);
          localStorage.setItem('hasSeenRecurringBillsWizard', 'true');
          toast.success('Contas recorrentes ativadas com sucesso!');
          // Recarregar dashboard para mostrar novas contas
          loadDashboardData();
        }}
      />

      {/* Modal de Seleção de Perfil (estilo Netflix) */}
      <ProfileSelectorModal
        isOpen={showProfileSelector}
        onClose={() => setShowProfileSelector(false)}
        onSelectProfile={(profileId) => {
          selectProfile(profileId);
          setShowProfileSelector(false);
          toast.success('Perfil selecionado!');
        }}
        profiles={profiles}
        isLoading={profilesLoading}
      />
      </div>
    </DashboardLayoutWrapper>
  );
}
