import { Router, Response } from 'express';
import { prisma } from '../main';
import { authenticateToken, AuthRequest, superMasterMiddleware } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';

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

export default router;
