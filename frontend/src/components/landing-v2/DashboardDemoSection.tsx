'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Loader } from 'lucide-react';

interface DashboardData {
  tenant: {
    name: string;
    owner: string;
  };
  balances: {
    total: number;
    income: number;
    expense: number;
  };
  accounts: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    currentBalance: number;
    type: string;
  }>;
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    transactionDate: string;
    status: string;
    category?: {
      name: string;
      icon: string;
      color: string;
    };
  }>;
  recurringBills: Array<{
    id: string;
    name: string;
    amount: number;
    dueDay: number;
    type: string;
    category?: {
      name: string;
      icon: string;
      color: string;
    };
  }>;
  chartData: Array<{
    month: string;
    income: number;
    expense: number;
  }>;
}

export default function DashboardDemoSection() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDemoData = async () => {
      try {
        const response = await fetch('/api/v1/demo/dashboard');
        if (!response.ok) {
          throw new Error('Falha ao carregar dados demo');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        console.error('Demo dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDemoData();
  }, []);

  if (loading) {
    return (
      <section className="py-24 px-4 bg-gradient-to-b from-[#080B14] to-[#0F1425]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <Loader className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return null; // Silenciar erro - seção apenas não mostra
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
  };

  return (
    <section className="py-24 px-4 bg-gradient-to-b from-[#080B14] to-[#0F1425]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[#F1F5F9]">
            Veja o UTOP em ação
          </h2>
          <p className="text-lg text-[#94A3B8] max-w-2xl">
            Este é um exemplo real de como o {data.tenant.name} gerencia suas finanças com
            UTOP. 6 meses de histórico, múltiplas contas e transações recorrentes.
          </p>
        </div>

        {/* Dashboard Demo Container */}
        <div className="bg-[#0F1425] border border-[#1E293B] rounded-2xl p-8 shadow-2xl">
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Total Balance */}
            <div className="bg-gradient-to-br from-[#1E293B] to-[#0F1425] border border-[#334155] rounded-xl p-6">
              <p className="text-[#94A3B8] text-sm mb-2">Saldo Total</p>
              <p className="text-3xl font-bold text-[#F1F5F9] mb-3">
                {formatCurrency(data.balances.total)}
              </p>
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-[#64748B] mb-1">Receitas</p>
                  <p className="text-lg font-semibold text-green-400">
                    +{formatCurrency(data.balances.income)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] mb-1">Despesas</p>
                  <p className="text-lg font-semibold text-red-400">
                    -{formatCurrency(data.balances.expense)}
                  </p>
                </div>
              </div>
            </div>

            {/* Accounts */}
            <div className="bg-gradient-to-br from-[#1E293B] to-[#0F1425] border border-[#334155] rounded-xl p-6">
              <p className="text-[#94A3B8] text-sm mb-4">Contas Bancárias</p>
              <div className="space-y-3">
                {data.accounts.slice(0, 2).map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{acc.icon}</span>
                      <span className="text-[#F1F5F9] text-sm font-medium">{acc.name}</span>
                    </div>
                    <span className="text-[#94A3B8] text-sm">
                      {formatCurrency(Number(acc.currentBalance))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contas Recorrentes */}
            <div className="bg-gradient-to-br from-[#1E293B] to-[#0F1425] border border-[#334155] rounded-xl p-6">
              <p className="text-[#94A3B8] text-sm mb-4">Contas Recorrentes</p>
              <div className="space-y-3">
                {data.recurringBills.slice(0, 3).map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between text-sm">
                    <span className="text-[#F1F5F9]">{bill.name}</span>
                    <span className={bill.type === 'income' ? 'text-green-400' : 'text-red-400'}>
                      {bill.type === 'income' ? '+' : '-'}{formatCurrency(Number(bill.amount))}
                    </span>
                  </div>
                ))}
                <p className="text-xs text-[#64748B] pt-2">+{data.recurringBills.length - 3} mais...</p>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-[#F1F5F9] mb-4">Últimas Transações</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left py-3 px-4 text-[#94A3B8] font-medium">Descrição</th>
                    <th className="text-left py-3 px-4 text-[#94A3B8] font-medium">Categoria</th>
                    <th className="text-right py-3 px-4 text-[#94A3B8] font-medium">Valor</th>
                    <th className="text-left py-3 px-4 text-[#94A3B8] font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTransactions.slice(0, 5).map((tx) => (
                    <tr key={tx.id} className="border-b border-[#1E293B] hover:bg-[#1E293B] transition">
                      <td className="py-4 px-4 text-[#F1F5F9]">{tx.description}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{tx.category?.icon}</span>
                          <span className="text-[#94A3B8] text-xs">{tx.category?.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span
                          className={`font-semibold flex items-center justify-end gap-1 ${
                            tx.type === 'income' ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {tx.type === 'income' ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                          {tx.type === 'income' ? '+' : '-'}
                          {formatCurrency(Number(tx.amount))}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-[#64748B]">{formatDate(tx.transactionDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mini Chart - Income vs Expense */}
          <div>
            <h3 className="text-lg font-semibold text-[#F1F5F9] mb-4">Receita vs Despesa (últimos 6 meses)</h3>
            <div className="flex gap-4 flex-wrap">
              {data.chartData.map((month, idx) => {
                const maxValue = Math.max(
                  ...data.chartData.map((m) => Math.max(m.income, m.expense))
                );
                const incomeHeight = (month.income / maxValue) * 100;
                const expenseHeight = (month.expense / maxValue) * 100;

                return (
                  <div key={idx} className="flex-1 min-w-24 text-center">
                    <div className="h-32 flex items-end justify-center gap-2 mb-3">
                      <div
                        className="w-5 bg-green-500/30 rounded-t border-t border-green-500 transition"
                        style={{ height: `${incomeHeight}%` }}
                      />
                      <div
                        className="w-5 bg-red-500/30 rounded-t border-t border-red-500 transition"
                        style={{ height: `${expenseHeight}%` }}
                      />
                    </div>
                    <p className="text-xs text-[#94A3B8] uppercase">{month.month}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-[#94A3B8] mb-6">
            Quer gerenciar suas finanças assim? Crie sua conta gratuitamente em segundos.
          </p>
          <a
            href="/login?tab=register"
            className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-8 rounded-lg transition shadow-lg"
          >
            Começar Gratuitamente
          </a>
        </div>
      </div>
    </section>
  );
}
