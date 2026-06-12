import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransactionsPage from '@/app/dashboard/transactions/page';
import api from '@/lib/api';

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
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

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

const categories = [
  { id: 'cat-food', name: 'Alimentacao', type: 'expense', icon: 'A', color: '#10b981', level: 1 },
];

const bankAccounts = [
  { id: 'acc-1', name: 'Conta', type: 'checking', institution: 'Banco', currentBalance: 1000 },
];

const paymentMethods = [
  { id: 'pay-1', name: 'Pix', type: 'pix' },
];

function mockTransactionsPageRequests() {
  const transactions: any[] = [];

  mockedApi.get.mockImplementation((url: string) => {
    if (url.startsWith('/transactions/ai-status')) {
      return Promise.resolve({ data: { data: { available: false } } });
    }

    if (url.startsWith('/transactions')) {
      return Promise.resolve({ data: { data: { transactions } } });
    }

    if (url.startsWith('/recurring-bills/occurrences')) {
      return Promise.resolve({ data: { data: { occurrences: [] } } });
    }

    if (url.startsWith('/installments')) {
      return Promise.resolve({ data: { data: { purchases: [] } } });
    }

    if (url.startsWith('/categories')) {
      return Promise.resolve({ data: { data: { categories } } });
    }

    if (url.startsWith('/bank-accounts')) {
      return Promise.resolve({ data: { data: { accounts: bankAccounts } } });
    }

    if (url.startsWith('/payment-methods')) {
      return Promise.resolve({ data: { data: { methods: paymentMethods } } });
    }

    return Promise.resolve({ data: { data: {} } });
  });

  mockedApi.post.mockImplementation((url: string, payload: any) => {
    if (url === '/transactions') {
      transactions.push({
        id: `tx-${transactions.length + 1}`,
        amount: String(payload.amount),
        description: payload.description,
        type: payload.type,
        transactionDate: payload.transactionDate,
        status: payload.status,
        notes: payload.notes || '',
        categoryId: payload.categoryId,
        bankAccountId: payload.bankAccountId,
        paymentMethodId: payload.paymentMethodId,
        categorySplits: [],
        category: categories[0],
        bankAccount: bankAccounts[0],
        paymentMethod: paymentMethods[0],
        createdAt: '2026-06-12T12:00:00.000Z',
      });
    }

    return Promise.resolve({ data: { data: { id: 'tx-1' } } });
  });
}

describe('Transactions create modal multiple mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionsPageRequests();
  });

  it('mantem modo multiplos, bloqueios e campos travados apos salvar e atualizar a lista', async () => {
    render(<TransactionsPage />);

    await waitFor(() => expect(screen.queryByText('Carregando transações...')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Nova Transação/i }));
    expect(await screen.findByRole('heading', { name: /Nova Transação/i })).toBeInTheDocument();

    const multipleButton = screen.getByRole('button', { name: /Múltiplos/i });
    fireEvent.click(multipleButton);

    fireEvent.change(screen.getAllByPlaceholderText('0,00')[0], { target: { value: '123.45' } });
    fireEvent.change(screen.getByPlaceholderText(/Ex: Salário, Aluguel, Compras/i), { target: { value: 'Despesa fixa' } });

    fireEvent.focus(screen.getByPlaceholderText('Buscar categoria...'));
    fireEvent.click(screen.getByText('Alimentacao'));

    fireEvent.change(screen.getByDisplayValue('Selecione uma conta'), { target: { value: 'acc-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Meio de Pagamento' }));
    fireEvent.click(screen.getByText('Pix'));

    fireEvent.click(screen.getByRole('button', { name: 'Bloquear descrição' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear conta bancária' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear meio de pagamento' }));

    fireEvent.click(screen.getByRole('button', { name: /Criar Transação/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/transactions', expect.objectContaining({
      amount: 123.45,
      description: 'Despesa fixa',
      categoryId: 'cat-food',
      bankAccountId: 'acc-1',
      paymentMethodId: 'pay-1',
    })));

    await waitFor(() => expect(screen.getByText('Despesa fixa')).toBeInTheDocument());
    expect(screen.queryByText('Carregando transações...')).not.toBeInTheDocument();
    expect(screen.getByText('Modo Múltiplos Lançamentos')).toBeInTheDocument();
    expect(multipleButton).toHaveClass('bg-amber-500');
    expect(screen.getByRole('button', { name: 'Desbloquear descrição' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desbloquear conta bancária' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desbloquear meio de pagamento' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ex: Salário, Aluguel, Compras/i)).toHaveValue('Despesa fixa');
    expect(screen.getByDisplayValue('Conta - Banco')).toHaveValue('acc-1');
    expect(screen.getByRole('button', { name: 'Meio de Pagamento' })).toHaveTextContent('Pix');
    expect(screen.getAllByPlaceholderText('0,00')[0]).toHaveValue(null);

    expect(screen.getByRole('heading', { name: /Nova Transação/i })).toBeInTheDocument();
  });
});
