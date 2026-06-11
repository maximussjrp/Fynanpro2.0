import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import TransactionsPage from '@/app/dashboard/transactions/page';
import api from '@/lib/api';
import { toast } from 'sonner';

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

const mockedApi = api as jest.Mocked<typeof api>;
const mockedToast = toast as unknown as { success: jest.Mock; error: jest.Mock };

describe('Transactions delete routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const today = new Date().toISOString().split('T')[0];

    mockedApi.get.mockImplementation((url: string) => {
      if (url.startsWith('/transactions')) {
        return Promise.resolve({
          data: {
            data: {
              transactions: [
                {
                  id: 'tx-1',
                  amount: '150',
                  description: 'Transacao Unica',
                  type: 'expense',
                  transactionDate: today,
                  status: 'pending',
                  notes: '',
                  categoryId: 'cat-1',
                  bankAccountId: 'acc-1',
                  paymentMethodId: 'pm-1',
                  categorySplits: [],
                  category: { id: 'cat-1', name: 'Mercado', type: 'expense', icon: 'M', color: '#333' },
                  bankAccount: { id: 'acc-1', name: 'Conta PF', type: 'bank', currentBalance: 1000 },
                  paymentMethod: { id: 'pm-1', name: 'Debito', type: 'debit' },
                  createdAt: `${today}T10:00:00.000Z`,
                },
              ],
            },
          },
        });
      }

      if (url === '/recurring-bills/occurrences') {
        return Promise.resolve({
          data: {
            data: {
              occurrences: [
                {
                  id: 'occ-1',
                  recurringBillId: 'rb-1',
                  amount: 90,
                  dueDate: today,
                  status: 'pending',
                  notes: '',
                  createdAt: `${today}T09:00:00.000Z`,
                  recurringBill: {
                    name: 'Assinatura Pro',
                    type: 'expense',
                    categoryId: 'cat-1',
                    bankAccountId: 'acc-1',
                    paymentMethodId: 'pm-1',
                    category: { id: 'cat-1', name: 'Mercado', type: 'expense', icon: 'M', color: '#333' },
                    bankAccount: { id: 'acc-1', name: 'Conta PF', type: 'bank', currentBalance: 1000 },
                    paymentMethod: { id: 'pm-1', name: 'Debito', type: 'debit' },
                  },
                },
              ],
            },
          },
        });
      }

      if (url === '/installments') {
        return Promise.resolve({ data: { data: { purchases: [] } } });
      }

      if (url === '/categories?isActive=true') {
        return Promise.resolve({ data: { data: { categories: [] } } });
      }

      if (url === '/bank-accounts?isActive=true') {
        return Promise.resolve({ data: { data: { accounts: [] } } });
      }

      if (url === '/payment-methods?isActive=true') {
        return Promise.resolve({ data: { data: { methods: [] } } });
      }

      return Promise.resolve({ data: { data: {} } });
    });
  });

  it('bloqueia exclusao individual de item legado de recorrencia sem chamar endpoint de transacoes', async () => {
    render(<TransactionsPage />);

    const recurringLabel = await screen.findByText('Assinatura Pro');
    const recurringRow = recurringLabel.closest('tr');
    expect(recurringRow).not.toBeNull();

    fireEvent.click(within(recurringRow as HTMLElement).getByTitle('Excluir'));

    expect(mockedApi.delete).not.toHaveBeenCalled();
    expect(mockedToast.error).toHaveBeenCalledWith('Este lançamento foi gerado por uma recorrência/parcela. A exclusão individual ainda não está disponível com segurança para este tipo.');
  });

  it('mantem exclusao normal via /transactions/:id para transacao unificada', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<TransactionsPage />);

    const regularLabel = await screen.findByText('Transacao Unica');
    const regularRow = regularLabel.closest('tr');
    expect(regularRow).not.toBeNull();

    fireEvent.click(within(regularRow as HTMLElement).getByTitle('Excluir'));

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith('/transactions/tx-1');
    });

    expect(mockedToast.success).toHaveBeenCalledWith('Transação excluída com sucesso!');
    confirmSpy.mockRestore();
  });
});
