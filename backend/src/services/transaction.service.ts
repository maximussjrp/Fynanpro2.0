/**
 * TransactionService - Serviço de Transações
 */

import { prisma } from '../utils/prisma-client';
import { log } from '../utils/logger';
import { CreateTransactionDTO, UpdateTransactionDTO, TransactionFiltersDTO } from '../dtos/transaction.dto';
import { cacheService, CacheNamespace } from './cache.service';

// Interfaces
interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  totalTransfers: number;
  balance: number;
  transactionCount: number;
  avgTransactionValue: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class TransactionService {
  /**
   * Lista todas as transações com filtros e paginação
   */
  async getAll(
    tenantId: string,
    filters: TransactionFiltersDTO
  ): Promise<PaginatedResponse<any>> {
    try {
      log.info('TransactionService.getAll', { tenantId, filters });

      // Build where clause
      const where: any = {
        tenantId,
        deletedAt: null,
      };

      if (filters.startDate && filters.endDate) {
        const startDate = new Date(filters.startDate);
        startDate.setHours(0, 0, 0, 0); // Início do dia
        
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Final do dia
        
        where.transactionDate = {
          gte: startDate,
          lte: endDate,
        };
      }

      if (filters.type) {
        where.type = filters.type;
      }

      if (filters.categoryId) {
        where.categoryId = filters.categoryId;
      }

      if (filters.bankAccountId) {
        where.bankAccountId = filters.bankAccountId;
      }

      if (filters.paymentMethodId) {
        where.paymentMethodId = filters.paymentMethodId;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      // Pagination
      const page = Number(filters.page) || 1;
      const limit = Number(filters.limit) || 50;
      const skip = (page - 1) * limit;

      // Get transactions with relations
      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                type: true,
                icon: true,
                color: true,
              },
            },
            bankAccount: {
              select: {
                id: true,
                name: true,
                type: true,
                institution: true,
              },
            },
            paymentMethod: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
          orderBy: {
            transactionDate: 'desc',
          },
          skip,
          take: limit,
        }),
        prisma.transaction.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      log.info('TransactionService.getAll success', { 
        tenantId, 
        count: transactions.length,
        total 
      });

      return {
        data: transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      log.error('TransactionService.getAll error', { error, tenantId, filters });
      throw error;
    }
  }

  /**
   * Busca uma transação por ID
   */
  async getById(id: string, tenantId: string): Promise<any> {
    try {
      log.info('TransactionService.getById', { id, tenantId });

      const transaction = await prisma.transaction.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        include: {
          category: true,
          bankAccount: true,
          paymentMethod: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      if (!transaction) {
        throw new Error('Transação não encontrada');
      }

      log.info('TransactionService.getById success', { id, tenantId });

      return transaction;
    } catch (error) {
      log.error('TransactionService.getById error', { error, id, tenantId });
      throw error;
    }
  }

  /**
   * Cria uma nova transação com validação e atualização de saldo
   */
  async create(
    data: CreateTransactionDTO,
    userId: string,
    tenantId: string
  ): Promise<any> {
    try {
      log.info('TransactionService.create', { data, userId, tenantId });

      // Validate category exists and belongs to tenant (apenas para income/expense)
      if (data.categoryId) {
        const category = await prisma.category.findFirst({
          where: {
            id: data.categoryId,
            tenantId,
            deletedAt: null,
          },
        });

        if (!category) {
          throw new Error('Categoria não encontrada');
        }

        // Validate category type matches transaction type
        if (data.type === 'income' && category.type !== 'income') {
          throw new Error('Categoria não é de receita');
        }

        if (data.type === 'expense' && category.type !== 'expense') {
          throw new Error('Categoria não é de despesa');
        }
      }

      // Validate bank account exists
      if (data.bankAccountId) {
        const bankAccount = await prisma.bankAccount.findFirst({
          where: {
            id: data.bankAccountId,
            tenantId,
            deletedAt: null,
          },
        });

        if (!bankAccount) {
          throw new Error('Conta bancária não encontrada');
        }
      }

      // Validate payment method exists
      if (data.paymentMethodId) {
        const paymentMethod = await prisma.paymentMethod.findFirst({
          where: {
            id: data.paymentMethodId,
            tenantId,
            deletedAt: null,
          },
        });

        if (!paymentMethod) {
          throw new Error('Meio de pagamento não encontrado');
        }
      }

      // Determine status based on date
      const transactionDate = new Date(data.transactionDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let finalStatus = data.status || 'pending';
      if (transactionDate <= today && finalStatus === 'pending') {
        finalStatus = 'completed';
      }

      // Create transaction with atomic balance update
      const transaction = await prisma.$transaction(async (tx) => {
        // Create transaction
        const newTransaction = await tx.transaction.create({
          data: {
            tenantId,
            userId,
            type: data.type,
            categoryId: data.categoryId || null,
            bankAccountId: data.bankAccountId || null,
            paymentMethodId: data.paymentMethodId || null,
            amount: data.amount,
            description: data.description,
            transactionDate,
            status: finalStatus,
            notes: data.notes || null,
            tags: data.tags || null,
          },
          include: {
            category: true,
            bankAccount: true,
            paymentMethod: true,
          },
        });

        // Update bank account balance if completed
        if (finalStatus === 'completed' && data.bankAccountId) {
          if (data.type === 'income') {
            await tx.bankAccount.update({
              where: { id: data.bankAccountId },
              data: {
                currentBalance: {
                  increment: data.amount,
                },
              },
            });
          } else if (data.type === 'expense') {
            await tx.bankAccount.update({
              where: { id: data.bankAccountId },
              data: {
                currentBalance: {
                  decrement: data.amount,
                },
              },
            });
          }
        }

        return newTransaction;
      });

      log.info('TransactionService.create success', { 
        transactionId: transaction.id,
        tenantId,
        userId 
      });

      // Invalidar caches relacionados
      await cacheService.invalidateMultiple([
        CacheNamespace.DASHBOARD,
        CacheNamespace.REPORTS,
        CacheNamespace.TRANSACTIONS,
        CacheNamespace.ACCOUNTS,
      ]);

      return transaction;
    } catch (error) {
      log.error('TransactionService.create error', { error, data, userId, tenantId });
      throw error;
    }
  }

  /**
   * Atualiza uma transação com validação e ajuste de saldo
   */
  async update(
    id: string,
    data: UpdateTransactionDTO,
    tenantId: string
  ): Promise<any> {
    try {
      log.info('TransactionService.update', { id, data, tenantId });

      // Find existing transaction
      const existingTransaction = await prisma.transaction.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
      });

      if (!existingTransaction) {
        throw new Error('Transação não encontrada');
      }

      // Validate category if provided
      if (data.categoryId !== undefined && data.categoryId !== null) {
        const category = await prisma.category.findFirst({
          where: {
            id: data.categoryId,
            tenantId,
            deletedAt: null,
          },
        });

        if (!category) {
          throw new Error('Categoria não encontrada');
        }

        const finalType = data.type || existingTransaction.type;
        if (finalType === 'income' && category.type !== 'income') {
          throw new Error('Categoria não é de receita');
        }

        if (finalType === 'expense' && category.type !== 'expense') {
          throw new Error('Categoria não é de despesa');
        }
      }

      // Validate bank account if provided
      if (data.bankAccountId !== undefined && data.bankAccountId !== null) {
        const bankAccount = await prisma.bankAccount.findFirst({
          where: {
            id: data.bankAccountId,
            tenantId,
            deletedAt: null,
          },
        });

        if (!bankAccount) {
          throw new Error('Conta bancária não encontrada');
        }
      }

      // Validate payment method if provided
      if (data.paymentMethodId !== undefined && data.paymentMethodId !== null) {
        const paymentMethod = await prisma.paymentMethod.findFirst({
          where: {
            id: data.paymentMethodId,
            tenantId,
            deletedAt: null,
          },
        });

        if (!paymentMethod) {
          throw new Error('Meio de pagamento não encontrado');
        }
      }

      // Update transaction with atomic balance adjustment
      const updatedTransaction = await prisma.$transaction(async (tx) => {
        // Revert old balance change if completed
        if (existingTransaction.status === 'completed' && existingTransaction.bankAccountId) {
          const oldAmount = parseFloat(existingTransaction.amount.toString());

          if (existingTransaction.type === 'income') {
            await tx.bankAccount.update({
              where: { id: existingTransaction.bankAccountId },
              data: {
                currentBalance: {
                  decrement: oldAmount,
                },
              },
            });
          } else if (existingTransaction.type === 'expense') {
            await tx.bankAccount.update({
              where: { id: existingTransaction.bankAccountId },
              data: {
                currentBalance: {
                  increment: oldAmount,
                },
              },
            });
          }
        }

        // Update transaction
        const updated = await tx.transaction.update({
          where: { id },
          data: {
            type: data.type !== undefined ? data.type : existingTransaction.type,
            categoryId: data.categoryId !== undefined ? data.categoryId : existingTransaction.categoryId,
            bankAccountId: data.bankAccountId !== undefined ? data.bankAccountId : existingTransaction.bankAccountId,
            paymentMethodId: data.paymentMethodId !== undefined ? data.paymentMethodId : existingTransaction.paymentMethodId,
            amount: data.amount !== undefined ? data.amount : existingTransaction.amount,
            description: data.description !== undefined ? data.description : existingTransaction.description,
            transactionDate: data.transactionDate ? new Date(data.transactionDate) : existingTransaction.transactionDate,
            status: data.status !== undefined ? data.status : existingTransaction.status,
            notes: data.notes !== undefined ? data.notes : existingTransaction.notes,
            tags: data.tags !== undefined ? data.tags : existingTransaction.tags,
          },
          include: {
            category: true,
            bankAccount: true,
            paymentMethod: true,
          },
        });

        // Apply new balance change if completed
        const finalStatus = data.status !== undefined ? data.status : existingTransaction.status;
        const finalBankAccountId = data.bankAccountId !== undefined ? data.bankAccountId : existingTransaction.bankAccountId;
        const finalType = data.type !== undefined ? data.type : existingTransaction.type;
        const finalAmount = data.amount !== undefined ? data.amount : parseFloat(existingTransaction.amount.toString());

        if (finalStatus === 'completed' && finalBankAccountId) {
          if (finalType === 'income') {
            await tx.bankAccount.update({
              where: { id: finalBankAccountId },
              data: {
                currentBalance: {
                  increment: finalAmount,
                },
              },
            });
          } else if (finalType === 'expense') {
            await tx.bankAccount.update({
              where: { id: finalBankAccountId },
              data: {
                currentBalance: {
                  decrement: finalAmount,
                },
              },
            });
          }
        }

        return updated;
      });

      log.info('TransactionService.update success', { id, tenantId });

      // Invalidar caches relacionados
      await cacheService.invalidateMultiple([
        CacheNamespace.DASHBOARD,
        CacheNamespace.REPORTS,
        CacheNamespace.TRANSACTIONS,
        CacheNamespace.ACCOUNTS,
      ]);

      return updatedTransaction;
    } catch (error) {
      log.error('TransactionService.update error', { error, id, data, tenantId });
      throw error;
    }
  }

  /**
   * Deleta uma transação (soft delete) com reversão de saldo
   */
  async delete(id: string, tenantId: string): Promise<void> {
    try {
      log.info('TransactionService.delete', { id, tenantId });

      // Find transaction
      const transaction = await prisma.transaction.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
      });

      if (!transaction) {
        throw new Error('Transação não encontrada');
      }

      // Delete with atomic balance revert
      await prisma.$transaction(async (tx) => {
        // Revert balance change if completed
        if (transaction.status === 'completed' && transaction.bankAccountId) {
          const amount = parseFloat(transaction.amount.toString());

          if (transaction.type === 'income') {
            await tx.bankAccount.update({
              where: { id: transaction.bankAccountId },
              data: {
                currentBalance: {
                  decrement: amount,
                },
              },
            });
          } else if (transaction.type === 'expense') {
            await tx.bankAccount.update({
              where: { id: transaction.bankAccountId },
              data: {
                currentBalance: {
                  increment: amount,
                },
              },
            });
          }
        }

        // Soft delete
        await tx.transaction.update({
          where: { id },
          data: {
            deletedAt: new Date(),
          },
        });
      });

      log.info('TransactionService.delete success', { id, tenantId });

      // Invalidar caches relacionados
      await cacheService.invalidateMultiple([
        CacheNamespace.DASHBOARD,
        CacheNamespace.REPORTS,
        CacheNamespace.TRANSACTIONS,
        CacheNamespace.ACCOUNTS,
      ]);
    } catch (error) {
      log.error('TransactionService.delete error', { error, id, tenantId });
      throw error;
    }
  }

  /**
   * Calcula resumo financeiro das transações
   */
  async getSummary(
    tenantId: string,
    filters: TransactionFiltersDTO
  ): Promise<TransactionSummary> {
    try {
      log.info('TransactionService.getSummary', { tenantId, filters });

      // Build where clause
      const where: any = {
        tenantId,
        deletedAt: null,
        status: 'completed', // Apenas transações concluídas
      };

      if (filters.startDate && filters.endDate) {
        const startDate = new Date(filters.startDate);
        startDate.setHours(0, 0, 0, 0); // Início do dia
        
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Final do dia
        
        where.transactionDate = {
          gte: startDate,
          lte: endDate,
        };
      }

      if (filters.categoryId) {
        where.categoryId = filters.categoryId;
      }

      if (filters.bankAccountId) {
        where.bankAccountId = filters.bankAccountId;
      }

      // Get aggregated data
      const [incomeData, expenseData, transferData, transactionCount] = await Promise.all([
        prisma.transaction.aggregate({
          where: { ...where, type: 'income' },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.transaction.aggregate({
          where: { ...where, type: 'expense' },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.transaction.aggregate({
          where: { ...where, type: 'transfer' },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.transaction.count({ where }),
      ]);

      const totalIncome = parseFloat(incomeData._sum.amount?.toString() || '0');
      const totalExpense = parseFloat(expenseData._sum.amount?.toString() || '0');
      const totalTransfers = parseFloat(transferData._sum.amount?.toString() || '0');
      const balance = totalIncome - totalExpense;
      const avgTransactionValue = transactionCount > 0 
        ? (totalIncome + totalExpense + totalTransfers) / transactionCount 
        : 0;

      const summary = {
        totalIncome,
        totalExpense,
        totalTransfers,
        balance,
        transactionCount,
        avgTransactionValue,
      };

      log.info('TransactionService.getSummary success', { tenantId, summary });

      return summary;
    } catch (error) {
      log.error('TransactionService.getSummary error', { error, tenantId, filters });
      throw error;
    }
  }

  /**
   * Paga uma transação
   */
  async pay(transactionId: string, data: any): Promise<any> {
    try {
      log.info('TransactionService.pay', { transactionId, data });

      const transaction = await prisma.transaction.update({
        where: { id: transactionId },
        data,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              icon: true,
              color: true,
            },
          },
          bankAccount: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          paymentMethod: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      });

      log.info('TransactionService.pay success', { transactionId });

      return transaction;
    } catch (error) {
      log.error('TransactionService.pay error', { error, transactionId });
      throw error;
    }
  }

  /**
   * Busca conta bancária
   */
  async getBankAccount(tenantId: string, bankAccountId: string): Promise<any> {
    try {
      const bankAccount = await prisma.bankAccount.findFirst({
        where: {
          id: bankAccountId,
          tenantId,
          deletedAt: null,
        },
      });

      return bankAccount;
    } catch (error) {
      log.error('TransactionService.getBankAccount error', { error, tenantId, bankAccountId });
      throw error;
    }
  }

  /**
   * Atualiza saldo da conta bancária
   */
  async updateBankAccountBalance(tenantId: string, bankAccountId: string, amount: number): Promise<any> {
    try {
      log.info('TransactionService.updateBankAccountBalance', { tenantId, bankAccountId, amount });

      const bankAccount = await prisma.bankAccount.update({
        where: {
          id: bankAccountId,
        },
        data: {
          currentBalance: {
            increment: amount,
          },
        },
      });

      log.info('TransactionService.updateBankAccountBalance success', { bankAccountId, newBalance: bankAccount.currentBalance });

      return bankAccount;
    } catch (error) {
      log.error('TransactionService.updateBankAccountBalance error', { error, tenantId, bankAccountId, amount });
      throw error;
    }
  }

  /**
   * Busca recurring bill
   */
  async getRecurringBill(tenantId: string, recurringBillId: string): Promise<any> {
    try {
      const recurringBill = await prisma.recurringBill.findFirst({
        where: {
          id: recurringBillId,
          tenantId,
          deletedAt: null,
        },
      });

      return recurringBill;
    } catch (error) {
      log.error('TransactionService.getRecurringBill error', { error, tenantId, recurringBillId });
      throw error;
    }
  }

  /**
   * Busca transação por data e recurring bill
   */
  async findByDateAndRecurringBill(tenantId: string, recurringBillId: string, dueDate: Date): Promise<any> {
    try {
      const transaction = await prisma.transaction.findFirst({
        where: {
          tenantId,
          recurringBillId,
          dueDate: {
            gte: new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()),
            lt: new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate() + 1),
          },
          deletedAt: null,
        },
      });

      return transaction;
    } catch (error) {
      log.error('TransactionService.findByDateAndRecurringBill error', { error, tenantId, recurringBillId, dueDate });
      throw error;
    }
  }

  /**
   * Cria notificação
   */
  async createNotification(tenantId: string, userId: string, data: any): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          tenantId,
          userId,
          ...data,
        },
      });

      log.info('TransactionService.createNotification success', { tenantId, userId, type: data.type });
    } catch (error) {
      log.error('TransactionService.createNotification error', { error, tenantId, userId });
      // Não falha o pagamento se notificação falhar
    }
  }

  // ==================== MÉTODOS PARA TRANSAÇÕES UNIFICADAS ====================

  /**
   * Cria uma transação recorrente (pai + primeira ocorrência)
   */
  async createRecurring(
    data: CreateTransactionDTO,
    userId: string,
    tenantId: string
  ): Promise<any> {
    try {
      log.info('TransactionService.createRecurring', { data, userId, tenantId });

      // Validações básicas
      if (!data.frequency) {
        throw new Error('Frequência é obrigatória para transações recorrentes');
      }

      const startDate = data.transactionDate ? new Date(data.transactionDate) : new Date();
      const nextDueDate = this.calculateNextDueDate(startDate, data.frequency, data.frequencyInterval || 1);

      // Criar transação pai (template)
      const result = await prisma.$transaction(async (tx) => {
        // Criar transação pai
        const parentTransaction = await tx.transaction.create({
          data: {
            tenantId,
            userId,
            type: data.type,
            transactionType: 'recurring',
            categoryId: data.categoryId || null,
            bankAccountId: data.bankAccountId || null,
            paymentMethodId: data.paymentMethodId || null,
            amount: data.amount,
            description: data.description,
            transactionDate: startDate,
            dueDate: startDate,
            status: 'scheduled', // Pai sempre fica como template
            frequency: data.frequency,
            frequencyInterval: data.frequencyInterval || 1,
            totalOccurrences: data.totalInstallments || null, // null = infinito
            startDate: startDate,
            endDate: data.totalInstallments && data.frequency
              ? this.calculateEndDate(startDate, data.frequency, data.frequencyInterval || 1, data.totalInstallments)
              : null,
            nextDueDate: nextDueDate,
            alertDaysBefore: 3,
            autoGenerateNext: true,
            isRecurring: true,
            isFixed: true,
            notes: data.notes || null,
            tags: data.tags || null,
          },
        });

        // Criar primeira ocorrência
        const firstOccurrence = await tx.transaction.create({
          data: {
            tenantId,
            userId,
            type: data.type,
            transactionType: 'recurring',
            parentId: parentTransaction.id,
            categoryId: data.categoryId || null,
            bankAccountId: data.bankAccountId || null,
            paymentMethodId: data.paymentMethodId || null,
            amount: data.amount,
            description: data.description,
            transactionDate: startDate,
            dueDate: startDate,
            status: 'pending',
            frequency: data.frequency,
            occurrenceNumber: 1,
            isRecurring: true,
            isFixed: true,
            notes: data.notes || null,
            tags: data.tags || null,
          },
          include: {
            category: true,
            bankAccount: true,
            paymentMethod: true,
          },
        });

        // Atualizar pai com referência ao próximo vencimento
        await tx.transaction.update({
          where: { id: parentTransaction.id },
          data: { nextDueDate },
        });

        return { parent: parentTransaction, firstOccurrence };
      });

      log.info('TransactionService.createRecurring success', { 
        parentId: result.parent.id,
        firstOccurrenceId: result.firstOccurrence.id,
        tenantId 
      });

      // Invalidar caches
      await cacheService.invalidateMultiple([
        CacheNamespace.DASHBOARD,
        CacheNamespace.REPORTS,
        CacheNamespace.TRANSACTIONS,
      ]);

      return result;
    } catch (error) {
      log.error('TransactionService.createRecurring error', { error, data, userId, tenantId });
      throw error;
    }
  }

  /**
   * Cria uma transação parcelada (pai + todas as parcelas)
   */
  async createInstallment(
    data: CreateTransactionDTO,
    userId: string,
    tenantId: string
  ): Promise<any> {
    try {
      log.info('TransactionService.createInstallment', { data, userId, tenantId });

      // Validações
      if (!data.totalInstallments || data.totalInstallments < 2) {
        throw new Error('Número de parcelas deve ser maior que 1');
      }

      if (data.totalInstallments > 72) {
        throw new Error('Número máximo de parcelas é 72');
      }

      const startDate = data.transactionDate ? new Date(data.transactionDate) : new Date();
      const originalAmount = data.amount;
      const hasDownPayment = data.hasDownPayment || false;
      const downPaymentAmount = hasDownPayment ? (data.downPaymentAmount || originalAmount / data.totalInstallments) : 0;
      
      // Calcular valor das parcelas
      const remainingAmount = originalAmount - downPaymentAmount;
      const numInstallments = hasDownPayment ? data.totalInstallments - 1 : data.totalInstallments;
      const installmentAmount = numInstallments > 0 ? remainingAmount / numInstallments : 0;

      const result = await prisma.$transaction(async (tx) => {
        // Criar transação pai (template)
        const parentTransaction = await tx.transaction.create({
          data: {
            tenantId,
            userId,
            type: data.type,
            transactionType: 'installment',
            categoryId: data.categoryId || null,
            bankAccountId: data.bankAccountId || null,
            paymentMethodId: data.paymentMethodId || null,
            amount: originalAmount,
            originalAmount: originalAmount,
            description: data.description,
            transactionDate: startDate,
            dueDate: startDate,
            status: 'scheduled',
            totalInstallments: data.totalInstallments,
            hasDownPayment: hasDownPayment,
            downPaymentAmount: hasDownPayment ? downPaymentAmount : null,
            startDate: startDate,
            endDate: data.totalInstallments ? this.addMonths(startDate, data.totalInstallments) : null,
            isRecurring: false,
            isFixed: true,
            notes: data.notes || null,
            tags: data.tags || null,
          },
        });

        const installments: any[] = [];

        // Criar entrada se houver
        if (hasDownPayment && downPaymentAmount > 0) {
          const downPayment = await tx.transaction.create({
            data: {
              tenantId,
              userId,
              type: data.type,
              transactionType: 'installment',
              parentId: parentTransaction.id,
              categoryId: data.categoryId || null,
              bankAccountId: data.bankAccountId || null,
              paymentMethodId: data.paymentMethodId || null,
              amount: downPaymentAmount,
              originalAmount: originalAmount,
              description: `${data.description} - Entrada`,
              transactionDate: startDate,
              dueDate: startDate,
              status: 'pending',
              installmentNumber: 0, // Entrada = parcela 0
              totalInstallments: data.totalInstallments,
              isRecurring: false,
              isFixed: true,
              notes: data.notes || null,
              tags: data.tags || null,
            },
            include: {
              category: true,
              bankAccount: true,
              paymentMethod: true,
            },
          });
          installments.push(downPayment);
        }

        // Criar todas as parcelas
        for (let i = 1; i <= numInstallments; i++) {
          const dueDate = this.addMonths(startDate, hasDownPayment ? i : i - 1);
          
          const installment = await tx.transaction.create({
            data: {
              tenantId,
              userId,
              type: data.type,
              transactionType: 'installment',
              parentId: parentTransaction.id,
              categoryId: data.categoryId || null,
              bankAccountId: data.bankAccountId || null,
              paymentMethodId: data.paymentMethodId || null,
              amount: installmentAmount,
              originalAmount: originalAmount,
              description: `${data.description} - Parcela ${i}/${numInstallments}`,
              transactionDate: dueDate,
              dueDate: dueDate,
              status: 'pending',
              installmentNumber: i,
              totalInstallments: data.totalInstallments,
              isRecurring: false,
              isFixed: true,
              notes: data.notes || null,
              tags: data.tags || null,
            },
            include: {
              category: true,
              bankAccount: true,
              paymentMethod: true,
            },
          });
          installments.push(installment);
        }

        return { parent: parentTransaction, installments };
      });

      log.info('TransactionService.createInstallment success', { 
        parentId: result.parent.id,
        installmentsCount: result.installments.length,
        tenantId 
      });

      // Invalidar caches
      await cacheService.invalidateMultiple([
        CacheNamespace.DASHBOARD,
        CacheNamespace.REPORTS,
        CacheNamespace.TRANSACTIONS,
      ]);

      return result;
    } catch (error) {
      log.error('TransactionService.createInstallment error', { error, data, userId, tenantId });
      throw error;
    }
  }

  /**
   * Gera próxima ocorrência de uma transação recorrente
   */
  async generateNextOccurrence(parentId: string, tenantId: string): Promise<any> {
    try {
      log.info('TransactionService.generateNextOccurrence', { parentId, tenantId });

      // Buscar transação pai
      const parent = await prisma.transaction.findFirst({
        where: {
          id: parentId,
          tenantId,
          transactionType: 'recurring',
          deletedAt: null,
        },
        include: {
          children: {
            where: { deletedAt: null },
            orderBy: { occurrenceNumber: 'desc' },
            take: 1,
          },
        },
      });

      if (!parent) {
        throw new Error('Transação recorrente não encontrada');
      }

      // Verificar se atingiu limite de ocorrências
      const lastOccurrence = parent.children[0];
      const nextOccurrenceNumber = (lastOccurrence?.occurrenceNumber || 0) + 1;

      if (parent.totalOccurrences && nextOccurrenceNumber > parent.totalOccurrences) {
        throw new Error('Limite de ocorrências atingido');
      }

      // Verificar data final
      if (parent.endDate && parent.nextDueDate && parent.nextDueDate > parent.endDate) {
        throw new Error('Data final da recorrência atingida');
      }

      // Criar próxima ocorrência
      const nextDueDate = parent.nextDueDate || new Date();
      const newNextDueDate = this.calculateNextDueDate(
        nextDueDate, 
        parent.frequency || 'monthly', 
        parent.frequencyInterval || 1
      );

      const result = await prisma.$transaction(async (tx) => {
        // Criar nova ocorrência
        const newOccurrence = await tx.transaction.create({
          data: {
            tenantId,
            userId: parent.userId,
            type: parent.type,
            transactionType: 'recurring',
            parentId: parent.id,
            categoryId: parent.categoryId,
            bankAccountId: parent.bankAccountId,
            paymentMethodId: parent.paymentMethodId,
            amount: parent.amount,
            description: parent.description,
            transactionDate: nextDueDate,
            dueDate: nextDueDate,
            status: 'pending',
            frequency: parent.frequency,
            occurrenceNumber: nextOccurrenceNumber,
            isRecurring: true,
            isFixed: parent.isFixed,
            notes: parent.notes,
            tags: parent.tags,
          },
          include: {
            category: true,
            bankAccount: true,
            paymentMethod: true,
          },
        });

        // Atualizar próxima data no pai
        await tx.transaction.update({
          where: { id: parent.id },
          data: { nextDueDate: newNextDueDate },
        });

        return newOccurrence;
      });

      log.info('TransactionService.generateNextOccurrence success', { 
        parentId,
        newOccurrenceId: result.id,
        occurrenceNumber: nextOccurrenceNumber 
      });

      return result;
    } catch (error) {
      log.error('TransactionService.generateNextOccurrence error', { error, parentId, tenantId });
      throw error;
    }
  }

  /**
   * Atualiza status de uma transação (workflow de pagamento)
   */
  async updateStatus(
    id: string, 
    newStatus: string, 
    tenantId: string,
    paidDate?: Date,
    paidAmount?: number
  ): Promise<any> {
    try {
      log.info('TransactionService.updateStatus', { id, newStatus, tenantId });

      const transaction = await prisma.transaction.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
      });

      if (!transaction) {
        throw new Error('Transação não encontrada');
      }

      // Calcular se pago antecipado ou atrasado
      let isPaidEarly: boolean | null = null;
      let isPaidLate: boolean | null = null;
      let daysEarlyLate: number | null = null;

      if (newStatus === 'completed' && transaction.dueDate) {
        const paymentDate = paidDate || new Date();
        const dueDate = new Date(transaction.dueDate);
        const diffTime = dueDate.getTime() - paymentDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
          isPaidEarly = true;
          isPaidLate = false;
          daysEarlyLate = diffDays;
        } else if (diffDays < 0) {
          isPaidEarly = false;
          isPaidLate = true;
          daysEarlyLate = Math.abs(diffDays);
        } else {
          isPaidEarly = false;
          isPaidLate = false;
          daysEarlyLate = 0;
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        // Reverter saldo se estava completa
        if (transaction.status === 'completed' && transaction.bankAccountId) {
          const amount = parseFloat(transaction.amount.toString());
          if (transaction.type === 'income') {
            await tx.bankAccount.update({
              where: { id: transaction.bankAccountId },
              data: { currentBalance: { decrement: amount } },
            });
          } else if (transaction.type === 'expense') {
            await tx.bankAccount.update({
              where: { id: transaction.bankAccountId },
              data: { currentBalance: { increment: amount } },
            });
          }
        }

        // Atualizar transação
        const updated = await tx.transaction.update({
          where: { id },
          data: {
            status: newStatus,
            paidDate: newStatus === 'completed' ? (paidDate || new Date()) : null,
            isPaidEarly,
            isPaidLate,
            daysEarlyLate,
            amount: paidAmount !== undefined ? paidAmount : transaction.amount,
          },
          include: {
            category: true,
            bankAccount: true,
            paymentMethod: true,
          },
        });

        // Aplicar saldo se ficando completa
        if (newStatus === 'completed' && transaction.bankAccountId) {
          const amount = paidAmount !== undefined ? paidAmount : parseFloat(transaction.amount.toString());
          if (transaction.type === 'income') {
            await tx.bankAccount.update({
              where: { id: transaction.bankAccountId },
              data: { currentBalance: { increment: amount } },
            });
          } else if (transaction.type === 'expense') {
            await tx.bankAccount.update({
              where: { id: transaction.bankAccountId },
              data: { currentBalance: { decrement: amount } },
            });
          }
        }

        return updated;
      });

      // Se for recorrente e completada, gerar próxima
      if (newStatus === 'completed' && 
          transaction.transactionType === 'recurring' && 
          transaction.parentId) {
        try {
          await this.generateNextOccurrence(transaction.parentId, tenantId);
        } catch (e) {
          log.warn('TransactionService.updateStatus - could not generate next occurrence', { error: e });
        }
      }

      log.info('TransactionService.updateStatus success', { id, newStatus });

      // Invalidar caches
      await cacheService.invalidateMultiple([
        CacheNamespace.DASHBOARD,
        CacheNamespace.REPORTS,
        CacheNamespace.TRANSACTIONS,
        CacheNamespace.ACCOUNTS,
      ]);

      return result;
    } catch (error) {
      log.error('TransactionService.updateStatus error', { error, id, newStatus, tenantId });
      throw error;
    }
  }

  /**
   * Pula uma ocorrência de transação recorrente
   */
  async skipOccurrence(id: string, tenantId: string): Promise<any> {
    try {
      log.info('TransactionService.skipOccurrence', { id, tenantId });

      const transaction = await prisma.transaction.findFirst({
        where: {
          id,
          tenantId,
          transactionType: 'recurring',
          parentId: { not: null },
          deletedAt: null,
        },
      });

      if (!transaction) {
        throw new Error('Transação recorrente não encontrada');
      }

      if (transaction.status === 'completed') {
        throw new Error('Transação já foi paga, não pode ser pulada');
      }

      const result = await prisma.transaction.update({
        where: { id },
        data: { status: 'skipped' },
        include: {
          category: true,
          bankAccount: true,
          paymentMethod: true,
        },
      });

      // Gerar próxima ocorrência
      if (transaction.parentId) {
        try {
          await this.generateNextOccurrence(transaction.parentId, tenantId);
        } catch (e) {
          log.warn('TransactionService.skipOccurrence - could not generate next occurrence', { error: e });
        }
      }

      log.info('TransactionService.skipOccurrence success', { id });

      return result;
    } catch (error) {
      log.error('TransactionService.skipOccurrence error', { error, id, tenantId });
      throw error;
    }
  }

  /**
   * Busca todas as transações filhas (ocorrências/parcelas)
   */
  async getChildren(parentId: string, tenantId: string): Promise<any[]> {
    try {
      log.info('TransactionService.getChildren', { parentId, tenantId });

      const children = await prisma.transaction.findMany({
        where: {
          parentId,
          tenantId,
          deletedAt: null,
        },
        include: {
          category: true,
          bankAccount: true,
          paymentMethod: true,
        },
        orderBy: [
          { installmentNumber: 'asc' },
          { occurrenceNumber: 'asc' },
          { dueDate: 'asc' },
        ],
      });

      log.info('TransactionService.getChildren success', { parentId, count: children.length });

      return children;
    } catch (error) {
      log.error('TransactionService.getChildren error', { error, parentId, tenantId });
      throw error;
    }
  }

  /**
   * Busca transações pendentes/vencidas para alertas
   */
  async getPendingAlerts(tenantId: string, userId: string, daysAhead: number = 7): Promise<any[]> {
    try {
      log.info('TransactionService.getPendingAlerts', { tenantId, userId, daysAhead });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const transactions = await prisma.transaction.findMany({
        where: {
          tenantId,
          userId,
          deletedAt: null,
          status: { in: ['pending', 'overdue'] },
          dueDate: {
            lte: futureDate,
          },
        },
        include: {
          category: true,
          bankAccount: true,
        },
        orderBy: { dueDate: 'asc' },
      });

      log.info('TransactionService.getPendingAlerts success', { count: transactions.length });

      return transactions;
    } catch (error) {
      log.error('TransactionService.getPendingAlerts error', { error, tenantId, userId });
      throw error;
    }
  }

  /**
   * Atualiza status de transações vencidas (para job agendado)
   */
  async updateOverdueStatus(tenantId: string): Promise<number> {
    try {
      log.info('TransactionService.updateOverdueStatus', { tenantId });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await prisma.transaction.updateMany({
        where: {
          tenantId,
          deletedAt: null,
          status: 'pending',
          dueDate: {
            lt: today,
          },
        },
        data: {
          status: 'overdue',
        },
      });

      log.info('TransactionService.updateOverdueStatus success', { count: result.count });

      return result.count;
    } catch (error) {
      log.error('TransactionService.updateOverdueStatus error', { error, tenantId });
      throw error;
    }
  }

  // ==================== MÉTODOS UTILITÁRIOS ====================

  /**
   * Calcula próxima data de vencimento baseado na frequência
   */
  private calculateNextDueDate(currentDate: Date, frequency: string, interval: number): Date {
    const next = new Date(currentDate);
    
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + interval);
        break;
      case 'weekly':
        next.setDate(next.getDate() + (7 * interval));
        break;
      case 'biweekly':
        next.setDate(next.getDate() + (14 * interval));
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + interval);
        break;
      case 'bimonthly':
        next.setMonth(next.getMonth() + (2 * interval));
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + (3 * interval));
        break;
      case 'semiannual':
        next.setMonth(next.getMonth() + (6 * interval));
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + interval);
        break;
      case 'custom':
        next.setMonth(next.getMonth() + interval);
        break;
      default:
        next.setMonth(next.getMonth() + 1);
    }
    
    return next;
  }

  /**
   * Calcula data final da recorrência
   */
  private calculateEndDate(startDate: Date, frequency: string, interval: number, occurrences: number): Date {
    let endDate = new Date(startDate);
    
    for (let i = 0; i < occurrences; i++) {
      endDate = this.calculateNextDueDate(endDate, frequency, interval);
    }
    
    return endDate;
  }

  /**
   * Adiciona meses a uma data
   */
  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }
}

// Export singleton
export const transactionService = new TransactionService();

