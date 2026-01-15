/**
 * Energy Reports Routes
 * ========================
 * Rotas da API para o sistema de relatórios cognitivos
 * baseados em energias financeiras.
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { log } from '../utils/logger';
import energyReportsService from '../services/energy-reports.service';

const router = Router();

// ==================== ENERGY FLOW ====================

/**
 * GET /api/v1/reports/energy-flow
 * Retorna distribuição de energia por período
 */
router.get('/energy-flow', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate, groupBy = 'month' } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    if (groupBy === 'single') {
      // Retorna apenas um período agregado
      const energy = await energyReportsService.getEnergyDistribution(tenantId, start, end);
      return res.json({ success: true, data: energy });
    }

    // Retorna timeline
    const timeline = await energyReportsService.getEnergyTimeline(
      tenantId, 
      start, 
      end, 
      groupBy as 'month' | 'week' | 'day'
    );

    return res.json({ success: true, data: timeline });
  } catch (error) {
    log.error('Error in energy-flow:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao calcular fluxo de energia' }
    });
  }
});

// ==================== HEALTH INDEX ====================

/**
 * GET /api/v1/reports/health-index
 * Retorna índice de saúde financeira
 */
router.get('/health-index', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { period = '3m' } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    // Calcular datas baseado no período
    const end = new Date();
    let start: Date;

    switch (period) {
      case '1m':
        start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
        break;
      case '3m':
        start = new Date(end.getFullYear(), end.getMonth() - 3, 1);
        break;
      case '6m':
        start = new Date(end.getFullYear(), end.getMonth() - 6, 1);
        break;
      case '12m':
        start = new Date(end.getFullYear() - 1, end.getMonth(), 1);
        break;
      case 'ytd':
        start = new Date(end.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(end.getFullYear(), end.getMonth() - 3, 1);
    }

    const healthIndex = await energyReportsService.getHealthIndex(tenantId, start, end);

    return res.json({ success: true, data: healthIndex });
  } catch (error) {
    log.error('Error in health-index:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao calcular índice de saúde' }
    });
  }
});

// ==================== INSIGHTS ====================

/**
 * GET /api/v1/reports/insights
 * Retorna insights e recomendações
 */
router.get('/insights', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate, limit = '10' } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const insights = await energyReportsService.generateInsights(tenantId, start, end);

    return res.json({ 
      success: true, 
      data: insights.slice(0, parseInt(limit as string))
    });
  } catch (error) {
    log.error('Error in insights:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao gerar insights' }
    });
  }
});

// ==================== ANNUAL NARRATIVE ====================

/**
 * GET /api/v1/reports/annual-narrative/:year
 * Retorna narrativa completa do ano
 */
router.get('/annual-narrative/:year', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const year = parseInt(req.params.year);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: { message: 'Ano inválido' }
      });
    }

    const narrative = await energyReportsService.generateAnnualNarrative(tenantId, year);

    return res.json({ success: true, data: narrative });
  } catch (error) {
    log.error('Error in annual-narrative:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao gerar narrativa anual' }
    });
  }
});

// ==================== COMPARISON ====================

/**
 * GET /api/v1/reports/comparison
 * Compara dois períodos
 */
router.get('/comparison', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { 
      baseStart, baseEnd, 
      targetStart, targetEnd,
      preset 
    } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    let base: { start: Date; end: Date };
    let target: { start: Date; end: Date };

    if (preset) {
      // Presets de comparação
      const now = new Date();
      
      switch (preset) {
        case 'month-vs-previous':
          // Mês atual vs mês anterior
          target = {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
          };
          base = {
            start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            end: new Date(now.getFullYear(), now.getMonth(), 0)
          };
          break;
          
        case 'month-vs-year-ago':
          // Mês atual vs mesmo mês ano passado
          target = {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
          };
          base = {
            start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
            end: new Date(now.getFullYear() - 1, now.getMonth() + 1, 0)
          };
          break;
          
        case 'quarter-vs-previous':
          // Trimestre atual vs anterior
          const currentQuarter = Math.floor(now.getMonth() / 3);
          target = {
            start: new Date(now.getFullYear(), currentQuarter * 3, 1),
            end: new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0)
          };
          base = {
            start: new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1),
            end: new Date(now.getFullYear(), currentQuarter * 3, 0)
          };
          break;
          
        case 'year-vs-previous':
          // Ano atual (até agora) vs mesmo período ano passado
          target = {
            start: new Date(now.getFullYear(), 0, 1),
            end: now
          };
          base = {
            start: new Date(now.getFullYear() - 1, 0, 1),
            end: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
          };
          break;
          
        default:
          return res.status(400).json({
            success: false,
            error: { message: 'Preset inválido' }
          });
      }
    } else {
      // Datas customizadas
      if (!baseStart || !baseEnd || !targetStart || !targetEnd) {
        return res.status(400).json({
          success: false,
          error: { message: 'Datas de comparação são obrigatórias' }
        });
      }
      
      base = {
        start: new Date(baseStart as string),
        end: new Date(baseEnd as string)
      };
      target = {
        start: new Date(targetStart as string),
        end: new Date(targetEnd as string)
      };
    }

    const comparison = await energyReportsService.comparePeriods(
      tenantId,
      base.start,
      base.end,
      target.start,
      target.end
    );

    return res.json({ success: true, data: comparison });
  } catch (error) {
    log.error('Error in comparison:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao comparar períodos' }
    });
  }
});

// ==================== CATEGORY SEMANTICS ====================

/**
 * GET /api/v1/reports/category-semantics
 * Retorna mapeamento semântico de todas as categorias
 */
router.get('/category-semantics', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const semantics = await energyReportsService.getCategorySemantics(tenantId);

    return res.json({ success: true, data: semantics });
  } catch (error) {
    log.error('Error in category-semantics:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao buscar semânticas' }
    });
  }
});

/**
 * PUT /api/v1/reports/category-semantics/:categoryId
 * Atualiza pesos semânticos de uma categoria
 */
router.put('/category-semantics/:categoryId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { categoryId } = req.params;
    const { survival, choice, future, loss } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    // Validar pesos
    if (typeof survival !== 'number' || typeof choice !== 'number' || 
        typeof future !== 'number' || typeof loss !== 'number') {
      return res.status(400).json({
        success: false,
        error: { message: 'Pesos devem ser números' }
      });
    }

    const normalized = await energyReportsService.updateCategorySemantics(
      tenantId,
      categoryId,
      { survival, choice, future, loss }
    );

    return res.json({ 
      success: true, 
      message: 'Semântica atualizada',
      data: normalized
    });
  } catch (error) {
    log.error('Error updating category-semantics:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao atualizar semântica' }
    });
  }
});

// ==================== TOP PENDING CATEGORIES (ONBOARDING) ====================

/**
 * GET /api/v1/reports/top-pending-categories
 * Retorna top categorias pendentes de validação para onboarding
 * Ordenado por impacto em R$ (soma de despesas no período)
 */
router.get('/top-pending-categories', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate, limit } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    // Período padrão: mês atual
    const now = new Date();
    const start = startDate ? new Date(startDate as string) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate as string) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const result = await energyReportsService.getTopPendingCategories(
      tenantId,
      limit ? parseInt(limit as string) : 10,
      start,
      end
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    log.error('Error in top-pending-categories:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao buscar categorias pendentes' }
    });
  }
});

export default router;
