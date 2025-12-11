import { Router, Response } from 'express';
import { prisma } from '../main';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { recurringBillService } from '../services/recurring-bill.service';
import { log } from '../utils/logger';

const router = Router();

router.use(authenticateToken);

// ==================== GET TEMPLATES (Onboarding) ====================
// GET /api/v1/recurring-bills/templates
router.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;

    const templates = await prisma.recurringBill.findMany({
      where: {
        tenantId,
        isTemplate: true,
        deletedAt: null,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            icon: true,
            color: true,
            parentId: true,
            parent: {
              select: {
                id: true,
                name: true,
                icon: true,
              },
            },
          },
        },
      },
      orderBy: [
        { type: 'asc' }, // expense first, then income
        { name: 'asc' },
      ],
    });

    // Agrupar por categoria pai
    const grouped = templates.reduce((acc: any, template: any) => {
      const parentName = template.category?.parent?.name || template.category?.name || 'Outros';
      
      if (!acc[parentName]) {
        acc[parentName] = {
          parent: parentName,
          icon: template.category?.parent?.icon || template.category?.icon || '',
          templates: [],
        };
      }
      
      acc[parentName].templates.push({
        id: template.id,
        name: template.name,
        type: template.type,
        amount: template.amount,
        dueDay: template.dueDay,
        frequency: template.frequency,
        isFixed: template.isFixed,
        notes: template.notes,
        category: template.category,
      });
      
      return acc;
    }, {});

    return successResponse(res, {
      templates: Object.values(grouped),
      totalTemplates: templates.length,
    });
    
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar templates', 500);
  }
});

// ==================== GET ALL RECURRING BILLS ====================
// GET /api/v1/recurring-bills
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { status, frequency } = req.query;

    const where: any = {
      tenantId,
      deletedAt: null,
      isTemplate: false, // Não retornar templates na listagem normal
    };

    if (status) {
      where.status = status as string;
    }

    if (frequency) {
      where.frequency = frequency as string;
    }

    const recurringBills = await prisma.recurringBill.findMany({
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
          },
        },
        paymentMethod: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        occurrences: {
          where: {
            dueDate: {
              gte: new Date(),
            },
          },
          orderBy: {
            dueDate: 'asc',
          },
          take: 3,
        },
        _count: {
          select: {
            occurrences: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Calcular próximos vencimentos
    const today = new Date();
    const nextDue = recurringBills.map(bill => {
      const nextOccurrence = bill.occurrences[0];
      return {
        ...bill,
        nextDueDate: nextOccurrence?.dueDate || null,
        nextDueStatus: nextOccurrence?.status || null,
        nextDueAmount: nextOccurrence?.paidAmount || bill.amount,
      };
    });

    return successResponse(res, {
      recurringBills: nextDue,
      summary: {
        total: recurringBills.length,
        active: recurringBills.filter(b => b.status === 'active').length,
        paused: recurringBills.filter(b => b.status === 'paused').length,
        cancelled: recurringBills.filter(b => b.status === 'cancelled').length,
      },
    });
  } catch (error) {
    console.error('Get recurring bills error:', error);
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar contas fixas', 500);
  }
});

// ==================== GET ALL OCCURRENCES ====================
// GET /api/v1/recurring-bills/occurrences
router.get('/occurrences', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { startDate, endDate, status } = req.query;

    const where: any = {
      tenantId,
    };

    // Filtro de data
    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0); // Início do dia
        where.dueDate.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999); // Final do dia
        where.dueDate.lte = end;
      }
    }

    // Filtro de status
    if (status && status !== 'all') {
      where.status = status as string;
    }

    // Filtrar apenas ocorrências de contas não deletadas
    where.recurringBill = {
      deletedAt: null,
    };

    const occurrences = await prisma.recurringBillOccurrence.findMany({
      where,
      include: {
        recurringBill: {
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
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    return successResponse(res, {
      occurrences,
      total: occurrences.length,
    });
  } catch (error) {
    console.error('Get occurrences error:', error);
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar ocorrências', 500);
  }
});

// ==================== GET RECURRING BILL BY ID ====================
// GET /api/v1/recurring-bills/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const recurringBill = await prisma.recurringBill.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        category: true,
        bankAccount: true,
        paymentMethod: true,
        occurrences: {
          orderBy: {
            dueDate: 'desc',
          },
          take: 12,
        },
      },
    });

    if (!recurringBill) {
      return errorResponse(res, 'NOT_FOUND', 'Conta fixa não encontrada', 404);
    }

    return successResponse(res, recurringBill);
  } catch (error) {
    console.error('Get recurring bill error:', error);
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar conta fixa', 500);
  }
});

// ==================== CREATE RECURRING BILL ====================
// POST /api/v1/recurring-bills
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const {
      name,
      amount,
      isVariableAmount = false,
      categoryId,
      bankAccountId,
      paymentMethodId,
      frequency = 'monthly',
      dueDay,
      firstDueDate,
      alertDaysBefore = 3,
      alertOnDueDay = true,
      alertIfOverdue = true,
      autoGenerate = true,
      notes,
    } = req.body;

    // Validations
    if (!name || !name.trim()) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Nome da conta é obrigatório', 400);
    }

    if (!isVariableAmount && (!amount || amount <= 0)) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Valor deve ser maior que zero', 400);
    }

    if (!dueDay || dueDay < 1 || dueDay > 31) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Dia de vencimento inválido (1-31)', 400);
    }

    if (!['monthly', 'weekly', 'yearly'].includes(frequency)) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Frequência inválida', 400);
    }

    // Validate category
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          tenantId,
          deletedAt: null,
        },
      });

      if (!category) {
        return errorResponse(res, 'VALIDATION_ERROR', 'Categoria não encontrada', 400);
      }
    }

    // Create recurring bill
    const recurringBill = await prisma.recurringBill.create({
      data: {
        tenantId,
        name: name.trim(),
        amount: isVariableAmount ? null : amount,
        isVariableAmount,
        categoryId,
        bankAccountId,
        paymentMethodId,
        frequency,
        dueDay,
        firstDueDate: firstDueDate ? new Date(firstDueDate) : null,
        alertDaysBefore,
        alertOnDueDay,
        alertIfOverdue,
        autoGenerate,
        notes,
        status: 'active',
      },
      include: {
        category: true,
        bankAccount: true,
        paymentMethod: true,
      },
    });

    // Auto-generate first occurrences if enabled
    if (autoGenerate) {
      await recurringBillService.generateOccurrences(recurringBill.id, tenantId, 3);
    }

    return successResponse(res, recurringBill, 201);
  } catch (error) {
    console.error('Create recurring bill error:', error);
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao criar conta fixa', 500);
  }
});

// POST /api/v1/recurring-bills/activate-templates
router.post('/activate-templates', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { templates } = req.body;

    if (!Array.isArray(templates) || templates.length === 0) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Nenhum template selecionado', 400);
    }

    const activated: any[] = [];
    const errors: any[] = [];

    for (const template of templates) {
      try {
        const { templateId, amount, dueDay, bankAccountId, paymentMethodId } = template;

        const templateData = await prisma.recurringBill.findFirst({
          where: { id: templateId, tenantId, isTemplate: true, deletedAt: null },
          include: { category: true },
        });

        if (!templateData) {
          errors.push({ templateId, error: 'Template nao encontrado' });
          continue;
        }

        const recurringBill = await prisma.recurringBill.create({
          data: {
            tenantId,
            name: templateData.name,
            type: templateData.type,
            amount: amount || templateData.amount,
            isVariableAmount: templateData.isVariableAmount,
            categoryId: templateData.categoryId,
            bankAccountId: bankAccountId || null,
            paymentMethodId: paymentMethodId || null,
            frequency: templateData.frequency,
            dueDay: dueDay || templateData.dueDay,
            alertDaysBefore: 3,
            alertOnDueDay: true,
            alertIfOverdue: true,
            autoGenerate: true,
            monthsAhead: 3,
            isFixed: templateData.isFixed,
            isTemplate: false,
            status: 'active',
            notes: templateData.notes,
          },
          include: { category: true, bankAccount: true, paymentMethod: true },
        });

        await recurringBillService.generateOccurrences(recurringBill.id, tenantId, 3);

        activated.push({
          id: recurringBill.id,
          name: recurringBill.name,
          amount: recurringBill.amount,
          dueDay: recurringBill.dueDay,
        });
        
      } catch (err) {
        errors.push({ templateId: template.templateId, error: err instanceof Error ? err.message : 'Erro desconhecido' });
      }
    }

    return successResponse(res, {
      activated,
      errors,
      total: templates.length,
      success: activated.length,
      failed: errors.length,
    }, 201);
    
  } catch (error) {
    console.error('Error activating templates:', error);
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao ativar templates', 500);
  }
});

// ==================== UPDATE RECURRING BILL ====================
// PUT /api/v1/recurring-bills/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const {
      name,
      amount,
      isVariableAmount,
      categoryId,
      bankAccountId,
      paymentMethodId,
      frequency,
      dueDay,
      alertDaysBefore,
      alertOnDueDay,
      alertIfOverdue,
      autoGenerate,
      status,
      notes,
    } = req.body;

    // Find existing
    const existing = await prisma.recurringBill.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return errorResponse(res, 'NOT_FOUND', 'Conta fixa não encontrada', 404);
    }

    // Validations
    if (name && !name.trim()) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Nome não pode ser vazio', 400);
    }

    if (dueDay && (dueDay < 1 || dueDay > 31)) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Dia de vencimento inválido', 400);
    }

    // Update
    const updated = await prisma.recurringBill.update({
      where: { id },
      data: {
        name: name ? name.trim() : existing.name,
        amount: amount !== undefined ? amount : existing.amount,
        isVariableAmount: isVariableAmount !== undefined ? isVariableAmount : existing.isVariableAmount,
        categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
        bankAccountId: bankAccountId !== undefined ? bankAccountId : existing.bankAccountId,
        paymentMethodId: paymentMethodId !== undefined ? paymentMethodId : existing.paymentMethodId,
        frequency: frequency || existing.frequency,
        dueDay: dueDay || existing.dueDay,
        alertDaysBefore: alertDaysBefore !== undefined ? alertDaysBefore : existing.alertDaysBefore,
        alertOnDueDay: alertOnDueDay !== undefined ? alertOnDueDay : existing.alertOnDueDay,
        alertIfOverdue: alertIfOverdue !== undefined ? alertIfOverdue : existing.alertIfOverdue,
        autoGenerate: autoGenerate !== undefined ? autoGenerate : existing.autoGenerate,
        status: status || existing.status,
        notes: notes !== undefined ? notes : existing.notes,
      },
      include: {
        category: true,
        bankAccount: true,
        paymentMethod: true,
      },
    });

    return successResponse(res, updated);
  } catch (error) {
    console.error('Update recurring bill error:', error);
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao atualizar conta fixa', 500);
  }
});

// ==================== DELETE RECURRING BILL ====================
// DELETE /api/v1/recurring-bills/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const recurringBill = await prisma.recurringBill.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    });

    if (!recurringBill) {
      return errorResponse(res, 'NOT_FOUND', 'Conta fixa não encontrada', 404);
    }

    // Soft delete
    await prisma.recurringBill.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'cancelled',
      },
    });

    return successResponse(res, { message: 'Conta fixa excluída com sucesso' });
  } catch (error) {
    console.error('Delete recurring bill error:', error);
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao excluir conta fixa', 500);
  }
});

// ==================== PAY OCCURRENCE ====================
// POST /api/v1/recurring-bills/:id/occurrences/:occurrenceId/pay
// CORRIGIDO: Usa serviço atômico para garantir consistência
router.post('/:id/occurrences/:occurrenceId/pay', async (req: AuthRequest, res: Response) => {
  try {
    const { id, occurrenceId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { paidAmount, paidDate, createTransaction = true, notes } = req.body;

    // Verificar se a ocorrência pertence à conta recorrente
    const occurrence = await prisma.recurringBillOccurrence.findFirst({
      where: {
        id: occurrenceId,
        recurringBillId: id,
        tenantId,
      },
    });

    if (!occurrence) {
      return errorResponse(res, 'NOT_FOUND', 'Ocorrência não encontrada', 404);
    }

    // Usar serviço atômico para pagamento
    const result = await recurringBillService.payOccurrence(
      occurrenceId,
      tenantId,
      userId,
      {
        paidAmount: paidAmount ? Number(paidAmount) : undefined,
        paidDate: paidDate ? new Date(paidDate) : undefined,
        createTransaction,
        notes,
      }
    );

    log.info('Occurrence paid successfully', {
      occurrenceId,
      transactionId: result.transaction?.id,
      balanceUpdated: result.balanceUpdated,
      nextOccurrenceGenerated: result.nextOccurrenceGenerated,
    });

    return successResponse(res, {
      occurrence: result.occurrence,
      transaction: result.transaction,
      balanceUpdated: result.balanceUpdated,
      nextOccurrenceGenerated: result.nextOccurrenceGenerated,
    });
  } catch (error: any) {
    log.error('Pay occurrence error:', { error: error.message, stack: error.stack });
    
    if (error.message === 'Ocorrência não encontrada') {
      return errorResponse(res, 'NOT_FOUND', error.message, 404);
    }
    if (error.message === 'Ocorrência já foi paga') {
      return errorResponse(res, 'ALREADY_PAID', error.message, 400);
    }
    
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao registrar pagamento', 500);
  }
});

// ==================== GENERATE OCCURRENCES ====================
// POST /api/v1/recurring-bills/:id/generate-occurrences
// CORRIGIDO: Usa serviço unificado com tratamento de dueDay em meses curtos
router.post('/:id/generate-occurrences', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const { months = 3 } = req.body;

    const recurringBill = await prisma.recurringBill.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    });

    if (!recurringBill) {
      return errorResponse(res, 'NOT_FOUND', 'Conta fixa não encontrada', 404);
    }

    // Usar serviço unificado
    const result = await recurringBillService.generateOccurrences(id, tenantId, months);

    // Buscar ocorrências geradas para retornar detalhes
    const occurrences = await prisma.recurringBillOccurrence.findMany({
      where: {
        recurringBillId: id,
        dueDate: { in: result.dates },
      },
      orderBy: { dueDate: 'asc' },
    });

    return successResponse(res, {
      message: `${result.generated} ocorrências geradas com sucesso`,
      generated: result.generated,
      skipped: result.skipped,
      occurrences,
    });
  } catch (error: any) {
    log.error('Generate occurrences error:', { error: error.message });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao gerar ocorrências', 500);
  }
});

// ==================== SKIP OCCURRENCE ====================
// POST /api/v1/recurring-bills/:id/occurrences/:occurrenceId/skip
// NOVO: Permite pular uma ocorrência sem pagar
router.post('/:id/occurrences/:occurrenceId/skip', async (req: AuthRequest, res: Response) => {
  try {
    const { id, occurrenceId } = req.params;
    const tenantId = req.tenantId!;
    const { reason } = req.body;

    // Verificar se a ocorrência pertence à conta recorrente
    const occurrence = await prisma.recurringBillOccurrence.findFirst({
      where: {
        id: occurrenceId,
        recurringBillId: id,
        tenantId,
      },
    });

    if (!occurrence) {
      return errorResponse(res, 'NOT_FOUND', 'Ocorrência não encontrada', 404);
    }

    // Usar serviço para pular
    const result = await recurringBillService.skipOccurrence(occurrenceId, tenantId, reason);

    return successResponse(res, result);
  } catch (error: any) {
    log.error('Skip occurrence error:', { error: error.message });
    
    if (error.message === 'Ocorrência não encontrada') {
      return errorResponse(res, 'NOT_FOUND', error.message, 404);
    }
    if (error.message === 'Não é possível pular uma ocorrência já paga') {
      return errorResponse(res, 'ALREADY_PAID', error.message, 400);
    }
    
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao pular ocorrência', 500);
  }
});

export default router;
