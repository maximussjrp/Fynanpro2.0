import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationBell from '@/components/NotificationBell';
import api from '@/lib/api';

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

function mockUnreadCount(count: number) {
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/notifications/unread-count') {
      return Promise.resolve({ data: { data: { count } } });
    }
    if (url === '/notifications') {
      return Promise.resolve({
        data: {
          data: {
            unreadCount: count,
            notifications: [
              {
                id: 'not-1',
                type: 'payment_due',
                title: 'Conta vence hoje',
                message: 'Existe uma conta pendente para hoje.',
                isRead: false,
                priority: 'high',
                createdAt: '2026-06-11T12:00:00.000Z',
              },
            ],
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
    mockUnreadCount(1);

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
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/notifications/unread-count') {
        return Promise.resolve({ data: { data: { count: 0 } } });
      }
      if (url === '/notifications') {
        return Promise.resolve({ data: { data: { unreadCount: 0, notifications: [] } } });
      }
      return Promise.reject(new Error(`Unexpected url ${url}`));
    });

    render(<NotificationBell />);

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/notifications/unread-count'));
    expect(screen.queryByText('1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    await waitFor(() => expect(screen.getByText('Nenhuma notificação')).toBeInTheDocument());
    expect(screen.queryByText(/não lida/)).not.toBeInTheDocument();
  });

  it('marca notificacao como lida, marca todas e remove mantendo contador real', async () => {
    mockUnreadCount(2);

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

  it('nao quebra o header quando a API falha', async () => {
    mockedApi.get.mockRejectedValue(new Error('network'));

    render(<NotificationBell />);

    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/notifications', { params: { limit: 10 } }));
    expect(screen.getByRole('button', { name: 'Notificações' })).toBeInTheDocument();
  });
});
