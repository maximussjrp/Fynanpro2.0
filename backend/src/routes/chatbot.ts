import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';
import { chatbotService } from '../services/chatbot.service';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// ==================== ENVIAR MENSAGEM ====================
// POST /api/v1/chatbot/message
router.post('/message', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return errorResponse(res, 'VALIDATION_ERROR', 'Mensagem é obrigatória', 400);
    }

    const result = await chatbotService.processMessage(tenantId, userId, message);

    return successResponse(res, result);
  } catch (error: any) {
    log.error('Erro ao processar mensagem do chatbot', { error: error.message });
    return errorResponse(res, 'CHATBOT_ERROR', 'Erro ao processar mensagem', 500);
  }
});

// ==================== INICIAR/RESETAR SESSÃO ====================
// POST /api/v1/chatbot/session
router.post('/session', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // Inicia uma nova sessão
    const session = await chatbotService.getOrCreateSession(tenantId, userId);
    
    // Enviar mensagem inicial baseada no estado
    let initialMessage;
    if (session.state === 'onboarding_welcome') {
      initialMessage = await chatbotService.processMessage(tenantId, userId, 'start');
    } else {
      // Usar saudação com insights para sessões existentes
      initialMessage = await chatbotService.processMessage(tenantId, userId, 'oi');
    }

    return successResponse(res, {
      sessionId: session.id,
      state: session.state,
      context: {
        userName: session.context.userName,
        profileType: session.context.profileType,
        bankAccountsCount: session.context.bankAccounts?.length || 0,
      },
      ...initialMessage,
    });
  } catch (error: any) {
    log.error('Erro ao criar sessão do chatbot', { error: error.message });
    return errorResponse(res, 'CHATBOT_ERROR', 'Erro ao criar sessão', 500);
  }
});

// ==================== OBTER HISTÓRICO ====================
// GET /api/v1/chatbot/history
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Buscar sessão do banco
    const dbSession = await prisma.chatSession.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });

    if (!dbSession) {
      return successResponse(res, { history: [], total: 0 });
    }

    // Buscar mensagens do banco
    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { sessionId: dbSession.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.chatMessage.count({
        where: { sessionId: dbSession.id },
      }),
    ]);

    return successResponse(res, {
      history: messages.reverse().map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.createdAt,
        options: m.options ? JSON.parse(m.options) : undefined,
        quickReplies: m.quickReplies ? JSON.parse(m.quickReplies) : undefined,
      })),
      total,
      hasMore: offset + messages.length < total,
    });
  } catch (error: any) {
    log.error('Erro ao obter histórico do chatbot', { error: error.message });
    return errorResponse(res, 'CHATBOT_ERROR', 'Erro ao obter histórico', 500);
  }
});

// ==================== OBTER INSIGHTS ====================
// GET /api/v1/chatbot/insights
router.get('/insights', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const now = new Date();
    const insights: any[] = [];

    // 1. Contas vencendo nos próximos 7 dias
    const in7Days = new Date();
    in7Days.setDate(now.getDate() + 7);

    const pendingBills = await prisma.recurringBillOccurrence.findMany({
      where: {
        tenantId,
        status: 'pending',
        dueDate: { gte: now, lte: in7Days },
      },
      include: { recurringBill: true },
      orderBy: { dueDate: 'asc' },
    });

    if (pendingBills.length > 0) {
      const totalPending = pendingBills.reduce((sum, b) => sum + Number(b.amount), 0);
      insights.push({
        type: 'bills_due',
        priority: 'high',
        title: `${pendingBills.length} conta(s) vencendo em breve`,
        description: `Total de R$ ${totalPending.toFixed(2)} nos próximos 7 dias`,
        data: pendingBills.map(b => ({
          name: b.recurringBill.name,
          amount: Number(b.amount),
          dueDate: b.dueDate,
        })),
      });
    }

    // 2. Comparação de gastos com mês anterior
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayOfMonth = now.getDate();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthSameDay = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth);

    const [currentExpenses, lastExpenses] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          tenantId,
          type: 'expense',
          transactionDate: { gte: startOfMonth, lte: now },
          deletedAt: null,
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          tenantId,
          type: 'expense',
          transactionDate: { gte: lastMonthStart, lte: lastMonthSameDay },
          deletedAt: null,
        },
        _sum: { amount: true },
      }),
    ]);

    const currentTotal = Number(currentExpenses._sum.amount) || 0;
    const lastTotal = Number(lastExpenses._sum.amount) || 0;

    if (lastTotal > 0 && currentTotal > 0) {
      const percentChange = ((currentTotal - lastTotal) / lastTotal) * 100;
      
      insights.push({
        type: 'expense_comparison',
        priority: percentChange > 20 ? 'high' : 'medium',
        title: percentChange > 0 
          ? `Gastos ${percentChange.toFixed(0)}% maiores` 
          : `Economia de ${Math.abs(percentChange).toFixed(0)}%`,
        description: `Comparado ao mesmo período do mês passado`,
        data: {
          currentMonth: currentTotal,
          lastMonth: lastTotal,
          percentChange,
        },
      });
    }

    // 3. Saldo disponível
    const accounts = await prisma.bankAccount.aggregate({
      where: { tenantId, isActive: true, deletedAt: null },
      _sum: { currentBalance: true },
    });

    const totalBalance = Number(accounts._sum.currentBalance) || 0;
    
    if (totalBalance < 500) {
      insights.push({
        type: 'low_balance',
        priority: 'high',
        title: 'Saldo baixo',
        description: `Seu saldo total é R$ ${totalBalance.toFixed(2)}`,
        data: { balance: totalBalance },
      });
    }

    return successResponse(res, { insights });
  } catch (error: any) {
    log.error('Erro ao obter insights', { error: error.message });
    return errorResponse(res, 'CHATBOT_ERROR', 'Erro ao obter insights', 500);
  }
});

// ==================== SUGESTÕES RÁPIDAS ====================
// GET /api/v1/chatbot/suggestions
router.get('/suggestions', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const session = await chatbotService.getOrCreateSession(tenantId, userId);
    
    // Sugestões baseadas no contexto
    const suggestions: string[] = [];
    
    const hour = new Date().getHours();
    
    // Sugestões por horário
    if (hour >= 11 && hour <= 14) {
      suggestions.push('Gastei no almoço');
    }
    if (hour >= 18 && hour <= 21) {
      suggestions.push('Gastei no jantar');
    }
    
    // Sugestões padrão
    suggestions.push('Meu saldo');
    suggestions.push('Quanto gastei');
    suggestions.push('Contas a vencer');
    
    // Baseado nos padrões aprendidos
    const patterns = session.context.learnedPatterns || [];
    const topPatterns = patterns.slice(0, 3);
    
    for (const pattern of topPatterns) {
      if (pattern.averageAmount) {
        suggestions.push(`Gastei ${pattern.averageAmount.toFixed(0)} no ${pattern.description}`);
      }
    }

    return successResponse(res, { suggestions: suggestions.slice(0, 6) });
  } catch (error: any) {
    log.error('Erro ao obter sugestões', { error: error.message });
    return errorResponse(res, 'CHATBOT_ERROR', 'Erro ao obter sugestões', 500);
  }
});

export default router;
