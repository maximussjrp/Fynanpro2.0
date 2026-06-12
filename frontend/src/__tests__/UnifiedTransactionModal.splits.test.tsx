import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const bankAccounts = [{ id: 'acc-1', name: 'Conta', type: 'checking', institution: 'Banco' }];
const paymentMethods = [{ id: 'pay-1', name: 'Pix', type: 'pix' }];

function mockFormDataRequests() {
  mockedApi.get.mockImplementation((url: string) => {
    if (url.startsWith('/categories')) {
      return Promise.resolve({ data: { data: { categories } } });
    }
    if (url.startsWith('/bank-accounts')) {
      return Promise.resolve({ data: { data: { accounts: bankAccounts } } });
    }
    if (url.startsWith('/payment-methods')) {
      return Promise.resolve({ data: { data: { methods: paymentMethods } } });
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

  it('preserva descricao e observacoes bloqueadas no modo multiplos entre envios sequenciais', async () => {
    render(<UnifiedTransactionModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/categories?isActive=true'));

    fireEvent.click(screen.getByRole('button', { name: /Múltiplos/i }));

    fireEvent.change(screen.getAllByPlaceholderText('0,00')[0], { target: { value: '100' } });
    fireEvent.change(screen.getByDisplayValue('Selecione uma conta'), { target: { value: 'acc-1' } });
    fireEvent.change(screen.getByPlaceholderText(/Ex: Salário, Aluguel, Compras/i), { target: { value: 'Descricao fixa' } });
    fireEvent.change(screen.getByPlaceholderText(/Adicione notas ou observações/i), { target: { value: 'Nota fixa' } });

    const descriptionHeader = screen.getByText('Descrição').parentElement as HTMLElement;
    fireEvent.click(within(descriptionHeader).getByTitle('Bloquear campo (será mantido após salvar)'));

    const notesHeader = screen.getByText('Observações', { exact: false }).parentElement as HTMLElement;
    fireEvent.click(within(notesHeader).getByTitle('Bloquear campo (será mantido após salvar)'));

    fireEvent.click(screen.getByRole('checkbox', { name: /Dividir/i }));
    fireEvent.change(screen.getByLabelText('Categoria do rateio'), { target: { value: 'cat-food' } });
    fireEvent.change(screen.getByLabelText('Valor do rateio'), { target: { value: '100' } });

    fireEvent.click(screen.getByRole('button', { name: /Criar Transação/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/transactions', expect.objectContaining({
        description: 'Descricao fixa',
        notes: 'Nota fixa',
      }));
    });

    expect(screen.getByPlaceholderText(/Ex: Salário, Aluguel, Compras/i)).toHaveValue('Descricao fixa');
    expect(screen.getByPlaceholderText(/Adicione notas ou observações/i)).toHaveValue('Nota fixa');

    fireEvent.change(screen.getAllByPlaceholderText('0,00')[0], { target: { value: '80' } });
    fireEvent.change(screen.getByDisplayValue('Selecione uma conta'), { target: { value: 'acc-1' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Dividir/i }));
    fireEvent.change(screen.getByLabelText('Categoria do rateio'), { target: { value: 'cat-food' } });
    fireEvent.change(screen.getByLabelText('Valor do rateio'), { target: { value: '80' } });

    fireEvent.click(screen.getByRole('button', { name: /Criar Transação/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenLastCalledWith('/transactions', expect.objectContaining({
        description: 'Descricao fixa',
        notes: 'Nota fixa',
      }));
    });
  });

  it('preserva todos os campos bloqueados no modo multiplos depois do submit e refresh do pai', async () => {
    const onSuccess = jest.fn();
    render(<UnifiedTransactionModal isOpen onClose={jest.fn()} onSuccess={onSuccess} />);

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/categories?isActive=true'));

    fireEvent.click(screen.getByRole('button', { name: /Múltiplos/i }));

    fireEvent.change(screen.getAllByPlaceholderText('0,00')[0], { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Data da transação'), { target: { value: '2026-06-11' } });
    fireEvent.change(screen.getByPlaceholderText(/Ex: Salário, Aluguel, Compras/i), { target: { value: 'Cliente fixo' } });

    const categoryInput = screen.getByPlaceholderText('Buscar categoria...');
    fireEvent.focus(categoryInput);
    fireEvent.click(screen.getByText('Alimentacao'));

    fireEvent.change(screen.getByDisplayValue('Selecione uma conta'), { target: { value: 'acc-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Meio de Pagamento' }));
    fireEvent.click(screen.getByText('Pix'));
    fireEvent.click(screen.getByLabelText('Pendente'));
    fireEvent.change(screen.getByPlaceholderText(/Adicione notas ou observações/i), { target: { value: 'Nota fixa' } });

    fireEvent.click(screen.getByRole('button', { name: 'Bloquear tipo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear descrição' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear categoria' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear conta bancária' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear meio de pagamento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear status' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear observações' }));

    fireEvent.click(screen.getByRole('button', { name: /Criar Transação/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/transactions', expect.objectContaining({
      type: 'expense',
      amount: 150,
      transactionDate: '2026-06-11',
      description: 'Cliente fixo',
      categoryId: 'cat-food',
      bankAccountId: 'acc-1',
      paymentMethodId: 'pay-1',
      status: 'pending',
      notes: 'Nota fixa',
    })));

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Despesa' })).toBeDisabled();
    expect(screen.getByLabelText('Data da transação')).toHaveValue('2026-06-11');
    expect(screen.getByPlaceholderText(/Ex: Salário, Aluguel, Compras/i)).toHaveValue('Cliente fixo');
    expect(screen.getByPlaceholderText('Buscar categoria...')).toHaveValue('Alimentacao');
    expect(screen.getByDisplayValue('Conta - Banco')).toHaveValue('acc-1');
    expect(screen.getByRole('button', { name: 'Meio de Pagamento' })).toHaveTextContent('Pix');
    expect(screen.getByLabelText('Pendente')).toBeChecked();
    expect(screen.getByPlaceholderText(/Adicione notas ou observações/i)).toHaveValue('Nota fixa');
    expect(screen.getAllByPlaceholderText('0,00')[0]).toHaveValue(null);

    expect(screen.getByRole('button', { name: 'Desbloquear tipo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desbloquear data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desbloquear categoria' })).toBeInTheDocument();

    fireEvent.change(screen.getAllByPlaceholderText('0,00')[0], { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar Transação/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenLastCalledWith('/transactions', expect.objectContaining({
      type: 'expense',
      amount: 80,
      transactionDate: '2026-06-11',
      description: 'Cliente fixo',
      categoryId: 'cat-food',
      bankAccountId: 'acc-1',
      paymentMethodId: 'pay-1',
      status: 'pending',
      notes: 'Nota fixa',
    })));
  });

  it('limpa campos nao bloqueados no modo multiplos depois do submit', async () => {
    render(<UnifiedTransactionModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/categories?isActive=true'));

    fireEvent.click(screen.getByRole('button', { name: /Múltiplos/i }));
    fireEvent.change(screen.getAllByPlaceholderText('0,00')[0], { target: { value: '90' } });
    fireEvent.change(screen.getByPlaceholderText(/Ex: Salário, Aluguel, Compras/i), { target: { value: 'Descricao temporaria' } });

    fireEvent.focus(screen.getByPlaceholderText('Buscar categoria...'));
    fireEvent.click(screen.getByText('Alimentacao'));
    fireEvent.change(screen.getByDisplayValue('Selecione uma conta'), { target: { value: 'acc-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Meio de Pagamento' }));
    fireEvent.click(screen.getByText('Pix'));
    fireEvent.change(screen.getByPlaceholderText(/Adicione notas ou observações/i), { target: { value: 'Nota temporaria' } });

    fireEvent.click(screen.getByRole('button', { name: /Criar Transação/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/transactions', expect.objectContaining({
      amount: 90,
      description: 'Descricao temporaria',
      categoryId: 'cat-food',
      bankAccountId: 'acc-1',
      paymentMethodId: 'pay-1',
      notes: 'Nota temporaria',
    })));

    expect(screen.getAllByPlaceholderText('0,00')[0]).toHaveValue(null);
    expect(screen.getByPlaceholderText(/Ex: Salário, Aluguel, Compras/i)).toHaveValue('');
    expect(screen.getByPlaceholderText('Buscar categoria...')).toHaveValue('');
    expect(screen.getByDisplayValue('Selecione uma conta')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Meio de Pagamento' })).toHaveTextContent('Selecione (opcional)');
    expect(screen.getByPlaceholderText(/Adicione notas ou observações/i)).toHaveValue('');
  });

  it('troca de aba ajusta status quando ele nao esta bloqueado', async () => {
    render(<UnifiedTransactionModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/categories?isActive=true'));

    expect(screen.getByLabelText('Pago')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Recorrente/i }));
    expect(screen.queryByLabelText('Pago')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Única/i }));
    expect(screen.getByLabelText('Pago')).toBeChecked();
  });
});
