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
}

// Export singleton
export const transactionService = new TransactionService();

