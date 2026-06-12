import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationBell from '@/components/NotificationBell';
import api from '@/lib/api';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function makeNotification(overrides = {}) {
  return {
    id: 'not-1',
    type: 'payment_due',
    title: 'Conta vence hoje',
    message: 'Existe uma conta pendente para hoje.',
    isRead: false,
    priority: 'high',
    createdAt: '2026-06-11T12:00:00.000Z',
    actionUrl: '/dashboard/recurring-bills',
    ...overrides,
  };
}

function mockNotifications(count: number, notifications = [makeNotification()]) {
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/notifications/unread-count') {
      return Promise.resolve({ data: { data: { count } } });
    }
    if (url === '/notifications') {
      return Promise.resolve({
        data: {
          data: {
            unreadCount: count,
            notifications,
          },
        },
      });
    }
    return Promise.reject(new Error(`Unexpected url ${url}`));
  });
}

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.patch.mockResolvedValue({ data: { data: {} } });
    mockedApi.delete.mockResolvedValue({ data: { data: {} } });
  });

  it('abre e fecha o painel carregando notificacoes reais', async () => {
    mockNotifications(1);

    render(<NotificationBell />);

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/notifications/unread-count'));
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/notifications', { params: { limit: 10 } }));
    expect(screen.getByText('Conta vence hoje')).toBeInTheDocument();
    expect(screen.getByText('Existe uma conta pendente para hoje.')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Fechar notificações'));
    expect(screen.queryByText('Conta vence hoje')).not.toBeInTheDocument();
  });

  it('mostra estado vazio sem ponto fixo quando nao ha nao lidas', async () => {
    mockNotifications(0, []);

    render(<NotificationBell />);

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/notifications/unread-count'));
    expect(screen.queryByText('1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    await waitFor(() => expect(screen.getByText('Nenhuma notificação')).toBeInTheDocument());
    expect(screen.queryByText(/não lida/)).not.toBeInTheDocument();
  });

  it('marca notificacao como lida, marca todas e remove mantendo contador real', async () => {
    mockNotifications(2);

    render(<NotificationBell />);

    fireEvent.click(await screen.findByRole('button', { name: 'Notificações' }));
    await screen.findByText('Conta vence hoje');

    fireEvent.click(screen.getByTitle('Marcar como lida'));
    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/notifications/not-1/read'));
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Marcar todas como lidas'));
    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/notifications/mark-all-read'));
    expect(screen.queryByText('1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Remover'));
    await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith('/notifications/not-1'));
  });

  it('Ver todas navega com router.push e fecha o painel', async () => {
    mockNotifications(1);

    render(<NotificationBell />);

    fireEvent.click(await screen.findByRole('button', { name: 'Notificações' }));
    await screen.findByText('Conta vence hoje');

    fireEvent.click(screen.getByText('Ver todas as notificações'));

    expect(pushMock).toHaveBeenCalledWith('/dashboard/notifications');
    expect(screen.queryByText('Conta vence hoje')).not.toBeInTheDocument();
  });

  it('Ver detalhes com rota interna valida usa router.push e marca como lida', async () => {
    mockNotifications(1, [makeNotification({ actionUrl: '/dashboard/bank-accounts' })]);

    render(<NotificationBell />);

    fireEvent.click(await screen.findByRole('button', { name: 'Notificações' }));
    await screen.findByText('Conta vence hoje');

    fireEvent.click(screen.getByText('Ver detalhes'));

    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/notifications/not-1/read'));
    expect(pushMock).toHaveBeenCalledWith('/dashboard/bank-accounts');
    expect(window.location.href).not.toContain('/login');
  });

  it('rejeita rota externa usando fallback seguro', async () => {
    mockNotifications(1, [
      makeNotification({ id: 'external', actionUrl: 'https://api.utopsistema.com.br/health' }),
    ]);

    render(<NotificationBell />);

    fireEvent.click(await screen.findByRole('button', { name: 'Notificações' }));
    await screen.findByText('Conta vence hoje');

    fireEvent.click(screen.getByText('Ver detalhes'));
    await waitFor(() => expect(pushMock).toHaveBeenLastCalledWith('/dashboard/notifications'));
  });

  it('normaliza rota antiga de transacao', async () => {
    mockNotifications(1, [makeNotification({ actionUrl: '/transactions/tx-123' })]);

    render(<NotificationBell />);

    fireEvent.click(await screen.findByRole('button', { name: 'Notificações' }));
    await screen.findByText('Conta vence hoje');

    fireEvent.click(screen.getByText('Ver detalhes'));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard/transactions?focus=tx-123'));
  });

  it('erro ao marcar como lida no detalhe nao limpa sessao nem impede navegacao segura', async () => {
    mockNotifications(1, [makeNotification({ actionUrl: '/dashboard/budgets' })]);
    mockedApi.patch.mockRejectedValueOnce(new Error('network'));
    const clearSpy = jest.spyOn(window.localStorage.__proto__, 'clear');

    render(<NotificationBell />);

    fireEvent.click(await screen.findByRole('button', { name: 'Notificações' }));
    await screen.findByText('Conta vence hoje');

    fireEvent.click(screen.getByText('Ver detalhes'));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard/budgets'));
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('nao quebra o header quando a API falha', async () => {
    mockedApi.get.mockRejectedValue(new Error('network'));

    render(<NotificationBell />);

    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/notifications', { params: { limit: 10 } }));
    expect(screen.getByRole('button', { name: 'Notificações' })).toBeInTheDocument();
  });
});
