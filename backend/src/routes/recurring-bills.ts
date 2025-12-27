import { Router, Response } from 'express';
import { prisma } from '../main';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';

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
      type,
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

    if (!type || !['income', 'expense'].includes(type)) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Tipo deve ser income ou expense', 400);
    }

    if (!isVariableAmount && (!amount || amount <= 0)) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Valor deve ser maior que zero', 400);
    }

    if (!dueDay || dueDay < 1 || dueDay > 31) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Dia de vencimento inválido (1-31)', 400);
    }

    if (!['monthly', 'weekly', 'yearly', 'daily'].includes(frequency)) {
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
        type,
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
      await generateOccurrences(recurringBill.id, tenantId, 3);
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

        await generateOccurrences(recurringBill.id, tenantId, 3);

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
router.post('/:id/occurrences/:occurrenceId/pay', async (req: AuthRequest, res: Response) => {
  try {
    const { id, occurrenceId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { paidAmount, paidDate, createTransaction = true } = req.body;

    // Find occurrence
    const occurrence = await prisma.recurringBillOccurrence.findFirst({
      where: {
        id: occurrenceId,
        recurringBillId: id,
      },
    });

    if (!occurrence) {
      return errorResponse(res, 'NOT_FOUND', 'Ocorrência não encontrada', 404);
    }

    // Get recurring bill
    const bill = await prisma.recurringBill.findFirst({
      where: {
        id: occurrence.recurringBillId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!bill) {
      return errorResponse(res, 'NOT_FOUND', 'Conta fixa não encontrada', 404);
    }

    // Update occurrence
    const updated = await prisma.recurringBillOccurrence.update({
      where: { id: occurrenceId },
      data: {
        status: 'paid',
        paidDate: paidDate ? new Date(paidDate) : new Date(),
        paidAmount: paidAmount || bill.amount || 0,
      },
    });

    // Create transaction if requested
    if (createTransaction && bill.bankAccountId && bill.categoryId) {
      const actualPaymentDate = new Date(); // Data real do pagamento (hoje)
      const dueDate = occurrence.dueDate; // Data de vencimento original

      // Calcular diferença de dias
      const diffTime = actualPaymentDate.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const isPaidEarly = diffDays < 0;
      const isPaidLate = diffDays > 0;
      const daysEarlyLate = Math.abs(diffDays);

      await prisma.transaction.create({
        data: {
          tenantId,
          userId,
          type: bill.type, // ✅ Usar tipo da recorrência (income ou expense)
          categoryId: bill.categoryId,
          bankAccountId: bill.bankAccountId,
          paymentMethodId: bill.paymentMethodId,
          amount: paidAmount || bill.amount || 0,
          description: `Pagamento: ${bill.name}`,
          transactionDate: dueDate, // ✅ Data de vencimento
          paidDate: actualPaymentDate, // ✅ Data real do pagamento
          isPaidEarly,
          isPaidLate,
          daysEarlyLate: diffDays !== 0 ? daysEarlyLate : null,
          status: 'completed',
          isRecurring: true,
          recurringBillId: id,
        },
      });

      console.log(`[PAY-OCCURRENCE] Transação criada:`);
      console.log(`  - Vencimento: ${dueDate.toISOString().split('T')[0]}`);
      console.log(`  - Pago em: ${actualPaymentDate.toISOString().split('T')[0]}`);
      console.log(`  - Tipo: ${isPaidEarly ? `ANTECIPADO (${daysEarlyLate} dias)` : isPaidLate ? `ATRASADO (${daysEarlyLate} dias)` : 'EM DIA'}`);

      // Update bank account balance
      const balanceChange = paidAmount || bill.amount || 0;
      if (bill.type === 'expense') {
        // Despesa: diminui saldo
        await prisma.bankAccount.update({
          where: { id: bill.bankAccountId },
          data: { currentBalance: { decrement: balanceChange } },
        });
        console.log(`  - Saldo atualizado: -R$ ${balanceChange}`);
      } else {
        // Receita: aumenta saldo
        await prisma.bankAccount.update({
          where: { id: bill.bankAccountId },
          data: { currentBalance: { increment: balanceChange } },
        });
        console.log(`  - Saldo atualizado: +R$ ${balanceChange}`);
      }
    }

    // Auto-generate next occurrence if autoGenerate is enabled
    if (bill.autoGenerate && bill.status === 'active') {
      await generateOccurrences(id, tenantId, 1);
    }

    return successResponse(res, updated);
  } catch (error) {
    console.error('Pay occurrence error:', error);
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao registrar pagamento', 500);
  }
});

// ==================== GENERATE OCCURRENCES ====================
// POST /api/v1/recurring-bills/:id/generate-occurrences
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

    await generateOccurrences(id, tenantId, months);

    return successResponse(res, { message: `${months} ocorrências geradas com sucesso` });
  } catch (error) {
    console.error('Generate occurrences error:', error);
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao gerar ocorrências', 500);
  }
});

// ==================== HELPER: GENERATE OCCURRENCES ====================
async function generateOccurrences(recurringBillId: string, tenantId: string, months: number) {
  const bill = await prisma.recurringBill.findUnique({
    where: { id: recurringBillId },
  });

  if (!bill || bill.status !== 'active') return;

  // Buscar a última ocorrência existente (seja paga ou pendente)
  const lastOccurrence = await prisma.recurringBillOccurrence.findFirst({
    where: {
      recurringBillId,
    },
    orderBy: {
      dueDate: 'desc',
    },
  });

  // Se não houver ocorrências, usar firstDueDate ou calcular a partir de hoje
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let startDate: Date;
  
  if (lastOccurrence) {
    // Começar a partir da última ocorrência existente
    startDate = new Date(lastOccurrence.dueDate);
  } else {
    // Primeira vez gerando: calcular a partir do mês atual
    if (bill.firstDueDate) {
      startDate = new Date(bill.firstDueDate);
    } else {
      // Calcular o dia de vencimento no mês atual
      const currentMonthDueDate = new Date(today.getFullYear(), today.getMonth(), bill.dueDay);
      currentMonthDueDate.setHours(0, 0, 0, 0);
      
      // Se o dia de vencimento no mês atual já passou, começar do próximo mês
      if (currentMonthDueDate < today) {
        startDate = new Date(today.getFullYear(), today.getMonth() + 1, bill.dueDay);
      } else {
        // Se ainda não passou, incluir o mês atual
        startDate = currentMonthDueDate;
      }
    }
  }

  console.log(`[GENERATE-OCCURRENCES] Gerando ${months} ocorrências a partir de ${startDate.toISOString().split('T')[0]}`);

  // Ajustar para começar do startDate (i=0) ao invés de startDate+1 (i=1)
  for (let i = 0; i < months; i++) {
    const dueDate = new Date(startDate);
    
    if (bill.frequency === 'monthly') {
      dueDate.setMonth(startDate.getMonth() + i);
    } else if (bill.frequency === 'yearly') {
      dueDate.setFullYear(startDate.getFullYear() + i);
    } else if (bill.frequency === 'weekly') {
      dueDate.setDate(startDate.getDate() + (i * 7));
    }

    // Check if occurrence already exists
    const existing = await prisma.recurringBillOccurrence.findFirst({
      where: {
        recurringBillId,
        dueDate: {
          gte: new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()),
          lt: new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate() + 1),
        },
      },
    });

    if (!existing) {
      await prisma.recurringBillOccurrence.create({
        data: {
          tenantId: bill.tenantId,
          recurringBillId,
          dueDate,
          amount: bill.amount || 0,
          status: 'pending',
        },
      });
      console.log(`[GENERATE-OCCURRENCES] ✅ Criada ocorrência para ${dueDate.toISOString().split('T')[0]}`);
    } else {
      console.log(`[GENERATE-OCCURRENCES] ⏭️ Ocorrência já existe para ${dueDate.toISOString().split('T')[0]}`);
    }
  }
}

// ==================== GENERATE OCCURRENCES (AUTO-GENERATION) ====================
// POST /api/v1/recurring-bills/:id/generate-occurrences
router.post('/:id/generate-occurrences', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const recurringBillId = req.params.id;
    const { monthsAhead } = req.body;

    // Buscar recurring bill
    const recurringBill = await prisma.recurringBill.findFirst({
      where: {
        id: recurringBillId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!recurringBill) {
      return errorResponse(res, 'RECURRING_BILL_NOT_FOUND', 'Recurring bill not found', 404);
    }

    if (recurringBill.status !== 'active') {
      return errorResponse(res, 'RECURRING_BILL_INACTIVE', 'Recurring bill is not active', 400);
    }

    // Determinar quantos meses gerar
    const months = monthsAhead || recurringBill.monthsAhead || 3;

    // Buscar última transação gerada para esta recorrência
    const lastTransaction = await prisma.transaction.findFirst({
      where: {
        recurringBillId,
        tenantId,
        deletedAt: null,
      },
      orderBy: {
        dueDate: 'desc',
      },
    });

    // Data inicial: última transação + 1 período OU startDate
    let currentDate = new Date();
    if (lastTransaction && lastTransaction.dueDate) {
      currentDate = new Date(lastTransaction.dueDate);
      // Avançar 1 período baseado na frequência
      switch (recurringBill.frequency) {
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'biweekly':
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
        default:
          currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    // Gerar transações
    const transactionsToCreate = [];
    const createdTransactions = [];

    for (let i = 0; i < months; i++) {
      // Calcular próxima data de vencimento
      const dueDate = new Date(currentDate);

      // Verificar se já existe transação nesta data
      const existingTransaction = await prisma.transaction.findFirst({
        where: {
          recurringBillId,
          tenantId,
          dueDate: {
            gte: new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()),
            lt: new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate() + 1),
          },
          deletedAt: null,
        },
      });

      if (!existingTransaction) {
        transactionsToCreate.push({
          tenantId,
          userId: req.userId!,
          categoryId: recurringBill.categoryId,
          bankAccountId: recurringBill.bankAccountId,
          paymentMethodId: recurringBill.paymentMethodId,
          recurringBillId,
          description: recurringBill.name,
          amount: recurringBill.amount ? Number(recurringBill.amount) : 0,
          type: recurringBill.type,
          status: 'pending',
          transactionDate: dueDate,
          dueDate: dueDate,
          isFixed: recurringBill.isFixed,
        });
      }

      // Avançar para próximo período
      switch (recurringBill.frequency) {
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'biweekly':
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
        default:
          currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    // Criar transações em batch
    if (transactionsToCreate.length > 0) {
      const result = await prisma.transaction.createMany({
        data: transactionsToCreate,
      });

      // Buscar transações criadas para retornar detalhes
      const created = await prisma.transaction.findMany({
        where: {
          recurringBillId,
          tenantId,
          status: 'pending',
          dueDate: {
            gte: transactionsToCreate[0].dueDate,
          },
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
        orderBy: {
          dueDate: 'asc',
        },
      });

      return successResponse(res, {
        message: `${result.count} occurrences generated successfully`,
        generated: result.count,
        transactions: created,
      }, 201);
    } else {
      return successResponse(res, {
        message: 'No new occurrences to generate',
        generated: 0,
        transactions: [],
      });
    }
  } catch (error) {
    console.error('Generate occurrences error:', error);
    return errorResponse(res, 'GENERATE_ERROR', 'Failed to generate occurrences', 500);
  }
});

export default router;
