import { mockPrisma } from '../setup';
import { recurringBillService } from '../../services/recurring-bill.service';

describe('recurring-bill.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bloqueia retry de pagamento da mesma ocorrencia sem duplicar saldo', async () => {
    const occurrence = {
      id: 'occ-1',
      tenantId: 'tenant-123',
      status: 'pending',
      dueDate: new Date('2026-05-10T00:00:00.000Z'),
      amount: 90,
      notes: null,
      recurringBill: {
        id: 'bill-1',
        type: 'expense',
        bankAccountId: 'bank-1',
        categoryId: 'cat-1',
        paymentMethodId: null,
        amount: 90,
        autoGenerate: true,
        status: 'active',
        isFixed: true,
      },
    };

    (mockPrisma.recurringBillOccurrence.findFirst as jest.Mock).mockResolvedValue(occurrence);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
      const tx = {
        recurringBillOccurrence: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findFirst: jest.fn(),
        },
        transaction: {
          create: jest.fn(),
        },
        bankAccount: {
          update: jest.fn(),
        },
      };
      return fn(tx);
    });

    await expect(
      recurringBillService.payOccurrence('occ-1', 'tenant-123', 'user-123')
    ).rejects.toThrow('Ocorrência já foi paga');
  });

  it('nao gera duas ocorrencias iguais para o mesmo nextDueDate', async () => {
    const parent = {
      id: 'parent-1',
      tenantId: 'tenant-123',
      transactionType: 'recurring',
      deletedAt: null,
      totalOccurrences: null,
      endDate: null,
      nextDueDate: new Date('2026-06-10T00:00:00.000Z'),
      frequency: 'monthly',
      frequencyInterval: 1,
      userId: 'user-123',
      type: 'expense',
      categoryId: 'cat-1',
      bankAccountId: 'bank-1',
      paymentMethodId: null,
      amount: 100,
      description: 'Mensalidade',
      isFixed: true,
      notes: null,
      tags: null,
      children: [
        {
          id: 'child-1',
          occurrenceNumber: 1,
        },
      ],
    };

    const existingOccurrence = {
      id: 'child-2',
      parentId: 'parent-1',
      dueDate: new Date('2026-06-10T00:00:00.000Z'),
      category: null,
      bankAccount: null,
      paymentMethod: null,
    };

    const prisma = mockPrisma as any;
    prisma.transaction.findFirst
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(existingOccurrence);

    const { transactionService } = await import('../../services/transaction.service');
    const result = await transactionService.generateNextOccurrence('parent-1', 'tenant-123');

    expect(result.id).toBe('child-2');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
