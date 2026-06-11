import { renderHook, act, waitFor } from '@testing-library/react';
import useInstallments from '@/hooks/useInstallments';
import apiClient from '@/lib/api';
import { toast } from 'sonner';

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
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;
const mockedToast = toast as unknown as { success: jest.Mock; error: jest.Mock };

describe('useInstallments', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedApi.get.mockImplementation((url: string) => {
      if (url.startsWith('/installments')) {
        return Promise.resolve({ data: { data: { purchases: [] } } });
      }
      if (url.startsWith('/transactions')) {
        return Promise.resolve({ data: { data: { transactions: [] } } });
      }
      if (url.startsWith('/recurring-bills')) {
        return Promise.resolve({ data: { data: { recurringBills: [] } } });
      }
      if (url.startsWith('/categories')) {
        return Promise.resolve({ data: { data: { categories: [] } } });
      }
      if (url.startsWith('/bank-accounts')) {
        return Promise.resolve({ data: { data: { accounts: [] } } });
      }
      if (url.startsWith('/payment-methods')) {
        return Promise.resolve({ data: { data: { paymentMethods: [] } } });
      }
      return Promise.resolve({ data: { data: {} } });
    });
  });

  it('usa POST para pagar parcela e recarrega os dados', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() => useInstallments());

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/installments');
    });

    const initialGetCalls = mockedApi.get.mock.calls.length;

    await act(async () => {
      await result.current.handlePayInstallment('purchase-1', 'installment-9');
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/installments/purchase-1/installments/installment-9/pay');
    expect(mockedApi.put).not.toHaveBeenCalled();
    expect(mockedApi.get.mock.calls.length).toBeGreaterThan(initialGetCalls);
    expect(mockedToast.success).toHaveBeenCalledWith('Parcela marcada como paga!');
  });

  it('exibe erro quando pagamento da parcela falha', async () => {
    mockedApi.post.mockRejectedValue({
      response: { data: { message: 'Falha ao pagar' } },
    });

    const { result } = renderHook(() => useInstallments());

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/installments');
    });

    await act(async () => {
      await result.current.handlePayInstallment('purchase-2', 'installment-2');
    });

    expect(mockedToast.error).toHaveBeenCalledWith('Falha ao pagar');
  });
});
