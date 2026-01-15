'use client';

import { useAuth } from '@/stores/auth';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  PlusCircle,
  Edit,
  Trash2,
  Target,
  ChevronLeft,
  ChevronRight,
  Wallet,
  AlertCircle,
  CheckCircle2,
  BarChart3
} from 'lucide-react';

interface MonthData {
  month: number;
  monthName: string;
  year: number;
  planned: {
    income: number;
    expense: number;
    balance: number;
  };
  realized: {
    income: number;
    expense: number;
    balance: number;
  };
  pending: {
    income: number;
    expense: number;
  };
  variance: {
    income: number;
    expense: number;
    balance: number;
  };
}

interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category?: string;
  bankAccount?: string;
}

interface PlanningData {
  year: number;
  currentBalance: number;
  months: MonthData[];
  annualTotals: {
    planned: { income: number; expense: number; balance: number };
    realized: { income: number; expense: number; balance: number };
  };
  recurringIncomes: RecurringItem[];
  recurringExpenses: RecurringItem[];
  budgets: { id: string; name: string; amount: number; category?: string }[];
  accounts: { id: string; name: string; currentBalance: number }[];
}

export default function PlanningPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PlanningData | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'income' | 'expense'>('expense');
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    dueDay: '',
    categoryId: '',
    bankAccountId: '',
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'incomes' | 'expenses' | 'projection'>('overview');

  useEffect(() => {
    loadPlanning();
  }, [selectedYear]);

  const loadPlanning = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/planning/annual?year=${selectedYear}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        toast.error('Erro ao carregar planejamento');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.amount || !formData.dueDay) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/planning/recurring`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          type: addType,
          amount: parseFloat(formData.amount.replace(/[^\d,.-]/g, '').replace(',', '.')),
          dueDay: parseInt(formData.dueDay),
          categoryId: formData.categoryId || null,
          bankAccountId: formData.bankAccountId || null,
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(`${addType === 'income' ? 'Receita' : 'Despesa'} fixa cadastrada!`);
        setShowAddModal(false);
        setFormData({ name: '', amount: '', dueDay: '', categoryId: '', bankAccountId: '' });
        loadPlanning();
      } else {
        toast.error(result.error?.message || 'Erro ao cadastrar');
      }
    } catch (error) {
      toast.error('Erro ao conectar com o servidor');
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getVarianceColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const getProgressPercentage = (realized: number, planned: number) => {
    if (planned === 0) return 0;
    return Math.min((realized / planned) * 100, 100);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Planejamento Anual</h1>
            <p className="text-gray-500">Carregando...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-32"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentMonthIndex = new Date().getMonth();
  const isCurrentYear = selectedYear === new Date().getFullYear();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] font-poppins flex items-center gap-2">
              <Calendar className="w-7 h-7 text-[#6C5CE7]" />
              Planejamento Anual
            </h1>
            <p className="text-[#4F4F4F] font-inter">Visualize e planeje suas finanças para o ano todo</p>
          </div>
        </div>

        {/* Seletor de Ano */}
        <div className="flex items-center gap-2 bg-white rounded-lg border px-2">
          <button 
            onClick={() => setSelectedYear(y => y - 1)} 
            className="p-2 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-lg min-w-[60px] text-center">{selectedYear}</span>
          <button 
            onClick={() => setSelectedYear(y => y + 1)} 
            className="p-2 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 font-inter">Saldo Atual</span>
            <Wallet className="w-5 h-5 text-[#6C5CE7]" />
          </div>
          <p className={`text-2xl font-bold font-poppins ${(data?.currentBalance || 0) >= 0 ? 'text-[#2ECC9A]' : 'text-red-500'}`}>
            {formatCurrency(data?.currentBalance || 0)}
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 font-inter">Receita Mensal Planejada</span>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-[#2ECC9A] font-poppins">
            {formatCurrency((data?.annualTotals?.planned?.income || 0) / 12)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{data?.recurringIncomes?.length || 0} receita(s) fixa(s)</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 font-inter">Despesa Mensal Planejada</span>
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-500 font-poppins">
            {formatCurrency((data?.annualTotals?.planned?.expense || 0) / 12)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{data?.recurringExpenses?.length || 0} despesa(s) fixa(s)</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 font-inter">Sobra Mensal Planejada</span>
            <Target className="w-5 h-5 text-[#6C5CE7]" />
          </div>
          <p className={`text-2xl font-bold font-poppins ${((data?.annualTotals?.planned?.balance || 0) / 12) >= 0 ? 'text-[#2ECC9A]' : 'text-red-500'}`}>
            {formatCurrency((data?.annualTotals?.planned?.balance || 0) / 12)}
          </p>
          <p className="text-xs text-gray-500 mt-1">por mês</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="border-b px-4">
          <div className="flex gap-4 overflow-x-auto">
            {[
              { key: 'overview', label: 'Visão Geral', icon: BarChart3 },
              { key: 'incomes', label: 'Receitas Fixas', icon: TrendingUp },
              { key: 'expenses', label: 'Despesas Fixas', icon: TrendingDown },
              { key: 'projection', label: 'Projeção 12 Meses', icon: Calendar },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 py-4 px-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key 
                    ? 'border-[#6C5CE7] text-[#6C5CE7] font-medium' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Resumo Anual */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
                  <h3 className="font-semibold text-green-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Receitas {selectedYear}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-green-700">Planejado (ano)</span>
                      <span className="font-bold text-green-800">{formatCurrency(data?.annualTotals?.planned?.income || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Realizado até agora</span>
                      <span className="font-bold text-green-800">{formatCurrency(data?.annualTotals?.realized?.income || 0)}</span>
                    </div>
                    <div className="h-2 bg-green-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${getProgressPercentage(data?.annualTotals?.realized?.income || 0, data?.annualTotals?.planned?.income || 1)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6">
                  <h3 className="font-semibold text-red-800 mb-4 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5" />
                    Despesas {selectedYear}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-red-700">Planejado (ano)</span>
                      <span className="font-bold text-red-800">{formatCurrency(data?.annualTotals?.planned?.expense || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-700">Realizado até agora</span>
                      <span className="font-bold text-red-800">{formatCurrency(data?.annualTotals?.realized?.expense || 0)}</span>
                    </div>
                    <div className="h-2 bg-red-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 rounded-full transition-all"
                        style={{ width: `${getProgressPercentage(data?.annualTotals?.realized?.expense || 0, data?.annualTotals?.planned?.expense || 1)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mini calendario dos meses */}
              <div>
                <h3 className="font-semibold text-[#1A1A1A] mb-4">Balanço por Mês</h3>
                <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2">
                  {data?.months?.map((month, idx) => {
                    const isPast = isCurrentYear && idx < currentMonthIndex;
                    const isCurrent = isCurrentYear && idx === currentMonthIndex;
                    const balance = isPast || isCurrent ? month.realized.balance : month.planned.balance;
                    
                    return (
                      <div 
                        key={month.month}
                        className={`p-3 rounded-lg text-center border-2 transition-all ${
                          isCurrent 
                            ? 'border-[#6C5CE7] bg-[#6C5CE7]/5' 
                            : isPast 
                              ? 'border-gray-200 bg-gray-50'
                              : 'border-gray-100 bg-white hover:border-[#6C5CE7]/30'
                        }`}
                      >
                        <p className="text-xs font-medium text-gray-500">{month.monthName.substring(0, 3)}</p>
                        <p className={`text-sm font-bold mt-1 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {balance >= 0 ? '+' : ''}{formatCurrency(balance).replace('R$', '')}
                        </p>
                        {isCurrent && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-[#6C5CE7] text-white text-[10px] rounded">Atual</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Incomes Tab */}
          {activeTab === 'incomes' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-[#1A1A1A]">Receitas Fixas Mensais</h3>
                <button
                  onClick={() => { setAddType('income'); setShowAddModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2ECC9A] text-white rounded-lg hover:bg-[#27b588] transition-colors"
                >
                  <PlusCircle className="w-4 h-4" />
                  Nova Receita Fixa
                </button>
              </div>

              {data?.recurringIncomes?.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhuma receita fixa cadastrada</p>
                  <p className="text-sm">Cadastre salários, aluguéis recebidos, etc.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data?.recurringIncomes?.map(income => (
                    <div key={income.id} className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-100">
                      <div>
                        <p className="font-medium text-[#1A1A1A]">{income.name}</p>
                        <p className="text-sm text-gray-500">
                          Dia {income.dueDay} • {income.bankAccount || 'Sem conta vinculada'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{formatCurrency(income.amount)}</p>
                        <p className="text-xs text-gray-500">/mês</p>
                      </div>
                    </div>
                  ))}
                  <div className="p-4 bg-green-100 rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-medium">Total Mensal</span>
                      <span className="font-bold text-green-700">
                        {formatCurrency(data?.recurringIncomes?.reduce((sum, i) => sum + i.amount, 0) || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Expenses Tab */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-[#1A1A1A]">Despesas Fixas Mensais</h3>
                <button
                  onClick={() => { setAddType('expense'); setShowAddModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <PlusCircle className="w-4 h-4" />
                  Nova Despesa Fixa
                </button>
              </div>

              {data?.recurringExpenses?.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <TrendingDown className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhuma despesa fixa cadastrada</p>
                  <p className="text-sm">Cadastre aluguel, internet, luz, etc.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data?.recurringExpenses?.map(expense => (
                    <div key={expense.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
                      <div>
                        <p className="font-medium text-[#1A1A1A]">{expense.name}</p>
                        <p className="text-sm text-gray-500">
                          Dia {expense.dueDay} • {expense.category || 'Sem categoria'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">{formatCurrency(expense.amount)}</p>
                        <p className="text-xs text-gray-500">/mês</p>
                      </div>
                    </div>
                  ))}
                  <div className="p-4 bg-red-100 rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-medium">Total Mensal</span>
                      <span className="font-bold text-red-700">
                        {formatCurrency(data?.recurringExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Projection Tab */}
          {activeTab === 'projection' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-[#1A1A1A]">Projeção Mês a Mês</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Mês</th>
                      <th className="text-right py-3 px-4 font-medium text-green-600">Receita Plan.</th>
                      <th className="text-right py-3 px-4 font-medium text-green-600">Receita Real.</th>
                      <th className="text-right py-3 px-4 font-medium text-red-600">Despesa Plan.</th>
                      <th className="text-right py-3 px-4 font-medium text-red-600">Despesa Real.</th>
                      <th className="text-right py-3 px-4 font-medium text-[#6C5CE7]">Balanço</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.months?.map((month, idx) => {
                      const isPast = isCurrentYear && idx < currentMonthIndex;
                      const isCurrent = isCurrentYear && idx === currentMonthIndex;
                      const isFuture = isCurrentYear && idx > currentMonthIndex;
                      const balance = isPast || isCurrent ? month.realized.balance : month.planned.balance;
                      
                      return (
                        <tr 
                          key={month.month} 
                          className={`border-b ${isCurrent ? 'bg-[#6C5CE7]/5' : ''}`}
                        >
                          <td className="py-3 px-4">
                            <span className="font-medium">{month.monthName}</span>
                            {isCurrent && <span className="ml-2 text-xs bg-[#6C5CE7] text-white px-2 py-0.5 rounded">Atual</span>}
                          </td>
                          <td className="text-right py-3 px-4 text-green-600">{formatCurrency(month.planned.income)}</td>
                          <td className="text-right py-3 px-4">
                            {isPast || isCurrent ? (
                              <span className="text-green-700 font-medium">{formatCurrency(month.realized.income)}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="text-right py-3 px-4 text-red-600">{formatCurrency(month.planned.expense)}</td>
                          <td className="text-right py-3 px-4">
                            {isPast || isCurrent ? (
                              <span className="text-red-700 font-medium">{formatCurrency(month.realized.expense)}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className={`text-right py-3 px-4 font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(balance)}
                          </td>
                          <td className="text-center py-3 px-4">
                            {isPast && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                <CheckCircle2 className="w-4 h-4" /> Concluído
                              </span>
                            )}
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 text-xs text-[#6C5CE7]">
                                <AlertCircle className="w-4 h-4" /> Em andamento
                              </span>
                            )}
                            {isFuture && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                <Calendar className="w-4 h-4" /> Futuro
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td className="py-3 px-4">TOTAL {selectedYear}</td>
                      <td className="text-right py-3 px-4 text-green-600">{formatCurrency(data?.annualTotals?.planned?.income || 0)}</td>
                      <td className="text-right py-3 px-4 text-green-700">{formatCurrency(data?.annualTotals?.realized?.income || 0)}</td>
                      <td className="text-right py-3 px-4 text-red-600">{formatCurrency(data?.annualTotals?.planned?.expense || 0)}</td>
                      <td className="text-right py-3 px-4 text-red-700">{formatCurrency(data?.annualTotals?.realized?.expense || 0)}</td>
                      <td className={`text-right py-3 px-4 ${(data?.annualTotals?.planned?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(data?.annualTotals?.planned?.balance || 0)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Adicionar */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">
                Nova {addType === 'income' ? 'Receita' : 'Despesa'} Fixa
              </h3>
            </div>
            
            <form onSubmit={handleAddRecurring} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  placeholder={addType === 'income' ? 'Ex: Salário' : 'Ex: Aluguel'}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7] focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor Mensal *</label>
                <input
                  type="text"
                  value={formData.amount}
                  onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))}
                  placeholder="Ex: 5000,00"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7] focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dia do Mês *</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dueDay}
                  onChange={e => setFormData(f => ({ ...f, dueDay: e.target.value }))}
                  placeholder="Ex: 5"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7] focus:border-transparent"
                />
              </div>

              {data?.accounts && data.accounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conta</label>
                  <select
                    value={formData.bankAccountId}
                    onChange={e => setFormData(f => ({ ...f, bankAccountId: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7] focus:border-transparent"
                  >
                    <option value="">Selecione uma conta</option>
                    {data.accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
                    addType === 'income' 
                      ? 'bg-[#2ECC9A] hover:bg-[#27b588]' 
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
