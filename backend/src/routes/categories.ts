import { Router, Request, Response } from 'express';
import { prisma } from '../main';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';
import { cacheService, CacheTTL, CacheNamespace } from '../services/cache.service';

const router = Router();

router.use(authenticateToken);

// ==================== GET ALL CATEGORIES ====================
// GET /api/v1/categories
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { type, level, parentId, isActive } = req.query;

    // Tentar buscar do cache
    const cacheKey = `${tenantId}:${type || 'all'}:${level || 'all'}:${parentId || 'all'}:${isActive || 'all'}`;
    const cached = await cacheService.get(CacheNamespace.CATEGORIES, cacheKey);
    if (cached) {
      return successResponse(res, cached);
    }

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (type) {
      where.type = type as string;
    }

    if (level !== undefined) {
      where.level = parseInt(level as string);
    }
    // Removido o else que forçava level = 1 por padrão
    // Agora retorna todos os níveis se não especificado

    if (parentId) {
      where.parentId = parentId as string;
    } else if (parentId === null) {
      where.parentId = null;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            type: true,
            icon: true,
            color: true,
          },
        },
        children: {
          where: {
            deletedAt: null,
            isActive: true,
          },
          include: {
            children: {
              where: {
                deletedAt: null,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: [
        { level: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const result = {
      categories,
      count: categories.length,
      summary: {
        total: categories.length,
        byType: {
          income: categories.filter(c => c.type === 'income').length,
          expense: categories.filter(c => c.type === 'expense').length,
        },
        byLevel: {
          level1: categories.filter(c => c.level === 1).length,
          level2: categories.filter(c => c.level === 2).length,
          level3: categories.filter(c => c.level === 3).length,
        },
      },
    };

    // Armazenar no cache (categorias mudam pouco, TTL de 1 hora)
    await cacheService.set(CacheNamespace.CATEGORIES, cacheKey, result, CacheTTL.CATEGORIES);

    return successResponse(res, result);
  } catch (error) {
    log.error('Get categories error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar categorias', 500);
  }
});

// ==================== MIGRATE CATEGORY ====================
// POST /api/v1/categories/migrate
router.post('/migrate', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { oldCategoryId, newCategoryId } = req.body;

    if (!oldCategoryId || !newCategoryId) {
      return errorResponse(res, 'VALIDATION_ERROR', 'oldCategoryId e newCategoryId são obrigatórios', 400);
    }

    // Verificar se ambas as categorias existem e pertencem ao tenant
    const [oldCategory, newCategory] = await Promise.all([
      prisma.category.findFirst({
        where: { id: oldCategoryId, tenantId, deletedAt: null }
      }),
      prisma.category.findFirst({
        where: { id: newCategoryId, tenantId, deletedAt: null }
      })
    ]);

    if (!oldCategory) {
      return errorResponse(res, 'NOT_FOUND', 'Categoria antiga não encontrada', 404);
    }

    if (!newCategory) {
      return errorResponse(res, 'NOT_FOUND', 'Categoria nova não encontrada', 404);
    }

    // Contar transações a migrar
    const transactionCount = await prisma.transaction.count({
      where: { categoryId: oldCategoryId, tenantId, deletedAt: null }
    });

    if (transactionCount === 0) {
      // Se não há transações, apenas arquivar a categoria antiga
      await prisma.category.update({
        where: { id: oldCategoryId },
        data: { deletedAt: new Date(), isActive: false }
      });

      log.info('Category archived (no transactions):', { 
        oldCategoryId, 
        oldCategoryName: oldCategory.name,
        tenantId 
      });

      // Limpar cache
      await cacheService.deletePattern(CacheNamespace.CATEGORIES, `${tenantId}:*`);

      return successResponse(res, { 
        message: 'Categoria arquivada (sem transações)',
        transactionsMigrated: 0
      });
    }

    // Migrar transações em uma transação do banco
    await prisma.$transaction(async (tx) => {
      // Atualizar todas as transações
      await tx.transaction.updateMany({
        where: { categoryId: oldCategoryId, tenantId, deletedAt: null },
        data: { categoryId: newCategoryId }
      });

      // Arquivar categoria antiga
      await tx.category.update({
        where: { id: oldCategoryId },
        data: { 
          deletedAt: new Date(),
          isActive: false
        }
      });
    });

    log.info('Category migrated successfully:', { 
      oldCategoryId, 
      oldCategoryName: oldCategory.name,
      newCategoryId,
      newCategoryName: newCategory.name,
      transactionsMigrated: transactionCount,
      tenantId 
    });

    // Limpar cache
    // await cacheService.deletePattern(CacheNamespace.CATEGORIES, `${tenantId}:*`);
    // await cacheService.deletePattern(CacheNamespace.TRANSACTIONS, `${tenantId}:*`);

    return successResponse(res, { 
      message: 'Migração concluída com sucesso',
      transactionsMigrated: transactionCount,
      oldCategory: { id: oldCategory.id, name: oldCategory.name },
      newCategory: { id: newCategory.id, name: newCategory.name }
    });

  } catch (error) {
    log.error('Migrate category error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao migrar categoria', 500);
  }
});

// ==================== UPDATE CATEGORY ====================
// PUT /api/v1/categories/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const { name, type, icon, color, parentId, isActive } = req.body;

    // Verificar se categoria existe e pertence ao tenant
    const category = await prisma.category.findFirst({
      where: { id, tenantId, deletedAt: null }
    });

    if (!category) {
      return errorResponse(res, 'NOT_FOUND', 'Categoria não encontrada', 404);
    }

    // Se mudar o parentId, verificar se o parent existe
    if (parentId !== undefined && parentId !== null) {
      const parent = await prisma.category.findFirst({
        where: { id: parentId, tenantId, deletedAt: null }
      });
      
      if (!parent) {
        return errorResponse(res, 'VALIDATION_ERROR', 'Categoria pai não encontrada', 400);
      }

      // Prevenir loops (não pode ser filho de si mesmo ou de seus filhos)
      if (parentId === id) {
        return errorResponse(res, 'VALIDATION_ERROR', 'Categoria não pode ser pai de si mesma', 400);
      }
    }

    // Atualizar categoria
    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(icon && { icon }),
        ...(color && { color }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        parent: true,
        children: true,
        _count: {
          select: { transactions: true }
        }
      }
    });

    log.info('Category updated:', { categoryId: id, tenantId });

    // Limpar cache
    // await cacheService.deletePattern(CacheNamespace.CATEGORIES, `${tenantId}:*`);

    return successResponse(res, updated);
  } catch (error) {
    log.error('Update category error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao atualizar categoria', 500);
  }
});

// ==================== DELETE CATEGORY ====================
// DELETE /api/v1/categories/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    // Verificar se categoria existe e pertence ao tenant
    const category = await prisma.category.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        _count: {
          select: { 
            transactions: true,
            children: true 
          }
        }
      }
    });

    if (!category) {
      return errorResponse(res, 'NOT_FOUND', 'Categoria não encontrada', 404);
    }

    // Verificar se tem transações vinculadas
    if (category._count.transactions > 0) {
      return errorResponse(
        res, 
        'VALIDATION_ERROR', 
        `Categoria possui ${category._count.transactions} transação(ões) vinculada(s). Por favor, migre ou exclua as transações primeiro.`, 
        400
      );
    }

    // Verificar se tem subcategorias
    if (category._count.children > 0) {
      return errorResponse(
        res,
        'VALIDATION_ERROR',
        `Categoria possui ${category._count.children} subcategoria(s). Por favor, exclua ou reorganize as subcategorias primeiro.`,
        400
      );
    }

    // Soft delete
    await prisma.category.update({
      where: { id },
      data: { 
        deletedAt: new Date(),
        isActive: false
      }
    });

    log.info('Category deleted:', { categoryId: id, categoryName: category.name, tenantId });

    // Limpar cache
    // await cacheService.deletePattern(CacheNamespace.CATEGORIES, `${tenantId}:*`);

    return successResponse(res, { 
      message: 'Categoria excluída com sucesso',
      category: {
        id: category.id,
        name: category.name
      }
    });
  } catch (error) {
    log.error('Delete category error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao excluir categoria', 500);
  }
});

export default router;
