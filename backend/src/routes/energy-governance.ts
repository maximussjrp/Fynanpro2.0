/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ROTAS DE GOVERNANÇA DE ENERGIA
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Endpoints para gerenciamento da classificação energética de categorias.
 * Permite visualizar, validar e corrigir a classificação semântica.
 * 
 * Ref: backend/src/contracts/ENERGY-CONTRACT.md
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateEnergyWithFlags } from '../contracts/energy.contract';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const UpdateSemanticsSchema = z.object({
  survivalWeight: z.number().min(0).max(1),
  choiceWeight: z.number().min(0).max(1),
  futureWeight: z.number().min(0).max(1),
  lossWeight: z.number().min(0).max(1),
  isFixed: z.boolean().optional(),
  isEssential: z.boolean().optional(),
  isInvestment: z.boolean().optional(),
  justification: z.string().optional()
}).refine(data => {
  const sum = data.survivalWeight + data.choiceWeight + data.futureWeight + data.lossWeight;
  return Math.abs(sum - 1.0) < 0.001;
}, {
  message: 'A soma dos pesos deve ser exatamente 1.0 (100%)'
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/energy-governance/categories
// Lista todas as categorias com suas classificações energéticas
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/categories', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    
    // Buscar todas as categorias do tenant com suas semânticas
    const categories = await prisma.category.findMany({
      where: {
        tenantId,
        deletedAt: null,
        type: 'expense' // Apenas despesas têm classificação de energia
      },
      include: {
        parent: {
          select: { id: true, name: true, icon: true }
        }
      },
      orderBy: [
        { level: 'asc' },
        { order: 'asc' },
        { name: 'asc' }
      ]
    });

    // Buscar semânticas existentes
    const semantics = await prisma.$queryRaw<Array<{
      categoryId: string;
      survivalWeight: Prisma.Decimal;
      choiceWeight: Prisma.Decimal;
      futureWeight: Prisma.Decimal;
      lossWeight: Prisma.Decimal;
      isFixed: boolean;
      isEssential: boolean;
      isInvestment: boolean;
      validationStatus: string;
      validatedAt: Date | null;
      justification: string | null;
      userOverride: boolean;
    }>>`
      SELECT 
        "categoryId",
        "survivalWeight",
        "choiceWeight",
        "futureWeight",
        "lossWeight",
        "isFixed",
        "isEssential",
        "isInvestment",
        "validationStatus",
        "validatedAt",
        "justification",
        "userOverride"
      FROM "CategorySemantics"
      WHERE "tenantId" = ${tenantId}
    `;

    const semanticsMap = new Map(semantics.map(s => [s.categoryId, {
      survivalWeight: Number(s.survivalWeight),
      choiceWeight: Number(s.choiceWeight),
      futureWeight: Number(s.futureWeight),
      lossWeight: Number(s.lossWeight),
      isFixed: s.isFixed,
      isEssential: s.isEssential,
      isInvestment: s.isInvestment,
      validationStatus: s.validationStatus,
      validatedAt: s.validatedAt,
      justification: s.justification,
      userOverride: s.userOverride
    }]));

    // Combinar categorias com semânticas
    const result = categories.map(cat => {
      const sem = semanticsMap.get(cat.id);
      
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        level: cat.level,
        parentId: cat.parentId,
        parentName: cat.parent?.name || null,
        parentIcon: cat.parent?.icon || null,
        semantics: sem || {
          survivalWeight: 0,
          choiceWeight: 0,
          futureWeight: 0,
          lossWeight: 0,
          isFixed: false,
          isEssential: false,
          isInvestment: false,
          validationStatus: 'not_validated',
          validatedAt: null,
          justification: null,
          userOverride: false
        },
        hasSemantics: !!sem,
        needsValidation: !sem || sem.validationStatus === 'not_validated' || sem.validationStatus === 'default'
      };
    });

    // Estatísticas
    const stats = {
      total: result.length,
      validated: result.filter(c => c.semantics.validationStatus === 'validated').length,
      inferred: result.filter(c => c.semantics.validationStatus === 'inferred').length,
      notValidated: result.filter(c => c.semantics.validationStatus === 'not_validated').length,
      default: result.filter(c => c.semantics.validationStatus === 'default').length,
      withoutSemantics: result.filter(c => !c.hasSemantics).length
    };

    res.json({
      categories: result,
      stats
    });
  } catch (error) {
    console.error('Erro ao listar categorias com semânticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/v1/energy-governance/categories/:categoryId
// Atualiza a classificação energética de uma categoria
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/categories/:categoryId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { categoryId } = req.params;
    
    // Validar corpo da requisição (schema Zod)
    const validation = UpdateSemanticsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: validation.error.issues
      });
    }
    
    const data = validation.data;
    
    // 🔒 VALIDAÇÃO DO CONTRATO DE ENERGIA
    const contractValidation = validateEnergyWithFlags(
      {
        survival: data.survivalWeight,
        choice: data.choiceWeight,
        future: data.futureWeight,
        loss: data.lossWeight
      },
      {
        isInvestment: data.isInvestment,
        isEssential: data.isEssential,
        isFixed: data.isFixed
      }
    );
    
    if (!contractValidation.valid) {
      return res.status(400).json({
        error: 'Classificação viola regras do contrato de energia',
        details: contractValidation.errors,
        warnings: contractValidation.warnings
      });
    }
    
    // Verificar se a categoria existe e pertence ao tenant
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId,
        deletedAt: null
      }
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    
    // Verificar se já existe semântica para esta categoria
    const existingSemantics = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "CategorySemantics" 
      WHERE "categoryId" = ${categoryId} AND "tenantId" = ${tenantId}
      LIMIT 1
    `;
    
    const now = new Date();
    
    if (existingSemantics.length > 0) {
      // Atualizar semântica existente
      await prisma.$executeRaw`
        UPDATE "CategorySemantics" SET
          "survivalWeight" = ${data.survivalWeight},
          "choiceWeight" = ${data.choiceWeight},
          "futureWeight" = ${data.futureWeight},
          "lossWeight" = ${data.lossWeight},
          "isFixed" = ${data.isFixed ?? false},
          "isEssential" = ${data.isEssential ?? false},
          "isInvestment" = ${data.isInvestment ?? false},
          "validationStatus" = 'validated',
          "validatedAt" = ${now},
          "validatedBy" = ${userId},
          "justification" = ${data.justification ?? null},
          "userOverride" = true,
          "updatedAt" = ${now}
        WHERE "categoryId" = ${categoryId} AND "tenantId" = ${tenantId}
      `;
    } else {
      // Criar nova semântica
      const id = require('crypto').randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "CategorySemantics" (
          "id", "categoryId", "tenantId",
          "generatedWeight", "survivalWeight", "choiceWeight", "futureWeight", "lossWeight",
          "isFixed", "isEssential", "isInvestment",
          "validationStatus", "validatedAt", "validatedBy", "justification", "userOverride",
          "createdAt", "updatedAt"
        ) VALUES (
          ${id}, ${categoryId}, ${tenantId},
          0, ${data.survivalWeight}, ${data.choiceWeight}, ${data.futureWeight}, ${data.lossWeight},
          ${data.isFixed ?? false}, ${data.isEssential ?? false}, ${data.isInvestment ?? false},
          'validated', ${now}, ${userId}, ${data.justification ?? null}, true,
          ${now}, ${now}
        )
      `;
    }
    
    res.json({
      success: true,
      message: 'Classificação energética atualizada',
      categoryId,
      validationStatus: 'validated',
      validatedAt: now,
      warnings: contractValidation.warnings.length > 0 ? contractValidation.warnings : undefined
    });
  } catch (error) {
    console.error('Erro ao atualizar semântica:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/energy-governance/audit
// Auditoria: Lista categorias que precisam de validação
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/audit', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    
    // Buscar todas as categorias de despesa
    const categories = await prisma.category.findMany({
      where: {
        tenantId,
        deletedAt: null,
        type: 'expense'
      },
      select: {
        id: true,
        name: true,
        icon: true
      }
    });

    // Buscar semânticas
    const semantics = await prisma.$queryRaw<Array<{
      categoryId: string;
      survivalWeight: Prisma.Decimal;
      choiceWeight: Prisma.Decimal;
      futureWeight: Prisma.Decimal;
      lossWeight: Prisma.Decimal;
      validationStatus: string;
    }>>`
      SELECT 
        "categoryId",
        "survivalWeight",
        "choiceWeight",
        "futureWeight",
        "lossWeight",
        "validationStatus"
      FROM "CategorySemantics"
      WHERE "tenantId" = ${tenantId}
    `;

    const semanticsMap = new Map(semantics.map(s => [s.categoryId, s]));

    // Classificar problemas
    const issues: Array<{
      categoryId: string;
      categoryName: string;
      categoryIcon: string | null;
      issue: string;
      severity: 'critical' | 'warning' | 'info';
    }> = [];

    for (const cat of categories) {
      const sem = semanticsMap.get(cat.id);
      
      if (!sem) {
        issues.push({
          categoryId: cat.id,
          categoryName: cat.name,
          categoryIcon: cat.icon,
          issue: 'Sem classificação energética',
          severity: 'critical'
        });
        continue;
      }
      
      const survival = Number(sem.survivalWeight);
      const choice = Number(sem.choiceWeight);
      const future = Number(sem.futureWeight);
      const loss = Number(sem.lossWeight);
      const total = survival + choice + future + loss;
      
      // Verificar soma
      if (Math.abs(total - 1.0) > 0.01) {
        issues.push({
          categoryId: cat.id,
          categoryName: cat.name,
          categoryIcon: cat.icon,
          issue: `Soma dos pesos incorreta: ${(total * 100).toFixed(1)}%`,
          severity: 'critical'
        });
      }
      
      // Verificar 50/50 sem justificativa (default silencioso)
      if (survival === 0.5 && choice === 0.5 && future === 0 && loss === 0) {
        if (sem.validationStatus !== 'validated') {
          issues.push({
            categoryId: cat.id,
            categoryName: cat.name,
            categoryIcon: cat.icon,
            issue: 'Default 50/50 sem validação (proibido pelo contrato)',
            severity: 'warning'
          });
        }
      }
      
      // Verificar status não validado
      if (sem.validationStatus === 'not_validated' || sem.validationStatus === 'default') {
        issues.push({
          categoryId: cat.id,
          categoryName: cat.name,
          categoryIcon: cat.icon,
          issue: `Status: ${sem.validationStatus}`,
          severity: 'info'
        });
      }
    }

    // Ordenar por severidade
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    res.json({
      totalCategories: categories.length,
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      warningIssues: issues.filter(i => i.severity === 'warning').length,
      infoIssues: issues.filter(i => i.severity === 'info').length,
      issues
    });
  } catch (error) {
    console.error('Erro na auditoria:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/energy-governance/contract
// Retorna o contrato oficial de energia (para referência na UI)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/contract', async (_req: Request, res: Response) => {
  res.json({
    version: '1.0.0',
    lastUpdated: '2025-12-27',
    energyTypes: [
      {
        key: 'survival',
        label: 'Sobrevivência',
        description: 'Gastos obrigatórios para manter a vida funcionando',
        icon: '🏠',
        color: '#3B82F6',
        examples: ['Aluguel', 'Luz', 'Água', 'Plano de Saúde']
      },
      {
        key: 'choice',
        label: 'Escolha',
        description: 'Gastos opcionais que melhoram conforto/prazer',
        icon: '🎯',
        color: '#8B5CF6',
        examples: ['Netflix', 'Restaurantes', 'Viagens', 'Academia']
      },
      {
        key: 'future',
        label: 'Futuro',
        description: 'Gastos que aumentam liberdade financeira futura',
        icon: '🚀',
        color: '#10B981',
        examples: ['Investimentos', 'Poupança', 'Previdência', 'Cursos']
      },
      {
        key: 'loss',
        label: 'Energia Perdida',
        description: 'Dinheiro perdido sem retorno',
        icon: '💸',
        color: '#EF4444',
        examples: ['Juros', 'Multas', 'Taxas', 'Cheque especial']
      }
    ],
    validationStatuses: [
      { key: 'validated', label: 'Validado', description: 'Confirmado por humano' },
      { key: 'inferred', label: 'Inferido', description: 'Pattern matching automático' },
      { key: 'not_validated', label: 'Não Validado', description: 'Requer atenção' },
      { key: 'default', label: 'Default', description: 'Nenhum pattern encontrado' }
    ],
    rules: [
      'Receita NÃO é energia (é Energia Gerada)',
      'Todo gasto DEVE cair em uma ou mais energias',
      'Híbridos são permitidos com justificativa',
      'Default 50/50 é proibido sem justificativa',
      'Usuário SEMPRE pode corrigir'
    ]
  });
});

export default router;
