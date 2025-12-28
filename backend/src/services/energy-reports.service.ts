/**
 * Energy Reports Service
 * ========================
 * Serviço central para cálculos de energia financeira, 
 * geração de narrativas e insights cognitivos.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== TIPOS E INTERFACES ====================

export interface EnergyDistribution {
  generated: number;   // Total de receitas
  survival: number;    // Gastos essenciais
  choice: number;      // Gastos opcionais
  future: number;      // Investimentos
  loss: number;        // Perdas
  
  // Métricas derivadas
  netEnergy: number;           // generated - (survival + choice + loss)
  survivalRatio: number;       // survival / generated (%)
  freedomRatio: number;        // (generated - survival) / generated (%)
  futureRatio: number;         // future / generated (%)
  wasteRatio: number;          // loss / generated (%)
  consumed: number;            // survival + choice + loss
  available: number;           // generated - consumed
}

export interface PeriodEnergy extends EnergyDistribution {
  period: string;              // "2025-01" ou "2025"
  periodLabel: string;         // "Janeiro 2025" ou "2025"
  transactionCount: number;
  categoryBreakdown: CategoryEnergy[];
  
  // Cobertura semântica (FASE 2: Modo Diagnóstico Parcial)
  // REGRA: Apenas validationStatus='validated' conta como classificado
  semanticsCoverage: {
    percentage: number;          // % do gasto total com semântica VALIDATED
    classifiedAmount: number;    // Valor em R$ com semântica validated
    unclassifiedAmount: number;  // Valor em R$ sem validação (pendente)
    pendingEnergy: number;       // Energia "em suspenso" - não entra no cálculo
    isComplete: boolean;         // >= 85% = completo
    diagnosticMode: 'complete' | 'partial' | 'insufficient'; // Estado do diagnóstico
  };
}

export interface CategoryEnergy {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  amount: number;
  energyType: 'generated' | 'survival' | 'choice' | 'future' | 'loss' | 'hybrid';
  percentage: number;
  weights: {
    generated: number;
    survival: number;
    choice: number;
    future: number;
    loss: number;
  };
}

export interface Insight {
  id: string;
  type: 'achievement' | 'warning' | 'opportunity' | 'trend';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  icon: string;
  color: string;
  metric?: {
    current: number;
    previous?: number;
    target?: number;
    unit: string;
  };
  actions?: InsightAction[];
  confidence: number;
}

export interface InsightAction {
  label: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface HealthComponent {
  name: string;
  score: number;
  weight: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'no_data';
  description: string;
  currentValue?: number;
  targetValue?: number;
}

export interface FinancialHealthIndex {
  score: number;
  grade: string;
  label: string;
  color: string;
  adjustmentReason?: string | null; // Indica limitação por regra do contrato
  
  // FASE 2: Cobertura semântica (SOMENTE validated conta)
  semanticsCoverage: {
    percentage: number;
    classifiedAmount: number;
    unclassifiedAmount: number;
    pendingEnergy: number;
    isComplete: boolean;
    diagnosticMode: 'complete' | 'partial' | 'insufficient';
  };
  
  components: {
    survivalEfficiency: HealthComponent;
    savingsRate: HealthComponent;
    wasteControl: HealthComponent;
    freedomRatio: HealthComponent;
    balance: HealthComponent;
  };
  trend: {
    direction: 'improving' | 'stable' | 'declining';
    lastMonthScore: number;
    threeMonthAvg: number;
  };
  recommendations: HealthRecommendation[];
}

export interface HealthRecommendation {
  priority: number;
  title: string;
  description: string;
  impact: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface AnnualNarrative {
  year: number;
  headline: string;
  summary: string;
  highlights: NarrativePoint[];
  warnings: NarrativePoint[];
  opportunities: NarrativePoint[];
  monthlyStory: MonthNarrative[];
  overallSentiment: 'excellent' | 'good' | 'neutral' | 'concerning' | 'critical';
  totals: EnergyDistribution;
}

export interface NarrativePoint {
  type: 'positive' | 'negative' | 'neutral' | 'opportunity';
  icon: string;
  title: string;
  description: string;
  metric?: {
    value: number;
    unit: string;
    trend?: 'up' | 'down' | 'stable';
  };
}

export interface MonthNarrative {
  month: string;
  monthIndex: number;
  energy: EnergyDistribution;
  headline: string;
  story: string;
  keyEvents: string[];
  sentiment: 'excellent' | 'good' | 'neutral' | 'concerning' | 'critical';
}

export interface PeriodComparison {
  basePeriod: {
    label: string;
    start: Date;
    end: Date;
    energy: EnergyDistribution;
  };
  targetPeriod: {
    label: string;
    start: Date;
    end: Date;
    energy: EnergyDistribution;
  };
  variations: {
    [key: string]: VariationMetric;
  };
  summary: string;
  highlights: ComparisonHighlight[];
}

export interface VariationMetric {
  absolute: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface ComparisonHighlight {
  type: 'improvement' | 'deterioration' | 'notable';
  title: string;
  description: string;
  metric: {
    base: number;
    target: number;
    variation: number;
  };
}

// ==================== CONSTANTES ====================

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                     'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const MONTH_ABBR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 
                   'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

// ==================== ENERGY CALCULATOR ====================

export async function getEnergyDistribution(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<PeriodEnergy> {
  // Buscar transações do período
  // FASE 2.4: Exclui transações marcadas como excludedFromEnergy (transfers, invoice_payments, etc.)
  const transactions = await prisma.transaction.findMany({
    where: {
      tenantId,
      transactionDate: { gte: startDate, lte: endDate },
      status: 'completed',
      deletedAt: null,
      excludedFromEnergy: false // FASE 2.4: Ignora transfers e invoice_payments
    },
    select: {
      id: true,
      type: true,
      amount: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          icon: true,
          type: true
        }
      }
    }
  });

  // Buscar semânticas das categorias COM status de validação
  const categoryIds = [...new Set(transactions.map(t => t.categoryId).filter(Boolean))] as string[];
  
  const semantics = await prisma.$queryRaw<Array<{
    categoryId: string;
    generatedWeight: Prisma.Decimal;
    survivalWeight: Prisma.Decimal;
    choiceWeight: Prisma.Decimal;
    futureWeight: Prisma.Decimal;
    lossWeight: Prisma.Decimal;
    validationStatus: string;
  }>>`
    SELECT "categoryId", "generatedWeight", "survivalWeight", "choiceWeight", "futureWeight", "lossWeight", "validationStatus"
    FROM "CategorySemantics"
    WHERE "categoryId" = ANY(${categoryIds})
  `;

  // Mapa com pesos E status de validação
  const semanticsMap = new Map(semantics.map(s => [s.categoryId, {
    generated: Number(s.generatedWeight),
    survival: Number(s.survivalWeight),
    choice: Number(s.choiceWeight),
    future: Number(s.futureWeight),
    loss: Number(s.lossWeight),
    isValidated: s.validationStatus === 'validated' // SOMENTE validated conta como "classificado"
  }]));

  // Calcular distribuição
  let generated = 0;
  let survival = 0;
  let choice = 0;
  let future = 0;
  let loss = 0;
  
  // FASE 2: Rastrear cobertura semântica
  // IMPORTANTE: Apenas despesas com validationStatus='validated' contam como classificadas
  // Despesas sem semântica validada NÃO entram no cálculo de energia (ficam pendentes)
  let classifiedAmount = 0;   // Despesas com semântica VALIDATED (não inferred/default)
  let unclassifiedAmount = 0; // Despesas sem validação (pendentes de classificação)
  let pendingEnergy = 0;      // Energia "em suspenso" de despesas não classificadas

  const categoryTotals = new Map<string, { amount: number; weights: any; name: string; icon: string | null }>();

  for (const t of transactions) {
    const amount = Number(t.amount);
    
    if (t.type === 'income') {
      generated += amount;
      // Track category
      const key = t.categoryId || 'sem-categoria';
      const current = categoryTotals.get(key) || { 
        amount: 0, 
        weights: { generated: 1, survival: 0, choice: 0, future: 0, loss: 0 },
        name: t.category?.name || 'Sem Categoria',
        icon: t.category?.icon || null
      };
      current.amount += amount;
      categoryTotals.set(key, current);
    } else if (t.type === 'expense') {
      const semanticData = t.categoryId ? semanticsMap.get(t.categoryId) : null;
      
      if (semanticData && semanticData.isValidated) {
        // ✅ VALIDATED: Entra no cálculo de energia com confiança
        survival += amount * semanticData.survival;
        choice += amount * semanticData.choice;
        future += amount * semanticData.future;
        loss += amount * semanticData.loss;
        classifiedAmount += amount;
        
        // Track category
        const key = t.categoryId!;
        const current = categoryTotals.get(key) || { 
          amount: 0, 
          weights: semanticData,
          name: t.category?.name || 'Sem Categoria',
          icon: t.category?.icon || null
        };
        current.amount += amount;
        categoryTotals.set(key, current);
      } else {
        // ⚠️ NÃO VALIDATED (inferred, default, ou sem semântica)
        // NÃO entra no cálculo de energia - fica como "pendente"
        unclassifiedAmount += amount;
        pendingEnergy += amount; // Contabilizar energia pendente de classificação
        
        // Track category mesmo assim para mostrar na UI
        const key = t.categoryId || 'sem-categoria';
        const current = categoryTotals.get(key) || { 
          amount: 0, 
          weights: { generated: 0, survival: 0, choice: 0, future: 0, loss: 0 },
          name: t.category?.name || 'Sem Categoria',
          icon: t.category?.icon || null
        };
        current.amount += amount;
        categoryTotals.set(key, current);
      }
    }
  }

  const consumed = survival + choice + loss;
  const netEnergy = generated - consumed - future;
  const available = generated - consumed;

  const distribution: EnergyDistribution = {
    generated,
    survival,
    choice,
    future,
    loss,
    netEnergy,
    survivalRatio: generated > 0 ? survival / generated : 0,
    freedomRatio: generated > 0 ? (generated - survival) / generated : 0,
    futureRatio: generated > 0 ? future / generated : 0,
    wasteRatio: generated > 0 ? loss / generated : 0,
    consumed,
    available
  };

  // Build category breakdown
  const categoryBreakdown: CategoryEnergy[] = Array.from(categoryTotals.entries()).map(([catId, data]) => {
    // Determine primary energy type
    let energyType: CategoryEnergy['energyType'] = 'hybrid';
    const w = data.weights;
    if (w.generated >= 0.5) energyType = 'generated';
    else if (w.survival >= 0.5) energyType = 'survival';
    else if (w.choice >= 0.5) energyType = 'choice';
    else if (w.future >= 0.5) energyType = 'future';
    else if (w.loss >= 0.5) energyType = 'loss';

    return {
      categoryId: catId,
      categoryName: data.name,
      categoryIcon: data.icon,
      amount: data.amount,
      energyType,
      percentage: generated > 0 ? (data.amount / generated) * 100 : 0,
      weights: data.weights
    };
  }).sort((a, b) => b.amount - a.amount);

  // FASE 2: Calcular cobertura semântica
  const totalExpenses = classifiedAmount + unclassifiedAmount;
  const coveragePercentage = totalExpenses > 0 ? (classifiedAmount / totalExpenses) * 100 : 100;
  const isComplete = coveragePercentage >= 85;
  const diagnosticMode: 'complete' | 'partial' | 'insufficient' = 
    coveragePercentage >= 85 ? 'complete' : 
    coveragePercentage >= 50 ? 'partial' : 'insufficient';

  return {
    ...distribution,
    period: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
    periodLabel: `${MONTH_NAMES[startDate.getMonth()]} ${startDate.getFullYear()}`,
    transactionCount: transactions.length,
    categoryBreakdown,
    
    // FASE 2: Cobertura semântica (SOMENTE validated conta)
    semanticsCoverage: {
      percentage: Math.round(coveragePercentage * 10) / 10,
      classifiedAmount,
      unclassifiedAmount,
      pendingEnergy,
      isComplete,
      diagnosticMode
    }
  };
}

export async function getEnergyTimeline(
  tenantId: string,
  startDate: Date,
  endDate: Date,
  groupBy: 'month' | 'week' | 'day' = 'month'
): Promise<PeriodEnergy[]> {
  const results: PeriodEnergy[] = [];
  
  if (groupBy === 'month') {
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    
    while (current <= end) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
      
      const energy = await getEnergyDistribution(tenantId, monthStart, monthEnd);
      results.push(energy);
      
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
  }
  
  return results;
}

// ==================== HEALTH INDEX ====================

export async function getHealthIndex(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<FinancialHealthIndex> {
  const energy = await getEnergyDistribution(tenantId, startDate, endDate);
  
  // Flag para identificar se há dados para determinadas métricas
  const hasIncomeData = energy.generated > 0;
  const hasFutureData = energy.future > 0;
  const hasLossData = energy.loss > 0;
  
  // 1. Survival Efficiency (25% do score) - ideal < 50%
  // Se não tem renda, não pode calcular - score neutro
  let survivalScore: number;
  let survivalStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'no_data';
  if (!hasIncomeData) {
    survivalScore = 0;
    survivalStatus = 'no_data';
  } else {
    survivalScore = Math.max(0, Math.min(100, 100 - ((energy.survivalRatio * 100) - 30)));
    survivalStatus = survivalScore >= 80 ? 'excellent' : 
                    survivalScore >= 60 ? 'good' : 
                    survivalScore >= 40 ? 'fair' : 'poor';
  }
  
  // 2. Savings Rate (25% do score) - ideal > 20%
  // Se futuro = 0 e tem renda, é "não detectado", não 0 excelente
  let savingsScore: number;
  let savingsStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'no_data';
  if (!hasIncomeData) {
    savingsScore = 0;
    savingsStatus = 'no_data';
  } else if (!hasFutureData) {
    // Tem renda mas não investiu nada - status neutro, não penaliza nem premia
    savingsScore = 0;
    savingsStatus = 'no_data';
  } else {
    savingsScore = Math.min(100, energy.futureRatio * 500);
    savingsStatus = savingsScore >= 80 ? 'excellent' : 
                   savingsScore >= 60 ? 'good' : 
                   savingsScore >= 40 ? 'fair' : 'poor';
  }
  
  // 3. Waste Control (20% do score) - ideal < 2%
  // Se loss = 0 e tem renda, significa "sem perdas detectadas" - excelente
  // Se não tem renda nem perdas, é "sem dados"
  let wasteScore: number;
  let wasteStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'no_data';
  if (!hasIncomeData && !hasLossData) {
    wasteScore = 0;
    wasteStatus = 'no_data';
  } else if (!hasLossData && hasIncomeData) {
    // Tem renda e não tem perdas - excelente!
    wasteScore = 100;
    wasteStatus = 'excellent';
  } else {
    wasteScore = Math.max(0, Math.min(100, 100 - (energy.wasteRatio * 2000)));
    wasteStatus = wasteScore >= 90 ? 'excellent' : 
                 wasteScore >= 70 ? 'good' : 
                 wasteScore >= 50 ? 'fair' : 'poor';
  }
  
  // 4. Freedom Ratio (20% do score)
  let freedomScore: number;
  let freedomStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'no_data';
  if (!hasIncomeData) {
    freedomScore = 0;
    freedomStatus = 'no_data';
  } else {
    freedomScore = Math.min(100, energy.freedomRatio * 200);
    freedomStatus = freedomScore >= 80 ? 'excellent' : 
                   freedomScore >= 60 ? 'good' : 
                   freedomScore >= 40 ? 'fair' : 'poor';
  }
  
  // 5. Balance (10% do score)
  let balanceScore: number;
  let balanceStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'no_data';
  if (!hasIncomeData) {
    balanceScore = 0;
    balanceStatus = 'no_data';
  } else {
    balanceScore = energy.netEnergy >= 0 ? 100 : 
                   Math.max(0, 100 + (energy.netEnergy / energy.generated * 100));
    balanceStatus = balanceScore >= 80 ? 'excellent' : 
                   balanceScore >= 60 ? 'good' : 
                   balanceScore >= 40 ? 'fair' : 'poor';
  }

  // Calcula score total apenas com componentes que têm dados
  const componentsWithData = [
    survivalStatus !== 'no_data' ? { score: survivalScore, weight: 0.25 } : null,
    savingsStatus !== 'no_data' ? { score: savingsScore, weight: 0.25 } : null,
    wasteStatus !== 'no_data' ? { score: wasteScore, weight: 0.20 } : null,
    freedomStatus !== 'no_data' ? { score: freedomScore, weight: 0.20 } : null,
    balanceStatus !== 'no_data' ? { score: balanceScore, weight: 0.10 } : null
  ].filter(Boolean) as { score: number; weight: number }[];
  
  let totalScore: number;
  if (componentsWithData.length === 0) {
    totalScore = 0;
  } else {
    const totalWeight = componentsWithData.reduce((sum, c) => sum + c.weight, 0);
    totalScore = Math.round(
      componentsWithData.reduce((sum, c) => sum + (c.score * c.weight / totalWeight * 100 / 100), 0)
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // REGRA DO CONTRATO DE ENERGIA (backend/src/contracts/ENERGY-CONTRACT.md)
  // ══════════════════════════════════════════════════════════════════════════════
  // O Health Score NÃO pode mentir:
  // - futureRatio = 0 → nota máxima = B (80 pontos)
  // - futureRatio = 0 + déficit → nota máxima = C (70 pontos)
  // ══════════════════════════════════════════════════════════════════════════════
  
  let scoreAdjusted = totalScore;
  let adjustmentReason: string | null = null;
  
  if (hasIncomeData && !hasFutureData) {
    // Tem renda mas não investiu nada - limitar nota máxima
    const hasDeficit = energy.netEnergy < 0;
    
    if (hasDeficit) {
      // Déficit + sem futuro = máximo C (70)
      if (scoreAdjusted > 70) {
        scoreAdjusted = 70;
        adjustmentReason = 'Score limitado a C: déficit financeiro e nenhum investimento em Futuro';
      }
    } else {
      // Só sem futuro = máximo B (80)
      if (scoreAdjusted > 80) {
        scoreAdjusted = 80;
        adjustmentReason = 'Score limitado a B: nenhum investimento em Futuro detectado';
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // FASE 2: MODO DIAGNÓSTICO PARCIAL
  // ══════════════════════════════════════════════════════════════════════════════
  // Se cobertura semântica < 85%, o diagnóstico é PARCIAL e deve indicar isso
  // ══════════════════════════════════════════════════════════════════════════════
  
  const coverageInfo = energy.semanticsCoverage;
  let diagnosticLimited = false;
  
  if (!coverageInfo.isComplete && hasIncomeData) {
    diagnosticLimited = true;
    if (!adjustmentReason) {
      adjustmentReason = `Diagnóstico parcial: apenas ${coverageInfo.percentage.toFixed(0)}% dos gastos classificados`;
    } else {
      adjustmentReason += ` | Diagnóstico parcial: ${coverageInfo.percentage.toFixed(0)}% classificados`;
    }
  }

  const grade = !hasIncomeData ? 'N/A' :
               diagnosticLimited ? '?' :  // FASE 2: Grade indeterminada se cobertura baixa
               scoreAdjusted >= 95 ? 'A+' :
               scoreAdjusted >= 90 ? 'A' :
               scoreAdjusted >= 85 ? 'B+' :
               scoreAdjusted >= 80 ? 'B' :
               scoreAdjusted >= 70 ? 'C+' :
               scoreAdjusted >= 60 ? 'C' :
               scoreAdjusted >= 50 ? 'D' : 'F';

  const label = !hasIncomeData ? 'Sem dados' :
               diagnosticLimited ? 'Incompleto' :  // FASE 2: Label para diagnóstico parcial
               scoreAdjusted >= 90 ? 'Excelente' :
               scoreAdjusted >= 80 ? 'Muito Bom' :
               scoreAdjusted >= 70 ? 'Bom' :
               scoreAdjusted >= 60 ? 'Regular' :
               scoreAdjusted >= 50 ? 'Atenção' : 'Crítico';

  const color = !hasIncomeData ? '#6B7280' :
               diagnosticLimited ? '#8B5CF6' :  // FASE 2: Roxo para diagnóstico parcial
               scoreAdjusted >= 80 ? '#10B981' :
               scoreAdjusted >= 60 ? '#F59E0B' : '#EF4444';

  // Gerar recomendações
  const recommendations: HealthRecommendation[] = [];
  
  if (survivalScore < 60) {
    recommendations.push({
      priority: 1,
      title: 'Reduzir custos de sobrevivência',
      description: 'Seus gastos essenciais estão consumindo muito da sua renda.',
      impact: 'Pode melhorar seu score em até 15 pontos',
      difficulty: 'medium'
    });
  }
  
  if (savingsScore < 40) {
    recommendations.push({
      priority: 2,
      title: 'Iniciar investimentos',
      description: 'Você não está direcionando energia para o futuro.',
      impact: 'Pode melhorar seu score em até 20 pontos',
      difficulty: 'easy'
    });
  }
  
  if (wasteScore < 70) {
    recommendations.push({
      priority: 3,
      title: 'Eliminar desperdícios',
      description: 'Juros, multas e taxas estão consumindo sua energia.',
      impact: 'Pode melhorar seu score em até 10 pontos',
      difficulty: 'easy'
    });
  }

  return {
    score: scoreAdjusted,
    grade,
    label,
    color,
    adjustmentReason, // Indica se houve limitação por regra do contrato
    
    // FASE 2: Cobertura semântica
    semanticsCoverage: coverageInfo,
    
    components: {
      survivalEfficiency: {
        name: 'Eficiência em Sobrevivência',
        score: survivalScore,
        weight: 0.25,
        status: survivalStatus,
        description: 'Quanto da renda vai para necessidades básicas',
        currentValue: energy.survivalRatio * 100,
        targetValue: 50
      },
      savingsRate: {
        name: 'Taxa de Poupança',
        score: savingsScore,
        weight: 0.25,
        status: savingsStatus,
        description: 'Quanto está sendo investido no futuro',
        currentValue: energy.futureRatio * 100,
        targetValue: 20
      },
      wasteControl: {
        name: 'Controle de Desperdício',
        score: wasteScore,
        weight: 0.20,
        status: wasteStatus,
        description: 'Energia perdida em juros, multas e taxas',
        currentValue: energy.wasteRatio * 100,
        targetValue: 2
      },
      freedomRatio: {
        name: 'Liberdade Financeira',
        score: freedomScore,
        weight: 0.20,
        status: freedomStatus,
        description: 'Renda livre após necessidades básicas',
        currentValue: energy.freedomRatio * 100,
        targetValue: 50
      },
      balance: {
        name: 'Equilíbrio',
        score: balanceScore,
        weight: 0.10,
        status: balanceStatus,
        description: 'Balanço entre geração e consumo',
        currentValue: energy.netEnergy
      }
    },
    trend: {
      direction: 'stable', // TODO: calcular baseado em histórico
      lastMonthScore: scoreAdjusted,
      threeMonthAvg: scoreAdjusted
    },
    recommendations
  };
}

// ==================== INSIGHTS ENGINE ====================

export async function generateInsights(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<Insight[]> {
  const energy = await getEnergyDistribution(tenantId, startDate, endDate);
  const insights: Insight[] = [];

  // 1. Sobrevivência muito alta
  if (energy.survivalRatio > 0.5) {
    insights.push({
      id: 'survival-high',
      type: 'warning',
      priority: 'high',
      title: 'Sobrevivência consumindo muito',
      description: `${(energy.survivalRatio * 100).toFixed(0)}% da sua renda vai para necessidades básicas. O ideal é abaixo de 50%.`,
      icon: '🏠',
      color: '#3B82F6',
      metric: {
        current: energy.survivalRatio * 100,
        target: 50,
        unit: '%'
      },
      actions: [
        { label: 'Renegociar contratos', description: 'Busque melhores condições', impact: 'high', difficulty: 'medium' },
        { label: 'Revisar planos', description: 'Telefone, internet, streaming', impact: 'medium', difficulty: 'easy' }
      ],
      confidence: 95
    });
  }

  // 2. Sem investimentos
  if (energy.futureRatio === 0 && energy.generated > 0) {
    insights.push({
      id: 'no-future',
      type: 'warning',
      priority: 'high',
      title: 'Nenhum investimento no futuro',
      description: 'Você não está direcionando energia para o futuro. Mesmo R$ 50/mês faz diferença.',
      icon: '🚀',
      color: '#8B5CF6',
      actions: [
        { label: 'Começar a investir', description: 'Configure investimento automático', impact: 'high', difficulty: 'easy' }
      ],
      confidence: 100
    });
  } else if (energy.futureRatio > 0.2) {
    insights.push({
      id: 'great-savings',
      type: 'achievement',
      priority: 'medium',
      title: 'Excelente taxa de poupança!',
      description: `Você está investindo ${(energy.futureRatio * 100).toFixed(0)}% da sua renda no futuro. Parabéns!`,
      icon: '🏆',
      color: '#10B981',
      metric: {
        current: energy.futureRatio * 100,
        target: 20,
        unit: '%'
      },
      confidence: 95
    });
  }

  // 3. Desperdício alto
  if (energy.wasteRatio > 0.05) {
    insights.push({
      id: 'high-waste',
      type: 'opportunity',
      priority: 'medium',
      title: 'Energia sendo desperdiçada',
      description: `${(energy.wasteRatio * 100).toFixed(1)}% está indo para juros, multas e taxas. Isso pode virar investimento!`,
      icon: '💨',
      color: '#EF4444',
      metric: {
        current: energy.wasteRatio * 100,
        unit: '%'
      },
      actions: [
        { label: 'Eliminar juros de cartão', description: 'Pague a fatura total', impact: 'high', difficulty: 'medium' },
        { label: 'Automatizar pagamentos', description: 'Evite multas por atraso', impact: 'medium', difficulty: 'easy' }
      ],
      confidence: 90
    });
  }

  // 4. Excelente liberdade financeira
  if (energy.freedomRatio > 0.5) {
    insights.push({
      id: 'great-freedom',
      type: 'achievement',
      priority: 'medium',
      title: 'Excelente liberdade financeira',
      description: `${(energy.freedomRatio * 100).toFixed(0)}% da sua renda está livre após necessidades básicas!`,
      icon: '🎯',
      color: '#10B981',
      metric: {
        current: energy.freedomRatio * 100,
        unit: '%'
      },
      confidence: 95
    });
  }

  // 5. Déficit no período
  if (energy.netEnergy < 0) {
    insights.push({
      id: 'deficit',
      type: 'warning',
      priority: 'high',
      title: 'Período deficitário',
      description: `Você gastou R$ ${Math.abs(energy.netEnergy).toFixed(2)} a mais do que ganhou neste período.`,
      icon: '⚠️',
      color: '#EF4444',
      metric: {
        current: energy.netEnergy,
        unit: 'R$'
      },
      actions: [
        { label: 'Revisar gastos de escolha', description: 'Lifestyle pode ser ajustado', impact: 'high', difficulty: 'medium' }
      ],
      confidence: 100
    });
  }

  // 6. Superávit forte
  if (energy.available > energy.generated * 0.3) {
    insights.push({
      id: 'strong-surplus',
      type: 'opportunity',
      priority: 'low',
      title: 'Sobrou energia para investir',
      description: `Você tem R$ ${energy.available.toFixed(2)} disponíveis após gastos. Considere investir!`,
      icon: '💡',
      color: '#F59E0B',
      metric: {
        current: energy.available,
        unit: 'R$'
      },
      actions: [
        { label: 'Investir excedente', description: 'Direcione para o futuro', impact: 'high', difficulty: 'easy' }
      ],
      confidence: 85
    });
  }

  return insights.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// ==================== NARRATIVE GENERATOR ====================

export async function generateAnnualNarrative(
  tenantId: string,
  year: number
): Promise<AnnualNarrative> {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);
  
  // Obter dados de todos os meses
  const monthlyData: PeriodEnergy[] = [];
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(year, m, 1);
    const monthEnd = new Date(year, m + 1, 0, 23, 59, 59);
    
    if (monthStart <= new Date()) {
      const energy = await getEnergyDistribution(tenantId, monthStart, monthEnd);
      monthlyData.push(energy);
    }
  }

  // Calcular totais anuais
  const totals: EnergyDistribution = {
    generated: monthlyData.reduce((sum, m) => sum + m.generated, 0),
    survival: monthlyData.reduce((sum, m) => sum + m.survival, 0),
    choice: monthlyData.reduce((sum, m) => sum + m.choice, 0),
    future: monthlyData.reduce((sum, m) => sum + m.future, 0),
    loss: monthlyData.reduce((sum, m) => sum + m.loss, 0),
    netEnergy: 0,
    survivalRatio: 0,
    freedomRatio: 0,
    futureRatio: 0,
    wasteRatio: 0,
    consumed: 0,
    available: 0
  };
  
  totals.consumed = totals.survival + totals.choice + totals.loss;
  totals.netEnergy = totals.generated - totals.consumed - totals.future;
  totals.available = totals.generated - totals.consumed;
  totals.survivalRatio = totals.generated > 0 ? totals.survival / totals.generated : 0;
  totals.freedomRatio = totals.generated > 0 ? (totals.generated - totals.survival) / totals.generated : 0;
  totals.futureRatio = totals.generated > 0 ? totals.future / totals.generated : 0;
  totals.wasteRatio = totals.generated > 0 ? totals.loss / totals.generated : 0;

  // Determinar sentimento geral
  let overallSentiment: AnnualNarrative['overallSentiment'] = 'neutral';
  if (totals.futureRatio >= 0.2 && totals.wasteRatio < 0.02) overallSentiment = 'excellent';
  else if (totals.futureRatio >= 0.1 && totals.netEnergy > 0) overallSentiment = 'good';
  else if (totals.netEnergy < 0) overallSentiment = 'concerning';
  else if (totals.survivalRatio > 0.7 || totals.wasteRatio > 0.1) overallSentiment = 'critical';

  // Gerar headline
  const headlines = {
    excellent: [`${year}: Ano de Prosperidade`, `${year}: Construindo Riqueza`],
    good: [`${year}: Progresso Consistente`, `${year}: Bases Sólidas`],
    neutral: [`${year}: Ano de Transição`, `${year}: Mantendo o Equilíbrio`],
    concerning: [`${year}: Sinais de Atenção`, `${year}: Momento de Ajustes`],
    critical: [`${year}: Ponto de Inflexão`, `${year}: Hora de Reagir`]
  };
  const headline = headlines[overallSentiment][0];

  // Gerar resumo
  const summary = generateSummary(totals, overallSentiment);

  // Gerar highlights
  const highlights: NarrativePoint[] = [];
  if (totals.futureRatio >= 0.1) {
    highlights.push({
      type: 'positive',
      icon: '🚀',
      title: 'Investindo no Futuro',
      description: `Você direcionou ${(totals.futureRatio * 100).toFixed(0)}% da sua renda para investimentos.`,
      metric: { value: totals.future, unit: 'R$', trend: 'up' }
    });
  }
  if (totals.freedomRatio >= 0.5) {
    highlights.push({
      type: 'positive',
      icon: '🎯',
      title: 'Alta Liberdade Financeira',
      description: `${(totals.freedomRatio * 100).toFixed(0)}% da sua renda ficou livre após necessidades.`
    });
  }

  // Gerar warnings
  const warnings: NarrativePoint[] = [];
  if (totals.survivalRatio > 0.5) {
    warnings.push({
      type: 'negative',
      icon: '🏠',
      title: 'Custos Essenciais Elevados',
      description: `${(totals.survivalRatio * 100).toFixed(0)}% foi consumido por sobrevivência.`
    });
  }
  if (totals.wasteRatio > 0.05) {
    warnings.push({
      type: 'negative',
      icon: '💨',
      title: 'Energia Dissipada',
      description: `R$ ${totals.loss.toFixed(2)} foram perdidos em juros, multas e taxas.`
    });
  }

  // Gerar oportunidades
  const opportunities: NarrativePoint[] = [];
  if (totals.futureRatio < 0.1 && totals.available > 0) {
    opportunities.push({
      type: 'opportunity',
      icon: '💡',
      title: 'Potencial de Investimento',
      description: `Você poderia estar investindo R$ ${(totals.available * 0.5).toFixed(2)} por período.`
    });
  }

  // Gerar história mensal
  const monthlyStory: MonthNarrative[] = monthlyData.map((m, idx) => {
    const sentiment: MonthNarrative['sentiment'] = 
      m.futureRatio >= 0.2 ? 'excellent' :
      m.netEnergy > 0 ? 'good' :
      m.netEnergy >= -500 ? 'neutral' :
      m.netEnergy >= -2000 ? 'concerning' : 'critical';

    const monthHeadline = 
      m.futureRatio >= 0.2 ? 'Mês de Crescimento' :
      m.netEnergy > m.generated * 0.2 ? 'Mês Próspero' :
      m.netEnergy > 0 ? 'Mês Equilibrado' :
      'Mês de Ajustes';

    return {
      month: MONTH_NAMES[idx],
      monthIndex: idx,
      energy: m,
      headline: monthHeadline,
      story: generateMonthStory(m),
      keyEvents: [],
      sentiment
    };
  });

  return {
    year,
    headline,
    summary,
    highlights,
    warnings,
    opportunities,
    monthlyStory,
    overallSentiment,
    totals
  };
}

function generateSummary(totals: EnergyDistribution, sentiment: string): string {
  const parts = [];
  
  parts.push(`Você gerou R$ ${totals.generated.toFixed(2)} de energia financeira este ano.`);
  
  if (totals.futureRatio >= 0.1) {
    parts.push(`Direcionou ${(totals.futureRatio * 100).toFixed(0)}% para o futuro.`);
  }
  
  if (totals.netEnergy > 0) {
    parts.push(`Sobrou R$ ${totals.netEnergy.toFixed(2)} após todos os gastos.`);
  } else if (totals.netEnergy < 0) {
    parts.push(`Gastou R$ ${Math.abs(totals.netEnergy).toFixed(2)} além do que gerou.`);
  }
  
  return parts.join(' ');
}

function generateMonthStory(energy: EnergyDistribution): string {
  if (energy.generated === 0) return 'Sem movimentação neste mês.';
  
  const parts = [];
  
  if (energy.futureRatio >= 0.2) {
    parts.push(`Excelente! ${(energy.futureRatio * 100).toFixed(0)}% foi para investimentos.`);
  }
  
  if (energy.survivalRatio > 0.6) {
    parts.push(`Mês pesado: ${(energy.survivalRatio * 100).toFixed(0)}% foi para sobrevivência.`);
  }
  
  if (energy.netEnergy > 0) {
    parts.push(`Saldo positivo de R$ ${energy.netEnergy.toFixed(2)}.`);
  } else if (energy.netEnergy < 0) {
    parts.push(`Déficit de R$ ${Math.abs(energy.netEnergy).toFixed(2)}.`);
  }
  
  return parts.join(' ') || 'Mês dentro da normalidade.';
}

// ==================== COMPARISON ENGINE ====================

export async function comparePeriods(
  tenantId: string,
  baseStart: Date,
  baseEnd: Date,
  targetStart: Date,
  targetEnd: Date
): Promise<PeriodComparison> {
  const baseEnergy = await getEnergyDistribution(tenantId, baseStart, baseEnd);
  const targetEnergy = await getEnergyDistribution(tenantId, targetStart, targetEnd);

  const calculateVariation = (base: number, target: number, isExpense = false): VariationMetric => {
    const absolute = target - base;
    const percentage = base !== 0 ? ((target - base) / base) * 100 : (target > 0 ? 100 : 0);
    const trend: VariationMetric['trend'] = absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'stable';
    
    // Para despesas, diminuir é positivo. Para receitas, aumentar é positivo.
    let sentiment: VariationMetric['sentiment'] = 'neutral';
    if (isExpense) {
      sentiment = absolute < 0 ? 'positive' : absolute > 0 ? 'negative' : 'neutral';
    } else {
      sentiment = absolute > 0 ? 'positive' : absolute < 0 ? 'negative' : 'neutral';
    }
    
    return { absolute, percentage, trend, sentiment };
  };

  const variations = {
    generated: calculateVariation(baseEnergy.generated, targetEnergy.generated, false),
    survival: calculateVariation(baseEnergy.survival, targetEnergy.survival, true),
    choice: calculateVariation(baseEnergy.choice, targetEnergy.choice, true),
    future: calculateVariation(baseEnergy.future, targetEnergy.future, false),
    loss: calculateVariation(baseEnergy.loss, targetEnergy.loss, true),
    netEnergy: calculateVariation(baseEnergy.netEnergy, targetEnergy.netEnergy, false),
    freedomRatio: calculateVariation(baseEnergy.freedomRatio * 100, targetEnergy.freedomRatio * 100, false)
  };

  // Gerar highlights
  const highlights: ComparisonHighlight[] = [];
  
  if (variations.generated.percentage > 10) {
    highlights.push({
      type: 'improvement',
      title: 'Aumento de Receita',
      description: `Receitas cresceram ${variations.generated.percentage.toFixed(1)}%`,
      metric: { base: baseEnergy.generated, target: targetEnergy.generated, variation: variations.generated.percentage }
    });
  }
  
  if (variations.loss.percentage < -20) {
    highlights.push({
      type: 'improvement',
      title: 'Redução de Desperdício',
      description: `Perdas reduziram ${Math.abs(variations.loss.percentage).toFixed(1)}%`,
      metric: { base: baseEnergy.loss, target: targetEnergy.loss, variation: variations.loss.percentage }
    });
  }
  
  if (variations.future.percentage > 20) {
    highlights.push({
      type: 'improvement',
      title: 'Mais Investimentos',
      description: `Investimentos cresceram ${variations.future.percentage.toFixed(1)}%`,
      metric: { base: baseEnergy.future, target: targetEnergy.future, variation: variations.future.percentage }
    });
  }

  // Gerar resumo
  let summary = '';
  const positives = Object.values(variations).filter(v => v.sentiment === 'positive').length;
  const negatives = Object.values(variations).filter(v => v.sentiment === 'negative').length;
  
  if (positives > negatives) {
    summary = 'Período com evolução positiva. Principais indicadores melhoraram.';
  } else if (negatives > positives) {
    summary = 'Período com pontos de atenção. Alguns indicadores precisam de ajuste.';
  } else {
    summary = 'Período estável, sem grandes variações.';
  }

  return {
    basePeriod: {
      label: baseEnergy.periodLabel,
      start: baseStart,
      end: baseEnd,
      energy: baseEnergy
    },
    targetPeriod: {
      label: targetEnergy.periodLabel,
      start: targetStart,
      end: targetEnd,
      energy: targetEnergy
    },
    variations,
    summary,
    highlights
  };
}

// ==================== CATEGORY SEMANTICS ====================

export async function getCategorySemantics(tenantId: string) {
  return await prisma.$queryRaw`
    SELECT 
      cs.*,
      c.name as "categoryName",
      c.icon as "categoryIcon",
      c.type as "categoryType",
      c.level as "categoryLevel"
    FROM "CategorySemantics" cs
    JOIN "Category" c ON cs."categoryId" = c.id
    WHERE cs."tenantId" = ${tenantId}
    ORDER BY c.type, c.name
  `;
}

export async function updateCategorySemantics(
  tenantId: string,
  categoryId: string,
  weights: { survival: number; choice: number; future: number; loss: number }
) {
  // Normalizar (para despesas, generated é sempre 0)
  const total = weights.survival + weights.choice + weights.future + weights.loss;
  const normalized = {
    survival: weights.survival / total,
    choice: weights.choice / total,
    future: weights.future / total,
    loss: weights.loss / total
  };

  await prisma.$executeRaw`
    UPDATE "CategorySemantics" SET
      "survivalWeight" = ${normalized.survival},
      "choiceWeight" = ${normalized.choice},
      "futureWeight" = ${normalized.future},
      "lossWeight" = ${normalized.loss},
      "userOverride" = true,
      "updatedAt" = NOW()
    WHERE "categoryId" = ${categoryId} AND "tenantId" = ${tenantId}
  `;
  
  return normalized;
}

// ==================== TOP PENDING CATEGORIES (ONBOARDING) ====================

interface TopPendingCategory {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  pendingAmount: number;
  pendingCount: number;
  currentStatus: 'not_validated' | 'inferred' | 'missing' | 'default';
  suggestedPreset: 'survival' | 'choice' | 'future' | 'loss' | 'hybrid';
  suggestedWeights: { survival: number; choice: number; future: number; loss: number };
}

interface TopPendingResult {
  coverage: {
    validatedPercent: number;
    validatedAmount: number;
    totalExpenseAmount: number;
    validatedCount: number;
    pendingCount: number;
    totalCategoriesUsed: number;
  };
  topPendingCategories: TopPendingCategory[];
}

/**
 * Heurística simples para sugerir preset baseado no nome da categoria
 * NÃO É IA - é pattern matching determinístico
 */
function suggestPresetByName(name: string): { preset: TopPendingCategory['suggestedPreset']; weights: TopPendingCategory['suggestedWeights'] } {
  const nameLower = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Padrões de SURVIVAL (essenciais)
  const survivalPatterns = [
    'aluguel', 'alugel', 'moradia', 'condominio', 'iptu', 'luz', 'energia', 'eletrica',
    'agua', 'gas', 'internet', 'telefone', 'saude', 'plano de saude', 'remedio', 'medicamento',
    'farmacia', 'supermercado', 'mercado', 'feira', 'hortifruti', 'transporte', 'combustivel',
    'gasolina', 'onibus', 'metro', 'seguro', 'escola', 'faculdade', 'creche'
  ];
  
  // Padrões de LOSS (perdas)
  const lossPatterns = [
    'juros', 'multa', 'taxa', 'tarifa', 'anuidade', 'cheque especial', 'iof',
    'mora', 'atraso', 'encargo', 'servico bancario'
  ];
  
  // Padrões de FUTURE (investimento)
  const futurePatterns = [
    'investimento', 'poupanca', 'tesouro', 'acao', 'acoes', 'fundo', 'cdb', 'lci', 'lca',
    'previdencia', 'curso', 'capacitacao', 'treinamento', 'livro', 'educacao'
  ];
  
  // Padrões de CHOICE (opcionais puros)
  const choicePatterns = [
    'lazer', 'entretenimento', 'netflix', 'spotify', 'streaming', 'cinema', 'teatro',
    'restaurante', 'delivery', 'ifood', 'bar', 'balada', 'viagem', 'turismo', 'hotel',
    'roupa', 'vestuario', 'shopping', 'beleza', 'estetica', 'salao', 'academia', 'esporte',
    'hobby', 'presente', 'jogo', 'game', 'assinatura'
  ];

  // Verificar padrões
  for (const pattern of survivalPatterns) {
    if (nameLower.includes(pattern)) {
      return { preset: 'survival', weights: { survival: 1, choice: 0, future: 0, loss: 0 } };
    }
  }
  
  for (const pattern of lossPatterns) {
    if (nameLower.includes(pattern)) {
      return { preset: 'loss', weights: { survival: 0, choice: 0, future: 0, loss: 1 } };
    }
  }
  
  for (const pattern of futurePatterns) {
    if (nameLower.includes(pattern)) {
      return { preset: 'future', weights: { survival: 0, choice: 0, future: 1, loss: 0 } };
    }
  }
  
  for (const pattern of choicePatterns) {
    if (nameLower.includes(pattern)) {
      return { preset: 'choice', weights: { survival: 0, choice: 1, future: 0, loss: 0 } };
    }
  }
  
  // Alimentação genérica = híbrido 60/40 (comida é parcialmente essencial)
  if (nameLower.includes('alimenta') || nameLower.includes('comida') || nameLower.includes('refeic')) {
    return { preset: 'hybrid', weights: { survival: 0.6, choice: 0.4, future: 0, loss: 0 } };
  }
  
  // Default: híbrido 50/50 (mas status continua pendente)
  return { preset: 'hybrid', weights: { survival: 0.5, choice: 0.5, future: 0, loss: 0 } };
}

/**
 * Retorna top categorias pendentes para onboarding
 * Ordenado por impacto (R$ gasto) e frequência
 */
export async function getTopPendingCategories(
  tenantId: string,
  limit: number = 10,
  startDate?: Date,
  endDate?: Date
): Promise<TopPendingResult> {
  // Período padrão: mês atual ou últimos 30 dias
  const now = new Date();
  const defaultStart = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Buscar despesas do período agrupadas por categoria
  const expensesByCategory = await prisma.$queryRaw<Array<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string | null;
    totalAmount: Prisma.Decimal;
    transactionCount: bigint;
  }>>`
    SELECT 
      c.id as "categoryId",
      c.name as "categoryName",
      c.icon as "categoryIcon",
      COALESCE(SUM(t.amount), 0) as "totalAmount",
      COUNT(t.id) as "transactionCount"
    FROM "Category" c
    LEFT JOIN "Transaction" t ON c.id = t."categoryId" 
      AND t.type = 'expense'
      AND t."tenantId" = ${tenantId}
      AND t."deletedAt" IS NULL
      AND t.date >= ${defaultStart}
      AND t.date <= ${defaultEnd}
    WHERE c."tenantId" = ${tenantId}
      AND c."deletedAt" IS NULL
      AND c.type = 'expense'
    GROUP BY c.id, c.name, c.icon
    HAVING COALESCE(SUM(t.amount), 0) > 0
    ORDER BY "totalAmount" DESC
  `;

  // Buscar status de validação das categorias
  const semantics = await prisma.$queryRaw<Array<{
    categoryId: string;
    validationStatus: string;
    survivalWeight: Prisma.Decimal;
    choiceWeight: Prisma.Decimal;
    futureWeight: Prisma.Decimal;
    lossWeight: Prisma.Decimal;
  }>>`
    SELECT 
      "categoryId",
      "validationStatus",
      "survivalWeight",
      "choiceWeight",
      "futureWeight",
      "lossWeight"
    FROM "CategorySemantics"
    WHERE "tenantId" = ${tenantId}
  `;

  const semanticsMap = new Map(semantics.map(s => [s.categoryId, {
    validationStatus: s.validationStatus,
    weights: {
      survival: Number(s.survivalWeight),
      choice: Number(s.choiceWeight),
      future: Number(s.futureWeight),
      loss: Number(s.lossWeight)
    }
  }]));

  // Separar categorias validadas e pendentes
  let validatedAmount = 0;
  let pendingAmount = 0;
  let validatedCount = 0;
  let pendingCount = 0;
  const pendingCategories: TopPendingCategory[] = [];

  for (const cat of expensesByCategory) {
    const amount = Number(cat.totalAmount);
    const count = Number(cat.transactionCount);
    const sem = semanticsMap.get(cat.categoryId);
    
    if (sem?.validationStatus === 'validated') {
      validatedAmount += amount;
      validatedCount++;
    } else {
      pendingAmount += amount;
      pendingCount++;
      
      // Determinar status e sugestão
      let currentStatus: TopPendingCategory['currentStatus'] = 'missing';
      if (sem) {
        currentStatus = sem.validationStatus as any || 'not_validated';
      }
      
      const suggestion = suggestPresetByName(cat.categoryName);
      
      pendingCategories.push({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        categoryIcon: cat.categoryIcon,
        pendingAmount: amount,
        pendingCount: count,
        currentStatus,
        suggestedPreset: suggestion.preset,
        suggestedWeights: suggestion.weights
      });
    }
  }

  // Calcular coverage
  const totalExpenseAmount = validatedAmount + pendingAmount;
  const validatedPercent = totalExpenseAmount > 0 ? (validatedAmount / totalExpenseAmount) * 100 : 100;

  return {
    coverage: {
      validatedPercent,
      validatedAmount,
      totalExpenseAmount,
      validatedCount,
      pendingCount,
      totalCategoriesUsed: expensesByCategory.length
    },
    topPendingCategories: pendingCategories.slice(0, limit)
  };
}

export default {
  getEnergyDistribution,
  getEnergyTimeline,
  getHealthIndex,
  generateInsights,
  generateAnnualNarrative,
  comparePeriods,
  getCategorySemantics,
  updateCategorySemantics,
  getTopPendingCategories
};
