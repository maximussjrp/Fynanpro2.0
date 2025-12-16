import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';
import { chatbotService } from '../services/chatbot.service';

const router = Router();

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
      initialMessage = {
        response: `Olá, ${session.context.userName}! 👋\n\nComo posso te ajudar hoje?`,
        quickReplies: ['Planejamento', 'Meu saldo', 'Novo gasto', 'Ajuda'],
      };
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

    const session = await chatbotService.getOrCreateSession(tenantId, userId);

    return successResponse(res, {
      history: session.history.slice(-50), // Últimas 50 mensagens
    });
  } catch (error: any) {
    log.error('Erro ao obter histórico do chatbot', { error: error.message });
    return errorResponse(res, 'CHATBOT_ERROR', 'Erro ao obter histórico', 500);
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
