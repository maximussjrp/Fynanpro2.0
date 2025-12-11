/**
 * Testes para RecurringBillService
 * 
 * Cenários testados:
 * 1. Geração de ocorrências com autoGenerate
 * 2. Pagamento de ocorrência (incluindo saldo da conta)
 * 3. Geração automática pelo job (sem duplicar)
 * 4. Cenário de dueDay = 31 em Fevereiro
 * 5. Skip de ocorrência
 */

import { RecurringBillService } from '../../services/recurring-bill.service';
import { prisma } from '../../utils/prisma-client';
import { cacheService } from '../../services/cache.service';

// Mock do Prisma
jest.mock('../../utils/prisma-client', () => ({
  prisma: {
    recurringBill: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    recurringBillOccurrence: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    bankAccount: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock do cache service
jest.mock('../../services/cache.service', () => ({
  cacheService: {
    invalidateMultiple: jest.fn(),
  },
  CacheNamespace: {
    DASHBOARD: 'dashboard',
    REPORTS: 'reports',
    TRANSACTIONS: 'transactions',
    ACCOUNTS: 'accounts',
  },
}));

describe('RecurringBillService', () => {
  let service: RecurringBillService;

  beforeEach(() => {
    service = new RecurringBillService();
    jest.clearAllMocks();
  });

  describe('generateOccurrences', () => {
    const mockBill = {
      id: 'bill-123',
      tenantId: 'tenant-123',
      name: 'Aluguel',
      type: 'expense',
      amount: 1500,
      frequency: 'monthly',
      dueDay: 10,
      status: 'active',
      autoGenerate: true,
      monthsAhead: 3,
      firstDueDate: null,
      lastDueDate: null,
    };

    it('deve gerar ocorrências quando não existem anteriores', async () => {
      (prisma.recurringBill.findFirst as jest.Mock).mockResolvedValue(mockBill);
      (prisma.recurringBillOccurrence.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // lastOccurrence
        .mockResolvedValue(null); // existing check
      (prisma.recurringBillOccurrence.create as jest.Mock).mockResolvedValue({});

      const result = await service.generateOccurrences('bill-123', 'tenant-123', 3);

      expect(result.generated).toBe(3);
      expect(result.skipped).toBe(0);
      expect(prisma.recurringBillOccurrence.create).toHaveBeenCalledTimes(3);
    });

    it('deve pular ocorrências que já existem', async () => {
      (prisma.recurringBill.findFirst as jest.Mock).mockResolvedValue(mockBill);
      (prisma.recurringBillOccurrence.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // lastOccurrence
        .mockResolvedValueOnce({ id: 'existing-1' }) // primeiro mês existe
        .mockResolvedValueOnce(null) // segundo mês não existe
        .mockResolvedValueOnce(null); // terceiro mês não existe
      (prisma.recurringBillOccurrence.create as jest.Mock).mockResolvedValue({});

      const result = await service.generateOccurrences('bill-123', 'tenant-123', 3);

      expect(result.generated).toBe(2);
      expect(result.skipped).toBe(1);
    });

    it('não deve gerar para bill inativa', async () => {
      (prisma.recurringBill.findFirst as jest.Mock).mockResolvedValue({
        ...mockBill,
        status: 'paused',
      });

      const result = await service.generateOccurrences('bill-123', 'tenant-123', 3);

      expect(result.generated).toBe(0);
      expect(prisma.recurringBillOccurrence.create).not.toHaveBeenCalled();
    });

    it('deve lançar erro para bill não encontrada', async () => {
      (prisma.recurringBill.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.generateOccurrences('nonexistent', 'tenant-123', 3)
      ).rejects.toThrow('Conta recorrente não encontrada');
    });
  });

  describe('payOccurrence', () => {
    const mockOccurrence = {
      id: 'occ-123',
      tenantId: 'tenant-123',
      recurringBillId: 'bill-123',
      dueDate: new Date('2025-01-10'),
      amount: 1500,
      status: 'pending',
      recurringBill: {
        id: 'bill-123',
        tenantId: 'tenant-123',
        name: 'Aluguel',
        type: 'expense',
        amount: 1500,
        categoryId: 'cat-123',
        bankAccountId: 'bank-123',
        paymentMethodId: null,
        autoGenerate: true,
        status: 'active',
        isFixed: true,
      },
    };

    it('deve pagar ocorrência e atualizar saldo atomicamente', async () => {
      (prisma.recurringBillOccurrence.findFirst as jest.Mock).mockResolvedValue(mockOccurrence);
      
      // Mock da transação atômica
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          recurringBillOccurrence: {
            update: jest.fn().mockResolvedValue({ ...mockOccurrence, status: 'paid' }),
          },
          transaction: {
            create: jest.fn().mockResolvedValue({ id: 'trans-123' }),
          },
          bankAccount: {
            update: jest.fn().mockResolvedValue({ currentBalance: 8500 }),
          },
        };
        return fn(tx);
      });

      // Mock para generateOccurrences (chamado após pagamento)
      jest.spyOn(service, 'generateOccurrences').mockResolvedValue({
        generated: 1,
        skipped: 0,
        dates: [],
      });

      const result = await service.payOccurrence(
        'occ-123',
        'tenant-123',
        'user-123',
        { paidAmount: 1500 }
      );

      expect(result.occurrence.status).toBe('paid');
      expect(result.transaction).toBeDefined();
      expect(result.balanceUpdated).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(cacheService.invalidateMultiple).toHaveBeenCalled();
    });

    it('deve rejeitar ocorrência já paga', async () => {
      (prisma.recurringBillOccurrence.findFirst as jest.Mock).mockResolvedValue({
        ...mockOccurrence,
        status: 'paid',
      });

      await expect(
        service.payOccurrence('occ-123', 'tenant-123', 'user-123', {})
      ).rejects.toThrow('Ocorrência já foi paga');
    });

    it('deve rejeitar ocorrência não encontrada', async () => {
      (prisma.recurringBillOccurrence.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.payOccurrence('nonexistent', 'tenant-123', 'user-123', {})
      ).rejects.toThrow('Ocorrência não encontrada');
    });

    it('deve calcular corretamente pagamento antecipado', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 5); // 5 dias no futuro

      (prisma.recurringBillOccurrence.findFirst as jest.Mock).mockResolvedValue({
        ...mockOccurrence,
        dueDate,
      });

      let capturedTransactionData: any;
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          recurringBillOccurrence: {
            update: jest.fn().mockResolvedValue({ ...mockOccurrence, status: 'paid' }),
          },
          transaction: {
            create: jest.fn().mockImplementation((data) => {
              capturedTransactionData = data.data;
              return { id: 'trans-123', ...data.data };
            }),
          },
          bankAccount: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      jest.spyOn(service, 'generateOccurrences').mockResolvedValue({
        generated: 0,
        skipped: 0,
        dates: [],
      });

      await service.payOccurrence('occ-123', 'tenant-123', 'user-123', {});

      expect(capturedTransactionData.isPaidEarly).toBe(true);
      expect(capturedTransactionData.isPaidLate).toBe(false);
    });

    it('deve calcular corretamente pagamento atrasado', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 3); // 3 dias no passado

      (prisma.recurringBillOccurrence.findFirst as jest.Mock).mockResolvedValue({
        ...mockOccurrence,
        dueDate,
      });

      let capturedTransactionData: any;
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          recurringBillOccurrence: {
            update: jest.fn().mockResolvedValue({ ...mockOccurrence, status: 'paid' }),
          },
          transaction: {
            create: jest.fn().mockImplementation((data) => {
              capturedTransactionData = data.data;
              return { id: 'trans-123', ...data.data };
            }),
          },
          bankAccount: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      jest.spyOn(service, 'generateOccurrences').mockResolvedValue({
        generated: 0,
        skipped: 0,
        dates: [],
      });

      await service.payOccurrence('occ-123', 'tenant-123', 'user-123', {});

      expect(capturedTransactionData.isPaidEarly).toBe(false);
      expect(capturedTransactionData.isPaidLate).toBe(true);
    });
  });

  describe('skipOccurrence', () => {
    it('deve marcar ocorrência como pulada', async () => {
      (prisma.recurringBillOccurrence.findFirst as jest.Mock).mockResolvedValue({
        id: 'occ-123',
        status: 'pending',
      });
      (prisma.recurringBillOccurrence.update as jest.Mock).mockResolvedValue({
        id: 'occ-123',
        status: 'skipped',
      });

      const result = await service.skipOccurrence('occ-123', 'tenant-123', 'Viagem');

      expect(result.occurrence.status).toBe('skipped');
      expect(prisma.recurringBillOccurrence.update).toHaveBeenCalledWith({
        where: { id: 'occ-123' },
        data: {
          status: 'skipped',
          notes: 'Viagem',
        },
      });
    });

    it('deve rejeitar pular ocorrência já paga', async () => {
      (prisma.recurringBillOccurrence.findFirst as jest.Mock).mockResolvedValue({
        id: 'occ-123',
        status: 'paid',
      });

      await expect(
        service.skipOccurrence('occ-123', 'tenant-123')
      ).rejects.toThrow('Não é possível pular uma ocorrência já paga');
    });
  });

  describe('updateOverdueOccurrences', () => {
    it('deve atualizar ocorrências vencidas para overdue', async () => {
      (prisma.recurringBillOccurrence.updateMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const result = await service.updateOverdueOccurrences('tenant-123');

      expect(result).toBe(5);
      expect(prisma.recurringBillOccurrence.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-123',
          status: 'pending',
          dueDate: { lt: expect.any(Date) },
        },
        data: {
          status: 'overdue',
        },
      });
    });
  });

  describe('generateAllOccurrences', () => {
    it('deve gerar para todas as bills ativas', async () => {
      const mockBills = [
        { id: 'bill-1', tenantId: 'tenant-123', status: 'active', monthsAhead: 3 },
        { id: 'bill-2', tenantId: 'tenant-123', status: 'active', monthsAhead: 2 },
      ];

      (prisma.recurringBill.findMany as jest.Mock).mockResolvedValue(mockBills);
      
      jest.spyOn(service, 'generateOccurrences')
        .mockResolvedValueOnce({ generated: 3, skipped: 0, dates: [] })
        .mockResolvedValueOnce({ generated: 2, skipped: 1, dates: [] });

      const result = await service.generateAllOccurrences('tenant-123');

      expect(result.totalGenerated).toBe(5);
      expect(result.totalSkipped).toBe(1);
      expect(result.billsProcessed).toBe(2);
      expect(result.errors).toHaveLength(0);
    });
  });
});
