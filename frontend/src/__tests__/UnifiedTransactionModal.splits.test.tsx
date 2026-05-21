import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UnifiedTransactionModal from '@/components/UnifiedTransactionModal';
import api from '@/lib/api';

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
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

const categories = [
  { id: 'cat-food', name: 'Alimentacao', type: 'expense', icon: 'A', color: '#10b981', level: 1 },
  { id: 'cat-hygiene', name: 'Higiene', type: 'expense', icon: 'H', color: '#3b82f6', level: 1 },
];

function mockFormDataRequests() {
  mockedApi.get.mockImplementation((url: string) => {
    if (url.startsWith('/categories')) {
      return Promise.resolve({ data: { data: { categories } } });
    }
    if (url.startsWith('/bank-accounts')) {
      return Promise.resolve({ data: { data: { accounts: [{ id: 'acc-1', name: 'Conta', type: 'checking', institution: 'Banco' }] } } });
    }
    if (url.startsWith('/payment-methods')) {
      return Promise.resolve({ data: { data: { methods: [] } } });
    }
    if (url.startsWith('/transactions/ai-status')) {
      return Promise.resolve({ data: { data: { available: false } } });
    }
    return Promise.resolve({ data: { data: {} } });
  });
  mockedApi.post.mockResolvedValue({ data: { data: { id: 'tx-1' } } });
}

describe('UnifiedTransactionModal category splits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFormDataRequests();
  });

  it('shows split rows, totals and blocks save when the split total does not match', async () => {
    render(<UnifiedTransactionModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/categories?isActive=true'));

    fireEvent.change(screen.getAllByPlaceholderText('0,00')[0], { target: { value: '230' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Dividir/ }));
    fireEvent.change(screen.getByLabelText('Categoria do rateio'), { target: { value: 'cat-food' } });
    fireEvent.change(screen.getByLabelText('Valor do rateio'), { target: { value: '100' } });

    expect(screen.getByLabelText('Categoria do rateio')).toBeInTheDocument();
    expect(screen.getByText('Valor total')).toBeInTheDocument();
    expect(screen.getByText('Dividido')).toBeInTheDocument();
    expect(screen.getByText('Falta dividir')).toBeInTheDocument();
    expect(screen.getByText('A soma das categorias precisa ser igual ao valor total do lançamento.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar/ })).toBeDisabled();
  });

  it('submits categorySplits when the split total matches the transaction amount', async () => {
    const onSuccess = jest.fn();
    render(<UnifiedTransactionModal isOpen onClose={jest.fn()} onSuccess={onSuccess} />);

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/categories?isActive=true'));

    fireEvent.change(screen.getAllByPlaceholderText('0,00')[0], { target: { value: '230' } });
    fireEvent.change(screen.getByDisplayValue('Selecione uma conta'), { target: { value: 'acc-1' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Dividir/ }));

    fireEvent.change(screen.getByLabelText('Categoria do rateio'), { target: { value: 'cat-food' } });
    fireEvent.change(screen.getByLabelText('Valor do rateio'), { target: { value: '160' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar categoria/ }));

    const splitCategories = screen.getAllByLabelText('Categoria do rateio');
    const splitAmounts = screen.getAllByLabelText('Valor do rateio');
    fireEvent.change(splitCategories[1], { target: { value: 'cat-hygiene' } });
    fireEvent.change(splitAmounts[1], { target: { value: '70' } });

    const submit = screen.getByRole('button', { name: /Criar/ });
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/transactions', expect.objectContaining({
      amount: 230,
      bankAccountId: 'acc-1',
      categoryId: 'cat-food',
      categorySplits: [
        { categoryId: 'cat-food', amount: 160, note: undefined },
        { categoryId: 'cat-hygiene', amount: 70, note: undefined },
      ],
    })));
    expect(onSuccess).toHaveBeenCalled();
  });
});
