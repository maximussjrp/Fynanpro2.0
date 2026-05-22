import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewTransactionModal from '@/components/NewTransactionModal';
import api from '@/lib/api';

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('NewTransactionModal category splits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockImplementation((url: string) => {
      if (url.startsWith('/categories')) {
        return Promise.resolve({
          data: {
            data: {
              categories: [
                { id: 'cat-food', name: 'Alimentacao', type: 'expense', icon: 'A', color: '#10b981', level: 1 },
                { id: 'cat-delivery', name: 'Delivery', type: 'expense', icon: 'D', color: '#2563eb', level: 1 },
              ],
            },
          },
        });
      }
      if (url.startsWith('/bank-accounts')) {
        return Promise.resolve({ data: { data: { accounts: [{ id: 'acc-1', name: 'Conta', type: 'bank', institution: 'Banco' }] } } });
      }
      if (url.startsWith('/payment-methods')) {
        return Promise.resolve({ data: { data: { methods: [] } } });
      }
      return Promise.resolve({ data: { data: {} } });
    });

    mockedApi.put.mockResolvedValue({ data: { success: true } } as any);
  });

  it('loads saved splits on edit and submits categorySplits', async () => {
    render(
      <NewTransactionModal
        isOpen
        onClose={jest.fn()}
        onSuccess={jest.fn()}
        transaction={{
          id: 'tx-1',
          amount: '50',
          description: 'iFood',
          type: 'expense',
          transactionDate: '2026-05-21T12:00:00.000Z',
          status: 'completed',
          notes: '',
          categoryId: 'cat-food',
          bankAccountId: 'acc-1',
          paymentMethodId: undefined,
          bankAccount: { id: 'acc-1', name: 'Conta', type: 'bank', currentBalance: 0, institution: 'Banco' },
          categorySplits: [
            { categoryId: 'cat-food', amount: 30, note: 'refeicao', category: { id: 'cat-food', name: 'Alimentacao', type: 'expense', icon: 'A', color: '#10b981' } },
            { categoryId: 'cat-delivery', amount: 20, note: 'entrega', category: { id: 'cat-delivery', name: 'Delivery', type: 'expense', icon: 'D', color: '#2563eb' } },
          ],
        }}
      />
    );

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/categories?isActive=true'));

    expect(screen.getByText(/Dividido em 2 categorias/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Atualizar/ }));

    await waitFor(() =>
      expect(mockedApi.put).toHaveBeenCalledWith('/transactions/tx-1', expect.objectContaining({
        amount: 50,
        categoryId: 'cat-food',
        categorySplits: [
          { categoryId: 'cat-food', amount: 30, note: 'refeicao' },
          { categoryId: 'cat-delivery', amount: 20, note: 'entrega' },
        ],
      }))
    );
  });
});
