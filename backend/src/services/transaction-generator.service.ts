/**
 * Serviço de Geração de Transações Recorrentes
 * Responsável por criar transações automáticas baseadas em RecurringBills
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface GenerationResult {
  generatedRecurring: number;
  generatedInstallments: number;
  updatedOverdue: number;
  errors: string[];
}

/**
 * Gera transações de contas recorrentes ativas
 */
export async function generateRecurringTransactions(
  tenantId: string,
  userId: string
): Promise<number> {
  const activeRecurringBills = await prisma.recurringBill.findMany({
    where: {
      tenantId,
      status: 'active',
      autoGenerate: true,
      deletedAt: null,
    },
  });

  let generated = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const bill of activeRecurringBills) {
    const currentDate = new Date(today);
    const dueDay = bill.dueDay;

    // Se já passou o dia do mês, pegar próximo mês
    if (currentDate.getDate() > dueDay) {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    currentDate.setDate(dueDay);

    // Verificar se está dentro do range permitido
    if (bill.firstDueDate && currentDate < new Date(bill.firstDueDate)) {
      continue;
    }
    if (bill.lastDueDate && currentDate > new Date(bill.lastDueDate)) {
      continue;
    }

    // ✅ CORREÇÃO: Query de duplicatas mais específica
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        tenantId,
        transactionDate: {
          gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()),
          lt: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1),
        },
        // Query exata - evita falsos positivos
        OR: [
          { description: { equals: `${bill.name} (Recorrente)` } },
          { description: { equals: `${bill.name} (Previsto)` } },
          {
            AND: [
              { description: { equals: bill.name } },
              { amount: bill.amount || 0 },
              { type: bill.type.toUpperCase() },
            ],
          },
        ],
        deletedAt: null,
      },
    });

    if (!existingTransaction) {
      // ✅ CORREÇÃO: Usar transação atômica
      await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            tenantId,
            userId,
            categoryId: bill.categoryId,
            bankAccountId: bill.bankAccountId,
            paymentMethodId: bill.paymentMethodId,
            type: bill.type.toUpperCase(),
            amount: bill.amount || 0,
            description: `${bill.name} (Recorrente)`,
            transactionDate: currentDate,
            status: currentDate <= today ? 'completed' : 'pending',
            notes: bill.notes || undefined,
          },
        });
      });

      generated++;
    }
  }

  return generated;
}

/**
 * Gera transações de parcelas vencidas
 */
export async function generateInstallmentTransactions(
  tenantId: string,
  userId: string
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueInstallments = await prisma.installment.findMany({
    where: {
      tenantId,
      status: 'pending',
      dueDate: { lte: today },
    },
    include: {
      installmentPurchase: true,
    },
  });

  let generated = 0;

  for (const installment of dueInstallments) {
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        tenantId,
        installmentId: installment.id,
        deletedAt: null,
      },
    });

    if (!existingTransaction) {
      // ✅ CORREÇÃO: Usar transação atômica
      await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            tenantId,
            userId,
            categoryId: installment.installmentPurchase.categoryId,
            bankAccountId: installment.bankAccountId,
            paymentMethodId: installment.paymentMethodId,
            type: 'EXPENSE',
            amount: installment.amount,
            description: `${installment.installmentPurchase.name} - Parcela ${installment.installmentNumber}/${installment.installmentPurchase.numberOfInstallments}`,
            transactionDate: installment.dueDate,
            status: 'pending',
            installmentId: installment.id,
          },
        });
      });

      generated++;
    }
  }

  return generated;
}

/**
 * Atualiza status de transações vencidas
 */
export async function updateOverdueTransactions(tenantId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await prisma.transaction.updateMany({
    where: {
      tenantId,
      status: 'pending',
      transactionDate: { lt: today },
      deletedAt: null,
    },
    data: {
      status: 'overdue',
    },
  });

  return result.count;
}

/**
 * Executa todos os processos de geração para um tenant
 */
export async function generateAllTransactions(
  tenantId: string,
  userId: string
): Promise<GenerationResult> {
  const errors: string[] = [];
  let generatedRecurring = 0;
  let generatedInstallments = 0;
  let updatedOverdue = 0;

  try {
    generatedRecurring = await generateRecurringTransactions(tenantId, userId);
  } catch (error) {
    errors.push(`Recurring: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  try {
    generatedInstallments = await generateInstallmentTransactions(tenantId, userId);
  } catch (error) {
    errors.push(`Installments: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  try {
    updatedOverdue = await updateOverdueTransactions(tenantId);
  } catch (error) {
    errors.push(`Overdue: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    generatedRecurring,
    generatedInstallments,
    updatedOverdue,
    errors,
  };
}
