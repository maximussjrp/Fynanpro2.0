import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransactionsPage from '@/app/dashboard/transactions/page';
import { DueFilter, getDuePeriod } from '@/lib/dashboard-due-reminders';
import api from '@/lib/api';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/stores/auth', () => ({
  useAuth: () => ({
    accessToken: 'token',
    isAuthenticated: true,
  }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/components/NewTransactionModal', () => () => null);
jest.mock('@/components/UnifiedTransactionModal', () => () => null);

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Transactions due query params', () => {
  let currentDueFilter: DueFilter = 'week';

  beforeEach(() => {
    jest.clearAllMocks();

    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('/transactions')) {
        const period = getDuePeriod(currentDueFilter);
        return Promise.resolve({
          data: {
            data: {
              transactions: [
                {
                  id: 'tx-week',
                  amount: '100',
                  description: 'Conta da semana',
                  type: 'expense',
                  transactionDate: period.startDate,
                  dueDate: period.startDate,
                  status: 'pending',
                  notes: '',
                  categoryId: 'cat-1',
                  bankAccountId: 'acc-1',
                  category: { id: 'cat-1', name: 'Casa', type: 'expense', icon: 'C', color: '#333' },
                  bankAccount: { id: 'acc-1', name: 'Conta PF', type: 'bank', currentBalance: 1000 },
                  createdAt: `${period.startDate}T10:00:00.000Z`,
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

      if (url === '/categories?isActive=true') {
        return Promise.resolve({ data: { data: { categories: [{ id: 'cat-1', name: 'Casa', type: 'expense', icon: 'C' }] } } });
      }

      if (url === '/bank-accounts?isActive=true') {
        return Promise.resolve({ data: { data: { accounts: [{ id: 'acc-1', name: 'Conta PF' }] } } });
      }

      if (url === '/payment-methods?isActive=true') {
        return Promise.resolve({ data: { data: { methods: [] } } });
      }

      return Promise.resolve({ data: { data: {} } });
    });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it.each<DueFilter>(['today', 'week', 'month'])('aplica due=%s e status pending,overdue sem quebrar filtros existentes', async (dueFilter) => {
    currentDueFilter = dueFilter;
    window.history.pushState({}, '', `/dashboard/transactions?status=pending,overdue&due=${dueFilter}`);

    render(<TransactionsPage />);

    expect(await screen.findByText('Conta da semana')).toBeInTheDocument();
    const expectedPeriod = getDuePeriod(dueFilter);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/transactions', {
        params: expect.objectContaining({
          startDate: expectedPeriod.startDate,
          endDate: expectedPeriod.endDate,
          limit: 10000,
        }),
      });
    });
  });
});
