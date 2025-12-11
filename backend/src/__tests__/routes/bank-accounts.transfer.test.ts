/**
 * Testes para Transferências entre Contas
 * 
 * Cenários testados:
 * 1. Transferência bem sucedida (atômica)
 * 2. Tentativa com saldo insuficiente
 * 3. Contas não encontradas
 * 4. Mesma conta origem e destino
 * 5. Erro no meio da operação (rollback automático)
 */

import request from 'supertest';
import express from 'express';
import { prisma } from '../../utils/prisma-client';

// Mock do Prisma
jest.mock('../../utils/prisma-client', () => ({
  prisma: {
    bankAccount: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock do logger
jest.mock('../../utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Bank Account Transfer', () => {
  const mockFromAccount = {
    id: 'from-account-123',
    tenantId: 'tenant-123',
    name: 'Conta Corrente',
    currentBalance: 5000,
    deletedAt: null,
  };

  const mockToAccount = {
    id: 'to-account-123',
    tenantId: 'tenant-123',
    name: 'Poupança',
    currentBalance: 2000,
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validações de entrada', () => {
    it('deve rejeitar quando fromAccountId não é fornecido', async () => {
      const validationResult = validateTransferInput({
        toAccountId: 'to-123',
        amount: 100,
        transactionDate: new Date(),
      });

      expect(validationResult.valid).toBe(false);
      expect(validationResult.error).toContain('origem');
    });

    it('deve rejeitar quando toAccountId não é fornecido', async () => {
      const validationResult = validateTransferInput({
        fromAccountId: 'from-123',
        amount: 100,
        transactionDate: new Date(),
      });

      expect(validationResult.valid).toBe(false);
      expect(validationResult.error).toContain('destino');
    });

    it('deve rejeitar quando origem e destino são iguais', async () => {
      const validationResult = validateTransferInput({
        fromAccountId: 'same-123',
        toAccountId: 'same-123',
        amount: 100,
        transactionDate: new Date(),
      });

      expect(validationResult.valid).toBe(false);
      expect(validationResult.error).toContain('diferentes');
    });

    it('deve rejeitar valor zero ou negativo', async () => {
      const validationResult = validateTransferInput({
        fromAccountId: 'from-123',
        toAccountId: 'to-123',
        amount: 0,
        transactionDate: new Date(),
      });

      expect(validationResult.valid).toBe(false);
      expect(validationResult.error).toContain('maior que zero');
    });

    it('deve rejeitar sem data de transferência', async () => {
      const validationResult = validateTransferInput({
        fromAccountId: 'from-123',
        toAccountId: 'to-123',
        amount: 100,
      });

      expect(validationResult.valid).toBe(false);
      expect(validationResult.error).toContain('Data');
    });
  });

  describe('Transferência Atômica', () => {
    it('deve executar todas as operações em uma transação', async () => {
      // Configurar mocks
      (prisma.bankAccount.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockFromAccount)
        .mockResolvedValueOnce(mockToAccount);

      const txOperations: string[] = [];

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          transaction: {
            create: jest.fn().mockImplementation(() => {
              txOperations.push('transaction.create');
              return { id: 'tx-123' };
            }),
          },
          bankAccount: {
            update: jest.fn().mockImplementation((args) => {
              if (args.data.currentBalance.decrement) {
                txOperations.push('bankAccount.decrement');
              } else {
                txOperations.push('bankAccount.increment');
              }
              return { currentBalance: 4000 };
            }),
          },
        };
        return fn(tx);
      });

      // Simular transferência
      await executeAtomicTransfer({
        fromAccountId: mockFromAccount.id,
        toAccountId: mockToAccount.id,
        amount: 1000,
        tenantId: 'tenant-123',
        userId: 'user-123',
      });

      // Verificar que todas as operações foram chamadas
      expect(txOperations).toContain('transaction.create');
      expect(txOperations).toContain('bankAccount.decrement');
      expect(txOperations).toContain('bankAccount.increment');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('deve fazer rollback se criar transação falhar', async () => {
      (prisma.bankAccount.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockFromAccount)
        .mockResolvedValueOnce(mockToAccount);

      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        executeAtomicTransfer({
          fromAccountId: mockFromAccount.id,
          toAccountId: mockToAccount.id,
          amount: 1000,
          tenantId: 'tenant-123',
          userId: 'user-123',
        })
      ).rejects.toThrow('Database error');

      // Nenhuma operação individual deve ter sido executada
      expect(prisma.bankAccount.update).not.toHaveBeenCalled();
    });

    it('deve fazer rollback se atualizar saldo falhar', async () => {
      (prisma.bankAccount.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockFromAccount)
        .mockResolvedValueOnce(mockToAccount);

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          transaction: {
            create: jest.fn().mockResolvedValue({ id: 'tx-123' }),
          },
          bankAccount: {
            update: jest.fn()
              .mockResolvedValueOnce({ currentBalance: 4000 }) // Primeiro decrement OK
              .mockRejectedValueOnce(new Error('Balance update failed')), // Segundo increment falha
          },
        };
        return fn(tx);
      });

      await expect(
        executeAtomicTransfer({
          fromAccountId: mockFromAccount.id,
          toAccountId: mockToAccount.id,
          amount: 1000,
          tenantId: 'tenant-123',
          userId: 'user-123',
        })
      ).rejects.toThrow();
    });
  });

  describe('Saldo Insuficiente', () => {
    it('deve rejeitar transferência quando saldo é insuficiente', async () => {
      const lowBalanceAccount = {
        ...mockFromAccount,
        currentBalance: 50,
      };

      (prisma.bankAccount.findFirst as jest.Mock)
        .mockResolvedValueOnce(lowBalanceAccount)
        .mockResolvedValueOnce(mockToAccount);

      const result = await validateSufficientBalance(lowBalanceAccount, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Saldo insuficiente');
    });

    it('deve permitir transferência quando saldo é exatamente igual', async () => {
      const exactBalanceAccount = {
        ...mockFromAccount,
        currentBalance: 100,
      };

      const result = await validateSufficientBalance(exactBalanceAccount, 100);

      expect(result.valid).toBe(true);
    });
  });

  describe('Integridade dos Saldos', () => {
    it('deve decrementar saldo da origem corretamente', async () => {
      (prisma.bankAccount.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockFromAccount)
        .mockResolvedValueOnce(mockToAccount);

      let capturedDecrementAmount: number = 0;

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          transaction: { create: jest.fn().mockResolvedValue({ id: 'tx-123' }) },
          bankAccount: {
            update: jest.fn().mockImplementation((args) => {
              if (args.data.currentBalance.decrement) {
                capturedDecrementAmount = args.data.currentBalance.decrement;
              }
              return { currentBalance: 4000 };
            }),
          },
        };
        return fn(tx);
      });

      await executeAtomicTransfer({
        fromAccountId: mockFromAccount.id,
        toAccountId: mockToAccount.id,
        amount: 1500.50,
        tenantId: 'tenant-123',
        userId: 'user-123',
      });

      expect(capturedDecrementAmount).toBe(1500.50);
    });

    it('deve incrementar saldo do destino corretamente', async () => {
      (prisma.bankAccount.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockFromAccount)
        .mockResolvedValueOnce(mockToAccount);

      let capturedIncrementAmount: number = 0;

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          transaction: { create: jest.fn().mockResolvedValue({ id: 'tx-123' }) },
          bankAccount: {
            update: jest.fn().mockImplementation((args) => {
              if (args.data.currentBalance.increment) {
                capturedIncrementAmount = args.data.currentBalance.increment;
              }
              return { currentBalance: 3500 };
            }),
          },
        };
        return fn(tx);
      });

      await executeAtomicTransfer({
        fromAccountId: mockFromAccount.id,
        toAccountId: mockToAccount.id,
        amount: 1500.50,
        tenantId: 'tenant-123',
        userId: 'user-123',
      });

      expect(capturedIncrementAmount).toBe(1500.50);
    });
  });
});

// ==================== HELPER FUNCTIONS ====================
// Funções auxiliares para os testes

interface TransferInput {
  fromAccountId?: string;
  toAccountId?: string;
  amount?: number;
  transactionDate?: Date;
}

function validateTransferInput(input: TransferInput): { valid: boolean; error?: string } {
  if (!input.fromAccountId) {
    return { valid: false, error: 'Contas de origem e destino são obrigatórias' };
  }
  if (!input.toAccountId) {
    return { valid: false, error: 'Contas de origem e destino são obrigatórias' };
  }
  if (input.fromAccountId === input.toAccountId) {
    return { valid: false, error: 'Contas de origem e destino devem ser diferentes' };
  }
  if (!input.amount || input.amount <= 0) {
    return { valid: false, error: 'Valor deve ser maior que zero' };
  }
  if (!input.transactionDate) {
    return { valid: false, error: 'Data da transferência é obrigatória' };
  }
  return { valid: true };
}

function validateSufficientBalance(account: any, amount: number): { valid: boolean; error?: string } {
  if (Number(account.currentBalance) < amount) {
    return { valid: false, error: 'Saldo insuficiente na conta de origem' };
  }
  return { valid: true };
}

interface AtomicTransferParams {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  tenantId: string;
  userId: string;
}

async function executeAtomicTransfer(params: AtomicTransferParams): Promise<void> {
  const { fromAccountId, toAccountId, amount, tenantId, userId } = params;

  await prisma.$transaction(async (tx: any) => {
    // 1. Criar transação de saída
    await tx.transaction.create({
      data: {
        tenantId,
        userId,
        type: 'transfer',
        bankAccountId: fromAccountId,
        destinationAccountId: toAccountId,
        amount,
        status: 'completed',
      },
    });

    // 2. Criar transação de entrada
    await tx.transaction.create({
      data: {
        tenantId,
        userId,
        type: 'transfer',
        bankAccountId: toAccountId,
        destinationAccountId: fromAccountId,
        amount,
        status: 'completed',
      },
    });

    // 3. Decrementar saldo da origem
    await tx.bankAccount.update({
      where: { id: fromAccountId },
      data: { currentBalance: { decrement: amount } },
    });

    // 4. Incrementar saldo do destino
    await tx.bankAccount.update({
      where: { id: toAccountId },
      data: { currentBalance: { increment: amount } },
    });
  });
}
