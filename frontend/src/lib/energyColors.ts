/**
 * Energy Colors and Constants
 * ============================
 * Sistema de cores e constantes para os relatórios de energia financeira
 */

// Cores das Energias
export const ENERGY_COLORS = {
  generated: {
    primary: '#10B981',      // Emerald 500
    light: '#D1FAE5',        // Emerald 100
    dark: '#059669',         // Emerald 600
    gradient: 'from-emerald-400 to-emerald-600',
    bg: 'bg-emerald-500',
    bgLight: 'bg-emerald-100',
    text: 'text-emerald-600',
    border: 'border-emerald-500'
  },
  survival: {
    primary: '#3B82F6',      // Blue 500
    light: '#DBEAFE',        // Blue 100
    dark: '#2563EB',         // Blue 600
    gradient: 'from-blue-400 to-blue-600',
    bg: 'bg-blue-500',
    bgLight: 'bg-blue-100',
    text: 'text-blue-600',
    border: 'border-blue-500'
  },
  choice: {
    primary: '#F59E0B',      // Amber 500
    light: '#FEF3C7',        // Amber 100
    dark: '#D97706',         // Amber 600
    gradient: 'from-amber-400 to-amber-600',
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-100',
    text: 'text-amber-600',
    border: 'border-amber-500'
  },
  future: {
    primary: '#8B5CF6',      // Violet 500
    light: '#EDE9FE',        // Violet 100
    dark: '#7C3AED',         // Violet 600
    gradient: 'from-violet-400 to-violet-600',
    bg: 'bg-violet-500',
    bgLight: 'bg-violet-100',
    text: 'text-violet-600',
    border: 'border-violet-500'
  },
  loss: {
    primary: '#EF4444',      // Red 500
    light: '#FEE2E2',        // Red 100
    dark: '#DC2626',         // Red 600
    gradient: 'from-red-400 to-red-600',
    bg: 'bg-red-500',
    bgLight: 'bg-red-100',
    text: 'text-red-600',
    border: 'border-red-500'
  }
} as const;

// Ícones das Energias
export const ENERGY_ICONS = {
  generated: '⚡',
  survival: '🏠',
  choice: '🎯',
  future: '🚀',
  loss: '💨'
} as const;

// Labels em português
export const ENERGY_LABELS = {
  generated: 'Energia Gerada',
  survival: 'Sobrevivência',
  choice: 'Escolha',
  future: 'Futuro',
  loss: 'Energia Perdida'
} as const;

// Polaridade por métrica: define se aumento é bom ou ruim
// higher_is_better: true = verde quando sobe, vermelho quando desce
// higher_is_better: false = vermelho quando sobe, verde quando desce
export const METRIC_POLARITY: Record<string, { higher_is_better: boolean; zeroMeaning: 'no_data' | 'excellent' | 'neutral' }> = {
  generated: { higher_is_better: true, zeroMeaning: 'no_data' },
  survival: { higher_is_better: false, zeroMeaning: 'no_data' },
  choice: { higher_is_better: false, zeroMeaning: 'no_data' },
  future: { higher_is_better: true, zeroMeaning: 'no_data' },
  loss: { higher_is_better: false, zeroMeaning: 'excellent' },
  netEnergy: { higher_is_better: true, zeroMeaning: 'neutral' },
  survivalRatio: { higher_is_better: false, zeroMeaning: 'no_data' },
  freedomRatio: { higher_is_better: true, zeroMeaning: 'no_data' },
  futureRatio: { higher_is_better: true, zeroMeaning: 'no_data' },
  wasteRatio: { higher_is_better: false, zeroMeaning: 'excellent' }
} as const;

// Descrições das energias
export const ENERGY_DESCRIPTIONS = {
  generated: 'Dinheiro que entrou (receitas)',
  survival: 'Gastos essenciais para viver',
  choice: 'Gastos opcionais de lifestyle',
  future: 'Investimentos e reservas',
  loss: 'Perdas evitáveis (juros, multas)'
} as const;

/**
 * Determina a cor do badge de variação baseado na métrica e direção
 */
export function getVariationBadgeColor(
  metricKey: string, 
  trend: 'up' | 'down' | 'stable',
  hasData: boolean = true
): 'green' | 'red' | 'gray' {
  if (!hasData || trend === 'stable') return 'gray';
  
  const polarity = METRIC_POLARITY[metricKey];
  if (!polarity) return 'gray';
  
  const isUp = trend === 'up';
  
  // Se higher_is_better=true: up=green, down=red
  // Se higher_is_better=false: up=red, down=green
  if (polarity.higher_is_better) {
    return isUp ? 'green' : 'red';
  } else {
    return isUp ? 'red' : 'green';
  }
}

/**
 * Verifica se um score deve mostrar 'sem dados' em vez de valor
 */
export function shouldShowNoData(
  metricKey: string,
  baseValue: number,
  targetValue: number,
  hasTransactions: boolean
): boolean {
  const polarity = METRIC_POLARITY[metricKey];
  if (!polarity) return false;
  
  // Se não tem transações no período, sempre é sem dados
  if (!hasTransactions) return true;
  
  // Para métricas onde 0 significa 'sem dados' (não excelente)
  if (polarity.zeroMeaning === 'no_data' && baseValue === 0 && targetValue === 0) {
    return true;
  }
  
  return false;
}

// Tipos
export type EnergyType = keyof typeof ENERGY_COLORS;

// Interfaces
export interface EnergyDistribution {
  generated: number;
  survival: number;
  choice: number;
  future: number;
  loss: number;
  netEnergy: number;
  survivalRatio: number;
  freedomRatio: number;
  futureRatio: number;
  wasteRatio: number;
  consumed: number;
  available: number;
}

export interface SemanticsCoverage {
  percentage: number;          // % do gasto total com semântica VALIDATED
  classifiedAmount: number;    // Valor em R$ com semântica validated
  unclassifiedAmount: number;  // Valor em R$ sem validação (pendente)
  pendingEnergy: number;       // Energia "em suspenso" - não entra no cálculo
  isComplete: boolean;         // >= 85% = completo
  diagnosticMode: 'complete' | 'partial' | 'insufficient'; // Estado do diagnóstico
}

export interface PeriodEnergy extends EnergyDistribution {
  period: string;
  periodLabel: string;
  transactionCount: number;
  categoryBreakdown: CategoryEnergy[];
  semanticsCoverage?: SemanticsCoverage; // FASE 2: Modo Diagnóstico Parcial
}

export interface CategoryEnergy {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  amount: number;
  energyType: EnergyType | 'hybrid';
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
  semanticsCoverage?: SemanticsCoverage; // FASE 2: Modo Diagnóstico Parcial
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

export interface MonthNarrative {
  month: string;
  monthIndex: number;
  energy: EnergyDistribution;
  headline: string;
  story: string;
  keyEvents: string[];
  sentiment: 'excellent' | 'good' | 'neutral' | 'concerning' | 'critical';
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

export interface VariationMetric {
  absolute: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface PeriodComparison {
  basePeriod: {
    label: string;
    start: Date | string;
    end: Date | string;
    energy: EnergyDistribution;
  };
  targetPeriod: {
    label: string;
    start: Date | string;
    end: Date | string;
    energy: EnergyDistribution;
  };
  variations: {
    [key: string]: VariationMetric;
  };
  summary: string;
  highlights: ComparisonHighlight[];
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

// Helpers
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function getEnergyColor(type: EnergyType): string {
  return ENERGY_COLORS[type].primary;
}

export function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'excellent': return '#10B981';
    case 'good': return '#22C55E';
    case 'neutral': return '#F59E0B';
    case 'concerning': return '#F97316';
    case 'critical': return '#EF4444';
    default: return '#6B7280';
  }
}

export function getSentimentLabel(sentiment: string): string {
  switch (sentiment) {
    case 'excellent': return 'Excelente';
    case 'good': return 'Bom';
    case 'neutral': return 'Neutro';
    case 'concerning': return 'Atenção';
    case 'critical': return 'Crítico';
    default: return 'Desconhecido';
  }
}
