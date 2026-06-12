import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardV2Page from '@/app/dashboard/v2/page';
import api from '@/lib/api';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/stores/auth', () => ({
  useAuth: () => ({ isAuthenticated: true }),
  useTenant: () => ({ name: 'Tenant Teste' }),
  useUser: () => ({ fullName: 'Usuario Teste' }),
}));

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock('@/components/dashboard-v2/KpiCard', () => function MockKpiCard() {
  return <div data-testid="kpi-card" />;
});
jest.mock('@/components/dashboard-v2/QuickCard', () => function MockQuickCard({ label }: { label: string }) {
  return <div>{label}</div>;
});
jest.mock('@/components/dashboard-v2/RankingList', () => function MockRankingList() {
  return <div data-testid="ranking-list" />;
});
jest.mock('@/components/dashboard-v2/GoalRing', () => function MockGoalRing() {
  return <div data-testid="goal-ring" />;
});
jest.mock('@/components/dashboard-v2/EvolutionChart', () => function MockEvolutionChart() {
  return <div data-testid="evolution-chart" />;
});
jest.mock('@/components/dashboard-v2/CategoryDonut', () => function MockCategoryDonut() {
  return <div data-testid="category-donut" />;
});

describe('DashboardV2 due card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window.localStorage.__proto__, 'setItem');

    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/transactions') {
        return Promise.resolve({
          data: {
            data: {
              transactions: [
                {
                  id: 'today',
                  description: 'Conta hoje',
                  dueDate: new Date().toISOString().split('T')[0],
                  transactionDate: new Date().toISOString().split('T')[0],
                  amount: '100',
                  status: 'pending',
                  bankAccount: { name: 'Conta Principal' },
                  category: { icon: 'C' },
                },
              ],
            },
          },
        });
      }

      if (url === '/recurring-bills/occurrences') {
        return Promise.resolve({ data: { data: { occurrences: [] } } });
      }

      if (url === '/installments') {
        return Promise.resolve({ data: { data: { purchases: [] } } });
      }

      if (url === '/bank-accounts?isActive=true') {
        return Promise.resolve({ data: { data: { accounts: [] } } });
      }

      if (url === '/dashboard/today-summary') {
        return Promise.resolve({ data: { data: { overdue: { count: 0, total: 0, items: [] } } } });
      }

      if (url === '/dashboard/income-vs-expenses') {
        return Promise.resolve({ data: { data: { chartData: [] } } });
      }

      if (url === '/dashboard/expense-ranking') {
        return Promise.resolve({ data: { data: { ranking: [] } } });
      }

      return Promise.resolve({ data: { data: { summary: {} } } });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('navega para lancamentos com status e due=today, due=week e due=month', async () => {
    render(<DashboardV2Page />);

    expect(await screen.findByText('Conta hoje')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas' }));
    expect(pushMock).toHaveBeenLastCalledWith('/dashboard/transactions?status=pending,overdue&due=today');

    fireEvent.click(screen.getByRole('button', { name: 'Semana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas' }));
    expect(pushMock).toHaveBeenLastCalledWith('/dashboard/transactions?status=pending,overdue&due=week');

    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas' }));
    expect(pushMock).toHaveBeenLastCalledWith('/dashboard/transactions?status=pending,overdue&due=month');
  });

  it('fecha o lembrete e salva no localStorage do dia', async () => {
    render(<DashboardV2Page />);

    const closeButton = await screen.findByRole('button', { name: 'Fechar lembrete' });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Fechar lembrete' })).not.toBeInTheDocument();
    });
    expect(window.localStorage.setItem).toHaveBeenCalledWith(expect.stringContaining('utop-dashboard-reminder-dismissed-'), 'true');
  });
});
