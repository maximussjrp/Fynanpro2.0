import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { log } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/calendar/events:
 *   get:
 *     summary: Buscar eventos do calendário financeiro
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *     responses:
 *       200:
 *         description: Lista de eventos financeiros
 */
router.get('/events', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const tenantId = (req as any).tenantId;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        message: 'startDate e endDate são obrigatórios' 
      });
    }

    const start = new Date(startDate as string);
    start.setHours(0, 0, 0, 0); // Início do dia
    
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999); // Final do dia

    // Buscar transações no período (excluindo deletadas)
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        deletedAt: null,
        transactionDate: {
          gte: start,
          lte: end
        }
      },
      include: {
        category: true,
        bankAccount: true
      },
      orderBy: {
        transactionDate: 'asc'
      }
    });

    // Buscar ocorrências de recorrências no período (apenas pendentes)
    const recurringOccurrences = await prisma.recurringBillOccurrence.findMany({
      where: {
        tenantId,
        status: 'pending',
        dueDate: {
          gte: start,
          lte: end
        }
      },
      include: {
        recurringBill: {
          include: {
            category: true,
            bankAccount: true,
            paymentMethod: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    });

    res.json({
      success: true,
      data: {
        transactions,
        recurringOccurrences
      }
    });
  } catch (error: any) {
    log.error('Erro ao buscar eventos do calendário:', { error: error.message });
    res.status(500).json({ 
      message: 'Erro ao buscar eventos do calendário' 
    });
  }
});

export default router;
