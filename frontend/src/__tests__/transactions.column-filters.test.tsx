import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransactionsPage from '@/app/dashboard/transactions/page';

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

import api from '@/lib/api';

describe('Transactions column filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('/transactions')) {
        return Promise.resolve({
          data: {
            data: {
              transactions: [
                {
                  id: 'tx-split',
                  amount: '100',
                  description: 'Transacao Split Supermercado',
                  type: 'expense',
                  transactionDate: '2026-05-10',
                  status: 'pending',
                  notes: '',
                  categoryId: 'cat-main',
                  bankAccountId: 'acc-1',
                  paymentMethodId: 'pm-1',
                  categorySplits: [
                    { categoryId: 'cat-food', amount: '60', category: { id: 'cat-food', name: 'Alimentacao', icon: '🍽️' } },
                    { categoryId: 'cat-hygiene', amount: '40', category: { id: 'cat-hygiene', name: 'Higiene', icon: '🧼' } },
                  ],
                  category: { id: 'cat-main', name: 'Mercado', type: 'expense', icon: '🛒', color: '#333' },
                  bankAccount: { id: 'acc-1', name: 'Conta PF', type: 'bank', currentBalance: 1000 },
                  paymentMethod: { id: 'pm-1', name: 'Debito', type: 'debit' },
                  createdAt: '2026-05-10T10:00:00.000Z',
                },
                {
                  id: 'tx-simple',
                  amount: '50',
                  description: 'Transacao Simples Alimentacao',
                  type: 'expense',
                  transactionDate: '2026-05-11',
                  status: 'pending',
                  notes: '',
                  categoryId: 'cat-food',
                  bankAccountId: 'acc-1',
                  paymentMethodId: 'pm-1',
                  categorySplits: [],
                  category: { id: 'cat-food', name: 'Alimentacao', type: 'expense', icon: '🍽️', color: '#444' },
                  bankAccount: { id: 'acc-1', name: 'Conta PF', type: 'bank', currentBalance: 1000 },
                  paymentMethod: { id: 'pm-1', name: 'Debito', type: 'debit' },
                  createdAt: '2026-05-11T10:00:00.000Z',
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
        return Promise.resolve({
          data: {
            data: {
              categories: [
                { id: 'cat-main', name: 'Mercado', type: 'expense', icon: '🛒' },
                { id: 'cat-food', name: 'Alimentacao', type: 'expense', icon: '🍽️' },
                { id: 'cat-hygiene', name: 'Higiene', type: 'expense', icon: '🧼' },
              ],
            },
          },
        });
      }

      if (url === '/bank-accounts?isActive=true') {
        return Promise.resolve({ data: { data: { accounts: [{ id: 'acc-1', name: 'Conta PF' }] } } });
      }

      if (url === '/payment-methods?isActive=true') {
        return Promise.resolve({ data: { data: { methods: [{ id: 'pm-1', name: 'Debito', type: 'debit' }] } } });
      }

      return Promise.resolve({ data: { data: {} } });
    });
  });

  it('aplica filtro de categoria por split e limpar filtros remove filtro por coluna', async () => {
    render(<TransactionsPage />);

    expect(await screen.findByText('Transacao Split Supermercado')).toBeInTheDocument();
    expect(await screen.findByText('Transacao Simples Alimentacao')).toBeInTheDocument();

    const categoryFilterButton = screen.getByRole('button', { name: 'Filtrar coluna Categoria' });
    fireEvent.click(categoryFilterButton);

    fireEvent.click(screen.getByRole('button', { name: /Higiene/i }));

    await waitFor(() => {
      expect(screen.getByText('Transacao Split Supermercado')).toBeInTheDocument();
      expect(screen.queryByText('Transacao Simples Alimentacao')).not.toBeInTheDocument();
    }, { timeout: 10000 });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Filtrar coluna Categoria' }).className).toContain('text-blue-600');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Abrir filtros gerais' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar Filtros' }));

    await waitFor(() => {
      expect(screen.getByText('Transacao Split Supermercado')).toBeInTheDocument();
      expect(screen.getByText('Transacao Simples Alimentacao')).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 20000);

  it('aplica filtro de descricao e valor, destaca icones e limpar/ver tudo limpam os filtros', async () => {
    render(<TransactionsPage />);

    expect(await screen.findByText('Transacao Split Supermercado')).toBeInTheDocument();
    expect(await screen.findByText('Transacao Simples Alimentacao')).toBeInTheDocument();

    const descriptionFilterButton = screen.getByRole('button', { name: 'Filtrar coluna Descrição' });
    fireEvent.click(descriptionFilterButton);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Filtro de descrição' }), {
      target: { value: 'split' },
    });

    await waitFor(() => {
      expect(screen.getByText('Transacao Split Supermercado')).toBeInTheDocument();
      expect(screen.queryByText('Transacao Simples Alimentacao')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Filtrar coluna Descrição' }).className).toContain('text-blue-600');
    });

    const amountFilterButton = screen.getByRole('button', { name: 'Filtrar coluna Valor' });
    fireEvent.click(amountFilterButton);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Filtro de valor' }), {
      target: { value: '100' },
    });

    await waitFor(() => {
      expect(screen.getByText('Transacao Split Supermercado')).toBeInTheDocument();
      expect(screen.queryByText('Transacao Simples Alimentacao')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Filtrar coluna Valor' }).className).toContain('text-blue-600');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Abrir filtros gerais' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar Filtros' }));

    await waitFor(() => {
      expect(screen.getByText('Transacao Split Supermercado')).toBeInTheDocument();
      expect(screen.getByText('Transacao Simples Alimentacao')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Filtrar coluna Descrição' }).className).not.toContain('text-blue-600');
      expect(screen.getByRole('button', { name: 'Filtrar coluna Valor' }).className).not.toContain('text-blue-600');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Filtrar coluna Descrição' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Filtro de descrição' }), {
      target: { value: 'simples' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Transacao Split Supermercado')).not.toBeInTheDocument();
      expect(screen.getByText('Transacao Simples Alimentacao')).toBeInTheDocument();
    });

    if (!screen.queryByRole('button', { name: 'Ver Tudo' })) {
      fireEvent.click(screen.getByRole('button', { name: 'Abrir filtros gerais' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Ver Tudo' }));

    await waitFor(() => {
      expect(screen.getByText('Transacao Split Supermercado')).toBeInTheDocument();
      expect(screen.getByText('Transacao Simples Alimentacao')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Filtrar coluna Descrição' }).className).not.toContain('text-blue-600');
    });
  }, 30000);
});
