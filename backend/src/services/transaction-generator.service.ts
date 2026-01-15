/**
 * Serviço de Geração de Transações Recorrentes
 * 
 * REFATORADO: Agora trabalha com RecurringBillOccurrence ao invés de criar Transaction diretamente.
 * ATUALIZADO: Também suporta transações unificadas (transactionType = 'recurring')
 * 
 * Responsabilidades:
 * 1. Gerar novas ocorrências para contas recorrentes ativas
 * 2. Gerar próximas ocorrências de transações unificadas recorrentes
 * 3. Gerar transações de parcelas vencidas
 * 4. Atualizar status de transações/ocorrências vencidas para 'overdue'
 * 
 * IMPORTANTE: O job NÃO cria transações para recorrências!
 * Transações são criadas APENAS quando o usuário paga uma ocorrência.
 */

import { PrismaClient } from '@prisma/client';
import { recurringBillService } from './recurring-bill.service';
import { transactionService } from './transaction.service';
import { log } from '../utils/logger';

const prisma = new PrismaClient();

interface GenerationResult {
  generatedOccurrences: number;
  generatedUnifiedRecurring: number;
  generatedInstallments: number;
  updatedOverdueOccurrences: number;
  updatedOverdueTransactions: number;
  errors: string[];
}

/**
 * Gera ocorrências de contas recorrentes ativas
 * CORRIGIDO: Usa RecurringBillOccurrence, não cria Transaction diretamente
 */
export async function generateRecurringOccurrences(
  tenantId: string
): Promise<number> {
  try {
    const result = await recurringBillService.generateAllOccurrences(tenantId);
    
    if (result.errors.length > 0) {
      log.warn('Some recurring bills had errors during generation', {
        tenantId,
        errors: result.errors,
      });
    }

    return result.totalGenerated;
  } catch (error) {
    log.error('generateRecurringOccurrences error', { tenantId, error });
    throw error;
  }
}

/**
 * Gera próximas ocorrências de transações unificadas recorrentes
 * NOVO: Suporta o modelo unificado (transactionType = 'recurring')
 */
export async function generateUnifiedRecurringOccurrences(
  tenantId: string
): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscar transações pai recorrentes que precisam gerar próxima ocorrência
    const recurringParents = await prisma.transaction.findMany({
      where: {
        tenantId,
        transactionType: 'recurring',
        parentId: null, // É uma transação pai (template)
        autoGenerateNext: true,
        deletedAt: null,
        OR: [
          { endDate: null }, // Sem data final = infinita
          { endDate: { gte: today } }, // Data final ainda não atingida
        ],
        nextDueDate: {
          lte: today, // Próxima data é hoje ou já passou
        },
      },
    });

    let generated = 0;

    for (const parent of recurringParents) {
      try {
        // Verificar se já existe ocorrência para a data
        const existingOccurrence = await prisma.transaction.findFirst({
          where: {
            parentId: parent.id,
            dueDate: parent.nextDueDate,
            deletedAt: null,
          },
        });

        if (!existingOccurrence) {
          await transactionService.generateNextOccurrence(parent.id, tenantId);
          generated++;
          
          log.info('Generated unified recurring occurrence', {
            tenantId,
            parentId: parent.id,
            description: parent.description,
          });
        }
      } catch (error) {
        log.error('Error generating unified recurring occurrence', {
          tenantId,
          parentId: parent.id,
          error,
        });
      }
    }

    return generated;
  } catch (error) {
    log.error('generateUnifiedRecurringOccurrences error', { tenantId, error });
    throw error;
  }
}

/**
 * Atualiza status de ocorrências vencidas para 'overdue'
 */
export async function updateOverdueOccurrences(tenantId: string): Promise<number> {
  return recurringBillService.updateOverdueOccurrences(tenantId);
}

/**
 * Gera transações de parcelas vencidas
 * (Parcelas funcionam diferente de recorrências - aqui criamos Transaction)
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
      // Usar transação atômica
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
            dueDate: installment.dueDate,
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
 * Atualiza status de transações vencidas para 'overdue'
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
 * REFATORADO: Gera Occurrences para recorrências, não Transactions
 * ATUALIZADO: Também suporta transações unificadas recorrentes
 */
export async function generateAllTransactions(
  tenantId: string,
  userId: string
): Promise<GenerationResult> {
  const errors: string[] = [];
  let generatedOccurrences = 0;
  let generatedUnifiedRecurring = 0;
  let generatedInstallments = 0;
  let updatedOverdueOccurrences = 0;
  let updatedOverdueTransactions = 0;

  // 1. Gerar ocorrências de recorrências legadas (RecurringBillOccurrence)
  try {
    generatedOccurrences = await generateRecurringOccurrences(tenantId);
  } catch (error) {
    errors.push(`Occurrences: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 2. Gerar ocorrências de transações unificadas recorrentes (NOVO)
  try {
    generatedUnifiedRecurring = await generateUnifiedRecurringOccurrences(tenantId);
  } catch (error) {
    errors.push(`Unified Recurring: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 3. Gerar transações de parcelas vencidas (legado)
  try {
    generatedInstallments = await generateInstallmentTransactions(tenantId, userId);
  } catch (error) {
    errors.push(`Installments: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 4. Atualizar status de ocorrências vencidas (legado)
  try {
    updatedOverdueOccurrences = await updateOverdueOccurrences(tenantId);
  } catch (error) {
    errors.push(`Overdue Occurrences: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 5. Atualizar status de transações vencidas (incluindo unificadas)
  try {
    updatedOverdueTransactions = await updateOverdueTransactions(tenantId);
  } catch (error) {
    errors.push(`Overdue Transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 6. Atualizar status de transações unificadas vencidas
  try {
    await transactionService.updateOverdueStatus(tenantId);
  } catch (error) {
    errors.push(`Unified Overdue: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  log.info('generateAllTransactions completed', {
    tenantId,
    generatedOccurrences,
    generatedUnifiedRecurring,
    generatedInstallments,
    updatedOverdueOccurrences,
    updatedOverdueTransactions,
    errors,
  });

  return {
    generatedOccurrences,
    generatedUnifiedRecurring,
    generatedInstallments,
    updatedOverdueOccurrences,
    updatedOverdueTransactions,
    errors,
  };
}
