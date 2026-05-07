'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  CalendarClock,
  AlertTriangle,
  Sparkles,
  Target,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth, useTenant } from '@/stores/auth';
import { formatCurrency } from '@/lib/energyColors';
import KpiCard from '@/components/dashboard-v2/KpiCard';
import QuickCard from '@/components/dashboard-v2/QuickCard';
import RankingList from '@/components/dashboard-v2/RankingList';
import UpcomingTable, { UpcomingItem } from '@/components/dashboard-v2/UpcomingTable';
import GoalRing from '@/components/dashboard-v2/GoalRing';

// Charts em dynamic import — Recharts é pesado e SSR não ajuda aqui
const EvolutionChart = dynamic(() => import('@/components/dashboard-v2/EvolutionChart'), {
  ssr: false,
  loading: () => <div className="h-[300px] flex items-center justify-center v2-faint text-sm">Carregando gráfico…</div>,
});
const CategoryDonut = dynamic(() => import('@/components/dashboard-v2/CategoryDonut'), {
  ssr: false,
});

// ==================== Helpers ====================

function getMonthRange(offsetMonths = 0): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end) };
}

function getRangeMonths(monthsBack: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end) };
}

function pctDelta(current: number, previous: number): number | undefined {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return undefined;
  if (previous === 0) {
    if (current === 0) return 0;
    return current > 0 ? 100 : -100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

// Greeting time-aware
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ==================== Page ====================

interface MonthSummary {
  totalIncome: number;
  receivedIncome: number;
  pendingIncome: number;
  totalExpense: number;
  paidExpense: number;
  pendingExpense: number;
  finalBalance: number;
}

interface ChartPoint {
  month: string;
  realizedIncome: number;
  realizedExpense: number;
  projectedIncome?: number;
  projectedExpense: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

interface RankingRow {
  rank: number;
  name: string;
  total: number;
  count: number;
  percentage: number;
}

interface TodaySummary {
  overdue: { total: number; count: number; items: Array<{ description: string; daysOverdue: number; dueDate: string }> };
}

const CATEGORY_PALETTE = ['#3B82F6', '#C026D3', '#F59E0B', '#10B981', '#F43F5E', '#8B5CF6', '#06B6D4'];

export default function DashboardV2Page() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const tenant = useTenant();

  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<MonthSummary | null>(null);
  const [previousMonth, setPreviousMonth] = useState<MonthSummary | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [today, setToday] = useState<TodaySummary | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [totalAccountsBalance, setTotalAccountsBalance] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    const load = async () => {
      try {
        setLoading(true);

        const cur = getMonthRange(0);
        const prev = getMonthRange(-1);
        const sixMonths = getRangeMonths(6);

        const today0 = new Date().toISOString().split('T')[0];
        const upcomingEnd = (() => {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          return d.toISOString().split('T')[0];
        })();

        const [
          curBalance,
          prevBalance,
          ivseRes,
          rankingRes,
          todayRes,
          accountsRes,
          upcomingRes,
        ] = await Promise.all([
          api.get('/dashboard/balance-summary', { params: { startDate: cur.start, endDate: cur.end } }),
          api.get('/dashboard/balance-summary', { params: { startDate: prev.start, endDate: prev.end } }),
          api.get('/dashboard/income-vs-expenses', { params: { startDate: sixMonths.start, endDate: sixMonths.end } }),
          api.get('/dashboard/expense-ranking', { params: { startDate: cur.start, endDate: cur.end } }),
          api.get('/dashboard/today-summary'),
          api.get('/bank-accounts?isActive=true'),
          api.get('/transactions', {
            params: {
              startDate: today0,
              endDate: upcomingEnd,
              status: 'pending',
              type: 'expense',
              limit: 8,
              page: 1,
            },
          }),
        ]);

        setCurrentMonth(curBalance.data.data?.summary ?? null);
        setPreviousMonth(prevBalance.data.data?.summary ?? null);
        setChart(ivseRes.data.data?.chartData ?? []);
        setRanking(rankingRes.data.data?.ranking ?? []);
        setToday(todayRes.data.data ?? null);

        const accounts = accountsRes.data.data?.accounts ?? [];
        const totalBalance = accounts.reduce(
          (sum: number, a: { currentBalance?: number | string }) => sum + Number(a.currentBalance ?? 0),
          0,
        );
        setTotalAccountsBalance(totalBalance);

        const upcomingTx: UpcomingItem[] = (upcomingRes.data.data?.transactions ?? [])
          .slice(0, 6)
          .map((t: {
            id: string;
            description: string;
            dueDate?: string;
            transactionDate: string;
            amount: number | string;
            bankAccount?: { name?: string };
            category?: { icon?: string };
            isRecurringOccurrence?: boolean;
          }) => ({
            id: t.id,
            description: t.description,
            dueDate: t.dueDate || t.transactionDate,
            amount: Number(t.amount),
            account: t.bankAccount?.name,
            status: (() => {
              const due = new Date(t.dueDate || t.transactionDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (due < today) return 'overdue' as const;
              if (t.isRecurringOccurrence) return 'recurring' as const;
              return 'upcoming' as const;
            })(),
            icon: t.category?.icon,
          }));
        setUpcoming(upcomingTx);
      } catch (err) {
        console.error('Erro carregando dashboard v2:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isAuthenticated]);

  // ---------- Derived ----------

  const incomeDelta = pctDelta(currentMonth?.receivedIncome ?? 0, previousMonth?.receivedIncome ?? 0);
  const expenseDelta = pctDelta(currentMonth?.paidExpense ?? 0, previousMonth?.paidExpense ?? 0);
  const balanceDelta = pctDelta(currentMonth?.finalBalance ?? 0, previousMonth?.finalBalance ?? 0);

  const sparkIncome = chart.map((c) => c.realizedIncome + (c.projectedIncome ?? 0));
  const sparkExpense = chart.map((c) => c.realizedExpense + c.projectedExpense);
  const sparkBalance = chart.map((c) => c.balance);

  const evolutionData = useMemo(
    () =>
      chart.map((c) => {
        const [, m] = c.month.split('-');
        return {
          label: MONTH_SHORT[parseInt(m, 10) - 1] ?? c.month,
          income: c.totalIncome,
          expense: c.totalExpense,
        };
      }),
    [chart],
  );

  const donutData = useMemo(
    () =>
      ranking.slice(0, 6).map((r, i) => ({
        name: r.name,
        value: r.total,
        color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
      })),
    [ranking],
  );

  const rankingItems = useMemo(
    () =>
      ranking.slice(0, 5).map((r, i) => ({
        name: r.name,
        value: r.total,
        color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
      })),
    [ranking],
  );

  // Próxima conta + mais antiga em atraso (para QuickCards)
  const nextDue = upcoming.find((u) => u.status !== 'overdue');
  const oldestOverdue = (today?.overdue?.items ?? [])[0];

  // Previsão fim do mês (caixa)
  const forecastEom =
    (currentMonth?.receivedIncome ?? 0) +
    (currentMonth?.pendingIncome ?? 0) -
    (currentMonth?.paidExpense ?? 0) -
    (currentMonth?.pendingExpense ?? 0);

  // ---------- UI ----------

  if (!isAuthenticated) return null;

  const userName = tenant?.name?.split(' ')[0] ?? 'por aqui';

  return (
    <div className="utop-v2 min-h-screen p-4 md:p-6 lg:p-8">
      {/* Hero / Greeting */}
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
              {greeting()}, {userName}! <span aria-hidden>👋</span>
            </h1>
            <p className="text-sm v2-muted mt-1">Aqui está sua saúde financeira hoje.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="text-xs v2-muted hover:text-[var(--v2-text-primary)] underline-offset-4 hover:underline"
            title="Voltar para o dashboard clássico"
          >
            ← versão clássica
          </button>
        </div>
      </header>

      {/* Bloco 1: KPIs principais */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <KpiCard
          label="Saldo disponível"
          value={totalAccountsBalance}
          microcopy="Em todas as contas"
          accentColor="#3B82F6"
          icon={Wallet}
          spark={sparkBalance}
          trendLabel="Hoje"
        />
        <KpiCard
          label="Entradas do mês"
          value={currentMonth?.receivedIncome ?? 0}
          microcopy={
            (currentMonth?.pendingIncome ?? 0) > 0
              ? `+ ${formatCurrency(currentMonth!.pendingIncome)} a receber`
              : 'Receitas recebidas'
          }
          accentColor="#3B82F6"
          icon={ArrowDownToLine}
          trendPct={incomeDelta}
          positiveIsGood
          spark={sparkIncome}
        />
        <KpiCard
          label="Saídas do mês"
          value={currentMonth?.paidExpense ?? 0}
          microcopy={
            (currentMonth?.pendingExpense ?? 0) > 0
              ? `+ ${formatCurrency(currentMonth!.pendingExpense)} a pagar`
              : 'Despesas pagas'
          }
          accentColor="#C026D3"
          icon={ArrowUpFromLine}
          trendPct={expenseDelta}
          positiveIsGood={false}
          spark={sparkExpense}
        />
        <KpiCard
          label="Resultado do mês"
          value={currentMonth?.finalBalance ?? 0}
          microcopy={(currentMonth?.finalBalance ?? 0) >= 0 ? 'Superávit' : 'Déficit'}
          accentColor={(currentMonth?.finalBalance ?? 0) >= 0 ? '#10B981' : '#F43F5E'}
          icon={TrendingUp}
          trendPct={balanceDelta}
          positiveIsGood
        />
      </section>

      {/* Bloco 2: Visão rápida do mês */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <QuickCard
          icon={CalendarClock}
          iconColor="#3B82F6"
          label="Contas a vencer"
          primary={`${upcoming.filter((u) => u.status !== 'overdue').length} contas`}
          secondary={
            nextDue
              ? `Próxima: ${nextDue.description}`
              : 'Nada nos próximos 30 dias'
          }
          detail={nextDue ? { label: 'Vence', value: formatCurrency(nextDue.amount) } : undefined}
        />
        <QuickCard
          icon={AlertTriangle}
          iconColor="#F43F5E"
          label="Atrasadas"
          primary={`${today?.overdue?.count ?? 0} contas`}
          secondary={
            oldestOverdue
              ? `Mais antiga: ${oldestOverdue.description}`
              : 'Tudo em dia 👏'
          }
          detail={
            today?.overdue?.total
              ? { label: 'Total', value: formatCurrency(today.overdue.total) }
              : undefined
          }
        />
        <QuickCard
          icon={Sparkles}
          iconColor="#F59E0B"
          label="Previsão do mês"
          primary={formatCurrency(forecastEom)}
          secondary="Saldo projetado"
          detail={{ label: 'Baseado nas', value: 'transações atuais' }}
        />
        <QuickCard
          icon={Target}
          iconColor="#10B981"
          label="Meta / Reserva"
          primary={
            (currentMonth?.finalBalance ?? 0) > 0
              ? formatCurrency(currentMonth!.finalBalance)
              : formatCurrency(0)
          }
          secondary="Você no caminho certo"
          detail={{ label: 'Mês', value: '55%' }}
        />
      </section>

      {/* Bloco 3: Gráfico herói + donut categorias */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="v2-card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Sua evolução</h2>
              <p className="text-xs v2-muted mt-0.5">Receitas × Despesas dos últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-3 text-xs v2-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3B82F6]" /> Receitas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#C026D3]" /> Despesas
              </span>
            </div>
          </div>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center v2-faint text-sm">Carregando…</div>
          ) : (
            <EvolutionChart data={evolutionData} />
          )}
        </div>

        <div className="v2-card p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Gastos por categoria</h2>
            <p className="text-xs v2-muted mt-0.5">Onde seu dinheiro foi este mês</p>
          </div>
          <CategoryDonut data={donutData} />
        </div>
      </section>

      {/* Bloco 4: Maiores gastos + Reserva */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <div className="v2-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Maiores gastos</h2>
              <p className="text-xs v2-muted mt-0.5">Top 5 categorias do mês</p>
            </div>
          </div>
          <RankingList items={rankingItems} max={5} />
        </div>

        <div className="v2-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Reserva de emergência</h2>
              <p className="text-xs v2-muted mt-0.5">Sua segurança financeira</p>
            </div>
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--v2-border-strong)] v2-muted hover:text-[var(--v2-text-primary)]"
              onClick={() => router.push('/dashboard/budgets')}
              title="Gerenciar meta"
            >
              Gerenciar meta
            </button>
          </div>
          <GoalRing
            current={Math.max(0, currentMonth?.finalBalance ?? 0)}
            target={Math.max(1, (currentMonth?.totalIncome ?? 0) * 3)}
            label="da meta"
          />
        </div>
      </section>

      {/* Bloco 5: Próximos vencimentos */}
      <section className="v2-card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">Próximos vencimentos</h2>
            <p className="text-xs v2-muted mt-0.5">Próximos 30 dias</p>
          </div>
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--v2-border-strong)] v2-muted hover:text-[var(--v2-text-primary)]"
            onClick={() => router.push('/dashboard/transactions?status=pending')}
            title="Ver todas as transações"
          >
            Ver todas
          </button>
        </div>
        <UpcomingTable items={upcoming} onItemClick={(id) => router.push(`/dashboard/transactions?focus=${id}`)} />
      </section>

      <p className="text-center text-xs v2-faint mt-6">
        Você está no caminho certo. Continue assim 💪
      </p>
    </div>
  );
}
