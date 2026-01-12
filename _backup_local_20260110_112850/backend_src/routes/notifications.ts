import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../main';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';

const router = Router();

// Aplicar autenticação em todas as rotas
router.use(authMiddleware);

/**
 * GET /api/v1/notifications
 * Lista todas as notificações do usuário
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId;
    const { isRead, type, limit = '50', page = '1' } = req.query;

    const where: any = {
      tenantId,
      OR: [
        { userId: userId }, // Notificações específicas do usuário
        { userId: null },   // Notificações gerais do tenant
      ],
    };

    if (isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    if (type) {
      where.type = type;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limitNum,
        skip,
      }),
      prisma.notification.count({ where }),
    ]);

    const unreadCount = await prisma.notification.count({
      where: {
        ...where,
        isRead: false,
      },
    });

    return successResponse(res, {
      notifications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      unreadCount,
    });
  } catch (error: any) {
    log.error('Erro ao listar notificações:', error);
    return errorResponse(res, 'INTERNAL_ERROR', error.message, 500);
  }
});

/**
 * GET /api/v1/notifications/unread-count
 * Retorna quantidade de notificações não lidas
 */
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId;

    const count = await prisma.notification.count({
      where: {
        tenantId,
        OR: [
          { userId: userId },
          { userId: null },
        ],
        isRead: false,
      },
    });

    return successResponse(res, { count });
  } catch (error: any) {
    log.error('Erro ao contar notificações não lidas:', error);
    return errorResponse(res, 'INTERNAL_ERROR', error.message, 500);
  }
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Marca uma notificação como lida
 */
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const notification = await prisma.notification.findFirst({
      where: { id, tenantId },
    });

    if (!notification) {
      return errorResponse(res, 'NOT_FOUND', 'Notificação não encontrada', 404);
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return successResponse(res, updated);
  } catch (error: any) {
    log.error('Erro ao marcar notificação como lida:', error);
    return errorResponse(res, 'INTERNAL_ERROR', error.message, 500);
  }
});

/**
 * PATCH /api/v1/notifications/mark-all-read
 * Marca todas as notificações como lidas
 */
router.patch('/mark-all-read', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId;

    const result = await prisma.notification.updateMany({
      where: {
        tenantId,
        OR: [
          { userId: userId },
          { userId: null },
        ],
        isRead: false,
      },
      data: { isRead: true },
    });

    return successResponse(res, { updated: result.count });
  } catch (error: any) {
    log.error('Erro ao marcar todas notificações como lidas:', error);
    return errorResponse(res, 'INTERNAL_ERROR', error.message, 500);
  }
});

/**
 * DELETE /api/v1/notifications/:id
 * Remove uma notificação
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const notification = await prisma.notification.findFirst({
      where: { id, tenantId },
    });

    if (!notification) {
      return errorResponse(res, 'NOT_FOUND', 'Notificação não encontrada', 404);
    }

    await prisma.notification.delete({
      where: { id },
    });

    return successResponse(res, { message: 'Notificação removida com sucesso' });
  } catch (error: any) {
    log.error('Erro ao remover notificação:', error);
    return errorResponse(res, 'INTERNAL_ERROR', error.message, 500);
  }
});

export default router;
