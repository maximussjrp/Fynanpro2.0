# 🧠 Arquitetura: Relatórios Financeiros Cognitivos (DVF)

## Visão Geral

**DVF = Demonstração de Vida Financeira**

Este documento descreve a arquitetura completa para a nova aba de Relatórios do UTOP, substituindo o paradigma tradicional de DRE por uma abordagem cognitiva baseada em "energias financeiras".

---

## 1. Modelo Conceitual: 5 Energias Financeiras

### 1.1 Taxonomia de Energias

| Energia | Cor | Ícone | Descrição | Exemplos |
|---------|-----|-------|-----------|----------|
| **Gerada** | 🟢 Verde | ⚡ | Dinheiro que entrou | Salário, Freelance, Vendas, Dividendos |
| **Sobrevivência** | 🔵 Azul | 🏠 | Gastos essenciais fixos | Aluguel, Luz, Água, Plano de Saúde |
| **Escolha** | 🟡 Amarelo | 🎯 | Gastos variáveis opcionais | Lazer, Restaurantes, Streaming, Roupas |
| **Futuro** | 🟣 Roxo | 🚀 | Investimentos e reservas | Poupança, Previdência, Investimentos |
| **Dissipada** | 🔴 Vermelho | 💨 | Perdas e desperdícios | Juros, Multas, Taxas, Cancelamentos |

### 1.2 Regras de Classificação Semântica

```typescript
// Weights: cada categoria pode ter múltiplos pesos (soma = 1.0)
// Exemplo: "Alimentação" pode ser 0.6 sobrevivência + 0.4 escolha

interface CategorySemantics {
  categoryId: string;
  tenantId: string;
  
  // Pesos normalizados (soma = 1.0)
  generatedWeight: number;    // Sempre 0 para despesas
  survivalWeight: number;     // Essencial para viver
  choiceWeight: number;       // Opcional/lifestyle
  futureWeight: number;       // Investimento/reserva
  lossWeight: number;         // Desperdício/perda
  
  // Flags
  isFixed: boolean;           // Custo fixo mensal
  isEssential: boolean;       // Necessidade básica
  isInvestment: boolean;      // Investimento/poupança
  
  // Metadata
  autoClassified: boolean;    // Classificado automaticamente
  userOverride: boolean;      // Usuário alterou manualmente
}
```

### 1.3 Mapeamento Automático por Padrões

```typescript
const SEMANTIC_PATTERNS = {
  // Receitas -> 100% Energia Gerada
  income: {
    patterns: ['salário', 'freelance', 'venda', 'receita', 'dividendo'],
    defaultWeights: { generated: 1.0, survival: 0, choice: 0, future: 0, loss: 0 }
  },
  
  // Sobrevivência (gastos essenciais fixos)
  survival: {
    patterns: ['aluguel', 'condomínio', 'luz', 'água', 'gás', 'internet', 
               'plano de saúde', 'seguro', 'iptu', 'ipva', 'escola', 'faculdade'],
    defaultWeights: { generated: 0, survival: 1.0, choice: 0, future: 0, loss: 0 }
  },
  
  // Híbridos Sobrevivência/Escolha
  survivalChoice: {
    patterns: ['alimentação', 'supermercado', 'farmácia', 'combustível', 
               'transporte', 'celular'],
    defaultWeights: { generated: 0, survival: 0.6, choice: 0.4, future: 0, loss: 0 }
  },
  
  // Escolha (lifestyle)
  choice: {
    patterns: ['lazer', 'restaurante', 'ifood', 'uber', 'streaming', 
               'netflix', 'spotify', 'roupa', 'viagem', 'hotel', 'festa'],
    defaultWeights: { generated: 0, survival: 0, choice: 1.0, future: 0, loss: 0 }
  },
  
  // Futuro (investimentos)
  future: {
    patterns: ['investimento', 'poupança', 'previdência', 'tesouro', 
               'ação', 'fundo', 'criptomoeda', 'reserva'],
    defaultWeights: { generated: 0, survival: 0, choice: 0, future: 1.0, loss: 0 }
  },
  
  // Perdas
  loss: {
    patterns: ['juros', 'multa', 'taxa', 'tarifa bancária', 'iof', 
               'cancelamento', 'perda', 'roubo', 'furto'],
    defaultWeights: { generated: 0, survival: 0, choice: 0, future: 0, loss: 1.0 }
  }
};
```

---

## 2. Camada de Dados

### 2.1 Nova Tabela: CategorySemantics

```prisma
// schema.prisma - Adicionar ao schema existente

model CategorySemantics {
  id              String   @id @default(uuid())
  
  // Relacionamentos
  categoryId      String   
  category        Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  // Pesos de energia (0.0 a 1.0, soma deve = 1.0)
  generatedWeight Decimal  @default(0) @db.Decimal(5, 4)
  survivalWeight  Decimal  @default(0) @db.Decimal(5, 4)
  choiceWeight    Decimal  @default(0) @db.Decimal(5, 4)
  futureWeight    Decimal  @default(0) @db.Decimal(5, 4)
  lossWeight      Decimal  @default(0) @db.Decimal(5, 4)
  
  // Flags de classificação
  isFixed         Boolean  @default(false)
  isEssential     Boolean  @default(false)
  isInvestment    Boolean  @default(false)
  
  // Controle
  autoClassified  Boolean  @default(true)
  userOverride    Boolean  @default(false)
  
  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([categoryId, tenantId])
  @@index([tenantId])
  @@index([categoryId])
}

// Adicionar relation na Category existente
model Category {
  // ... campos existentes ...
  semantics       CategorySemantics?
}
```

### 2.2 Views Agregadas (Queries Otimizadas)

```sql
-- View: Energy Distribution por Período
CREATE VIEW vw_energy_distribution AS
SELECT 
  t.tenant_id,
  DATE_TRUNC('month', t.transaction_date) as period,
  
  -- Energia Gerada (Receitas)
  SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as generated,
  
  -- Distribuição de Despesas por Energia
  SUM(CASE WHEN t.type = 'expense' THEN t.amount * cs.survival_weight ELSE 0 END) as survival,
  SUM(CASE WHEN t.type = 'expense' THEN t.amount * cs.choice_weight ELSE 0 END) as choice,
  SUM(CASE WHEN t.type = 'expense' THEN t.amount * cs.future_weight ELSE 0 END) as future,
  SUM(CASE WHEN t.type = 'expense' THEN t.amount * cs.loss_weight ELSE 0 END) as loss
  
FROM transactions t
LEFT JOIN category_semantics cs ON t.category_id = cs.category_id
WHERE t.status = 'completed' AND t.deleted_at IS NULL
GROUP BY t.tenant_id, DATE_TRUNC('month', t.transaction_date);
```

---

## 3. Camada de Serviço: Energy Engine

### 3.1 Estrutura do Serviço

```
backend/src/services/
└── reportsEngine/
    ├── index.ts              # Exportações
    ├── energyCalculator.ts   # Cálculos de distribuição
    ├── narrativeGenerator.ts # Geração de textos
    ├── insightsEngine.ts     # Motor de insights
    ├── comparisonEngine.ts   # Comparações temporais
    └── healthIndex.ts        # Índice de saúde financeira
```

### 3.2 Energy Calculator

```typescript
// backend/src/services/reportsEngine/energyCalculator.ts

interface EnergyDistribution {
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
  
  // Fluxo líquido
  consumed: number;            // survival + choice + loss
  available: number;           // generated - consumed
  actualSavings: number;       // available + future (se positivo)
}

interface PeriodEnergy extends EnergyDistribution {
  period: string;              // "2025-01" ou "2025"
  periodLabel: string;         // "Janeiro 2025" ou "2025"
  transactionCount: number;
  categoryBreakdown: CategoryEnergy[];
}

interface CategoryEnergy {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  amount: number;
  energyType: 'generated' | 'survival' | 'choice' | 'future' | 'loss';
  percentage: number;          // % do total daquela energia
  weights: {
    generated: number;
    survival: number;
    choice: number;
    future: number;
    loss: number;
  };
}
```

### 3.3 Narrative Generator

```typescript
// backend/src/services/reportsEngine/narrativeGenerator.ts

interface AnnualNarrative {
  year: number;
  headline: string;           // "2024: O Ano da Estabilização"
  summary: string;            // Resumo em 2-3 frases
  highlights: NarrativePoint[];
  warnings: NarrativePoint[];
  opportunities: NarrativePoint[];
  
  monthlyStory: MonthNarrative[];
  overallSentiment: 'excellent' | 'good' | 'neutral' | 'concerning' | 'critical';
}

interface NarrativePoint {
  type: 'positive' | 'negative' | 'neutral' | 'opportunity';
  icon: string;
  title: string;
  description: string;
  metric?: {
    value: number;
    unit: string;
    trend?: 'up' | 'down' | 'stable';
  };
  relatedCategories?: string[];
}

interface MonthNarrative {
  month: string;              // "Janeiro"
  monthIndex: number;         // 0-11
  energy: EnergyDistribution;
  headline: string;           // "Mês de Contenção"
  story: string;              // Narrativa do mês
  keyEvents: string[];        // Eventos marcantes
  sentiment: 'excellent' | 'good' | 'neutral' | 'concerning' | 'critical';
}

// Templates de Narrativa
const NARRATIVE_TEMPLATES = {
  annualHeadlines: {
    excellent: [
      "{year}: O Ano da Prosperidade",
      "{year}: Construindo Riqueza",
      "{year}: Resultados Extraordinários"
    ],
    good: [
      "{year}: Progresso Consistente",
      "{year}: Bases Sólidas",
      "{year}: Caminho Certo"
    ],
    neutral: [
      "{year}: Ano de Transição",
      "{year}: Mantendo o Equilíbrio",
      "{year}: Estabilidade"
    ],
    concerning: [
      "{year}: Sinais de Atenção",
      "{year}: Momento de Ajustes",
      "{year}: Reavaliação Necessária"
    ],
    critical: [
      "{year}: Ponto de Inflexão",
      "{year}: Hora de Reagir",
      "{year}: Reestruturação Urgente"
    ]
  },
  
  monthlyPatterns: {
    highSavings: "Excelente mês! Você conseguiu direcionar {percentage}% da sua energia gerada para o futuro.",
    highSurvival: "Mês de foco nas necessidades básicas. {percentage}% foi para sobrevivência.",
    highChoice: "Mês de aproveitamento! {percentage}% foi investido em qualidade de vida.",
    highLoss: "Atenção: {percentage}% da energia foi dissipada em perdas evitáveis.",
    deficit: "Mês deficitário. Consumo superou a geração em {amount}.",
    surplus: "Mês positivo! Sobrou {amount} após todas as despesas."
  }
};
```

### 3.4 Insights Engine

```typescript
// backend/src/services/reportsEngine/insightsEngine.ts

interface Insight {
  id: string;
  type: 'achievement' | 'warning' | 'opportunity' | 'trend' | 'comparison';
  priority: 'high' | 'medium' | 'low';
  
  // Conteúdo
  title: string;
  description: string;
  detailedExplanation?: string;
  
  // Visualização
  icon: string;
  color: string;
  
  // Dados
  metric?: {
    current: number;
    previous?: number;
    target?: number;
    unit: string;
  };
  
  // Ações sugeridas
  actions?: InsightAction[];
  
  // Contexto
  relatedCategories?: string[];
  relatedPeriod?: string;
  confidence: number;         // 0-100%
}

interface InsightAction {
  label: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
}

// Regras de Geração de Insights
const INSIGHT_RULES = [
  {
    id: 'survival_over_50',
    condition: (e: EnergyDistribution) => e.survivalRatio > 0.5,
    generate: (e: EnergyDistribution) => ({
      type: 'warning',
      priority: 'high',
      title: 'Sobrevivência Consumindo Muito',
      description: `${(e.survivalRatio * 100).toFixed(0)}% da sua renda vai para necessidades básicas. O ideal é abaixo de 50%.`,
      actions: [
        { label: 'Renegociar contratos', impact: 'high', difficulty: 'medium' },
        { label: 'Buscar alternativas mais baratas', impact: 'medium', difficulty: 'easy' }
      ]
    })
  },
  {
    id: 'no_future_investment',
    condition: (e: EnergyDistribution) => e.futureRatio === 0 && e.generated > 0,
    generate: (e: EnergyDistribution) => ({
      type: 'warning',
      priority: 'high',
      title: 'Nenhum Investimento no Futuro',
      description: 'Você não está direcionando energia para o futuro. Mesmo R$ 50/mês faz diferença.',
      actions: [
        { label: 'Configurar investimento automático', impact: 'high', difficulty: 'easy' }
      ]
    })
  },
  {
    id: 'high_waste',
    condition: (e: EnergyDistribution) => e.wasteRatio > 0.05,
    generate: (e: EnergyDistribution) => ({
      type: 'opportunity',
      priority: 'medium',
      title: 'Energia Sendo Desperdiçada',
      description: `${(e.wasteRatio * 100).toFixed(1)}% está indo para juros, multas e taxas. Isso pode virar investimento!`,
      actions: [
        { label: 'Eliminar juros de cartão', impact: 'high', difficulty: 'medium' },
        { label: 'Automatizar pagamentos', impact: 'medium', difficulty: 'easy' }
      ]
    })
  },
  {
    id: 'excellent_freedom',
    condition: (e: EnergyDistribution) => e.freedomRatio > 0.5,
    generate: (e: EnergyDistribution) => ({
      type: 'achievement',
      priority: 'medium',
      title: 'Excelente Liberdade Financeira',
      description: `${(e.freedomRatio * 100).toFixed(0)}% da sua renda está livre após necessidades básicas. Ótimo trabalho!`
    })
  }
];
```

### 3.5 Comparison Engine

```typescript
// backend/src/services/reportsEngine/comparisonEngine.ts

interface PeriodComparison {
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
  
  // Variações
  variations: {
    generated: VariationMetric;
    survival: VariationMetric;
    choice: VariationMetric;
    future: VariationMetric;
    loss: VariationMetric;
    netEnergy: VariationMetric;
    freedomRatio: VariationMetric;
  };
  
  // Análise
  summary: string;
  highlights: ComparisonHighlight[];
  categoryChanges: CategoryChange[];
}

interface VariationMetric {
  absolute: number;          // Diferença em R$
  percentage: number;        // Variação %
  trend: 'up' | 'down' | 'stable';
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface ComparisonHighlight {
  type: 'improvement' | 'deterioration' | 'notable';
  title: string;
  description: string;
  metric: {
    base: number;
    target: number;
    variation: number;
  };
}

interface CategoryChange {
  categoryId: string;
  categoryName: string;
  baseAmount: number;
  targetAmount: number;
  variation: number;
  percentageChange: number;
  isSignificant: boolean;
}
```

### 3.6 Health Index

```typescript
// backend/src/services/reportsEngine/healthIndex.ts

interface FinancialHealthIndex {
  score: number;              // 0-100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  label: string;              // "Excelente", "Bom", etc.
  color: string;              // Cor para UI
  
  // Componentes do score
  components: {
    survivalEfficiency: HealthComponent;     // Quanto % vai para sobrevivência
    savingsRate: HealthComponent;            // Taxa de poupança
    wasteControl: HealthComponent;           // Controle de desperdícios
    incomeStability: HealthComponent;        // Estabilidade de renda
    budgetAdherence: HealthComponent;        // Aderência ao orçamento
  };
  
  // Evolução
  trend: {
    direction: 'improving' | 'stable' | 'declining';
    lastMonthScore: number;
    threeMonthAvg: number;
    sixMonthAvg: number;
  };
  
  // Recomendações priorizadas
  recommendations: HealthRecommendation[];
}

interface HealthComponent {
  name: string;
  score: number;              // 0-100
  weight: number;             // Peso no cálculo final
  status: 'excellent' | 'good' | 'fair' | 'poor';
  description: string;
  targetValue?: number;
  currentValue?: number;
}

interface HealthRecommendation {
  priority: number;           // 1 = mais importante
  title: string;
  description: string;
  impact: string;             // "Pode melhorar seu score em até X pontos"
  difficulty: 'easy' | 'medium' | 'hard';
  category?: string;          // Categoria relacionada
}

// Cálculo do Health Index
const calculateHealthIndex = (energy: EnergyDistribution): FinancialHealthIndex => {
  // 1. Survival Efficiency (25% do score)
  // Ideal: < 50% da renda para sobrevivência
  const survivalScore = Math.max(0, 100 - (energy.survivalRatio * 100 - 30));
  
  // 2. Savings Rate (25% do score)
  // Ideal: > 20% da renda para futuro
  const savingsScore = Math.min(100, energy.futureRatio * 500); // 20% = 100 pontos
  
  // 3. Waste Control (20% do score)
  // Ideal: < 2% em perdas
  const wasteScore = Math.max(0, 100 - (energy.wasteRatio * 2000));
  
  // 4. Freedom Ratio (20% do score)
  // Quanto sobra após sobrevivência
  const freedomScore = Math.min(100, energy.freedomRatio * 200);
  
  // 5. Balance (10% do score)
  // Se está tendo superávit
  const balanceScore = energy.netEnergy >= 0 ? 100 : Math.max(0, 100 + (energy.netEnergy / energy.generated * 100));
  
  const totalScore = (
    survivalScore * 0.25 +
    savingsScore * 0.25 +
    wasteScore * 0.20 +
    freedomScore * 0.20 +
    balanceScore * 0.10
  );
  
  return {
    score: Math.round(totalScore),
    grade: getGrade(totalScore),
    label: getLabel(totalScore),
    color: getColor(totalScore),
    // ... resto da estrutura
  };
};
```

---

## 4. Camada de API

### 4.1 Novos Endpoints

```typescript
// backend/src/routes/reports.ts - Adicionar rotas

// ==================== ENERGIA FINANCEIRA ====================

// GET /api/v1/reports/energy-flow
// Distribuição de energia por período
router.get('/energy-flow', authenticateToken, async (req, res) => {
  // Query params: startDate, endDate, groupBy (day|week|month|quarter|year)
  // Retorna: EnergyDistribution[] com breakdown por período
});

// GET /api/v1/reports/annual-narrative/:year
// Narrativa completa do ano
router.get('/annual-narrative/:year', authenticateToken, async (req, res) => {
  // Retorna: AnnualNarrative com história do ano
});

// GET /api/v1/reports/comparison
// Comparação entre períodos
router.get('/comparison', authenticateToken, async (req, res) => {
  // Query params: basePeriodStart, basePeriodEnd, targetPeriodStart, targetPeriodEnd
  // Retorna: PeriodComparison
});

// GET /api/v1/reports/insights
// Insights e recomendações
router.get('/insights', authenticateToken, async (req, res) => {
  // Query params: startDate, endDate, limit
  // Retorna: Insight[]
});

// GET /api/v1/reports/health-index
// Índice de saúde financeira
router.get('/health-index', authenticateToken, async (req, res) => {
  // Query params: period (current|3m|6m|12m)
  // Retorna: FinancialHealthIndex
});

// ==================== SEMÂNTICA ====================

// GET /api/v1/reports/category-semantics
// Mapeamento semântico das categorias
router.get('/category-semantics', authenticateToken, async (req, res) => {
  // Retorna: CategorySemantics[] com pesos de cada categoria
});

// PUT /api/v1/reports/category-semantics/:categoryId
// Atualiza pesos semânticos de uma categoria
router.put('/category-semantics/:categoryId', authenticateToken, async (req, res) => {
  // Body: { survivalWeight, choiceWeight, futureWeight, lossWeight }
});

// POST /api/v1/reports/category-semantics/auto-classify
// Reclassifica automaticamente todas as categorias
router.post('/category-semantics/auto-classify', authenticateToken, async (req, res) => {
  // Aplica regras de pattern matching
});
```

---

## 5. Camada de UI

### 5.1 Estrutura de Componentes

```
frontend/src/components/reports/
├── index.ts
├── EnergyFlow/
│   ├── EnergyTimeline.tsx        # Gráfico de fluxo temporal
│   ├── EnergyDonut.tsx           # Distribuição em donut
│   ├── EnergyBars.tsx            # Barras comparativas
│   └── EnergyLegend.tsx          # Legenda com cores/ícones
│
├── HealthIndex/
│   ├── HealthGauge.tsx           # Gauge circular do score
│   ├── HealthComponents.tsx      # Breakdown dos componentes
│   ├── HealthTrend.tsx           # Evolução do score
│   └── HealthRecommendations.tsx # Lista de recomendações
│
├── Narrative/
│   ├── AnnualStory.tsx           # História do ano completo
│   ├── MonthCard.tsx             # Card de cada mês
│   ├── HeadlineDisplay.tsx       # Manchete principal
│   └── SentimentBadge.tsx        # Badge de sentimento
│
├── Insights/
│   ├── InsightsPanel.tsx         # Painel de insights
│   ├── InsightCard.tsx           # Card individual
│   ├── InsightActions.tsx        # Ações sugeridas
│   └── InsightFilter.tsx         # Filtros de tipo/prioridade
│
├── Comparison/
│   ├── PeriodComparator.tsx      # Comparador de períodos
│   ├── VariationBadge.tsx        # Badge de variação
│   ├── ComparisonChart.tsx       # Gráfico comparativo
│   └── CategoryChanges.tsx       # Mudanças por categoria
│
└── SemanticMapper/
    ├── CategorySemanticEditor.tsx # Editor de pesos
    ├── EnergySliders.tsx          # Sliders de distribuição
    └── AutoClassifyButton.tsx     # Botão de auto-classificar
```

### 5.2 Cores e Design System

```typescript
// frontend/src/lib/energyColors.ts

export const ENERGY_COLORS = {
  generated: {
    primary: '#10B981',      // Emerald 500
    light: '#D1FAE5',        // Emerald 100
    dark: '#059669',         // Emerald 600
    gradient: 'from-emerald-400 to-emerald-600'
  },
  survival: {
    primary: '#3B82F6',      // Blue 500
    light: '#DBEAFE',        // Blue 100
    dark: '#2563EB',         // Blue 600
    gradient: 'from-blue-400 to-blue-600'
  },
  choice: {
    primary: '#F59E0B',      // Amber 500
    light: '#FEF3C7',        // Amber 100
    dark: '#D97706',         // Amber 600
    gradient: 'from-amber-400 to-amber-600'
  },
  future: {
    primary: '#8B5CF6',      // Violet 500
    light: '#EDE9FE',        // Violet 100
    dark: '#7C3AED',         // Violet 600
    gradient: 'from-violet-400 to-violet-600'
  },
  loss: {
    primary: '#EF4444',      // Red 500
    light: '#FEE2E2',        // Red 100
    dark: '#DC2626',         // Red 600
    gradient: 'from-red-400 to-red-600'
  }
};

export const ENERGY_ICONS = {
  generated: '⚡',
  survival: '🏠',
  choice: '🎯',
  future: '🚀',
  loss: '💨'
};

export const ENERGY_LABELS = {
  generated: 'Energia Gerada',
  survival: 'Sobrevivência',
  choice: 'Escolha',
  future: 'Futuro',
  loss: 'Dissipada'
};
```

### 5.3 Página Principal de Relatórios

```tsx
// frontend/src/app/dashboard/reports/page.tsx - Nova estrutura

export default function ReportsPage() {
  const [activeView, setActiveView] = useState<
    'overview' | 'narrative' | 'comparison' | 'insights' | 'health' | 'semantic'
  >('overview');
  
  return (
    <div className="space-y-6">
      {/* Header com Seletor de Período */}
      <ReportsHeader 
        period={period}
        onPeriodChange={setPeriod}
      />
      
      {/* Navegação por Abas */}
      <ReportsTabs 
        active={activeView}
        onChange={setActiveView}
        tabs={[
          { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
          { id: 'narrative', label: 'História', icon: BookOpen },
          { id: 'comparison', label: 'Comparar', icon: GitCompare },
          { id: 'insights', label: 'Insights', icon: Lightbulb },
          { id: 'health', label: 'Saúde', icon: Heart },
          { id: 'semantic', label: 'Configurar', icon: Settings }
        ]}
      />
      
      {/* Conteúdo */}
      <div className="grid gap-6">
        {activeView === 'overview' && <OverviewView period={period} />}
        {activeView === 'narrative' && <NarrativeView year={period.year} />}
        {activeView === 'comparison' && <ComparisonView />}
        {activeView === 'insights' && <InsightsView period={period} />}
        {activeView === 'health' && <HealthView period={period} />}
        {activeView === 'semantic' && <SemanticView />}
      </div>
    </div>
  );
}
```

### 5.4 Componentes Principais

#### Overview View
```tsx
// Visão geral com todas as energias
const OverviewView = ({ period }) => (
  <div className="grid gap-6">
    {/* Resumo de Energias */}
    <div className="grid grid-cols-5 gap-4">
      <EnergyCard type="generated" value={data.generated} />
      <EnergyCard type="survival" value={data.survival} />
      <EnergyCard type="choice" value={data.choice} />
      <EnergyCard type="future" value={data.future} />
      <EnergyCard type="loss" value={data.loss} />
    </div>
    
    {/* Timeline de Energia */}
    <Card>
      <CardHeader>
        <CardTitle>Fluxo de Energia</CardTitle>
      </CardHeader>
      <CardContent>
        <EnergyTimeline data={data.timeline} />
      </CardContent>
    </Card>
    
    {/* Distribuição + Health Index */}
    <div className="grid grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Distribuição de Energia</CardTitle>
        </CardHeader>
        <CardContent>
          <EnergyDonut data={data.distribution} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Saúde Financeira</CardTitle>
        </CardHeader>
        <CardContent>
          <HealthGauge score={data.healthScore} />
        </CardContent>
      </Card>
    </div>
    
    {/* Top Insights */}
    <Card>
      <CardHeader>
        <CardTitle>Destaques</CardTitle>
      </CardHeader>
      <CardContent>
        <InsightsPanel insights={data.topInsights} limit={3} />
      </CardContent>
    </Card>
  </div>
);
```

#### Narrative View
```tsx
// História narrativa do ano
const NarrativeView = ({ year }) => (
  <div className="space-y-6">
    {/* Manchete do Ano */}
    <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
      <CardContent className="py-8">
        <HeadlineDisplay 
          headline={narrative.headline}
          summary={narrative.summary}
          sentiment={narrative.sentiment}
        />
      </CardContent>
    </Card>
    
    {/* Highlights e Warnings */}
    <div className="grid grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="text-green-500" />
            Conquistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NarrativeList points={narrative.highlights} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" />
            Pontos de Atenção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NarrativeList points={narrative.warnings} />
        </CardContent>
      </Card>
    </div>
    
    {/* Timeline Mensal */}
    <Card>
      <CardHeader>
        <CardTitle>Sua Jornada Mês a Mês</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          {narrative.monthlyStory.map(month => (
            <MonthCard key={month.monthIndex} data={month} />
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);
```

---

## 6. Plano de Implementação

### Fase 1: Fundação (2-3 dias)
1. ✅ Documentar arquitetura (este documento)
2. Criar migration para CategorySemantics
3. Criar seed inicial com pattern matching
4. Implementar energyCalculator.ts

### Fase 2: Backend Core (2-3 dias)
1. Implementar todos os endpoints de /energy-flow
2. Implementar healthIndex.ts
3. Implementar insightsEngine.ts
4. Testes de integração

### Fase 3: Narrativas (1-2 dias)
1. Implementar narrativeGenerator.ts
2. Implementar comparisonEngine.ts
3. Endpoint de annual-narrative

### Fase 4: Frontend (3-4 dias)
1. Componentes base (EnergyCard, colors)
2. OverviewView com gráficos
3. NarrativeView
4. ComparisonView
5. HealthView
6. SemanticView (configuração)

### Fase 5: Polish (1-2 dias)
1. Animações e transições
2. Responsividade
3. Testes E2E
4. Deploy

---

## 7. Métricas de Sucesso

- [ ] Health Index calculado corretamente
- [ ] Narrativas geradas automaticamente
- [ ] Comparações precisas entre períodos
- [ ] Insights relevantes e acionáveis
- [ ] UI responsiva e intuitiva
- [ ] Performance < 500ms por request

---

## Próximos Passos Imediatos

1. **Aprovar arquitetura** - Revisar este documento
2. **Criar migration** - Adicionar CategorySemantics ao schema
3. **Implementar seed** - Popular dados semânticos iniciais
4. **Começar backend** - energyCalculator.ts primeiro

---

*Documento gerado em: Janeiro 2025*
*Versão: 1.0*
