import { prisma } from '../main';
import { log } from '../utils/logger';

interface NotificationData {
  tenantId: string;
  userId?: string;
  type: string;
  title: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  relatedId?: string;
  relatedType?: string;
  actionUrl?: string;
  transactionId?: string;
}

/**
 * Serviço para criar e gerenciar notificações
 */
export class NotificationService {
  /**
   * Cria uma nova notificação
   */
  static async create(data: NotificationData) {
    try {
      const notification = await prisma.notification.create({
        data: {
          tenantId: data.tenantId,
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          priority: data.priority || 'normal',
          relatedId: data.relatedId,
          relatedType: data.relatedType,
          actionUrl: data.actionUrl,
          transactionId: data.transactionId,
        },
      });

      log.info(`Notificação criada: ${notification.type} para tenant ${data.tenantId}`);
      return notification;
    } catch (error: any) {
      log.error('Erro ao criar notificação:', error);
      throw error;
    }
  }

  /**
   * Verifica vencimentos próximos (3 dias antes)
   */
  static async checkUpcomingBills() {
    try {
      const today = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(today.getDate() + 3);

      // Buscar ocorrências pendentes que vencem em 3 dias
      const upcomingOccurrences = await prisma.recurringBillOccurrence.findMany({
        where: {
          status: 'pending',
          dueDate: {
            gte: threeDaysFromNow,
            lt: new Date(threeDaysFromNow.getTime() + 24 * 60 * 60 * 1000), // Apenas dia específico
          },
        },
        include: {
          recurringBill: {
            include: {
              category: true,
            },
          },
        },
      });

      log.info(`Encontradas ${upcomingOccurrences.length} contas vencendo em 3 dias`);

      for (const occurrence of upcomingOccurrences) {
        // Verificar se já existe notificação para esta ocorrência
        const existingNotification = await prisma.notification.findFirst({
          where: {
            tenantId: occurrence.tenantId,
            relatedId: occurrence.id,
            type: 'payment_due',
          },
        });

        if (!existingNotification) {
          await this.create({
            tenantId: occurrence.tenantId,
            type: 'payment_due',
            title: '💰 Conta a vencer em 3 dias',
            message: `${occurrence.recurringBill.name} no valor de R$ ${occurrence.amount.toFixed(2)} vence em ${occurrence.dueDate.toLocaleDateString('pt-BR')}`,
            priority: 'normal',
            relatedId: occurrence.id,
            relatedType: 'recurring_bill_occurrence',
            actionUrl: `/dashboard/recurring-bills`,
          });
        }
      }

      return upcomingOccurrences.length;
    } catch (error: any) {
      log.error('Erro ao verificar vencimentos próximos:', error);
      throw error;
    }
  }

  /**
   * Verifica contas vencidas
   */
  static async checkOverdueBills() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Atualizar status de ocorrências vencidas
      await prisma.recurringBillOccurrence.updateMany({
        where: {
          status: 'pending',
          dueDate: {
            lt: today,
          },
        },
        data: {
          status: 'overdue',
        },
      });

      // Buscar ocorrências vencidas sem notificação
      const overdueOccurrences = await prisma.recurringBillOccurrence.findMany({
        where: {
          status: 'overdue',
        },
        include: {
          recurringBill: true,
        },
      });

      log.info(`Encontradas ${overdueOccurrences.length} contas vencidas`);

      for (const occurrence of overdueOccurrences) {
        // Verificar se já existe notificação
        const existingNotification = await prisma.notification.findFirst({
          where: {
            tenantId: occurrence.tenantId,
            relatedId: occurrence.id,
            type: 'overdue',
          },
        });

        if (!existingNotification) {
          const daysLate = Math.floor(
            (today.getTime() - occurrence.dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          await this.create({
            tenantId: occurrence.tenantId,
            type: 'overdue',
            title: '⚠️ Conta atrasada!',
            message: `${occurrence.recurringBill.name} está ${daysLate} dia(s) atrasada. Valor: R$ ${occurrence.amount.toFixed(2)}`,
            priority: 'high',
            relatedId: occurrence.id,
            relatedType: 'recurring_bill_occurrence',
            actionUrl: `/dashboard/recurring-bills`,
          });
        }
      }

      return overdueOccurrences.length;
    } catch (error: any) {
      log.error('Erro ao verificar contas vencidas:', error);
      throw error;
    }
  }

  /**
   * Verifica orçamentos próximos do limite
   */
  static async checkBudgetAlerts() {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

      // Buscar orçamentos ativos
      const budgets = await prisma.budget.findMany({
        where: {
          startDate: { gte: startOfMonth },
          endDate: { lte: endOfMonth },
          isActive: true,
        },
        include: {
          category: true,
        },
      });

      log.info(`Verificando ${budgets.length} orçamentos ativos`);

      for (const budget of budgets) {
        // Calcular gastos do orçamento no período
        const expenses = await prisma.transaction.findMany({
          where: {
            tenantId: budget.tenantId,
            categoryId: budget.categoryId,
            type: 'expense',
            transactionDate: {
              gte: budget.startDate,
              lte: budget.endDate,
            },
            status: 'completed',
          },
        });
        
        const spent = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
        const percentage = (spent / Number(budget.amount)) * 100;

        // Alerta 80%
        if (percentage >= 80 && percentage < 100) {
          const existingAlert = await prisma.notification.findFirst({
            where: {
              tenantId: budget.tenantId,
              relatedId: budget.id,
              type: 'budget_alert',
              message: {
                contains: '80%',
              },
            },
          });

          if (!existingAlert) {
            await this.create({
              tenantId: budget.tenantId,
              type: 'budget_alert',
              title: '⚠️ Orçamento em 80%',
              message: `A categoria "${budget.category?.name || 'Sem categoria'}" atingiu 80% do orçamento mensal (R$ ${spent.toFixed(2)} de R$ ${Number(budget.amount).toFixed(2)})`,
              priority: 'normal',
              relatedId: budget.id,
              relatedType: 'budget',
              actionUrl: `/dashboard/budgets`,
            });
          }
        }

        // Alerta 100% (estourou)
        if (percentage >= 100) {
          const existingAlert = await prisma.notification.findFirst({
            where: {
              tenantId: budget.tenantId,
              relatedId: budget.id,
              type: 'budget_alert',
              message: {
                contains: 'estourado',
              },
            },
          });

          if (!existingAlert) {
            await this.create({
              tenantId: budget.tenantId,
              type: 'budget_alert',
              title: '🚨 Orçamento estourado!',
              message: `A categoria "${budget.category?.name || 'Sem categoria'}" estourou o orçamento mensal! Gasto: R$ ${spent.toFixed(2)} (Limite: R$ ${Number(budget.amount).toFixed(2)})`,
              priority: 'high',
              relatedId: budget.id,
              relatedType: 'budget',
              actionUrl: `/dashboard/budgets`,
            });
          }
        }
      }

      return budgets.length;
    } catch (error: any) {
      log.error('Erro ao verificar orçamentos:', error);
      throw error;
    }
  }

  /**
   * Verifica saldo baixo em contas bancárias
   */
  static async checkLowBalance() {
    try {
      const LOW_BALANCE_THRESHOLD = 100; // R$ 100

      const accounts = await prisma.bankAccount.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
      });

      log.info(`Verificando ${accounts.length} contas bancárias`);

      for (const account of accounts) {
        if (Number(account.currentBalance) < LOW_BALANCE_THRESHOLD && Number(account.currentBalance) >= 0) {
          const existingAlert = await prisma.notification.findFirst({
            where: {
              tenantId: account.tenantId,
              relatedId: account.id,
              type: 'low_balance',
              isRead: false,
            },
          });

          if (!existingAlert) {
            await this.create({
              tenantId: account.tenantId,
              type: 'low_balance',
              title: '💸 Saldo baixo',
              message: `A conta "${account.name}" está com saldo baixo: R$ ${account.currentBalance.toFixed(2)}`,
              priority: 'normal',
              relatedId: account.id,
              relatedType: 'bank_account',
              actionUrl: `/dashboard/bank-accounts`,
            });
          }
        }

        // Alerta crítico: saldo negativo
        if (Number(account.currentBalance) < 0) {
          const existingAlert = await prisma.notification.findFirst({
            where: {
              tenantId: account.tenantId,
              relatedId: account.id,
              type: 'low_balance',
              message: {
                contains: 'negativo',
              },
              isRead: false,
            },
          });

          if (!existingAlert) {
            await this.create({
              tenantId: account.tenantId,
              type: 'low_balance',
              title: '🚨 Saldo negativo!',
              message: `A conta "${account.name}" está com saldo negativo: R$ ${account.currentBalance.toFixed(2)}`,
              priority: 'urgent',
              relatedId: account.id,
              relatedType: 'bank_account',
              actionUrl: `/dashboard/bank-accounts`,
            });
          }
        }
      }

      return accounts.length;
    } catch (error: any) {
      log.error('Erro ao verificar saldo baixo:', error);
      throw error;
    }
  }

  /**
   * Executa todas as verificações de notificações
   */
  static async runAllChecks() {
    try {
      log.info('Iniciando verificação de notificações...');

      const results = await Promise.allSettled([
        this.checkUpcomingBills(),
        this.checkOverdueBills(),
        this.checkBudgetAlerts(),
        this.checkLowBalance(),
      ]);

      const summary = {
        upcomingBills: results[0].status === 'fulfilled' ? results[0].value : 0,
        overdueBills: results[1].status === 'fulfilled' ? results[1].value : 0,
        budgetAlerts: results[2].status === 'fulfilled' ? results[2].value : 0,
        lowBalance: results[3].status === 'fulfilled' ? results[3].value : 0,
      };

      log.info('Verificação de notificações concluída:', summary);
      return summary;
    } catch (error: any) {
      log.error('Erro ao executar verificações de notificações:', error);
      throw error;
    }
  }
}
