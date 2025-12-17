'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api, { logout } from '@/lib/api';
import { useAuth, useUser, useTenant } from '@/stores/auth';
import TransactionModal from '@/components/NewTransactionModal';
import UnifiedTransactionModal from '@/components/UnifiedTransactionModal';
import QuickActions from '@/components/QuickActions';
import OnboardingRecurringBills from '@/components/OnboardingRecurringBills';
import { 
  DashboardMetricsSkeleton, 
  ChartSkeleton, 
  RankingCardSkeleton 
} from '@/components/Skeletons';
import { 
  Calendar,
  Filter,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CreditCard,
  PiggyBank,
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

export default function Dashboard() {
  const router = useRouter();
  const user = useUser();
  const tenant = useTenant();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData>({});
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [unifiedModalTab, setUnifiedModalTab] = useState<'recurring' | 'installment' | 'single'>('single');
  const [showBankAccountModal, setShowBankAccountModal] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showOnboardingRecurring, setShowOnboardingRecurring] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [submitting, setSubmitting] = useState(false);
  
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`; // Primeiro dia do mês
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate(); // Último dia do mês
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  
  // Estados temporários para o modal (só aplica quando clicar em Aplicar)
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    loadDashboardData();
    loadFormData();
    
    // Verificar se é primeiro acesso para mostrar wizard de contas recorrentes
    const hasSeenWizard = localStorage.getItem('hasSeenRecurringBillsWizard');
    if (!hasSeenWizard) {
      // Aguardar 1 segundo para dashboard carregar antes de mostrar wizard
      const timer = setTimeout(() => {
        setShowOnboardingRecurring(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [startDate, endDate, isAuthenticated]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const params = { startDate, endDate };

      console.log('Carregando dashboard com período:', params);

      // Carregar todos os dados em paralelo usando API client
      const [balance, expenseRank, incomeRank, incomeVsExp] = await Promise.all([
        api.get('/dashboard/balance-summary', { params }),
        api.get('/dashboard/expense-ranking', { params }),
        api.get('/dashboard/income-ranking', { params }),
        api.get('/dashboard/income-vs-expenses', { params }),
      ]);

      console.log('Resposta income-vs-expenses:', incomeVsExp.data);
      console.log('chartData extraído:', incomeVsExp.data.data?.chartData);

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
      console.log('Carregando categorias, contas e meios de pagamento...');

      const [categoriesRes, accountsRes, paymentsRes] = await Promise.all([
        api.get('/categories?isActive=true'),
        api.get('/bank-accounts?isActive=true'),
        api.get('/payment-methods?isActive=true'),
      ]);

      console.log('Dados carregados:', {
        categorias: categoriesRes.data.data.categories?.length || 0,
        contas: accountsRes.data.data.accounts?.length || 0,
        meios: paymentsRes.data.data.paymentMethods?.length || 0,
      });

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

    const newStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const newEnd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    setTempStartDate(newStart);
    setTempEndDate(newEnd);
    setStartDate(newStart);
    setEndDate(newEnd);
    setShowPeriodModal(false);
  };

  const handleOpenPeriodModal = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setShowPeriodModal(true);
  };

  const handleApplyPeriod = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setShowPeriodModal(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <DashboardMetricsSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <ChartSkeleton height={350} />
          <ChartSkeleton height={350} />
        </div>
      </div>
    );
  }

  const balance = dashboardData.balanceSummary?.summary;
  const expenseData = dashboardData.expenseRanking;
  const incomeData = dashboardData.incomeRanking;
  const chartData = dashboardData.incomeVsExpenses?.chartData || [];

  return (
    <>
      {/* Content */}
      <div className="p-6">
        {/* Quick Actions */}
        <QuickActions
          onAddTransaction={() => setShowUnifiedModal(true)}
          onAddRecurring={() => {
            setUnifiedModalTab('recurring');
            setShowUnifiedModal(true);
          }}
          onAddInstallment={() => {
            setUnifiedModalTab('installment');
            setShowUnifiedModal(true);
          }}
          onOpenCalendar={() => router.push('/dashboard/calendar')}
        />

        {/* Period Filter */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-gray-600 font-inter">
            <Calendar className="w-4 h-4" />
            <span>
              {(() => {
                const [sy, sm, sd] = startDate.split('-').map(Number);
                const [ey, em, ed] = endDate.split('-').map(Number);
                return `${new Date(sy, sm - 1, sd).toLocaleDateString('pt-BR')} - ${new Date(ey, em - 1, ed).toLocaleDateString('pt-BR')}`;
              })()}
            </span>
          </div>
          <button
            onClick={handleOpenPeriodModal}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium font-inter"
          >
            <Filter className="w-4 h-4" />
            <span>Alterar Período</span>
          </button>
        </div>

        {/* 1. Saldo Final Detalhado */}
        <div className={`rounded-xl p-6 mb-8 text-white shadow-lg ${
          balance?.isPositive 
            ? 'bg-gradient-to-r from-[#1F4FD8] to-[#1A44BF]' 
            : 'bg-gradient-to-r from-[#DC2626] to-[#B91C1C]'
        }`}>
          <h2 className="text-lg font-semibold mb-6 font-poppins">Saldo Final do Período</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* COLUNA RECEITAS */}
            <div className="bg-white/10 rounded-lg p-4">
              <h3 className={`text-sm font-medium mb-3 ${balance?.isPositive ? 'text-blue-100' : 'text-red-100'}`}>💰 RECEITAS</h3>
              
              <div className="mb-4">
                <p className={`text-xs mb-1 ${balance?.isPositive ? 'text-blue-200' : 'text-red-200'}`}>Total de Receitas</p>
                <p className="text-2xl font-bold">{formatCurrency(balance?.totalIncome || 0)}</p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className={balance?.isPositive ? 'text-blue-200' : 'text-red-200'}>✅ Receitas Recebidas</span>
                  <span className="font-semibold">{formatCurrency(balance?.receivedIncome || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={balance?.isPositive ? 'text-blue-200' : 'text-red-200'}>⏳ Receitas a Receber</span>
                  <span className="font-semibold">{formatCurrency(balance?.pendingIncome || 0)}</span>
                </div>
              </div>
            </div>

            {/* COLUNA DESPESAS */}
            <div className="bg-white/10 rounded-lg p-4">
              <h3 className={`text-sm font-medium mb-3 ${balance?.isPositive ? 'text-blue-100' : 'text-red-100'}`}>💸 DESPESAS</h3>
              
              <div className="mb-4">
                <p className={`text-xs mb-1 ${balance?.isPositive ? 'text-blue-200' : 'text-red-200'}`}>Total de Despesas</p>
                <p className="text-2xl font-bold">{formatCurrency(balance?.totalExpense || 0)}</p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className={balance?.isPositive ? 'text-blue-200' : 'text-red-200'}>✅ Despesas Pagas</span>
                  <span className="font-semibold">{formatCurrency(balance?.paidExpense || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={balance?.isPositive ? 'text-blue-200' : 'text-red-200'}>⏳ Despesas a Pagar</span>
                  <span className="font-semibold">{formatCurrency(balance?.pendingExpense || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SALDO FINAL */}
          <div className="border-t border-white/20 pt-4">
            <div className={`rounded-lg p-4 text-center ${balance?.isPositive ? 'bg-white/20' : 'bg-white/10'}`}>
              <p className="text-sm text-white mb-2 font-medium">Saldo Final (Receitas - Despesas)</p>
              <p className={`text-4xl font-bold ${balance?.isPositive ? 'text-[#2ECC9A]' : 'text-[#FFEB3B]'}`}>
                {formatCurrency(balance?.finalBalance || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 2. Ranking de Gastos (Pareto 80%) */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4 font-poppins">
              Principais Gastos (80% da despesa)
            </h3>
            {expenseData?.pareto80?.length > 0 ? (
              <div className="space-y-3">
                {expenseData.pareto80.map((item: any) => (
                  <div key={item.rank} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#FEF2F2] rounded-full flex items-center justify-center text-[#EF4444] font-semibold text-sm">
                      {item.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-[#1A1A1A] truncate font-inter">{item.name}</p>
                        <p className="text-sm font-semibold text-[#1A1A1A] font-inter">{formatCurrency(item.total)}</p>
                      </div>
                      <div className="w-full bg-[#D9D9D9] rounded-full h-2">
                        <div
                          className="bg-[#EF4444] h-2 rounded-full transition-all"
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-[#4F4F4F] mt-1 font-inter">
                        <span>{item.percentage.toFixed(1)}%</span>
                        <span>Acumulado: {item.accumulatedPercentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#4F4F4F] text-center py-8 font-inter">Nenhum gasto registrado no período</p>
            )}
          </div>

          {/* 3. Ranking de Receitas */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4 font-poppins">
              Principais Receitas
            </h3>
            {incomeData?.ranking?.length > 0 ? (
              <div className="space-y-3">
                {incomeData.ranking.slice(0, 8).map((item: any) => (
                  <div key={item.rank} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#DCFCE7] rounded-full flex items-center justify-center text-[#2ECC9A] font-semibold text-sm">
                      {item.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-[#1A1A1A] truncate font-inter">{item.name}</p>
                        <p className="text-sm font-semibold text-[#1A1A1A] font-inter">{formatCurrency(item.total)}</p>
                      </div>
                      <div className="w-full bg-[#D9D9D9] rounded-full h-2">
                        <div
                          className="bg-[#2ECC9A] h-2 rounded-full transition-all"
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-[#4F4F4F] mt-1 font-inter">{item.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#4F4F4F] text-center py-8 font-inter">Nenhuma receita registrada no período</p>
            )}
          </div>
        </div>

        {/* 4. Gráfico Receitas x Despesas */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-6 font-poppins">
            Receitas x Despesas (com gastos provisionados)
          </h3>
          {chartData.length > 0 ? (
            <div className="space-y-6">
              {chartData.map((month: any) => (
                <div key={month.month} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[#1A1A1A] font-inter">{formatMonth(month.month)}</span>
                    <span className={`font-semibold font-inter ${month.balance >= 0 ? 'text-[#2ECC9A]' : 'text-[#EF4444]'}`}>
                      {formatCurrency(month.balance)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Receitas */}
                    <div>
                      <div className="flex items-center justify-between mb-1 text-xs text-[#4F4F4F] font-inter">
                        <span>Receitas (realizado + provisionado)</span>
                        <span className="font-medium">{formatCurrency(month.totalIncome || month.realizedIncome)}</span>
                      </div>
                      <div className="h-8 bg-[#DCFCE7] rounded overflow-hidden">
                        <div className="h-full flex">
                          <div
                            className="bg-[#2ECC9A]"
                            style={{
                              width: month.totalIncome ? `${(month.realizedIncome / month.totalIncome) * 100}%` : '100%',
                            }}
                            title={`Realizado: ${formatCurrency(month.realizedIncome)}`}
                          ></div>
                          {month.projectedIncome > 0 && (
                            <div
                              className="bg-[#6DD9B9]"
                              style={{
                                width: `${((month.projectedIncome || 0) / month.totalIncome) * 100}%`,
                              }}
                              title={`Provisionado: ${formatCurrency(month.projectedIncome || 0)}`}
                            ></div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#4F4F4F] font-inter">
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-[#2ECC9A] rounded"></div>
                          Realizado: {formatCurrency(month.realizedIncome)}
                        </span>
                        {month.projectedIncome > 0 && (
                          <span className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-[#6DD9B9] rounded"></div>
                            Provisionado: {formatCurrency(month.projectedIncome || 0)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Despesas */}
                    <div>
                      <div className="flex items-center justify-between mb-1 text-xs text-[#4F4F4F] font-inter">
                        <span>Despesas (realizado + provisionado)</span>
                        <span className="font-medium">{formatCurrency(month.totalExpense)}</span>
                      </div>
                      <div className="h-8 bg-[#FEF2F2] rounded overflow-hidden">
                        <div className="h-full flex">
                          <div
                            className="bg-[#EF4444]"
                            style={{
                              width: `${(month.realizedExpense / month.totalExpense) * 100}%`,
                            }}
                            title={`Realizado: ${formatCurrency(month.realizedExpense)}`}
                          ></div>
                          <div
                            className="bg-[#F39C8F]"
                            style={{
                              width: `${(month.projectedExpense / month.totalExpense) * 100}%`,
                            }}
                            title={`Provisionado: ${formatCurrency(month.projectedExpense)}`}
                          ></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#4F4F4F] font-inter">
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-[#EF4444] rounded"></div>
                          Realizado: {formatCurrency(month.realizedExpense)}
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-[#F39C8F] rounded"></div>
                          Provisionado: {formatCurrency(month.projectedExpense)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#4F4F4F] text-center py-8 font-inter">Nenhum dado disponível para o período</p>
          )}
        </div>

        {/* 5. Contas Bancárias e Meios de Pagamento */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Contas Bancárias */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="text-[#1F4FD8]" size={20} />
                <h3 className="text-lg font-semibold text-[#1A1A1A] font-poppins">Contas Bancárias</h3>
              </div>
              <button
                onClick={() => setShowBankAccountModal(true)}
                className="px-3 py-1.5 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] text-sm font-medium flex items-center gap-1"
              >
                <span>+</span> Nova Conta
              </button>
            </div>
            {bankAccounts.length > 0 ? (
              <div className="space-y-3">
                {bankAccounts.map(account => (
                  <div key={account.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-[#1A1A1A]">{account.name}</p>
                      <p className="text-xs text-gray-500">{account.institution || account.type}</p>
                    </div>
                    <p className={`font-semibold ${account.currentBalance >= 0 ? 'text-[#2ECC9A]' : 'text-[#EF4444]'}`}>
                      {formatCurrency(account.currentBalance)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Wallet className="mx-auto text-gray-300 mb-2" size={40} />
                <p className="text-gray-500 text-sm">Nenhuma conta cadastrada</p>
                <button
                  onClick={() => setShowBankAccountModal(true)}
                  className="mt-3 text-[#1F4FD8] text-sm hover:underline"
                >
                  Adicionar primeira conta
                </button>
              </div>
            )}
          </div>

          {/* Meios de Pagamento */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="text-purple-600" size={20} />
                <h3 className="text-lg font-semibold text-[#1A1A1A] font-poppins">Meios de Pagamento</h3>
              </div>
              <button
                onClick={() => setShowPaymentMethodModal(true)}
                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center gap-1"
              >
                <span>+</span> Novo Método
              </button>
            </div>
            {paymentMethods.length > 0 ? (
              <div className="space-y-3">
                {paymentMethods.map(method => (
                  <div key={method.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <CreditCard className="text-purple-600" size={16} />
                      </div>
                      <div>
                        <p className="font-medium text-[#1A1A1A]">{method.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{method.type.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="mx-auto text-gray-300 mb-2" size={40} />
                <p className="text-gray-500 text-sm">Nenhum método cadastrado</p>
                <button
                  onClick={() => setShowPaymentMethodModal(true)}
                  className="mt-3 text-purple-600 text-sm hover:underline"
                >
                  Adicionar primeiro método
                </button>
              </div>
            )}
          </div>
        </div>

      {/* Modal de Período */}
      {showPeriodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#1A1A1A] font-poppins">Filtrar por Período</h3>
              <button onClick={() => setShowPeriodModal(false)} className="p-2 hover:bg-gray-100 rounded-lg" title="Fechar" aria-label="Fechar modal">
                <X className="w-5 h-5 text-[#4F4F4F]" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-2 font-inter">Data Inicial</label>
                <input
                  type="date"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] font-inter"
                  title="Data inicial do período"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-2 font-inter">Data Final</label>
                <input
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] font-inter"
                  title="Data final do período"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button onClick={() => applyQuickFilter('currentMonth')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium font-inter">
                Mês Atual
              </button>
              <button onClick={() => applyQuickFilter('lastMonth')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium font-inter">
                Mês Anterior
              </button>
              <button onClick={() => applyQuickFilter('last3Months')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium font-inter">
                Últimos 3 Meses
              </button>
              <button onClick={() => applyQuickFilter('last6Months')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium font-inter">
                Últimos 6 Meses
              </button>
              <button onClick={() => applyQuickFilter('currentYear')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium col-span-2 font-inter">
                Ano Atual
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPeriodModal(false)}
                className="flex-1 px-4 py-2 border border-[#D9D9D9] rounded-lg hover:bg-gray-50 font-inter"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyPeriod}
                className="flex-1 px-4 py-2 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] shadow-md font-inter"
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
                <Wallet className="text-[#1F4FD8]" size={24} />
                <h2 className="text-xl font-bold text-gray-900">Nova Conta Bancária</h2>
              </div>
              <button
                onClick={() => setShowBankAccountModal(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={submitting}
                title="Fechar"
                aria-label="Fechar modal"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                  title="Tipo de conta"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
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
                    className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
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
                  className={`flex-1 px-4 py-2 rounded-lg text-white font-medium bg-[#1F4FD8] hover:bg-[#1A44BF] ${
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
                <CreditCard className="text-[#1F4FD8]" size={24} />
                <h2 className="text-xl font-bold text-gray-900">Novo Meio de Pagamento</h2>
              </div>
              <button
                onClick={() => setShowPaymentMethodModal(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={submitting}
                title="Fechar"
                aria-label="Fechar modal"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                  title="Tipo de meio de pagamento"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                    title="Conta bancária vinculada"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                        title="Bandeira do cartão"
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
                      type="text"
                      value={paymentMethodForm.expirationDate}
                      onChange={(e) => {
                        // Formata como MM/AA
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length >= 2) {
                          value = value.slice(0, 2) + '/' + value.slice(2, 4);
                        }
                        setPaymentMethodForm({ ...paymentMethodForm, expirationDate: value });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                      title="Data de vencimento do cartão"
                      placeholder="MM/AA"
                      maxLength={5}
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
                  className={`flex-1 px-4 py-2 rounded-lg text-white font-medium bg-[#1F4FD8] hover:bg-[#1A44BF] ${
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
      
      {/* Modal de Transação Simples (legado) */}
      <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        onSuccess={() => {
          loadDashboardData();
          setShowTransactionModal(false);
        }}
      />

      {/* Modal de Transação Unificado (Única/Recorrente/Parcelada) */}
      <UnifiedTransactionModal
        isOpen={showUnifiedModal}
        onClose={() => setShowUnifiedModal(false)}
        onSuccess={() => {
          loadDashboardData();
          setShowUnifiedModal(false);
        }}
        initialTab={unifiedModalTab}
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
      </div>
    </>
  );
}
