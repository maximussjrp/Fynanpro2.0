/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CONTRATO OFICIAL DE ENERGIA FINANCEIRA - UTOP
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Este arquivo define o CONTRATO IMUTÁVEL das energias financeiras.
 * 
 * ⚠️ REGRAS DE OURO:
 * 1. Este contrato é a FONTE DA VERDADE para todo o sistema
 * 2. Qualquer mudança aqui deve ser aprovada e documentada
 * 3. Nenhuma lógica no sistema pode contrariar este contrato
 * 4. UI, relatórios e scores DEVEM respeitar estas definições
 * 
 * 📅 Criado: 27/Dez/2025
 * 📝 Versão: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DE ENERGIA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tipos de energia para GASTOS (despesas).
 * Receitas NÃO são energia - são "Energia Gerada".
 */
export enum EnergyType {
  /**
   * SOBREVIVÊNCIA
   * Gastos obrigatórios para manter a vida funcionando.
   * Sem eles, a vida básica seria impossível ou severamente comprometida.
   * 
   * Exemplos: Aluguel, Luz, Água, Plano de Saúde, Alimentação básica
   * 
   * Características:
   * - Geralmente fixos ou com pouca variação
   * - Não podem ser cortados sem impacto severo
   * - Relacionados a necessidades básicas (moradia, saúde, alimentação)
   */
  SURVIVAL = 'survival',

  /**
   * ESCOLHA
   * Gastos opcionais que melhoram conforto, prazer ou qualidade de vida.
   * A vida continua sem eles, mas com menos satisfação.
   * 
   * Exemplos: Netflix, Restaurantes, Viagens, Roupas de marca, Academia
   * 
   * Características:
   * - Podem ser reduzidos ou cortados sem impacto na sobrevivência
   * - Relacionados a estilo de vida e preferências pessoais
   * - Variam conforme momento financeiro
   */
  CHOICE = 'choice',

  /**
   * FUTURO
   * Gastos que AUMENTAM liberdade financeira futura.
   * Dinheiro que sai hoje para voltar multiplicado amanhã.
   * 
   * Exemplos: Investimentos, Poupança, Previdência, Cursos profissionalizantes
   * 
   * Características:
   * - Criam patrimônio ou capacidade de geração de renda
   * - Diminuem dependência de trabalho ativo
   * - Representam "sementes plantadas"
   */
  FUTURE = 'future',

  /**
   * ENERGIA PERDIDA (LOSS)
   * Dinheiro que saiu sem retorno algum.
   * Puro desperdício financeiro.
   * 
   * Exemplos: Juros de cartão, Multas, Taxas bancárias evitáveis,
   *           Cheque especial, Anuidade de cartão não utilizado
   * 
   * Características:
   * - Não gera valor nenhum
   * - Poderia ter sido evitado
   * - Representa ineficiência financeira
   */
  LOSS = 'loss'
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISTRIBUIÇÃO DE ENERGIA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Distribuição de energia para uma categoria ou transação.
 * A soma de todos os pesos DEVE ser exatamente 1.0 (100%).
 */
export interface EnergyDistribution {
  /** Peso de Sobrevivência (0.0 a 1.0) */
  survival: number;
  
  /** Peso de Escolha (0.0 a 1.0) */
  choice: number;
  
  /** Peso de Futuro (0.0 a 1.0) */
  future: number;
  
  /** Peso de Energia Perdida (0.0 a 1.0) */
  loss: number;
}

/**
 * Validação de distribuição de energia.
 * Verifica se a soma dos pesos é exatamente 1.0.
 */
export function validateEnergyDistribution(dist: EnergyDistribution): boolean {
  const sum = dist.survival + dist.choice + dist.future + dist.loss;
  // Tolerância de 0.001 para erros de ponto flutuante
  return Math.abs(sum - 1.0) < 0.001;
}

/**
 * Resultado de validação completa de energia.
 */
export interface EnergyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validação completa de distribuição de energia com flags.
 * Aplica todas as regras do contrato.
 * 
 * REGRAS:
 * 1. Soma dos pesos deve ser 1.0
 * 2. LOSS e FUTURE são mutuamente exclusivos
 * 3. isInvestment = true → future > 0
 * 4. isEssential = true → survival > 0
 * 5. isFixed = true → survival > 0 (warning)
 */
export function validateEnergyWithFlags(
  dist: EnergyDistribution,
  flags: { isInvestment?: boolean; isEssential?: boolean; isFixed?: boolean }
): EnergyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // REGRA 1: Soma deve ser 1.0
  const sum = dist.survival + dist.choice + dist.future + dist.loss;
  if (Math.abs(sum - 1.0) >= 0.001) {
    errors.push(`A soma dos pesos deve ser 100%. Atual: ${Math.round(sum * 100)}%`);
  }

  // REGRA 2: LOSS e FUTURE são mutuamente exclusivos
  if (dist.future > 0 && dist.loss > 0) {
    errors.push('LOSS e FUTURE não podem coexistir. Um gasto não pode ser investimento e perda ao mesmo tempo.');
  }

  // REGRA 3: isInvestment → future > 0
  if (flags.isInvestment && dist.future === 0) {
    errors.push('Itens marcados como investimento devem possuir energia FUTURE > 0.');
  }

  // REGRA 4: isEssential → survival > 0
  if (flags.isEssential && dist.survival === 0) {
    errors.push('Itens essenciais devem possuir energia SURVIVAL > 0.');
  }

  // REGRA 5: isFixed → survival > 0 (warning, não erro)
  if (flags.isFixed && dist.survival === 0) {
    warnings.push('Gastos fixos normalmente possuem energia SURVIVAL. Verifique se a classificação está correta.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Normaliza distribuição de energia para que a soma seja exatamente 1.0.
 */
export function normalizeEnergyDistribution(dist: EnergyDistribution): EnergyDistribution {
  const sum = dist.survival + dist.choice + dist.future + dist.loss;
  if (sum === 0) {
    // Se tudo é zero, não pode normalizar - retorna erro
    throw new Error('Distribuição de energia não pode ter todos os pesos zerados');
  }
  return {
    survival: dist.survival / sum,
    choice: dist.choice / sum,
    future: dist.future / sum,
    loss: dist.loss / sum
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Status de validação da classificação energética.
 */
export enum ValidationStatus {
  /**
   * VALIDADO
   * A classificação foi explicitamente confirmada por um humano.
   * Maior confiança possível.
   */
  VALIDATED = 'validated',

  /**
   * INFERIDO
   * A classificação foi determinada por pattern matching automático.
   * Confiança média - deve ser validada pelo usuário.
   */
  INFERRED = 'inferred',

  /**
   * NÃO VALIDADO
   * O sistema não tem certeza da classificação.
   * Requer atenção do usuário.
   */
  NOT_VALIDATED = 'not_validated',

  /**
   * DEFAULT
   * Classificação padrão aplicada quando nenhum pattern foi encontrado.
   * Menor confiança - deve ser corrigida.
   */
  DEFAULT = 'default'
}

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE DA ENERGIA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * De onde vem a classificação energética de uma transação.
 */
export enum EnergySource {
  /**
   * CATEGORIA
   * A energia vem da categoria associada à transação.
   * Comportamento padrão.
   */
  CATEGORY = 'category',

  /**
   * OVERRIDE DO USUÁRIO
   * O usuário definiu manualmente a energia DESTA transação específica.
   * Não afeta a categoria.
   */
  USER_OVERRIDE = 'user_override'
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEMÂNTICA DE CATEGORIA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Metadados semânticos de uma categoria.
 * Armazena informações além da distribuição de energia.
 */
export interface CategorySemantics {
  /** Distribuição de energia (survival, choice, future, loss) */
  distribution: EnergyDistribution;

  /** Status de validação da classificação */
  validationStatus: ValidationStatus;

  /** Data da última validação (se houver) */
  validatedAt?: Date;

  /** ID do usuário que validou (se houver) */
  validatedBy?: string;

  /** Categoria é fixa/essencial? (não pode ser cortada) */
  isFixed: boolean;

  /** Categoria é essencial para sobrevivência? */
  isEssential: boolean;

  /** Categoria é investimento? */
  isInvestment: boolean;

  /** Justificativa para a classificação (se híbrida) */
  justification?: string;

  /** Histórico de alterações */
  history?: Array<{
    changedAt: Date;
    changedBy: string;
    previousDistribution: EnergyDistribution;
    newDistribution: EnergyDistribution;
    reason?: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERRIDE DE TRANSAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Override de energia para uma transação específica.
 * Permite que o usuário corrija a classificação sem alterar a categoria.
 */
export interface TransactionEnergyOverride {
  /** Distribuição de energia customizada */
  distribution: EnergyDistribution;

  /** Quando foi criado o override */
  createdAt: Date;

  /** Justificativa do usuário */
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGRAS DO CONTRATO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * REGRAS IMUTÁVEIS DO CONTRATO DE ENERGIA
 * 
 * 1. RECEITA NÃO É ENERGIA DE GASTO
 *    Receitas são "Energia Gerada" - a fonte que alimenta todo o sistema.
 *    Não se classificam como survival/choice/future/loss.
 * 
 * 2. TODO GASTO DEVE TER CLASSIFICAÇÃO
 *    Não existe gasto "sem energia". Se não souber, marcar como NOT_VALIDATED.
 * 
 * 3. HÍBRIDOS SÃO PERMITIDOS COM JUSTIFICATIVA
 *    Exemplo: Alimentação pode ser 60% survival + 40% choice.
 *    A justificativa deve explicar o raciocínio.
 * 
 * 4. DEFAULT 50/50 É PROIBIDO SEM JUSTIFICATIVA
 *    Se o sistema não sabe, deve marcar como NOT_VALIDATED.
 *    Nunca assumir 50/50 silenciosamente.
 * 
 * 5. USUÁRIO SEMPRE PODE CORRIGIR
 *    A classificação não é imposição - é sugestão.
 *    O sistema aprende com as correções.
 * 
 * 6. CATEGORIA NÃO É ALTERADA POR TRANSAÇÃO
 *    Override de transação afeta apenas aquela transação.
 *    Para mudar a categoria, usar a tela de classificação.
 * 
 * 7. SCORE NÃO PODE MENTIR
 *    - futureRatio = 0 → nota máxima B
 *    - futureRatio = 0 + déficit → nota máxima C
 *    - Score deve ser explicável
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Distribuição padrão para categorias não classificadas.
 * NÃO é 50/50 - é marcada como NOT_VALIDATED.
 */
export const UNCLASSIFIED_DISTRIBUTION: EnergyDistribution = {
  survival: 0,
  choice: 0,
  future: 0,
  loss: 0
};

/**
 * Labels em português para os tipos de energia.
 */
export const ENERGY_LABELS: Record<EnergyType, string> = {
  [EnergyType.SURVIVAL]: 'Sobrevivência',
  [EnergyType.CHOICE]: 'Escolha',
  [EnergyType.FUTURE]: 'Futuro',
  [EnergyType.LOSS]: 'Energia Perdida'
};

/**
 * Descrições curtas para os tipos de energia.
 */
export const ENERGY_DESCRIPTIONS: Record<EnergyType, string> = {
  [EnergyType.SURVIVAL]: 'Gastos essenciais para manter a vida',
  [EnergyType.CHOICE]: 'Gastos opcionais de conforto e prazer',
  [EnergyType.FUTURE]: 'Investimentos na liberdade futura',
  [EnergyType.LOSS]: 'Dinheiro perdido sem retorno'
};

/**
 * Cores associadas a cada tipo de energia.
 */
export const ENERGY_COLORS: Record<EnergyType, string> = {
  [EnergyType.SURVIVAL]: '#3B82F6', // Azul
  [EnergyType.CHOICE]: '#8B5CF6',   // Roxo
  [EnergyType.FUTURE]: '#10B981',   // Verde
  [EnergyType.LOSS]: '#EF4444'      // Vermelho
};

/**
 * Ícones associados a cada tipo de energia.
 */
export const ENERGY_ICONS: Record<EnergyType, string> = {
  [EnergyType.SURVIVAL]: '🏠',
  [EnergyType.CHOICE]: '🎯',
  [EnergyType.FUTURE]: '🚀',
  [EnergyType.LOSS]: '💸'
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determina o tipo de energia predominante em uma distribuição.
 */
export function getPredominantEnergy(dist: EnergyDistribution): EnergyType {
  const entries: [EnergyType, number][] = [
    [EnergyType.SURVIVAL, dist.survival],
    [EnergyType.CHOICE, dist.choice],
    [EnergyType.FUTURE, dist.future],
    [EnergyType.LOSS, dist.loss]
  ];
  
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/**
 * Verifica se uma distribuição é híbrida (mais de um tipo com peso > 0).
 */
export function isHybridDistribution(dist: EnergyDistribution): boolean {
  const nonZeroCount = [dist.survival, dist.choice, dist.future, dist.loss]
    .filter(v => v > 0)
    .length;
  return nonZeroCount > 1;
}

/**
 * Formata uma distribuição para exibição.
 * Ex: "60% Sobrevivência / 40% Escolha"
 */
export function formatDistribution(dist: EnergyDistribution): string {
  const parts: string[] = [];
  
  if (dist.survival > 0) {
    parts.push(`${Math.round(dist.survival * 100)}% ${ENERGY_LABELS[EnergyType.SURVIVAL]}`);
  }
  if (dist.choice > 0) {
    parts.push(`${Math.round(dist.choice * 100)}% ${ENERGY_LABELS[EnergyType.CHOICE]}`);
  }
  if (dist.future > 0) {
    parts.push(`${Math.round(dist.future * 100)}% ${ENERGY_LABELS[EnergyType.FUTURE]}`);
  }
  if (dist.loss > 0) {
    parts.push(`${Math.round(dist.loss * 100)}% ${ENERGY_LABELS[EnergyType.LOSS]}`);
  }
  
  return parts.length > 0 ? parts.join(' / ') : 'Não classificado';
}

/**
 * Cria uma distribuição pura (100% de um tipo).
 */
export function createPureDistribution(type: EnergyType): EnergyDistribution {
  return {
    survival: type === EnergyType.SURVIVAL ? 1 : 0,
    choice: type === EnergyType.CHOICE ? 1 : 0,
    future: type === EnergyType.FUTURE ? 1 : 0,
    loss: type === EnergyType.LOSS ? 1 : 0
  };
}

/**
 * Cria uma distribuição híbrida.
 * @param primary Tipo primário
 * @param primaryWeight Peso do tipo primário (0.5 a 1.0)
 * @param secondary Tipo secundário
 */
export function createHybridDistribution(
  primary: EnergyType,
  primaryWeight: number,
  secondary: EnergyType
): EnergyDistribution {
  if (primaryWeight < 0.5 || primaryWeight > 1) {
    throw new Error('Peso primário deve estar entre 0.5 e 1.0');
  }
  
  const secondaryWeight = 1 - primaryWeight;
  const dist: EnergyDistribution = { survival: 0, choice: 0, future: 0, loss: 0 };
  
  dist[primary] = primaryWeight;
  dist[secondary] = secondaryWeight;
  
  return dist;
}
