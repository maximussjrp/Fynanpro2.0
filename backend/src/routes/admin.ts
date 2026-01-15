import { Router, Response } from 'express';
import { prisma } from '../main';
import { authenticateToken, AuthRequest, superMasterMiddleware } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';
import { couponService } from '../services/coupon.service';
import { adminService } from '../services/admin.service';

const router = Router();

// Todas as rotas admin requerem autenticação + super_master
router.use(authenticateToken);
router.use(superMasterMiddleware);

// ==================== GET ADMIN OVERVIEW ====================
// GET /api/v1/admin/overview
router.get('/overview', async (req: AuthRequest, res: Response) => {
  try {
    log.info('Admin overview requested', { userId: req.userId });

    // Buscar todos os tenants com contagens
    const tenants = await prisma.tenant.findMany({
      where: { deletedAt: null },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        _count: {
          select: {
            tenantUsers: true,
            transactions: true,
            bankAccounts: true,
            categories: true,
            recurringBills: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Buscar todos os usuários
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            ownedTenants: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calcular estatísticas
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalTransactions = tenants.reduce((sum, t) => sum + t._count.transactions, 0);
    
    const newTenantsThisMonth = tenants.filter(t => 
      new Date(t.createdAt) >= startOfMonth
    ).length;

    const newUsersThisMonth = users.filter(u => 
      new Date(u.createdAt) >= startOfMonth
    ).length;

    const stats = {
      totalTenants: tenants.length,
      activeTenants: tenants.filter(t => t.subscriptionStatus === 'active').length,
      totalUsers: users.length,
      activeUsers: users.filter(u => u.isActive).length,
      totalTransactions,
      totalRevenue: 0, // Placeholder - implementar quando tiver billing
      newUsersThisMonth,
      newTenantsThisMonth
    };

    return successResponse(res, {
      stats,
      tenants,
      users
    });
  } catch (error) {
    log.error('Admin overview error:', { error, userId: req.userId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar dados administrativos', 500);
  }
});

// ==================== GET ALL TENANTS ====================
// GET /api/v1/admin/tenants
router.get('/tenants', async (req: AuthRequest, res: Response) => {
  try {
    const { plan, status, search } = req.query;

    const where: any = { deletedAt: null };

    if (plan && plan !== 'all') {
      where.subscriptionPlan = plan as string;
    }

    if (status && status !== 'all') {
      where.subscriptionStatus = status as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { owner: { email: { contains: search as string, mode: 'insensitive' } } }
      ];
    }

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        _count: {
          select: {
            tenantUsers: true,
            transactions: true,
            bankAccounts: true,
            categories: true,
            recurringBills: true,
            paymentMethods: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return successResponse(res, { tenants, count: tenants.length });
  } catch (error) {
    log.error('Admin list tenants error:', { error, userId: req.userId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar tenants', 500);
  }
});

// ==================== GET TENANT DETAILS ====================
// GET /api/v1/admin/tenants/:id
router.get('/tenants/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            lastLoginAt: true
          }
        },
        tenantUsers: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            tenantUsers: true,
            transactions: true,
            bankAccounts: true,
            categories: true,
            recurringBills: true,
            paymentMethods: true,
            budgets: true
          }
        }
      }
    });

    if (!tenant) {
      return errorResponse(res, 'NOT_FOUND', 'Tenant não encontrado', 404);
    }

    return successResponse(res, { tenant });
  } catch (error) {
    log.error('Admin get tenant error:', { error, userId: req.userId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar tenant', 500);
  }
});

// ==================== UPDATE TENANT ====================
// PUT /api/v1/admin/tenants/:id
router.put('/tenants/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { subscriptionPlan, subscriptionStatus, name } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(subscriptionPlan && { subscriptionPlan }),
        ...(subscriptionStatus && { subscriptionStatus }),
        ...(name && { name })
      }
    });

    log.info('Admin updated tenant', { tenantId: id, userId: req.userId, changes: req.body });

    return successResponse(res, { tenant });
  } catch (error) {
    log.error('Admin update tenant error:', { error, userId: req.userId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao atualizar tenant', 500);
  }
});

// ==================== GET ALL USERS ====================
// GET /api/v1/admin/users
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { role, active, search } = req.query;

    const where: any = { deletedAt: null };

    if (role && role !== 'all') {
      where.role = role as string;
    }

    if (active !== undefined) {
      where.isActive = active === 'true';
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            ownedTenants: true,
            tenantUsers: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return successResponse(res, { users, count: users.length });
  } catch (error) {
    log.error('Admin list users error:', { error, userId: req.userId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar usuários', 500);
  }
});

// ==================== GET USER DETAILS ====================
// GET /api/v1/admin/users/:id
router.get('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        ownedTenants: {
          select: {
            id: true,
            name: true,
            subscriptionPlan: true,
            subscriptionStatus: true
          }
        },
        tenantUsers: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return errorResponse(res, 'NOT_FOUND', 'Usuário não encontrado', 404);
    }

    return successResponse(res, { user });
  } catch (error) {
    log.error('Admin get user error:', { error, userId: req.userId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar usuário', 500);
  }
});

// ==================== UPDATE USER ====================
// PUT /api/v1/admin/users/:id
router.put('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role, isActive, fullName } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(role && { role }),
        ...(isActive !== undefined && { isActive }),
        ...(fullName && { fullName })
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true
      }
    });

    log.info('Admin updated user', { targetUserId: id, userId: req.userId, changes: req.body });

    return successResponse(res, { user });
  } catch (error) {
    log.error('Admin update user error:', { error, userId: req.userId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao atualizar usuário', 500);
  }
});

// ==================== UPDATE USER STATUS ====================
// PUT /api/v1/admin/users/:id/status
router.put('/users/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return errorResponse(res, 'VALIDATION_ERROR', 'isActive deve ser boolean', 400);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true
      }
    });

    log.info('Admin updated user status', { targetUserId: id, userId: req.userId, isActive });

    return successResponse(res, { user });
  } catch (error) {
    log.error('Admin update user status error:', { error, userId: req.userId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao atualizar status do usuário', 500);
  }
});

// ==================== DELETE USER (SOFT DELETE) ====================
// DELETE /api/v1/admin/users/:id
// Remove o usuário mas permite recadastro com o mesmo email
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Não pode deletar a si mesmo
    if (id === req.userId) {
      return errorResponse(res, 'FORBIDDEN', 'Você não pode remover a si mesmo', 403);
    }

    // Verifica se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        ownedTenants: true
      }
    });

    if (!user) {
      return errorResponse(res, 'NOT_FOUND', 'Usuário não encontrado', 404);
    }

    // Não pode deletar outro super_master
    if (user.role === 'super_master' && req.userRole !== 'super_master') {
      return errorResponse(res, 'FORBIDDEN', 'Sem permissão para remover super_master', 403);
    }

    // Executa exclusão em transação
    await prisma.$transaction(async (tx) => {
      // 1. Remove vínculos tenant-user
      await tx.tenantUser.deleteMany({
        where: { userId: id }
      });

      // 2. Remove refresh tokens
      await tx.refreshToken.deleteMany({
        where: { userId: id }
      });

      // 3. Remove notificações do usuário
      await tx.notification.deleteMany({
        where: { userId: id }
      });

      // 4. Para cada tenant que o usuário é dono, marca como deletado
      // Nota: ownerId não pode ser null no schema atual, então apenas marcamos deletedAt
      for (const tenant of user.ownedTenants) {
        await tx.tenant.update({
          where: { id: tenant.id },
          data: { 
            deletedAt: new Date() 
          }
        });
      }

      // 5. Deleta o usuário permanentemente (permite recadastro com mesmo email)
      await tx.user.delete({
        where: { id }
      });
    });

    log.warn('Admin deleted user', { 
      deletedUserId: id, 
      deletedEmail: user.email,
      adminUserId: req.userId 
    });

    return successResponse(res, { 
      message: 'Usuário removido com sucesso',
      deletedUser: {
        id: user.id,
        email: user.email,
        fullName: user.fullName
      }
    });
  } catch (error) {
    log.error('Admin delete user error:', { error, userId: req.userId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao remover usuário', 500);
  }
});

// ==================== IMPERSONATE USER (ACESSAR COMO) ====================
// POST /api/v1/admin/impersonate/:userId
router.post('/impersonate/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownedTenants: {
          where: { deletedAt: null },
          take: 1
        }
      }
    });

    if (!targetUser) {
      return errorResponse(res, 'NOT_FOUND', 'Usuário não encontrado', 404);
    }

    if (targetUser.ownedTenants.length === 0) {
      return errorResponse(res, 'NO_TENANT', 'Usuário não possui workspace', 400);
    }

    // Gerar token temporário para o usuário alvo
    const jwt = require('jsonwebtoken');
    const { env } = require('../config/env');

    const impersonationToken = jwt.sign(
      {
        userId: targetUser.id,
        tenantId: targetUser.ownedTenants[0].id,
        role: targetUser.role,
        impersonatedBy: req.userId // Marca quem está "impersonando"
      },
      env.JWT_SECRET,
      { expiresIn: '2h' } // Token curto por segurança
    );

    log.warn('Admin impersonation', { 
      adminUserId: req.userId, 
      targetUserId: userId,
      targetTenantId: targetUser.ownedTenants[0].id
    });

    return successResponse(res, {
      token: impersonationToken,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        fullName: targetUser.fullName
      },
      tenant: {
        id: targetUser.ownedTenants[0].id,
        name: targetUser.ownedTenants[0].name
      }
    });
  } catch (error) {
    log.error('Admin impersonate error:', { error, userId: req.userId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao acessar como usuário', 500);
  }
});

// ==================== DASHBOARD STATS ====================
// GET /api/v1/admin/dashboard
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const stats = await adminService.getDashboardStats();
    return successResponse(res, stats);
  } catch (error) {
    log.error('Dashboard stats error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar estatísticas', 500);
  }
});

// ==================== COUPON ROUTES ====================
// GET /api/v1/admin/coupons
router.get('/coupons', async (req: AuthRequest, res: Response) => {
  try {
    const coupons = await couponService.list();
    return successResponse(res, { coupons });
  } catch (error) {
    log.error('List coupons error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao listar cupons', 500);
  }
});

// GET /api/v1/admin/coupons/stats
router.get('/coupons/stats', async (req: AuthRequest, res: Response) => {
  try {
    const stats = await couponService.getStats();
    return successResponse(res, stats);
  } catch (error) {
    log.error('Coupon stats error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar estatísticas', 500);
  }
});

// GET /api/v1/admin/coupons/:id
router.get('/coupons/:id', async (req: AuthRequest, res: Response) => {
  try {
    const coupon = await couponService.findById(req.params.id);
    if (!coupon) {
      return errorResponse(res, 'NOT_FOUND', 'Cupom não encontrado', 404);
    }
    return successResponse(res, { coupon });
  } catch (error) {
    log.error('Get coupon error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar cupom', 500);
  }
});

// POST /api/v1/admin/coupons
router.post('/coupons', async (req: AuthRequest, res: Response) => {
  try {
    const coupon = await couponService.create(req.body);
    await adminService.log({ adminId: req.userId!, action: 'CREATE_COUPON', targetType: 'Coupon', targetId: coupon.id, description: 'Cupom criado', newValue: coupon });
    return successResponse(res, { coupon }, 201);
  } catch (error: any) {
    log.error('Create coupon error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', error.message || 'Erro ao criar cupom', 500);
  }
});

// PUT /api/v1/admin/coupons/:id
router.put('/coupons/:id', async (req: AuthRequest, res: Response) => {
  try {
    const oldCoupon = await couponService.findById(req.params.id);
    const coupon = await couponService.update(req.params.id, req.body);
    await adminService.log({ adminId: req.userId!, action: 'UPDATE_COUPON', targetType: 'Coupon', targetId: coupon.id, description: 'Cupom atualizado', previousValue: oldCoupon, newValue: coupon });
    return successResponse(res, { coupon });
  } catch (error: any) {
    log.error('Update coupon error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', error.message || 'Erro ao atualizar cupom', 500);
  }
});

// PATCH /api/v1/admin/coupons/:id/toggle
router.patch('/coupons/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { isActive } = req.body;
    const coupon = await couponService.toggleActive(req.params.id, isActive ?? true);
    await adminService.log({ adminId: req.userId!, action: 'TOGGLE_COUPON', targetType: 'Coupon', targetId: coupon.id, description: 'Status do cupom alterado', newValue: { isActive: coupon.isActive } });
    return successResponse(res, { coupon });
  } catch (error) {
    log.error('Toggle coupon error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao alterar status', 500);
  }
});

// DELETE /api/v1/admin/coupons/:id
router.delete('/coupons/:id', async (req: AuthRequest, res: Response) => {
  try {
    const coupon = await couponService.findById(req.params.id);
    await couponService.delete(req.params.id);
    await adminService.log({ adminId: req.userId!, action: 'DELETE_COUPON', targetType: 'Coupon', targetId: req.params.id, description: 'Cupom excluído', previousValue: coupon });
    return successResponse(res, { message: 'Cupom excluído com sucesso' });
  } catch (error) {
    log.error('Delete coupon error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao excluir cupom', 500);
  }
});

// POST /api/v1/admin/coupons/validate
router.post('/coupons/validate', async (req: AuthRequest, res: Response) => {
  try {
    const { code, userId, tenantId, planId, planAmount } = req.body;
    const result = await couponService.validate(
      code, 
      userId || '', 
      tenantId || '', 
      planId || '', 
      planAmount || 0
    );
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, 'INVALID_COUPON', error.message, 400);
  }
});

// ==================== SUBSCRIPTION MANAGEMENT ====================
// GET /api/v1/admin/subscriptions
router.get('/subscriptions', async (req: AuthRequest, res: Response) => {
  try {
    const { status, plan, page = '1', limit = '20' } = req.query;
    const subscriptions = await adminService.listSubscriptions({
      status: status as string,
      planId: plan as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    });
    return successResponse(res, subscriptions);
  } catch (error) {
    log.error('List subscriptions error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao listar assinaturas', 500);
  }
});

// POST /api/v1/admin/subscriptions/:tenantId/cancel
router.post('/subscriptions/:tenantId/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const result = await adminService.cancelSubscription(
      req.params.tenantId, 
      req.userId!, 
      reason || 'Cancelada pelo admin',
      req.ip
    );
    return successResponse(res, result);
  } catch (error: any) {
    log.error('Cancel subscription error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', error.message || 'Erro ao cancelar assinatura', 500);
  }
});

// POST /api/v1/admin/tenants/:id/change-plan
router.post('/tenants/:id/change-plan', async (req: AuthRequest, res: Response) => {
  try {
    const { newPlan, reason } = req.body;
    const result = await adminService.changePlan(
      req.params.id, 
      newPlan, 
      req.userId!, 
      reason || 'Alterado pelo admin',
      req.ip
    );
    return successResponse(res, result);
  } catch (error: any) {
    log.error('Change plan error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', error.message || 'Erro ao alterar plano', 500);
  }
});

// POST /api/v1/admin/tenants/:id/extend-trial
router.post('/tenants/:id/extend-trial', async (req: AuthRequest, res: Response) => {
  try {
    const { days, reason } = req.body;
    const result = await adminService.extendTrial(
      req.params.id, 
      days, 
      req.userId!, 
      reason || 'Estendido pelo admin',
      req.ip
    );
    return successResponse(res, result);
  } catch (error: any) {
    log.error('Extend trial error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', error.message || 'Erro ao estender trial', 500);
  }
});

// ==================== USER MANAGEMENT (ENHANCED) ====================
// POST /api/v1/admin/users/:id/toggle-active
router.post('/users/:id/toggle-active', async (req: AuthRequest, res: Response) => {
  try {
    const { isActive, reason } = req.body;
    const result = await adminService.toggleUserActive(
      req.params.id, 
      isActive, 
      req.userId!, 
      reason || 'Alterado pelo admin',
      req.ip
    );
    return successResponse(res, result);
  } catch (error) {
    log.error('Toggle user active error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao alterar status', 500);
  }
});

// POST /api/v1/admin/users/:id/force-password-reset
router.post('/users/:id/force-password-reset', async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const result = await adminService.forcePasswordReset(
      req.params.id, 
      req.userId!, 
      reason || 'Reset forçado pelo admin',
      req.ip
    );
    return successResponse(res, result);
  } catch (error) {
    log.error('Force password reset error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao forçar reset de senha', 500);
  }
});

// ==================== REPORTS ====================
// GET /api/v1/admin/reports/revenue
router.get('/reports/revenue', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await adminService.getRevenueReport({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });
    return successResponse(res, report);
  } catch (error) {
    log.error('Revenue report error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao gerar relatório', 500);
  }
});

// GET /api/v1/admin/reports/churn
router.get('/reports/churn', async (req: AuthRequest, res: Response) => {
  try {
    const report = await adminService.getChurnReport();
    return successResponse(res, report);
  } catch (error) {
    log.error('Churn report error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao gerar relatório', 500);
  }
});

// ==================== AUDIT LOGS ====================
// GET /api/v1/admin/logs
router.get('/logs', async (req: AuthRequest, res: Response) => {
  try {
    const { action, targetType, adminId, page = '1', limit = '50' } = req.query;
    const logs = await adminService.getLogs({
      action: action as string,
      targetType: targetType as string,
      adminId: adminId as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    });
    return successResponse(res, logs);
  } catch (error) {
    log.error('Get logs error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar logs', 500);
  }
});

// ==================== SYSTEM CONFIG ====================
// GET /api/v1/admin/config
router.get('/config', async (req: AuthRequest, res: Response) => {
  try {
    const configs = await adminService.listConfigs();
    return successResponse(res, { configs });
  } catch (error) {
    log.error('List configs error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao listar configurações', 500);
  }
});

// GET /api/v1/admin/config/:key
router.get('/config/:key', async (req: AuthRequest, res: Response) => {
  try {
    const value = await adminService.getConfig(req.params.key);
    return successResponse(res, { key: req.params.key, value });
  } catch (error) {
    log.error('Get config error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar configuração', 500);
  }
});

// PUT /api/v1/admin/config/:key
router.put('/config/:key', async (req: AuthRequest, res: Response) => {
  try {
    const { value, description } = req.body;
    const config = await adminService.setConfig(req.params.key, value, description);
    await adminService.log({ adminId: req.userId!, action: 'UPDATE_CONFIG', targetType: 'SystemConfig', targetId: req.params.key, description: 'Configuração atualizada', newValue: { value } });
    return successResponse(res, { config });
  } catch (error) {
    log.error('Set config error:', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao salvar configuração', 500);
  }
});

// ==================== ANNOUNCEMENTS ====================
// TODO: Modelo SystemAnnouncement precisa ser adicionado ao schema Prisma
// Por enquanto, estas rotas estão desabilitadas

// GET /api/v1/admin/announcements
router.get('/announcements', async (_req: AuthRequest, res: Response) => {
  return successResponse(res, { data: [], message: 'Feature em desenvolvimento' });
});

// POST /api/v1/admin/announcements
router.post('/announcements', async (_req: AuthRequest, res: Response) => {
  return errorResponse(res, 'NOT_IMPLEMENTED', 'Feature em desenvolvimento', 501);
});

// PATCH /api/v1/admin/announcements/:id/toggle
router.patch('/announcements/:id/toggle', async (_req: AuthRequest, res: Response) => {
  return errorResponse(res, 'NOT_IMPLEMENTED', 'Feature em desenvolvimento', 501);
});

// GET /api/v1/admin/announcements/active
router.get('/announcements/active', async (_req: AuthRequest, res: Response) => {
  return successResponse(res, { announcements: [] });
});

export default router;
