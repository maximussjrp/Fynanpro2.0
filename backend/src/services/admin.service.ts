import { prisma } from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import { paymentService } from './payment.service';

interface AdminLogData {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  description: string;
  previousValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}

export const adminService = {
  // ==================== LOGS ADMINISTRATIVOS ====================

  /**
   * Registrar ação administrativa
   */
  async log(data: AdminLogData) {
    return prisma.adminLog.create({
      data: {
        adminId: data.adminId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        description: data.description,
        previousValue: data.previousValue ? JSON.stringify(data.previousValue) : null,
        newValue: data.newValue ? JSON.stringify(data.newValue) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      }
    });
  },

  /**
   * Listar logs administrativos
   */
  async getLogs(options?: {
    adminId?: string;
    action?: string;
    targetType?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50 } = options || {};

    const where: any = {};

    if (options?.adminId) where.adminId = options.adminId;
    if (options?.action) where.action = options.action;
    if (options?.targetType) where.targetType = options.targetType;
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options?.startDate) where.createdAt.gte = options.startDate;
      if (options?.endDate) where.createdAt.lte = options.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adminLog.count({ where })
    ]);

    // Buscar nomes dos admins
    const adminIds = [...new Set(logs.map(l => l.adminId))];
    const admins = await prisma.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, fullName: true, email: true }
    });
    const adminMap = new Map(admins.map(a => [a.id, a]));

    return {
      logs: logs.map(log => ({
        ...log,
        previousValue: log.previousValue ? JSON.parse(log.previousValue) : null,
        newValue: log.newValue ? JSON.parse(log.newValue) : null,
        admin: adminMap.get(log.adminId)
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  },

  // ==================== GESTÃO DE ASSINATURAS ====================

  /**
   * Listar todas as assinaturas
   */
  async listSubscriptions(options?: {
    status?: string;
    planId?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50 } = options || {};

    const where: any = {};
    if (options?.status) where.status = options.status;
    if (options?.planId) where.planId = options.planId;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      }),
      prisma.subscription.count({ where })
    ]);

    // Buscar dados dos tenants
    const tenantIds = subscriptions.map(s => s.tenantId);
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      include: {
        owner: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });
    const tenantMap = new Map(tenants.map(t => [t.id, t]));

    return {
      subscriptions: subscriptions.map(sub => ({
        ...sub,
        tenant: tenantMap.get(sub.tenantId)
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Cancelar assinatura
   */
  async cancelSubscription(
    subscriptionId: string, 
    adminId: string, 
    reason: string,
    ipAddress?: string
  ) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { payments: true }
    });

    if (!subscription) {
      throw new Error('Assinatura não encontrada');
    }

    const previousStatus = subscription.status;

    // Cancelar no Asaas se houver integração
    if (subscription.asaasSubscriptionId) {
      try {
        await paymentService.cancelSubscription(subscription.asaasSubscriptionId);
      } catch (error) {
        console.error('Erro ao cancelar no Asaas:', error);
      }
    }

    // Atualizar assinatura
    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason
      }
    });

    // Atualizar tenant
    await prisma.tenant.update({
      where: { id: subscription.tenantId },
      data: {
        subscriptionStatus: 'cancelled',
        subscriptionPlan: 'trial' // Volta para trial
      }
    });

    // Registrar log
    await this.log({
      adminId,
      action: 'subscription_cancel',
      targetType: 'subscription',
      targetId: subscriptionId,
      description: `Assinatura cancelada. Motivo: ${reason}`,
      previousValue: { status: previousStatus },
      newValue: { status: 'cancelled', reason },
      ipAddress
    });

    return updated;
  },

  /**
   * Alterar plano de assinatura
   */
  async changePlan(
    tenantId: string,
    newPlanId: string,
    adminId: string,
    reason: string,
    ipAddress?: string
  ) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        owner: true
      }
    });

    if (!tenant) {
      throw new Error('Tenant não encontrado');
    }

    const previousPlan = tenant.subscriptionPlan;

    // Atualizar tenant
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionPlan: newPlanId,
        subscriptionStatus: 'active'
      }
    });

    // Atualizar ou criar subscription
    await prisma.subscription.upsert({
      where: { tenantId },
      update: {
        planId: newPlanId,
        status: 'active'
      },
      create: {
        tenantId,
        planId: newPlanId,
        billingCycle: 'monthly',
        status: 'active'
      }
    });

    // Registrar log
    await this.log({
      adminId,
      action: 'plan_change',
      targetType: 'tenant',
      targetId: tenantId,
      description: `Plano alterado de ${previousPlan} para ${newPlanId}. Motivo: ${reason}`,
      previousValue: { plan: previousPlan },
      newValue: { plan: newPlanId },
      ipAddress
    });

    return updated;
  },

  /**
   * Estender período de trial
   */
  async extendTrial(
    tenantId: string,
    days: number,
    adminId: string,
    reason: string,
    ipAddress?: string
  ) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new Error('Tenant não encontrado');
    }

    const currentEnd = tenant.trialEndsAt || new Date();
    const newEnd = new Date(currentEnd);
    newEnd.setDate(newEnd.getDate() + days);

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        trialEndsAt: newEnd,
        subscriptionPlan: 'trial',
        subscriptionStatus: 'active'
      }
    });

    // Registrar log
    await this.log({
      adminId,
      action: 'trial_extend',
      targetType: 'tenant',
      targetId: tenantId,
      description: `Trial estendido em ${days} dias. Nova data: ${newEnd.toISOString()}. Motivo: ${reason}`,
      previousValue: { trialEndsAt: currentEnd },
      newValue: { trialEndsAt: newEnd },
      ipAddress
    });

    return updated;
  },

  // ==================== GESTÃO DE USUÁRIOS ====================

  /**
   * Bloquear/desbloquear usuário
   */
  async toggleUserActive(
    userId: string,
    isActive: boolean,
    adminId: string,
    reason: string,
    ipAddress?: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive }
    });

    // Revogar todos os tokens se bloqueando
    if (!isActive) {
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true, revokedReason: 'user_blocked' }
      });
    }

    // Registrar log
    await this.log({
      adminId,
      action: isActive ? 'user_unblock' : 'user_block',
      targetType: 'user',
      targetId: userId,
      description: `Usuário ${isActive ? 'desbloqueado' : 'bloqueado'}. Motivo: ${reason}`,
      previousValue: { isActive: user.isActive },
      newValue: { isActive },
      ipAddress
    });

    return updated;
  },

  /**
   * Forçar reset de senha
   */
  async forcePasswordReset(
    userId: string,
    adminId: string,
    reason: string,
    ipAddress?: string
  ) {
    // Gerar token de reset
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Aqui você implementaria a lógica de reset de senha
    // Por enquanto apenas registra o log

    // Revogar tokens atuais
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true, revokedReason: 'password_reset_forced' }
    });

    // Registrar log
    await this.log({
      adminId,
      action: 'password_reset_force',
      targetType: 'user',
      targetId: userId,
      description: `Reset de senha forçado. Motivo: ${reason}`,
      ipAddress
    });

    return { success: true, message: 'Reset de senha solicitado' };
  },

  /**
   * Login como usuário (impersonate)
   */
  async impersonateUser(
    userId: string,
    adminId: string,
    ipAddress?: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownedTenants: true,
        tenantUsers: {
          include: {
            tenant: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Registrar log
    await this.log({
      adminId,
      action: 'impersonate',
      targetType: 'user',
      targetId: userId,
      description: `Admin acessou como usuário ${user.email}`,
      ipAddress
    });

    // Retornar dados do usuário para gerar token
    return {
      user,
      tenant: user.ownedTenants[0] || user.tenantUsers[0]?.tenant
    };
  },

  // ==================== RELATÓRIOS ====================

  /**
   * Relatório de faturamento (MRR/ARR)
   */
  async getRevenueReport(options?: {
    startDate?: Date;
    endDate?: Date;
  }) {
    const startDate = options?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 12));
    const endDate = options?.endDate || new Date();

    // Pagamentos recebidos
    const payments = await prisma.payment.findMany({
      where: {
        status: 'paid',
        paidAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { paidAt: 'asc' }
    });

    // Agrupar por mês
    const monthlyRevenue: Record<string, number> = {};
    payments.forEach(p => {
      if (p.paidAt) {
        const key = `${p.paidAt.getFullYear()}-${String(p.paidAt.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenue[key] = (monthlyRevenue[key] || 0) + Number(p.amount);
      }
    });

    // Calcular MRR (último mês completo)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    const mrr = monthlyRevenue[lastMonthKey] || 0;

    // Assinaturas ativas por plano
    const subscriptionsByPlan = await prisma.subscription.groupBy({
      by: ['planId'],
      where: { status: 'active' },
      _count: true
    });

    // Total recebido
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      mrr,
      arr: mrr * 12,
      totalRevenue,
      monthlyRevenue: Object.entries(monthlyRevenue).map(([month, value]) => ({
        month,
        value
      })).sort((a, b) => a.month.localeCompare(b.month)),
      subscriptionsByPlan: subscriptionsByPlan.map(s => ({
        plan: s.planId,
        count: s._count
      }))
    };
  },

  /**
   * Relatório de churn
   */
  async getChurnReport(options?: {
    months?: number;
  }) {
    const months = options?.months || 6;
    const results: any[] = [];

    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      // Assinaturas ativas no início do mês
      const activeAtStart = await prisma.subscription.count({
        where: {
          status: 'active',
          createdAt: { lt: startOfMonth }
        }
      });

      // Cancelamentos no mês
      const cancelled = await prisma.subscription.count({
        where: {
          status: 'cancelled',
          cancelledAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      });

      // Novas assinaturas no mês
      const newSubs = await prisma.subscription.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      });

      const churnRate = activeAtStart > 0 ? (cancelled / activeAtStart) * 100 : 0;

      results.push({
        month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        activeAtStart,
        newSubscriptions: newSubs,
        cancelled,
        churnRate: Math.round(churnRate * 100) / 100
      });
    }

    return results.reverse();
  },

  /**
   * Dashboard geral do admin
   */
  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalTenants,
      activeTenants,
      totalUsers,
      activeSubscriptions,
      trialTenants,
      newTenantsMonth,
      newUsersMonth,
      revenueMonth,
      cancelledMonth
    ] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.tenant.count({ where: { subscriptionStatus: 'active', deletedAt: null } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.tenant.count({ where: { subscriptionPlan: 'trial', deletedAt: null } }),
      prisma.tenant.count({ where: { createdAt: { gte: startOfMonth }, deletedAt: null } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.payment.aggregate({
        where: { status: 'paid', paidAt: { gte: startOfMonth } },
        _sum: { amount: true }
      }),
      prisma.subscription.count({
        where: { status: 'cancelled', cancelledAt: { gte: startOfMonth } }
      })
    ]);

    // Planos breakdown
    const planBreakdown = await prisma.tenant.groupBy({
      by: ['subscriptionPlan'],
      where: { deletedAt: null },
      _count: true
    });

    return {
      totalTenants,
      activeTenants,
      totalUsers,
      activeSubscriptions,
      trialTenants,
      newTenantsMonth,
      newUsersMonth,
      revenueMonth: Number(revenueMonth._sum.amount || 0),
      cancelledMonth,
      planBreakdown: planBreakdown.map(p => ({
        plan: p.subscriptionPlan,
        count: p._count
      })),
      conversionRate: trialTenants > 0 
        ? Math.round(((activeTenants - trialTenants) / totalTenants) * 100) 
        : 0
    };
  },

  // ==================== CONFIGURAÇÕES DO SISTEMA ====================

  /**
   * Obter configuração
   */
  async getConfig(key: string) {
    const config = await prisma.systemConfig.findUnique({
      where: { key }
    });
    return config ? JSON.parse(config.value) : null;
  },

  /**
   * Definir configuração
   */
  async setConfig(key: string, value: any, adminId: string, description?: string) {
    const existing = await prisma.systemConfig.findUnique({ where: { key } });
    
    const result = await prisma.systemConfig.upsert({
      where: { key },
      update: {
        value: JSON.stringify(value),
        updatedBy: adminId
      },
      create: {
        key,
        value: JSON.stringify(value),
        description,
        updatedBy: adminId
      }
    });

    // Log
    await this.log({
      adminId,
      action: 'config_update',
      targetType: 'system_config',
      targetId: key,
      description: `Configuração ${key} atualizada`,
      previousValue: existing ? JSON.parse(existing.value) : null,
      newValue: value
    });

    return result;
  },

  /**
   * Listar todas configurações
   */
  async listConfigs(category?: string) {
    const where = category ? { category } : {};
    const configs = await prisma.systemConfig.findMany({ where });
    return configs.map(c => ({
      ...c,
      value: JSON.parse(c.value)
    }));
  },

  // ==================== ANÚNCIOS ====================

  /**
   * Criar anúncio
   */
  async createAnnouncement(data: {
    title: string;
    message: string;
    type?: string;
    targetPlans?: string[];
    targetTenants?: string[];
    startsAt?: Date;
    endsAt?: Date;
    createdBy: string;
  }) {
    return prisma.systemAnnouncement.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        targetPlans: data.targetPlans ? JSON.stringify(data.targetPlans) : null,
        targetTenants: data.targetTenants ? JSON.stringify(data.targetTenants) : null,
        startsAt: data.startsAt || new Date(),
        endsAt: data.endsAt,
        createdBy: data.createdBy
      }
    });
  },

  /**
   * Listar anúncios ativos
   */
  async getActiveAnnouncements(tenantId?: string, planId?: string) {
    const now = new Date();

    const announcements = await prisma.systemAnnouncement.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [
          { endsAt: null },
          { endsAt: { gte: now } }
        ]
      },
      orderBy: { startsAt: 'desc' }
    });

    // Filtrar por tenant/plano se especificado
    return announcements.filter(a => {
      if (a.targetTenants && tenantId) {
        const tenants = JSON.parse(a.targetTenants) as string[];
        if (!tenants.includes(tenantId)) return false;
      }
      if (a.targetPlans && planId) {
        const plans = JSON.parse(a.targetPlans) as string[];
        if (!plans.includes(planId)) return false;
      }
      return true;
    }).map(a => ({
      ...a,
      targetPlans: a.targetPlans ? JSON.parse(a.targetPlans) : null,
      targetTenants: a.targetTenants ? JSON.parse(a.targetTenants) : null
    }));
  },

  /**
   * Desativar anúncio
   */
  async toggleAnnouncement(id: string, isActive: boolean) {
    return prisma.systemAnnouncement.update({
      where: { id },
      data: { isActive }
    });
  }
};
