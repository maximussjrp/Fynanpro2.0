import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationsPage from '@/app/dashboard/notifications/page';
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

function mockPage(notifications = [makeNotification()], unreadCount = 1, totalPages = 1) {
  mockedApi.get.mockResolvedValue({
    data: {
      data: {
        notifications,
        unreadCount,
        pagination: {
          page: 1,
          limit: 50,
          total: notifications.length,
          totalPages,
        },
      },
    },
  });
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.patch.mockResolvedValue({ data: { data: {} } });
    mockedApi.delete.mockResolvedValue({ data: { data: {} } });
  });

  it('renderiza loading e lista notificacoes lidas e nao lidas', async () => {
    mockPage([
      makeNotification(),
      makeNotification({ id: 'not-2', title: 'Lida', isRead: true, actionUrl: '/dashboard/bank-accounts' }),
    ]);

    render(<NotificationsPage />);

    expect(screen.getByText('Carregando notificações...')).toBeInTheDocument();
    await screen.findByText('Conta vence hoje');

    expect(mockedApi.get).toHaveBeenCalledWith('/notifications', { params: { limit: 50, page: 1 } });
    expect(screen.getByText('Lida')).toBeInTheDocument();
    expect(screen.getByText('Não lida')).toBeInTheDocument();
  });

  it('mostra estado vazio', async () => {
    mockPage([], 0);

    render(<NotificationsPage />);

    await screen.findByText('Nenhuma notificação');
    expect(screen.getByText('Quando houver alertas, eles aparecerão aqui.')).toBeInTheDocument();
  });

  it('marca uma, marca todas e remove', async () => {
    mockPage();

    render(<NotificationsPage />);

    await screen.findByText('Conta vence hoje');

    fireEvent.click(screen.getByText('Marcar todas como lidas'));
    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/notifications/mark-all-read'));
  });

  it('marca uma e remove', async () => {
    mockPage();

    render(<NotificationsPage />);

    await screen.findByText('Conta vence hoje');

    fireEvent.click(screen.getByText('Marcar como lida'));
    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/notifications/not-1/read'));

    fireEvent.click(screen.getByText('Remover'));
    await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith('/notifications/not-1'));
  });

  it('abre detalhe com rota segura e fallback de rota invalida', async () => {
    mockPage([
      makeNotification({ id: 'valid', actionUrl: '/dashboard/bank-accounts' }),
      makeNotification({ id: 'invalid', title: 'Antiga sem destino', actionUrl: 'https://api.utopsistema.com.br/x' }),
    ], 2);

    render(<NotificationsPage />);

    await screen.findByText('Conta vence hoje');

    fireEvent.click(screen.getAllByText('Ver detalhes')[0]);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard/bank-accounts'));

    fireEvent.click(screen.getAllByText('Ver detalhes')[1]);
    await waitFor(() => expect(pushMock).toHaveBeenLastCalledWith('/dashboard/notifications'));
  });

  it('mostra erro de API e permite tentar novamente', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('network'));

    render(<NotificationsPage />);

    await screen.findByText('Não foi possível carregar suas notificações.');
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
  });

  it('renderiza controles responsivos basicos e paginacao', async () => {
    mockPage([makeNotification()], 1, 2);

    render(<NotificationsPage />);

    await screen.findByText('Conta vence hoje');
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getByText('Próxima')).toBeInTheDocument();
    expect(screen.getByText('Anterior')).toBeInTheDocument();
  });
});
