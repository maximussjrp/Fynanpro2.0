/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CLASSIFICAÇÃO AUTOMÁTICA DE ENERGIA - UTOP
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Este arquivo define a lógica de classificação AUTOMÁTICA de energia.
 * A classificação é determinada pelo SISTEMA, não pelo usuário.
 *
 * ⚠️ REGRAS:
 * 1. O sistema classifica com base no nome/tipo da categoria
 * 2. O usuário NÃO pode editar a classificação diretamente
 * 3. A classificação pode ser revista pelo administrador do sistema
 * 4. Dados existentes NÃO são alterados - apenas novas classificações
 *
 * 📅 Criado: 07/Jan/2026
 * 📝 Versão: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { EnergyDistribution, ValidationStatus } from './energy.contract';

// ══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ══════════════════════════════════════════════════════════════════════════════

export interface CategoryEnergyTemplate {
  /** Padrões de nome para match (case-insensitive) */
  patterns: string[];
  
  /** Distribuição de energia */
  distribution: EnergyDistribution;
  
  /** Flags semânticas */
  flags: {
    isFixed: boolean;
    isEssential: boolean;
    isInvestment: boolean;
  };
  
  /** Justificativa automática */
  justification: string;
}

export interface AutoClassificationResult {
  matched: boolean;
  templateName?: string;
  distribution: EnergyDistribution;
  flags: {
    isFixed: boolean;
    isEssential: boolean;
    isInvestment: boolean;
  };
  justification: string;
  validationStatus: ValidationStatus;
  confidence: 'high' | 'medium' | 'low';
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATES DE CLASSIFICAÇÃO
// Baseados nas categorias padrão do sistema (populate-categories.ts)
// ══════════════════════════════════════════════════════════════════════════════

export const ENERGY_TEMPLATES: Record<string, CategoryEnergyTemplate> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // 🏠 MORADIA - 100% Sobrevivência (Essencial, Fixo)
  // ═══════════════════════════════════════════════════════════════════════════
  ALUGUEL: {
    patterns: ['aluguel', 'financiamento imóvel', 'financiamento casa', 'parcela imóvel'],
    distribution: { survival: 1, choice: 0, future: 0, loss: 0 },
    flags: { isFixed: true, isEssential: true, isInvestment: false },
    justification: 'Moradia é gasto essencial e fixo - 100% Sobrevivência'
  },
  
  CONDOMINIO_IPTU: {
    patterns: ['condomínio', 'condominio', 'iptu', 'taxa condominial'],
    distribution: { survival: 1, choice: 0, future: 0, loss: 0 },
    flags: { isFixed: true, isEssential: true, isInvestment: false },
    justification: 'Taxas obrigatórias de moradia - 100% Sobrevivência'
  },
  
  ENERGIA_ELETRICA: {
    patterns: ['energia', 'luz', 'eletricidade', 'conta de luz', 'cemig', 'enel', 'cpfl', 'light'],
    distribution: { survival: 1, choice: 0, future: 0, loss: 0 },
    flags: { isFixed: true, isEssential: true, isInvestment: false },
    justification: 'Energia elétrica é essencial para vida moderna - 100% Sobrevivência'
  },
  
  AGUA: {
    patterns: ['água', 'agua', 'saneamento', 'copasa', 'sabesp', 'cedae'],
    distribution: { survival: 1, choice: 0, future: 0, loss: 0 },
    flags: { isFixed: true, isEssential: true, isInvestment: false },
    justification: 'Água é necessidade básica - 100% Sobrevivência'
  },
  
  GAS: {
    patterns: ['gás', 'gas', 'botijão', 'encanado'],
    distribution: { survival: 1, choice: 0, future: 0, loss: 0 },
    flags: { isFixed: true, isEssential: true, isInvestment: false },
    justification: 'Gás para alimentação - 100% Sobrevivência'
  },
  
  MANUTENCAO_CASA: {
    patterns: ['manutenção casa', 'reparo', 'conserto', 'reforma'],
    distribution: { survival: 0.8, choice: 0.2, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Manutenção básica é sobrevivência, reformas estéticas são escolha'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🍔 ALIMENTAÇÃO - Mix Sobrevivência/Escolha
  // ═══════════════════════════════════════════════════════════════════════════
  SUPERMERCADO: {
    patterns: ['supermercado', 'mercado', 'feira', 'hortifruti', 'açougue', 'padaria'],
    distribution: { survival: 0.7, choice: 0.3, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: true, isInvestment: false },
    justification: 'Alimentação básica é essencial (70%), itens supérfluos são escolha (30%)'
  },
  
  RESTAURANTE: {
    patterns: ['restaurante', 'lanchonete', 'delivery', 'ifood', 'rappi', 'uber eats'],
    distribution: { survival: 0, choice: 1, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Comer fora é escolha de conforto - 100% Escolha'
  },
  
  CAFE_LANCHES: {
    patterns: ['café', 'cafe', 'lanche', 'starbucks', 'cafeteria'],
    distribution: { survival: 0, choice: 1, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Cafés e lanches são escolhas de prazer - 100% Escolha'
  },
  
  BEBIDAS: {
    patterns: ['bebidas', 'bar', 'cerveja', 'vinho', 'drinks'],
    distribution: { survival: 0, choice: 1, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Bebidas alcoólicas são escolha - 100% Escolha'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🚗 TRANSPORTE - Mix Sobrevivência/Escolha
  // ═══════════════════════════════════════════════════════════════════════════
  COMBUSTIVEL: {
    patterns: ['combustível', 'combustivel', 'gasolina', 'etanol', 'diesel', 'posto'],
    distribution: { survival: 0.8, choice: 0.2, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: true, isInvestment: false },
    justification: 'Transporte para trabalho é essencial (80%), lazer é escolha (20%)'
  },
  
  TRANSPORTE_PUBLICO: {
    patterns: ['transporte público', 'ônibus', 'onibus', 'metrô', 'metro', 'trem', 'passagem'],
    distribution: { survival: 1, choice: 0, future: 0, loss: 0 },
    flags: { isFixed: true, isEssential: true, isInvestment: false },
    justification: 'Transporte público para trabalho - 100% Sobrevivência'
  },
  
  UBER_TAXI: {
    patterns: ['uber', 'taxi', 'táxi', '99', 'cabify', 'app transporte'],
    distribution: { survival: 0.3, choice: 0.7, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Aplicativos de transporte: emergências são sobrevivência, conveniência é escolha'
  },
  
  ESTACIONAMENTO: {
    patterns: ['estacionamento', 'parking', 'zona azul'],
    distribution: { survival: 0.5, choice: 0.5, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Estacionamento: trabalho é sobrevivência, lazer é escolha'
  },
  
  MANUTENCAO_VEICULO: {
    patterns: ['manutenção veículo', 'mecânico', 'oficina', 'troca óleo', 'revisão carro'],
    distribution: { survival: 0.8, choice: 0.2, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: true, isInvestment: false },
    justification: 'Manutenção preventiva é essencial, customização é escolha'
  },
  
  SEGURO_VEICULO: {
    patterns: ['seguro carro', 'seguro auto', 'seguro veículo', 'dpvat', 'licenciamento'],
    distribution: { survival: 0.9, choice: 0.1, future: 0, loss: 0 },
    flags: { isFixed: true, isEssential: true, isInvestment: false },
    justification: 'Seguro e documentação obrigatórios - principalmente Sobrevivência'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🏥 SAÚDE - 100% Sobrevivência
  // ═══════════════════════════════════════════════════════════════════════════
  PLANO_SAUDE: {
    patterns: ['plano de saúde', 'plano saude', 'convênio', 'unimed', 'amil', 'bradesco saúde', 'sulamerica'],
    distribution: { survival: 1, choice: 0, future: 0, loss: 0 },
    flags: { isFixed: true, isEssential: true, isInvestment: false },
    justification: 'Plano de saúde é proteção essencial - 100% Sobrevivência'
  },
  
  MEDICAMENTOS: {
    patterns: ['medicamento', 'remédio', 'farmácia', 'drogaria', 'receita médica'],
    distribution: { survival: 1, choice: 0, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: true, isInvestment: false },
    justification: 'Medicamentos são necessidade de saúde - 100% Sobrevivência'
  },
  
  CONSULTAS: {
    patterns: ['consulta', 'médico', 'médica', 'exame', 'clínica', 'hospital'],
    distribution: { survival: 1, choice: 0, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: true, isInvestment: false },
    justification: 'Consultas médicas são cuidado essencial - 100% Sobrevivência'
  },
  
  ODONTOLOGIA: {
    patterns: ['dentista', 'odonto', 'ortodontia', 'tratamento dental'],
    distribution: { survival: 0.8, choice: 0.2, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: true, isInvestment: false },
    justification: 'Saúde bucal é essencial (80%), estética dental é escolha (20%)'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 📚 EDUCAÇÃO - Mix Sobrevivência/Futuro
  // ═══════════════════════════════════════════════════════════════════════════
  MENSALIDADE_ESCOLA: {
    patterns: ['escola', 'colégio', 'mensalidade escolar', 'material escolar'],
    distribution: { survival: 0.6, choice: 0, future: 0.4, loss: 0 },
    flags: { isFixed: true, isEssential: true, isInvestment: true },
    justification: 'Educação básica é essencial e investimento no futuro'
  },
  
  FACULDADE: {
    patterns: ['faculdade', 'universidade', 'graduação', 'pós-graduação', 'mestrado', 'doutorado'],
    distribution: { survival: 0.3, choice: 0, future: 0.7, loss: 0 },
    flags: { isFixed: true, isEssential: false, isInvestment: true },
    justification: 'Educação superior é principalmente investimento no futuro'
  },
  
  CURSOS: {
    patterns: ['curso', 'treinamento', 'workshop', 'capacitação', 'certificação'],
    distribution: { survival: 0, choice: 0.2, future: 0.8, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: true },
    justification: 'Cursos são investimento em desenvolvimento profissional'
  },
  
  LIVROS: {
    patterns: ['livro', 'ebook', 'material didático', 'apostila'],
    distribution: { survival: 0, choice: 0.3, future: 0.7, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: true },
    justification: 'Livros: lazer é escolha, conhecimento é investimento'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎮 LAZER & ENTRETENIMENTO - 100% Escolha
  // ═══════════════════════════════════════════════════════════════════════════
  STREAMING: {
    patterns: ['netflix', 'amazon prime', 'disney', 'hbo', 'spotify', 'deezer', 'youtube premium', 'streaming', 'tv/streaming'],
    distribution: { survival: 0, choice: 1, future: 0, loss: 0 },
    flags: { isFixed: true, isEssential: false, isInvestment: false },
    justification: 'Serviços de streaming são entretenimento - 100% Escolha'
  },
  
  INTERNET: {
    patterns: ['internet', 'banda larga', 'fibra', 'provedor'],
    distribution: { survival: 0.7, choice: 0.3, future: 0, loss: 0 },
    flags: { isFixed: true, isEssential: true, isInvestment: false },
    justification: 'Internet: trabalho/estudo é sobrevivência, entretenimento é escolha'
  },
  
  CINEMA_TEATRO: {
    patterns: ['cinema', 'teatro', 'show', 'ingresso', 'espetáculo'],
    distribution: { survival: 0, choice: 1, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Entretenimento cultural - 100% Escolha'
  },
  
  GAMES: {
    patterns: ['game', 'jogo', 'playstation', 'xbox', 'nintendo', 'steam'],
    distribution: { survival: 0, choice: 1, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Jogos e games são lazer - 100% Escolha'
  },
  
  VIAGENS: {
    patterns: ['viagem', 'passagem aérea', 'hotel', 'hospedagem', 'airbnb', 'turismo'],
    distribution: { survival: 0, choice: 1, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Viagens de lazer são escolha - 100% Escolha'
  },
  
  FESTAS: {
    patterns: ['festa', 'evento', 'balada', 'happy hour'],
    distribution: { survival: 0, choice: 1, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Festas e eventos sociais - 100% Escolha'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 💳 CONTAS & SERVIÇOS - Mix
  // ═══════════════════════════════════════════════════════════════════════════
  CELULAR: {
    patterns: ['celular', 'telefone', 'operadora', 'vivo', 'claro', 'tim', 'oi'],
    distribution: { survival: 0.7, choice: 0.3, future: 0, loss: 0 },
    flags: { isFixed: true, isEssential: true, isInvestment: false },
    justification: 'Comunicação básica é essencial, dados extras são escolha'
  },
  
  SEGUROS: {
    patterns: ['seguro vida', 'seguro residencial', 'seguro'],
    distribution: { survival: 0.9, choice: 0.1, future: 0, loss: 0 },
    flags: { isFixed: true, isEssential: true, isInvestment: false },
    justification: 'Seguros são proteção essencial - 90% Sobrevivência'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 👕 VESTUÁRIO & BELEZA - Principalmente Escolha
  // ═══════════════════════════════════════════════════════════════════════════
  ROUPAS: {
    patterns: ['roupa', 'vestuário', 'loja roupa', 'shopping'],
    distribution: { survival: 0.2, choice: 0.8, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Roupas básicas são sobrevivência (20%), moda é escolha (80%)'
  },
  
  CALCADOS: {
    patterns: ['calçado', 'sapato', 'tênis', 'chinelo'],
    distribution: { survival: 0.3, choice: 0.7, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Calçados básicos são sobrevivência, moda é escolha'
  },
  
  COSMETICOS: {
    patterns: ['cosmético', 'maquiagem', 'perfume', 'beleza'],
    distribution: { survival: 0, choice: 1, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Cosméticos são escolha de estética - 100% Escolha'
  },
  
  SALAO: {
    patterns: ['salão', 'barbearia', 'cabelo', 'unha', 'manicure'],
    distribution: { survival: 0.2, choice: 0.8, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Corte básico é sobrevivência, tratamentos são escolha'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🏋️ BEM-ESTAR - Escolha com componente Futuro
  // ═══════════════════════════════════════════════════════════════════════════
  ACADEMIA: {
    patterns: ['academia', 'musculação', 'crossfit', 'smart fit', 'bluefit'],
    distribution: { survival: 0, choice: 0.6, future: 0.4, loss: 0 },
    flags: { isFixed: true, isEssential: false, isInvestment: true },
    justification: 'Exercício é escolha de saúde com investimento no bem-estar futuro'
  },
  
  YOGA_PILATES: {
    patterns: ['yoga', 'pilates', 'meditação'],
    distribution: { survival: 0, choice: 0.6, future: 0.4, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: true },
    justification: 'Práticas de bem-estar mental e físico'
  },
  
  SPA: {
    patterns: ['spa', 'massagem', 'relaxamento'],
    distribution: { survival: 0, choice: 1, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'SPA e massagens são escolha de conforto - 100% Escolha'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🐕 PETS - Mix Sobrevivência/Escolha
  // ═══════════════════════════════════════════════════════════════════════════
  PETS: {
    patterns: ['pet', 'cachorro', 'gato', 'ração', 'veterinário', 'petshop', 'banho tosa'],
    distribution: { survival: 0.6, choice: 0.4, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Cuidados básicos com pets são sobrevivência, extras são escolha'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 👨‍👩‍👧 FAMÍLIA
  // ═══════════════════════════════════════════════════════════════════════════
  CRECHE: {
    patterns: ['creche', 'babá', 'cuidador', 'berçário'],
    distribution: { survival: 1, choice: 0, future: 0, loss: 0 },
    flags: { isFixed: true, isEssential: true, isInvestment: false },
    justification: 'Cuidado infantil é essencial para trabalhar - 100% Sobrevivência'
  },
  
  PRESENTES: {
    patterns: ['presente', 'aniversário', 'natal', 'dia das mães', 'dia dos pais'],
    distribution: { survival: 0, choice: 1, future: 0, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Presentes são expressão social - 100% Escolha'
  },
  
  MESADA: {
    patterns: ['mesada', 'dinheiro filho'],
    distribution: { survival: 0, choice: 0.3, future: 0.7, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: true },
    justification: 'Mesada é educação financeira - principalmente Futuro'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 💰 INVESTIMENTOS & POUPANÇA - 100% Futuro
  // ═══════════════════════════════════════════════════════════════════════════
  INVESTIMENTOS: {
    patterns: ['investimento', 'ação', 'fundo', 'cdb', 'tesouro', 'lci', 'lca', 'cri', 'cra'],
    distribution: { survival: 0, choice: 0, future: 1, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: true },
    justification: 'Investimentos são 100% Futuro'
  },
  
  POUPANCA: {
    patterns: ['poupança', 'reserva', 'emergência'],
    distribution: { survival: 0, choice: 0, future: 1, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: true },
    justification: 'Poupança é construção de reserva - 100% Futuro'
  },
  
  PREVIDENCIA: {
    patterns: ['previdência', 'aposentadoria', 'pgbl', 'vgbl'],
    distribution: { survival: 0, choice: 0, future: 1, loss: 0 },
    flags: { isFixed: true, isEssential: false, isInvestment: true },
    justification: 'Previdência é planejamento de longo prazo - 100% Futuro'
  },
  
  CRIPTO: {
    patterns: ['cripto', 'bitcoin', 'ethereum', 'criptomoeda'],
    distribution: { survival: 0, choice: 0.2, future: 0.8, loss: 0 },
    flags: { isFixed: false, isEssential: false, isInvestment: true },
    justification: 'Criptomoedas: especulação é escolha, investimento é futuro'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 💸 ENERGIA PERDIDA - 100% Loss
  // ═══════════════════════════════════════════════════════════════════════════
  JUROS_CARTAO: {
    patterns: ['juros cartão', 'juros crédito', 'rotativo', 'encargos'],
    distribution: { survival: 0, choice: 0, future: 0, loss: 1 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Juros de cartão são dinheiro perdido - 100% Loss'
  },
  
  MULTAS: {
    patterns: ['multa', 'infração', 'penalidade'],
    distribution: { survival: 0, choice: 0, future: 0, loss: 1 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Multas são perda evitável - 100% Loss'
  },
  
  TAXAS_BANCARIAS: {
    patterns: ['taxa bancária', 'tarifa bancária', 'ted', 'doc', 'saque', 'taxa manutenção'],
    distribution: { survival: 0, choice: 0, future: 0, loss: 1 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Taxas bancárias evitáveis são perda - 100% Loss'
  },
  
  ANUIDADE_CARTAO: {
    patterns: ['anuidade', 'anuidade cartão'],
    distribution: { survival: 0, choice: 0, future: 0, loss: 1 },
    flags: { isFixed: true, isEssential: false, isInvestment: false },
    justification: 'Anuidade de cartão é custo evitável - 100% Loss'
  },
  
  CHEQUE_ESPECIAL: {
    patterns: ['cheque especial', 'limite conta', 'descoberto'],
    distribution: { survival: 0, choice: 0, future: 0, loss: 1 },
    flags: { isFixed: false, isEssential: false, isInvestment: false },
    justification: 'Cheque especial tem juros altíssimos - 100% Loss'
  },
  
  EMPRESTIMO: {
    patterns: ['empréstimo pessoal', 'consignado', 'crédito pessoal', 'financeira'],
    distribution: { survival: 0, choice: 0, future: 0, loss: 1 },
    flags: { isFixed: true, isEssential: false, isInvestment: false },
    justification: 'Juros de empréstimo são energia perdida - 100% Loss'
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// CLASSIFICAÇÃO PADRÃO PARA CATEGORIAS NÃO RECONHECIDAS
// ══════════════════════════════════════════════════════════════════════════════

const DEFAULT_EXPENSE_CLASSIFICATION: AutoClassificationResult = {
  matched: false,
  distribution: { survival: 0.5, choice: 0.5, future: 0, loss: 0 },
  flags: { isFixed: false, isEssential: false, isInvestment: false },
  justification: 'Categoria não reconhecida - classificação padrão 50/50 Sobrevivência/Escolha aguardando revisão',
  validationStatus: ValidationStatus.NOT_VALIDATED,
  confidence: 'low'
};

// ══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL DE CLASSIFICAÇÃO
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Classifica automaticamente uma categoria com base no seu nome.
 * O sistema determina a classificação, NÃO o usuário.
 * 
 * @param categoryName Nome da categoria
 * @param categoryType Tipo: 'income' ou 'expense'
 * @returns Resultado da classificação automática
 */
export function autoClassifyCategory(
  categoryName: string,
  categoryType: 'income' | 'expense'
): AutoClassificationResult {
  // Receitas não são classificadas como energia (são Energia Gerada)
  if (categoryType === 'income') {
    return {
      matched: true,
      templateName: 'INCOME',
      distribution: { survival: 0, choice: 0, future: 0, loss: 0 },
      flags: { isFixed: false, isEssential: false, isInvestment: false },
      justification: 'Receitas são Energia Gerada - não entram na classificação de gastos',
      validationStatus: ValidationStatus.VALIDATED,
      confidence: 'high'
    };
  }
  
  const normalizedName = categoryName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Buscar match nos templates
  for (const [templateName, template] of Object.entries(ENERGY_TEMPLATES)) {
    for (const pattern of template.patterns) {
      const normalizedPattern = pattern.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      if (normalizedName.includes(normalizedPattern) || normalizedPattern.includes(normalizedName)) {
        return {
          matched: true,
          templateName,
          distribution: { ...template.distribution },
          flags: { ...template.flags },
          justification: template.justification,
          validationStatus: ValidationStatus.INFERRED,
          confidence: 'high'
        };
      }
    }
  }
  
  // Match parcial - buscar palavras-chave
  for (const [templateName, template] of Object.entries(ENERGY_TEMPLATES)) {
    for (const pattern of template.patterns) {
      const words = pattern.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length >= 4 && normalizedName.includes(word)) {
          return {
            matched: true,
            templateName,
            distribution: { ...template.distribution },
            flags: { ...template.flags },
            justification: `${template.justification} (match parcial: "${word}")`,
            validationStatus: ValidationStatus.INFERRED,
            confidence: 'medium'
          };
        }
      }
    }
  }
  
  // Nenhum match encontrado
  return DEFAULT_EXPENSE_CLASSIFICATION;
}

/**
 * Classifica múltiplas categorias de uma vez.
 * Útil para processar todas as categorias de um tenant.
 * 
 * @param categories Lista de categorias para classificar
 * @returns Mapa de classificações por categoryId
 */
export function autoClassifyCategories(
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' }>
): Map<string, AutoClassificationResult> {
  const results = new Map<string, AutoClassificationResult>();
  
  for (const category of categories) {
    results.set(category.id, autoClassifyCategory(category.name, category.type));
  }
  
  return results;
}

/**
 * Verifica se uma classificação precisa de revisão.
 * Usado para identificar categorias que o sistema não conseguiu classificar com confiança.
 */
export function needsReview(classification: AutoClassificationResult): boolean {
  return (
    !classification.matched ||
    classification.confidence === 'low' ||
    classification.validationStatus === ValidationStatus.NOT_VALIDATED
  );
}
