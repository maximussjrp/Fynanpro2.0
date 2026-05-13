/**
 * TransactionService Tests
 * Testa CRUD, validações, atomicidade, invalidação de cache, tenant isolation
 */

import { TransactionService } from '../../services/transaction.service';
import { prisma } from '../../utils/prisma-client';
import { cacheService } from '../../services/cache.service';

describe('TransactionService', () => {
  let transactionService: TransactionService;

  beforeEach(() => {
    transactionService = new TransactionService();
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('deve criar transação de receita e atualizar saldo', async () => {
      const mockCategory = {
        id: 'cat-123',
        name: 'Salário',
        type: 'income',
        tenantId: 'tenant-123',
      };

      const mockBankAccount = {
        id: 'bank-123',
        name: 'Conta Corrente',
        currentBalance: 1000,
        tenantId: 'tenant-123',
      };

      const mockTransaction = {
        id: 'trans-123',
        tenantId: 'tenant-123',
        userId: 'user-123',
        type: 'income',
        amount: 5000,
        status: 'completed',
        category: mockCategory,
        bankAccount: mockBankAccount,
      };

      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.bankAccount.findFirst as jest.Mock).mockResolvedValue(mockBankAccount);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: {
            create: jest.fn().mockResolvedValue(mockTransaction),
          },
          bankAccount: {
            update: jest.fn().mockResolvedValue({ currentBalance: 6000 }),
          },
        };
        return fn(mockTx);
      });

      const result = await transactionService.create(
        {
          type: 'income',
          categoryId: 'cat-123',
          bankAccountId: 'bank-123',
          amount: 5000,
          description: 'Salário',
          transactionDate: new Date('2024-01-15'),
          status: 'completed',
        },
        'user-123',
        'tenant-123'
      );

      expect(result.type).toBe('income');
      expect(result.amount).toBe(5000);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(cacheService.invalidateMultiple).toHaveBeenCalledWith(
        expect.arrayContaining(['dashboard', 'reports', 'transactions', 'accounts'])
      );
    });

    it('deve criar transação de despesa e decrementar saldo', async () => {
      const mockCategory = {
        id: 'cat-123',
        type: 'expense',
        tenantId: 'tenant-123',
      };

      const mockBankAccount = {
        id: 'bank-123',
        currentBalance: 1000,
        tenantId: 'tenant-123',
      };

      const mockTransaction = {
        id: 'trans-123',
        type: 'expense',
        amount: 200,
        status: 'completed',
      };

      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.bankAccount.findFirst as jest.Mock).mockResolvedValue(mockBankAccount);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: {
            create: jest.fn().mockResolvedValue(mockTransaction),
          },
          bankAccount: {
            update: jest.fn().mockResolvedValue({ currentBalance: 800 }),
          },
        };
        return fn(mockTx);
      });

      const result = await transactionService.create(
        {
          type: 'expense',
          categoryId: 'cat-123',
          bankAccountId: 'bank-123',
          amount: 200,
          description: 'Compra',
          transactionDate: new Date(),
          status: 'completed',
        },
        'user-123',
        'tenant-123'
      );

      expect(result.type).toBe('expense');
      expect(result.amount).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('deve rejeitar categoria inexistente', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        transactionService.create(
          {
            type: 'income',
            categoryId: 'nonexistent-cat',
            amount: 1000,
            description: 'Test',
            transactionDate: new Date(),
          },
          'user-123',
          'tenant-123'
        )
      ).rejects.toThrow('Categoria não encontrada');
    });

    it('deve rejeitar categoria de tipo incompatível', async () => {
      const mockCategory = {
        id: 'cat-123',
        type: 'expense', // Despesa
        tenantId: 'tenant-123',
      };

      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);

      await expect(
        transactionService.create(
          {
            type: 'income', // Tentando criar receita com categoria de despesa
            categoryId: 'cat-123',
            amount: 1000,
            description: 'Test',
            transactionDate: new Date(),
          },
          'user-123',
          'tenant-123'
        )
      ).rejects.toThrow('Categoria não é de receita');
    });

    it('deve rejeitar conta bancária inexistente', async () => {
      const mockCategory = {
        id: 'cat-123',
        type: 'income',
        tenantId: 'tenant-123',
      };

      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.bankAccount.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        transactionService.create(
          {
            type: 'income',
            categoryId: 'cat-123',
            bankAccountId: 'nonexistent-bank',
            amount: 1000,
            description: 'Test',
            transactionDate: new Date(),
          },
          'user-123',
          'tenant-123'
        )
      ).rejects.toThrow('Conta bancária não encontrada');
    });

    it('deve rejeitar meio de pagamento inexistente', async () => {
      const mockCategory = {
        id: 'cat-123',
        type: 'expense',
        tenantId: 'tenant-123',
      };

      const mockBankAccount = {
        id: 'bank-123',
        tenantId: 'tenant-123',
      };

      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.bankAccount.findFirst as jest.Mock).mockResolvedValue(mockBankAccount);
      (prisma.paymentMethod.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        transactionService.create(
          {
            type: 'expense',
            categoryId: 'cat-123',
            bankAccountId: 'bank-123',
            paymentMethodId: 'nonexistent-pm',
            amount: 100,
            description: 'Test',
            transactionDate: new Date(),
          },
          'user-123',
          'tenant-123'
        )
      ).rejects.toThrow('Meio de pagamento não encontrado');
    });

    it('não deve atualizar saldo se transação pendente', async () => {
      const mockCategory = {
        id: 'cat-123',
        type: 'income',
        tenantId: 'tenant-123',
      };

      const mockBankAccount = {
        id: 'bank-123',
        tenantId: 'tenant-123',
      };

      const mockTransaction = {
        id: 'trans-123',
        status: 'pending',
      };

      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.bankAccount.findFirst as jest.Mock).mockResolvedValue(mockBankAccount);

      const bankAccountUpdateMock = jest.fn();
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: {
            create: jest.fn().mockResolvedValue(mockTransaction),
          },
          bankAccount: {
            update: bankAccountUpdateMock,
          },
        };
        return fn(mockTx);
      });

      await transactionService.create(
        {
          type: 'income',
          categoryId: 'cat-123',
          bankAccountId: 'bank-123',
          amount: 1000,
          description: 'Test',
          transactionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Futuro
          status: 'pending',
        },
        'user-123',
        'tenant-123'
      );

      // Saldo não deve ser atualizado para transações pendentes
      expect(bankAccountUpdateMock).not.toHaveBeenCalled();
    });

    it('deve deduplicar criação idêntica recente sem reaplicar saldo', async () => {
      const mockCategory = {
        id: 'cat-123',
        type: 'expense',
        tenantId: 'tenant-123',
      };

      const mockBankAccount = {
        id: 'bank-123',
        tenantId: 'tenant-123',
      };

      const duplicateTransaction = {
        id: 'trans-dup',
        tenantId: 'tenant-123',
        userId: 'user-123',
        type: 'expense',
        categoryId: 'cat-123',
        bankAccountId: 'bank-123',
        paymentMethodId: null,
        amount: 50,
        description: 'Padaria',
        transactionDate: new Date('2026-05-10T00:00:00.000Z'),
        status: 'completed',
        notes: null,
        tags: null,
        category: null,
        bankAccount: null,
        paymentMethod: null,
      };

      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.bankAccount.findFirst as jest.Mock).mockResolvedValue(mockBankAccount);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(duplicateTransaction);

      const result = await transactionService.create(
        {
          type: 'expense',
          categoryId: 'cat-123',
          bankAccountId: 'bank-123',
          amount: 50,
          description: 'Padaria',
          transactionDate: '2026-05-10',
          status: 'completed',
        },
        'user-123',
        'tenant-123'
      );

      expect(result.id).toBe('trans-dup');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('deve atualizar transação e ajustar saldo', async () => {
      const mockExistingTransaction = {
        id: 'trans-123',
        tenantId: 'tenant-123',
        type: 'expense',
        amount: 100,
        status: 'completed',
        bankAccountId: 'bank-123',
        categoryId: 'cat-old',
      };

      const mockCategory = {
        id: 'cat-new',
        type: 'expense',
        tenantId: 'tenant-123',
      };

      const mockBankAccount = {
        id: 'bank-123',
        currentBalance: 800,
        tenantId: 'tenant-123',
      };

      const mockUpdatedTransaction = {
        ...mockExistingTransaction,
        amount: 150,
        categoryId: 'cat-new',
      };

      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(mockExistingTransaction);
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.bankAccount.findFirst as jest.Mock).mockResolvedValue(mockBankAccount);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: {
            update: jest.fn().mockResolvedValue(mockUpdatedTransaction),
          },
          bankAccount: {
            update: jest.fn().mockResolvedValue({ currentBalance: 750 }),
          },
        };
        return fn(mockTx);
      });

      const result = await transactionService.update(
        'trans-123',
        {
          amount: 150,
          categoryId: 'cat-new',
        },
        'tenant-123'
      );

      expect(result.amount).toBe(150);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(cacheService.invalidateMultiple).toHaveBeenCalled();
    });

    it('deve rejeitar atualização de transação inexistente', async () => {
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        transactionService.update(
          'nonexistent-trans',
          { amount: 200 },
          'tenant-123'
        )
      ).rejects.toThrow('Transação não encontrada');
    });

    it('deve impedir atualização cross-tenant', async () => {
      const mockTransaction = {
        id: 'trans-123',
        tenantId: 'tenant-999', // Diferente do solicitado
      };

      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(null); // findFirst já filtra por tenant

      await expect(
        transactionService.update(
          'trans-123',
          { amount: 200 },
          'tenant-123' // Tentando acessar com tenant diferente
        )
      ).rejects.toThrow('Transação não encontrada');
    });

    it('deve sincronizar dueDate ao reagendar transação pendente', async () => {
      const mockExistingTransaction = {
        id: 'trans-123',
        tenantId: 'tenant-123',
        type: 'expense',
        amount: 100,
        status: 'pending',
        bankAccountId: 'bank-123',
        categoryId: 'cat-1',
        transactionDate: new Date('2026-04-01T00:00:00.000Z'),
        dueDate: new Date('2026-04-01T00:00:00.000Z'),
      };

      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(mockExistingTransaction);
      (prisma.bankAccount.findFirst as jest.Mock).mockResolvedValue({
        id: 'bank-123',
        currentBalance: 1000,
        tenantId: 'tenant-123',
      });

      const updateMock = jest.fn().mockResolvedValue({ ...mockExistingTransaction, transactionDate: new Date('2026-05-20T00:00:00.000Z'), dueDate: new Date('2026-05-20T00:00:00.000Z') });
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: { update: updateMock },
          bankAccount: { update: jest.fn() },
        };
        return fn(mockTx);
      });

      await transactionService.update(
        'trans-123',
        { transactionDate: '2026-05-20' },
        'tenant-123'
      );

      const updateCall = updateMock.mock.calls[0][0];
      expect(updateCall.data.transactionDate).toBeInstanceOf(Date);
      expect(updateCall.data.dueDate).toBeInstanceOf(Date);
      expect(updateCall.data.transactionDate.getTime()).toBe(updateCall.data.dueDate.getTime());
    });

    it('NÃO deve alterar dueDate ao reagendar transação já paga', async () => {
      const mockExistingTransaction = {
        id: 'trans-123',
        tenantId: 'tenant-123',
        type: 'expense',
        amount: 100,
        status: 'completed',
        bankAccountId: 'bank-123',
        categoryId: 'cat-1',
        transactionDate: new Date('2026-04-01T00:00:00.000Z'),
        dueDate: new Date('2026-03-15T00:00:00.000Z'),
      };

      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(mockExistingTransaction);
      (prisma.bankAccount.findFirst as jest.Mock).mockResolvedValue({
        id: 'bank-123',
        currentBalance: 1000,
        tenantId: 'tenant-123',
      });

      const updateMock = jest.fn().mockResolvedValue(mockExistingTransaction);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: { update: updateMock },
          bankAccount: { update: jest.fn() },
        };
        return fn(mockTx);
      });

      await transactionService.update(
        'trans-123',
        { transactionDate: '2026-05-20' },
        'tenant-123'
      );

      const updateCall = updateMock.mock.calls[0][0];
      expect(updateCall.data.dueDate).toBeUndefined();
    });

    it('deve recalcular ajuste de caixa aplicando apenas a diferença', async () => {
      const mockExistingTransaction = {
        id: 'adj-123',
        tenantId: 'tenant-123',
        type: 'adjustment',
        amount: 100,
        status: 'completed',
        bankAccountId: 'bank-123',
        transactionDate: new Date('2026-05-01T12:00:00.000Z'),
      };

      const bankAccountUpdateMock = jest.fn().mockResolvedValue({ currentBalance: 1150 });
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(mockExistingTransaction);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: {
            update: jest.fn().mockResolvedValue({ ...mockExistingTransaction, amount: 150 }),
          },
          bankAccount: {
            update: bankAccountUpdateMock,
          },
        };
        return fn(mockTx);
      });

      await transactionService.update('adj-123', { amount: 150 }, 'tenant-123');

      expect(bankAccountUpdateMock).toHaveBeenNthCalledWith(1, {
        where: { id: 'bank-123' },
        data: { currentBalance: { decrement: 100 } },
      });
      expect(bankAccountUpdateMock).toHaveBeenNthCalledWith(2, {
        where: { id: 'bank-123' },
        data: { currentBalance: { increment: 150 } },
      });
    });

    it('deve recalcular ajuste ao trocar de positivo para negativo', async () => {
      const mockExistingTransaction = {
        id: 'adj-456',
        tenantId: 'tenant-123',
        type: 'adjustment',
        amount: 100,
        status: 'completed',
        bankAccountId: 'bank-123',
        transactionDate: new Date('2026-05-01T12:00:00.000Z'),
      };

      const bankAccountUpdateMock = jest.fn().mockResolvedValue({ currentBalance: 850 });
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(mockExistingTransaction);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: {
            update: jest.fn().mockResolvedValue({ ...mockExistingTransaction, amount: -50 }),
          },
          bankAccount: {
            update: bankAccountUpdateMock,
          },
        };
        return fn(mockTx);
      });

      await transactionService.update('adj-456', { amount: -50 }, 'tenant-123');

      expect(bankAccountUpdateMock).toHaveBeenNthCalledWith(1, {
        where: { id: 'bank-123' },
        data: { currentBalance: { decrement: 100 } },
      });
      expect(bankAccountUpdateMock).toHaveBeenNthCalledWith(2, {
        where: { id: 'bank-123' },
        data: { currentBalance: { decrement: 50 } },
      });
    });

    it('deve bloquear edição financeira de transferência ligada', async () => {
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue({
        id: 'tx-transfer',
        tenantId: 'tenant-123',
        type: 'transfer',
        amount: -250,
        status: 'completed',
        bankAccountId: 'bank-123',
        linkedTransactionId: 'tx-transfer-in',
      });

      await expect(
        transactionService.update('tx-transfer', { amount: 300 }, 'tenant-123')
      ).rejects.toThrow('TRANSFER_LINKED_IMMUTABLE');
    });
  });

  describe('delete()', () => {
    it('deve fazer soft delete e reverter saldo', async () => {
      const mockTransaction = {
        id: 'trans-123',
        tenantId: 'tenant-123',
        type: 'expense',
        amount: 100,
        status: 'completed',
        bankAccountId: 'bank-123',
        deletedAt: null,
      };

      const mockBankAccount = {
        id: 'bank-123',
        currentBalance: 900,
      };

      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(mockBankAccount);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: {
            update: jest.fn().mockResolvedValue({ ...mockTransaction, deletedAt: new Date() }),
          },
          bankAccount: {
            update: jest.fn().mockResolvedValue({ currentBalance: 1000 }),
          },
        };
        return fn(mockTx);
      });

      await transactionService.delete('trans-123', 'tenant-123');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(cacheService.invalidateMultiple).toHaveBeenCalled();
    });

    it('deve rejeitar delete de transação inexistente', async () => {
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        transactionService.delete('nonexistent-trans', 'tenant-123')
      ).rejects.toThrow('Transação não encontrada');
    });

    it('deve rejeitar delete de transação já deletada', async () => {
      // findFirst filtra por deletedAt: null, então retorna null para transações deletadas
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        transactionService.delete('trans-123', 'tenant-123')
      ).rejects.toThrow('Transação não encontrada');
    });

    it('deve estornar ajuste positivo ao excluir', async () => {
      const adjustment = {
        id: 'adj-positive',
        tenantId: 'tenant-123',
        type: 'adjustment',
        amount: 120,
        status: 'completed',
        bankAccountId: 'bank-123',
        deletedAt: null,
      };

      const bankAccountUpdateMock = jest.fn().mockResolvedValue({ currentBalance: 880 });
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(adjustment);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: {
            update: jest.fn().mockResolvedValue({ ...adjustment, deletedAt: new Date() }),
            count: jest.fn().mockResolvedValue(0),
          },
          bankAccount: {
            update: bankAccountUpdateMock,
          },
        };
        return fn(mockTx);
      });

      await transactionService.delete('adj-positive', 'tenant-123');

      expect(bankAccountUpdateMock).toHaveBeenCalledWith({
        where: { id: 'bank-123' },
        data: { currentBalance: { decrement: 120 } },
      });
    });

    it('deve estornar ajuste negativo ao excluir', async () => {
      const adjustment = {
        id: 'adj-negative',
        tenantId: 'tenant-123',
        type: 'adjustment',
        amount: -80,
        status: 'completed',
        bankAccountId: 'bank-123',
        deletedAt: null,
      };

      const bankAccountUpdateMock = jest.fn().mockResolvedValue({ currentBalance: 1080 });
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(adjustment);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: {
            update: jest.fn().mockResolvedValue({ ...adjustment, deletedAt: new Date() }),
            count: jest.fn().mockResolvedValue(0),
          },
          bankAccount: {
            update: bankAccountUpdateMock,
          },
        };
        return fn(mockTx);
      });

      await transactionService.delete('adj-negative', 'tenant-123');

      expect(bankAccountUpdateMock).toHaveBeenCalledWith({
        where: { id: 'bank-123' },
        data: { currentBalance: { increment: 80 } },
      });
    });

    it('deve estornar as duas pernas de transferência ligada ao excluir', async () => {
      const transferOut = {
        id: 'tx-out',
        tenantId: 'tenant-123',
        type: 'transfer',
        amount: -200,
        status: 'completed',
        bankAccountId: 'bank-origin',
        linkedTransactionId: 'tx-in',
        deletedAt: null,
      };
      const transferIn = {
        id: 'tx-in',
        tenantId: 'tenant-123',
        type: 'transfer',
        amount: 200,
        status: 'completed',
        bankAccountId: 'bank-destination',
        linkedTransactionId: 'tx-out',
        deletedAt: null,
      };

      const bankAccountUpdateMock = jest.fn().mockResolvedValue({});
      (prisma.transaction.findFirst as jest.Mock)
        .mockResolvedValueOnce(transferOut)
        .mockResolvedValueOnce(transferIn);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: {
            update: jest.fn().mockResolvedValue({}),
            count: jest.fn().mockResolvedValue(0),
          },
          bankAccount: {
            update: bankAccountUpdateMock,
          },
        };
        return fn(mockTx);
      });

      await transactionService.delete('tx-out', 'tenant-123');

      expect(bankAccountUpdateMock).toHaveBeenNthCalledWith(1, {
        where: { id: 'bank-origin' },
        data: { currentBalance: { increment: 200 } },
      });
      expect(bankAccountUpdateMock).toHaveBeenNthCalledWith(2, {
        where: { id: 'bank-destination' },
        data: { currentBalance: { decrement: 200 } },
      });
    });
  });

  describe('updateStatus()', () => {
    it('deve estornar e reaplicar ajuste de caixa ao alternar status', async () => {
      const adjustment = {
        id: 'adj-status',
        tenantId: 'tenant-123',
        type: 'adjustment',
        amount: 75,
        status: 'completed',
        bankAccountId: 'bank-123',
        deletedAt: null,
        dueDate: null,
      };

      const bankAccountUpdateMock = jest.fn().mockResolvedValue({ currentBalance: 1000 });
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(adjustment);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: {
            update: jest.fn().mockResolvedValue({ ...adjustment, status: 'pending' }),
          },
          bankAccount: {
            update: bankAccountUpdateMock,
          },
        };
        return fn(mockTx);
      });

      await transactionService.updateStatus('adj-status', 'pending', 'tenant-123');

      expect(bankAccountUpdateMock).toHaveBeenCalledWith({
        where: { id: 'bank-123' },
        data: { currentBalance: { decrement: 75 } },
      });
    });

    it('deve aplicar ajuste negativo ao marcar como completed', async () => {
      const adjustment = {
        id: 'adj-status-negative',
        tenantId: 'tenant-123',
        type: 'adjustment',
        amount: -40,
        status: 'pending',
        bankAccountId: 'bank-123',
        deletedAt: null,
        dueDate: null,
      };

      const bankAccountUpdateMock = jest.fn().mockResolvedValue({ currentBalance: 960 });
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(adjustment);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          transaction: {
            update: jest.fn().mockResolvedValue({ ...adjustment, status: 'completed' }),
          },
          bankAccount: {
            update: bankAccountUpdateMock,
          },
        };
        return fn(mockTx);
      });

      await transactionService.updateStatus('adj-status-negative', 'completed', 'tenant-123');

      expect(bankAccountUpdateMock).toHaveBeenCalledWith({
        where: { id: 'bank-123' },
        data: { currentBalance: { decrement: 40 } },
      });
    });

    it('deve tratar retry completed->completed como noop sem tocar saldo nem gerar recorrencia', async () => {
      const completedRecurring = {
        id: 'rec-paid',
        tenantId: 'tenant-123',
        type: 'expense',
        amount: 55,
        status: 'completed',
        bankAccountId: 'bank-123',
        deletedAt: null,
        dueDate: new Date('2026-05-10T00:00:00.000Z'),
        paidDate: new Date('2026-05-10T00:00:00.000Z'),
        transactionType: 'recurring',
        parentId: 'parent-1',
      };

      const generateNextSpy = jest.spyOn(transactionService, 'generateNextOccurrence');
      (prisma.transaction.findFirst as jest.Mock)
        .mockResolvedValueOnce(completedRecurring)
        .mockResolvedValueOnce({
          ...completedRecurring,
          category: null,
          bankAccount: null,
          paymentMethod: null,
        });

      const result = await transactionService.updateStatus('rec-paid', 'completed', 'tenant-123');

      expect(result.status).toBe('completed');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(generateNextSpy).not.toHaveBeenCalled();
    });
  });

  describe('getAll()', () => {
    it('deve listar transações com paginação', async () => {
      const mockTransactions = [
        { id: 'trans-1', amount: 100, type: 'income' },
        { id: 'trans-2', amount: 200, type: 'expense' },
      ];

      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(mockTransactions);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(50);

      const result = await transactionService.getAll('tenant-123', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 50,
        totalPages: 5,
      });
    });

    it('deve filtrar por tipo de transação', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

      await transactionService.getAll('tenant-123', {
        type: 'income',
        page: 1,
        limit: 10,
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'income',
          }),
        })
      );
    });

    it('deve filtrar por range de data', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

      await transactionService.getAll('tenant-123', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        page: 1,
        limit: 10,
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            transactionDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('deve criar datas com horários corretos para início e fim do dia', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

      await transactionService.getAll('tenant-123', {
        startDate: '2024-01-15',
        endDate: '2024-01-15',
        page: 1,
        limit: 10,
      });

      const call = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
      const { gte, lte } = call.where.transactionDate;
      
      // Verificar que gte é início do dia (00:00:00)
      expect(gte.getHours()).toBe(0);
      expect(gte.getMinutes()).toBe(0);
      expect(gte.getSeconds()).toBe(0);
      expect(gte.getMilliseconds()).toBe(0);
      
      // Verificar que lte é final do dia (23:59:59.999)
      expect(lte.getHours()).toBe(23);
      expect(lte.getMinutes()).toBe(59);
      expect(lte.getSeconds()).toBe(59);
      expect(lte.getMilliseconds()).toBe(999);
    });

    it('deve filtrar corretamente datas retroativas (passado distante)', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

      // Testar data retroativa de 1 ano atrás
      await transactionService.getAll('tenant-123', {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        page: 1,
        limit: 10,
      });

      const call = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
      const { gte, lte } = call.where.transactionDate;
      
      // Verificar ano correto
      expect(gte.getFullYear()).toBe(2023);
      expect(lte.getFullYear()).toBe(2023);
      
      // Verificar meses corretos
      expect(gte.getMonth()).toBe(0); // Janeiro = 0
      expect(lte.getMonth()).toBe(11); // Dezembro = 11
      
      // Verificar dias corretos
      expect(gte.getDate()).toBe(1);
      expect(lte.getDate()).toBe(31);
    });

    it('deve filtrar corretamente range cruzando meses', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

      await transactionService.getAll('tenant-123', {
        startDate: '2024-11-25',
        endDate: '2024-12-05',
        page: 1,
        limit: 10,
      });

      const call = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
      const { gte, lte } = call.where.transactionDate;
      
      // Início: 25 de Novembro
      expect(gte.getMonth()).toBe(10); // Novembro = 10
      expect(gte.getDate()).toBe(25);
      
      // Fim: 5 de Dezembro
      expect(lte.getMonth()).toBe(11); // Dezembro = 11
      expect(lte.getDate()).toBe(5);
    });

    it('deve filtrar corretamente range cruzando anos', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

      await transactionService.getAll('tenant-123', {
        startDate: '2024-12-20',
        endDate: '2025-01-10',
        page: 1,
        limit: 10,
      });

      const call = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
      const { gte, lte } = call.where.transactionDate;
      
      // Início: 20 de Dezembro de 2024
      expect(gte.getFullYear()).toBe(2024);
      expect(gte.getMonth()).toBe(11); // Dezembro
      expect(gte.getDate()).toBe(20);
      
      // Fim: 10 de Janeiro de 2025
      expect(lte.getFullYear()).toBe(2025);
      expect(lte.getMonth()).toBe(0); // Janeiro
      expect(lte.getDate()).toBe(10);
    });

    it('deve isolar transações por tenant', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

      await transactionService.getAll('tenant-123', {
        page: 1,
        limit: 10,
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-123',
            deletedAt: null,
          }),
        })
      );
    });
  });

  describe('getSummary()', () => {
    it('deve calcular resumo de transações', async () => {
      const mockIncomeData = { _sum: { amount: 5000 }, _count: 10 };
      const mockExpenseData = { _sum: { amount: 3000 }, _count: 15 };
      const mockTransferData = { _sum: { amount: 1000 }, _count: 5 };

      (prisma.transaction.aggregate as jest.Mock)
        .mockResolvedValueOnce(mockIncomeData)
        .mockResolvedValueOnce(mockExpenseData)
        .mockResolvedValueOnce(mockTransferData);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(30);

      const result = await transactionService.getSummary('tenant-123', {
        page: 1,
        limit: 10,
      });

      expect(result.totalIncome).toBe(5000);
      expect(result.totalExpense).toBe(3000);
      expect(result.balance).toBe(2000); // 5000 - 3000
      expect(result.transactionCount).toBe(30); // 10 + 15 + 5
    });

    it('deve filtrar resumo por período', async () => {
      (prisma.transaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 0 }, _count: 0 });
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

      await transactionService.getSummary('tenant-123', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        page: 1,
        limit: 10,
      });

      expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            transactionDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });
  });

  describe('getById()', () => {
    it('deve buscar transação por ID', async () => {
      const mockTransaction = {
        id: 'trans-123',
        tenantId: 'tenant-123',
        amount: 1000,
        type: 'income',
      };

      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(mockTransaction);

      const result = await transactionService.getById('trans-123', 'tenant-123');

      expect(result.id).toBe('trans-123');
      expect(result.amount).toBe(1000);
    });

    it('deve rejeitar busca de transação inexistente', async () => {
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        transactionService.getById('nonexistent-trans', 'tenant-123')
      ).rejects.toThrow('Transação não encontrada');
    });

    it('deve respeitar tenant isolation no getById', async () => {
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        transactionService.getById('trans-123', 'tenant-123')
      ).rejects.toThrow('Transação não encontrada');

      expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-123',
          }),
        })
      );
    });
  });
});
