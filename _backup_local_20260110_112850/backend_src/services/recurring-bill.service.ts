/**
 * RecurringBillService - Serviço Unificado de Contas Recorrentes
 * 
 * Responsável por:
 * - Geração de ocorrências (única fonte de verdade)
 * - Pagamento atômico de ocorrências
 * - Cancelamento de ocorrências
 * - Atualização de status de vencidos
 * 
 * REGRAS CRÍTICAS:
 * 1. Geração de ocorrências NÃO mexe em saldo
 * 2. Pagamento é ATÔMICO (Occurrence + Transaction + Saldo em uma transação)
 * 3. Usa helper de datas para tratar dueDay > dias do mês
 * 4. Valida duplicatas por recurringBillId + dueDate (não por string)
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma-client';
import { log } from '../utils/logger';
import { getSafeDueDate, getNextDueDate, startOfDay, endOfDay, diffInDays } from '../utils/date-helpers';
import { cacheService, CacheNamespace } from './cache.service';

export interface GenerateOccurrencesResult {
  generated: number;
  skipped: number;
  dates: Date[];
}

export interface PayOccurrenceResult {
  occurrence: any;
  transaction: any | null;
  balanceUpdated: boolean;
  nextOccurrenceGenerated: boolean;
}

export interface CancelOccurrenceResult {
  occurrence: any;
  message: string;
}

export class RecurringBillService {
  /**
   * Gera ocorrências futuras para uma conta recorrente
   * 
   * @param recurringBillId ID da conta recorrente
   * @param tenantId ID do tenant
   * @param months Quantidade de meses/períodos a gerar
   * @returns Resultado da geração
   */
  async generateOccurrences(
    recurringBillId: string,
    tenantId: string,
    months: number = 3
  ): Promise<GenerateOccurrencesResult> {
    const result: GenerateOccurrencesResult = {
      generated: 0,
      skipped: 0,
      dates: [],
    };

    try {
      // Buscar conta recorrente
      const bill = await prisma.recurringBill.findFirst({
        where: {
          id: recurringBillId,
          tenantId,
          deletedAt: null,
        },
      });

      if (!bill) {
        throw new Error('Conta recorrente não encontrada');
      }

      if (bill.status !== 'active') {
        log.info('RecurringBillService.generateOccurrences: bill not active', { 
          recurringBillId, 
          status: bill.status 
        });
        return result;
      }

      // Buscar última ocorrência existente
      const lastOccurrence = await prisma.recurringBillOccurrence.findFirst({
        where: { recurringBillId },
        orderBy: { dueDate: 'desc' },
      });

      // Determinar data inicial
      const today = startOfDay(new Date());
      let startDate: Date;

      if (lastOccurrence) {
        // Se já existe ocorrência, começar do próximo período
        startDate = getNextDueDate(
          lastOccurrence.dueDate,
          bill.frequency,
          bill.dueDay,
          1
        );
      } else if (bill.firstDueDate) {
        // Se tem firstDueDate configurado
        startDate = new Date(bill.firstDueDate);
      } else {
        // Calcular a partir do mês atual
        const currentMonthDue = getSafeDueDate(
          today.getFullYear(),
          today.getMonth(),
          bill.dueDay
        );

        // Se o vencimento deste mês já passou, começar do próximo
        if (currentMonthDue < today) {
          startDate = getNextDueDate(currentMonthDue, bill.frequency, bill.dueDay, 1);
        } else {
          startDate = currentMonthDue;
        }
      }

      log.info('RecurringBillService.generateOccurrences: starting', {
        recurringBillId,
        startDate: startDate.toISOString(),
        months,
      });

      // Gerar ocorrências
      for (let i = 0; i < months; i++) {
        const dueDate = getNextDueDate(startDate, bill.frequency, bill.dueDay, i);

        // Verificar se já existe ocorrência nesta data
        const existing = await prisma.recurringBillOccurrence.findFirst({
          where: {
            recurringBillId,
            dueDate: {
              gte: startOfDay(dueDate),
              lte: endOfDay(dueDate),
            },
          },
        });

        if (existing) {
          result.skipped++;
          log.debug('Occurrence already exists', { dueDate: dueDate.toISOString() });
          continue;
        }

        // Verificar limites de data
        if (bill.lastDueDate && dueDate > bill.lastDueDate) {
          log.debug('Due date exceeds lastDueDate', { 
            dueDate: dueDate.toISOString(),
            lastDueDate: bill.lastDueDate.toISOString(),
          });
          break;
        }

        // Criar ocorrência
        await prisma.recurringBillOccurrence.create({
          data: {
            tenantId,
            recurringBillId,
            dueDate,
            amount: bill.amount || new Prisma.Decimal(0),
            status: 'pending',
          },
        });

        result.generated++;
        result.dates.push(dueDate);

        log.debug('Occurrence created', { dueDate: dueDate.toISOString() });
      }

      log.info('RecurringBillService.generateOccurrences: completed', {
        recurringBillId,
        generated: result.generated,
        skipped: result.skipped,
      });

      return result;

    } catch (error) {
      log.error('RecurringBillService.generateOccurrences error', { 
        error, 
        recurringBillId 
      });
      throw error;
    }
  }

  /**
   * Paga uma ocorrência de forma ATÔMICA
   * 
   * Operações realizadas em uma única transação:
   * 1. Atualiza RecurringBillOccurrence (status: paid)
   * 2. Cria Transaction (status: completed)
   * 3. Atualiza BankAccount.currentBalance
   * 4. Gera próxima ocorrência se autoGenerate = true
   * 
   * @param occurrenceId ID da ocorrência
   * @param tenantId ID do tenant
   * @param userId ID do usuário
   * @param options Opções de pagamento
   */
  async payOccurrence(
    occurrenceId: string,
    tenantId: string,
    userId: string,
    options: {
      paidAmount?: number;
      paidDate?: Date;
      createTransaction?: boolean;
      notes?: string;
    } = {}
  ): Promise<PayOccurrenceResult> {
    const { 
      paidAmount, 
      paidDate = new Date(), 
      createTransaction = true,
      notes,
    } = options;

    try {
      // Buscar ocorrência com bill
      const occurrence = await prisma.recurringBillOccurrence.findFirst({
        where: {
          id: occurrenceId,
          tenantId,
        },
        include: {
          recurringBill: true,
        },
      });

      if (!occurrence) {
        throw new Error('Ocorrência não encontrada');
      }

      if (occurrence.status === 'paid') {
        throw new Error('Ocorrência já foi paga');
      }

      const bill = occurrence.recurringBill;
      if (!bill) {
        throw new Error('Conta recorrente não encontrada');
      }

      const finalAmount = paidAmount ?? Number(occurrence.amount);
      const actualPaymentDate = startOfDay(paidDate);
      const dueDate = startOfDay(occurrence.dueDate);

      // Calcular se é antecipado/atrasado
      const daysDiff = diffInDays(actualPaymentDate, dueDate);
      const isPaidEarly = daysDiff < 0;
      const isPaidLate = daysDiff > 0;
      const daysEarlyLate = Math.abs(daysDiff);

      let result: PayOccurrenceResult = {
        occurrence: null,
        transaction: null,
        balanceUpdated: false,
        nextOccurrenceGenerated: false,
      };

      // Executar tudo em transação atômica
      await prisma.$transaction(async (tx) => {
        // 1. Atualizar ocorrência
        result.occurrence = await tx.recurringBillOccurrence.update({
          where: { id: occurrenceId },
          data: {
            status: 'paid',
            paidDate: actualPaymentDate,
            paidAmount: finalAmount,
            notes: notes || occurrence.notes,
          },
        });

        // 2. Criar transação se solicitado
        if (createTransaction && bill.bankAccountId && bill.categoryId) {
          result.transaction = await tx.transaction.create({
            data: {
              tenantId,
              userId,
              type: bill.type,
              categoryId: bill.categoryId,
              bankAccountId: bill.bankAccountId,
              paymentMethodId: bill.paymentMethodId,
              amount: finalAmount,
              description: `Pagamento: ${bill.name}`,
              transactionDate: occurrence.dueDate,
              dueDate: occurrence.dueDate,
              paidDate: actualPaymentDate,
              isPaidEarly,
              isPaidLate,
              daysEarlyLate: daysDiff !== 0 ? daysEarlyLate : null,
              status: 'completed',
              isRecurring: true,
              isFixed: bill.isFixed,
              recurringBillId: bill.id,
            },
          });

          // 3. Atualizar saldo
          if (bill.type === 'expense') {
            await tx.bankAccount.update({
              where: { id: bill.bankAccountId },
              data: { currentBalance: { decrement: finalAmount } },
            });
          } else {
            await tx.bankAccount.update({
              where: { id: bill.bankAccountId },
              data: { currentBalance: { increment: finalAmount } },
            });
          }

          result.balanceUpdated = true;
        }
      });

      // 4. Gerar próxima ocorrência (fora da transação principal)
      if (bill.autoGenerate && bill.status === 'active') {
        try {
          const genResult = await this.generateOccurrences(bill.id, tenantId, 1);
          result.nextOccurrenceGenerated = genResult.generated > 0;
        } catch (error) {
          // Log mas não falha a operação
          log.warn('Failed to generate next occurrence', { 
            recurringBillId: bill.id, 
            error 
          });
        }
      }

      // Invalidar caches
      await cacheService.invalidateMultiple([
        CacheNamespace.DASHBOARD,
        CacheNamespace.REPORTS,
        CacheNamespace.TRANSACTIONS,
        CacheNamespace.ACCOUNTS,
      ]);

      log.info('RecurringBillService.payOccurrence: completed', {
        occurrenceId,
        transactionId: result.transaction?.id,
        amount: finalAmount,
        isPaidEarly,
        isPaidLate,
        daysEarlyLate,
      });

      return result;

    } catch (error) {
      log.error('RecurringBillService.payOccurrence error', { 
        error, 
        occurrenceId 
      });
      throw error;
    }
  }

  /**
   * Cancela/pula uma ocorrência
   * NÃO mexe em saldo (não tinha transação associada)
   */
  async skipOccurrence(
    occurrenceId: string,
    tenantId: string,
    reason?: string
  ): Promise<CancelOccurrenceResult> {
    try {
      const occurrence = await prisma.recurringBillOccurrence.findFirst({
        where: {
          id: occurrenceId,
          tenantId,
        },
      });

      if (!occurrence) {
        throw new Error('Ocorrência não encontrada');
      }

      if (occurrence.status === 'paid') {
        throw new Error('Não é possível pular uma ocorrência já paga');
      }

      const updated = await prisma.recurringBillOccurrence.update({
        where: { id: occurrenceId },
        data: {
          status: 'skipped',
          notes: reason || 'Pulada pelo usuário',
        },
      });

      log.info('RecurringBillService.skipOccurrence: completed', {
        occurrenceId,
        reason,
      });

      return {
        occurrence: updated,
        message: 'Ocorrência marcada como pulada',
      };

    } catch (error) {
      log.error('RecurringBillService.skipOccurrence error', { 
        error, 
        occurrenceId 
      });
      throw error;
    }
  }

  /**
   * Atualiza status de ocorrências vencidas para 'overdue'
   */
  async updateOverdueOccurrences(tenantId: string): Promise<number> {
    const today = startOfDay(new Date());

    const result = await prisma.recurringBillOccurrence.updateMany({
      where: {
        tenantId,
        status: 'pending',
        dueDate: { lt: today },
      },
      data: {
        status: 'overdue',
      },
    });

    log.info('RecurringBillService.updateOverdueOccurrences', {
      tenantId,
      updated: result.count,
    });

    return result.count;
  }

  /**
   * Gera ocorrências para todas as contas recorrentes ativas de um tenant
   */
  async generateAllOccurrences(tenantId: string): Promise<{
    totalGenerated: number;
    totalSkipped: number;
    billsProcessed: number;
    errors: string[];
  }> {
    const result = {
      totalGenerated: 0,
      totalSkipped: 0,
      billsProcessed: 0,
      errors: [] as string[],
    };

    try {
      const activeBills = await prisma.recurringBill.findMany({
        where: {
          tenantId,
          status: 'active',
          autoGenerate: true,
          deletedAt: null,
        },
      });

      for (const bill of activeBills) {
        try {
          const genResult = await this.generateOccurrences(
            bill.id,
            tenantId,
            bill.monthsAhead || 3
          );
          result.totalGenerated += genResult.generated;
          result.totalSkipped += genResult.skipped;
          result.billsProcessed++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Bill ${bill.id}: ${errorMsg}`);
          log.error('Error generating occurrences for bill', { 
            billId: bill.id, 
            error 
          });
        }
      }

      log.info('RecurringBillService.generateAllOccurrences: completed', result);
      return result;

    } catch (error) {
      log.error('RecurringBillService.generateAllOccurrences error', { error });
      throw error;
    }
  }
}

// Instância singleton
export const recurringBillService = new RecurringBillService();
