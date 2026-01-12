import { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';
import { transactionService } from './transaction.service';

const prisma = new PrismaClient();

// ==================== TIPOS ====================

export enum ChatState {
  // Onboarding
  ONBOARDING_WELCOME = 'onboarding_welcome',
  ONBOARDING_NAME = 'onboarding_name',
  ONBOARDING_PROFILE = 'onboarding_profile',
  ONBOARDING_YEAR = 'onboarding_year',
  ONBOARDING_ACCOUNTS = 'onboarding_accounts',
  ONBOARDING_ACCOUNTS_PF_PJ = 'onboarding_accounts_pf_pj',
  ONBOARDING_ACCOUNTS_BALANCE = 'onboarding_accounts_balance',
  ONBOARDING_ACCOUNTS_MORE = 'onboarding_accounts_more',
  ONBOARDING_INCOME = 'onboarding_income',
  ONBOARDING_INCOME_TYPE = 'onboarding_income_type',
  ONBOARDING_INCOME_AMOUNT = 'onboarding_income_amount',
  ONBOARDING_INCOME_DAY = 'onboarding_income_day',
  ONBOARDING_INCOME_ACCOUNT = 'onboarding_income_account',
  ONBOARDING_INCOME_OCCURRENCES = 'onboarding_income_occurrences',
  ONBOARDING_INCOME_MORE = 'onboarding_income_more',
  ONBOARDING_EXPENSES = 'onboarding_expenses',
  ONBOARDING_EXPENSE_AMOUNT = 'onboarding_expense_amount',
  ONBOARDING_EXPENSE_DAY = 'onboarding_expense_day',
  ONBOARDING_EXPENSE_OCCURRENCES = 'onboarding_expense_occurrences',
  ONBOARDING_EXPENSE_ACCOUNT = 'onboarding_expense_account',
  ONBOARDING_EXPENSE_PAYMENT = 'onboarding_expense_payment',
  ONBOARDING_EXPENSE_MORE = 'onboarding_expense_more',
  ONBOARDING_COMPLETE = 'onboarding_complete',

  // Assistência diária
  IDLE = 'idle',
  ADDING_EXPENSE = 'adding_expense',
  ADDING_INCOME = 'adding_income',
  ASKING_CATEGORY = 'asking_category',
  ASKING_SUBCATEGORY = 'asking_subcategory',
  CONFIRMING_SUGGESTION = 'confirming_suggestion', // Novo: confirmar sugestão de categoria
  ASKING_ACCOUNT = 'asking_account',
  ASKING_PAYMENT_METHOD = 'asking_payment_method',
  ASKING_AMOUNT = 'asking_amount',
  ASKING_DESCRIPTION = 'asking_description',
  ASKING_DATE = 'asking_date',
  CONFIRMING = 'confirming',
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  options?: string[];
  quickReplies?: string[];
}

export interface ChatContext {
  userName?: string;
  profileType?: 'personal' | 'family';
  planningYear?: number;
  
  // Dados temporários
  tempTransaction?: {
    type?: 'income' | 'expense';
    amount?: number;
    description?: string;
    categoryId?: string;
    categoryName?: string;
    subcategoryId?: string;
    subcategoryName?: string;
    bankAccountId?: string;
    paymentMethodId?: string;
    date?: Date;
  };
  
  // Sugestão pendente de confirmação
  pendingSuggestion?: {
    categoryName: string;
    subcategoryName?: string;
    confidence: 'high' | 'medium' | 'low';
  };
  
  tempAccount?: {
    institution?: string;
    type?: 'PF' | 'PJ';
    balance?: number;
  };
  tempIncome?: {
    source?: string;
    isFixed?: boolean;
    amount?: number;
    dueDay?: number;
  };
  tempExpense?: {
    description?: string;
    amount?: number;
    dueDay?: number;
  };
  
  // Listas do usuário
  bankAccounts?: any[];
  paymentMethods?: any[];
  categories?: any[];
  subcategories?: any[];
  
  // Aprendizado
  learnedPatterns?: LearnedPattern[];
}

export interface ChatSession {
  id: string;
  tenantId: string;
  userId: string;
  state: ChatState;
  context: ChatContext;
  history: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// ==================== APRENDIZADO ====================

export interface LearnedPattern {
  description: string;        // Texto original (lowercase)
  keywords: string[];         // Palavras-chave extraídas
  categoryId: string;         // Categoria usada
  categoryName: string;       // Nome da categoria
  paymentMethodId?: string;   // Meio de pagamento frequente
  averageAmount?: number;     // Valor médio
  count: number;              // Quantas vezes usado
  lastUsed: Date;
}

// Cache de sessões em memória (backup do banco)
const sessions = new Map<string, ChatSession>();

// ==================== MENSAGENS AMIGÁVEIS ====================

const FRIENDLY_ERRORS = {
  invalidAmount: '💡 Hmm, não consegui entender o valor. Pode digitar só os números?\n\nExemplos: 50, 150.00, R$ 250,00',
  categoryNotFound: '🤔 Não encontrei essa categoria. Vamos tentar de outra forma?\n\nVocê pode digitar o número da lista ou parte do nome.',
  accountNotFound: '🏦 Não encontrei essa conta. Escolha uma da lista ou digite o número correspondente.',
  genericError: '😅 Ops! Algo deu errado. Que tal tentar de novo?\n\nDigite "menu" para ver as opções disponíveis.',
  connectionError: '📡 Parece que estamos com problemas de conexão. Aguarde um momento e tente novamente.',
  timeout: '⏰ A operação demorou mais que o esperado. Por favor, tente novamente.',
};

// ==================== PADRÕES DE LINGUAGEM EXPANDIDOS ====================

const EXPENSE_PATTERNS = [
  // Padrões existentes
  /(?:gastei|paguei|comprei)\s+(?:R\$\s*)?(\d+[\d.,]*)/i,
  /(?:R\$\s*)?(\d+[\d.,]*)\s+(?:em|no|na|de|para)\s+(.+)/i,
  // Novos padrões
  /(?:transferi|enviei)\s+(?:R\$\s*)?(\d+[\d.,]*)/i,
  /(?:paguei|quitei)\s+(?:a\s+)?(?:conta\s+)?(?:de\s+)?(.+?)\s+(?:R\$\s*)?(\d+[\d.,]*)/i,
  /(?:fiz\s+um\s+pix|mandei\s+um\s+pix)\s+(?:de\s+)?(?:R\$\s*)?(\d+[\d.,]*)/i,
  /(?:saquei|retirei)\s+(?:R\$\s*)?(\d+[\d.,]*)/i,
  /(?:dei\s+|dei\s+de\s+)(?:R\$\s*)?(\d+[\d.,]*)\s+(?:de\s+)?(.+)/i,
  /(?:despesa|gasto)\s+(?:de\s+)?(?:R\$\s*)?(\d+[\d.,]*)\s+(?:com|em|no|na)\s+(.+)/i,
];

const INCOME_PATTERNS = [
  // Padrões existentes
  /(?:recebi|ganhei|entrou)\s+(?:R\$\s*)?(\d+[\d.,]*)/i,
  /(?:R\$\s*)?(\d+[\d.,]*)\s+(?:de\s+|do\s+|da\s+)?(?:salário|salario|pagamento|freela|freelance)/i,
  // Novos padrões
  /(?:depositaram|caiu|entrou\s+na\s+conta)\s+(?:R\$\s*)?(\d+[\d.,]*)/i,
  /(?:vendi|fiz\s+uma\s+venda)\s+(?:de\s+)?(?:R\$\s*)?(\d+[\d.,]*)/i,
  /(?:recebi\s+um\s+pix|veio\s+um\s+pix)\s+(?:de\s+)?(?:R\$\s*)?(\d+[\d.,]*)/i,
  /(?:meu\s+salário|meu\s+salario|pagamento)\s+(?:foi\s+|de\s+)?(?:R\$\s*)?(\d+[\d.,]*)/i,
  /(?:rendimento|dividendo|juros)\s+(?:de\s+)?(?:R\$\s*)?(\d+[\d.,]*)/i,
];

const GREETING_PATTERNS = /^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hello|e ai|e aí|eae|opa|fala)/i;
const MENU_PATTERNS = /^(menu|ajuda|help|opções|opcoes|o que você faz|comandos|\?|inicio|início)/i;
const BALANCE_PATTERNS = /(?:meu\s+)?(?:saldo|quanto\s+tenho|quanto\s+tem|minhas?\s+contas?)/i;
const EXPENSES_PATTERNS = /(?:quanto\s+gastei|meus?\s+gastos?|despesas?|extrato)/i;
const BILLS_PATTERNS = /(?:contas?\s+a?\s*vencer|vencimentos?|próximas?\s+contas?|boletos?)/i;
const PLANNING_PATTERNS = /(?:planejamento|planejar|meu\s+mês|resumo|visão\s+geral|overview)/i;

// ==================== HELPER DE FUSO HORÁRIO ====================

/**
 * Obtém a hora atual no fuso horário de Brasília (America/Sao_Paulo)
 * O servidor pode estar em UTC, então convertemos para o horário local do Brasil
 */
function getBrazilHour(): number {
  const now = new Date();
  // Usar toLocaleString com timezone para obter a hora correta em Brasília
  const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return brazilTime.getHours();
}

// ==================== MAPA DE SUGESTÕES DE CATEGORIAS ====================

interface CategorySuggestion {
  keywords: string[];          // Palavras-chave que ativam a sugestão
  categoryName: string;        // Nome da categoria principal
  subcategoryName?: string;    // Nome da subcategoria (opcional)
  confidence: 'high' | 'medium' | 'low';  // Confiança na sugestão
}

// Mapa abrangente de palavras-chave para categorias (brasileiro)
const CATEGORY_SUGGESTIONS: CategorySuggestion[] = [
  // ========== ALIMENTAÇÃO ==========
  // Açougue/Carnes
  { keywords: ['carne', 'carnes', 'açougue', 'acougue', 'picanha', 'filé', 'file', 'costela', 'linguiça', 'linguica', 'frango', 'boi', 'porco', 'churrasco', 'corte', 'bovino', 'suino'], categoryName: 'Alimentação', subcategoryName: 'Açougue', confidence: 'high' },
  // Supermercado
  { keywords: ['mercado', 'supermercado', 'compras', 'feira', 'hortifruti', 'atacado', 'atacadao', 'assai', 'extra', 'carrefour', 'pao de acucar', 'dia', 'makro'], categoryName: 'Alimentação', subcategoryName: 'Supermercado', confidence: 'high' },
  // Padaria
  { keywords: ['padaria', 'pao', 'pães', 'bolo', 'confeitaria', 'doceria', 'pastel', 'sonho', 'croissant', 'cafe da manha'], categoryName: 'Alimentação', subcategoryName: 'Padaria', confidence: 'high' },
  // Restaurantes
  { keywords: ['restaurante', 'almoço', 'almoco', 'jantar', 'lanchonete', 'self-service', 'rodizio', 'buffet', 'pizzaria', 'churrascaria', 'japonês', 'japones', 'sushi', 'fast food', 'mcdonalds', 'burger king', 'subway', 'outback'], categoryName: 'Alimentação', subcategoryName: 'Restaurantes', confidence: 'high' },
  // Delivery/iFood
  { keywords: ['ifood', 'rappi', 'uber eats', 'delivery', 'entrega', 'pedido', 'app de comida'], categoryName: 'Alimentação', subcategoryName: 'Delivery', confidence: 'high' },
  // Lanches
  { keywords: ['lanche', 'lanches', 'hamburguer', 'hamburger', 'hot dog', 'cachorro quente', 'sanduiche', 'salgado', 'coxinha', 'empada', 'esfiha'], categoryName: 'Alimentação', subcategoryName: 'Lanches', confidence: 'high' },
  // Bebidas
  { keywords: ['bebida', 'refrigerante', 'cerveja', 'vinho', 'whisky', 'vodka', 'destilado', 'bar', 'boteco', 'happy hour', 'drinks'], categoryName: 'Alimentação', subcategoryName: 'Bebidas', confidence: 'high' },
  // Café
  { keywords: ['cafe', 'café', 'cafeteria', 'starbucks', 'expresso', 'cappuccino', 'latte'], categoryName: 'Alimentação', subcategoryName: 'Cafeteria', confidence: 'high' },
  // Alimentação genérica
  { keywords: ['comida', 'alimentação', 'alimentacao', 'refeição', 'refeicao', 'comer'], categoryName: 'Alimentação', confidence: 'medium' },
  
  // ========== TRANSPORTE ==========
  // Combustível
  { keywords: ['gasolina', 'alcool', 'etanol', 'diesel', 'combustivel', 'posto', 'abasteci', 'tanque', 'shell', 'ipiranga', 'petrobras', 'br'], categoryName: 'Transporte', subcategoryName: 'Combustível', confidence: 'high' },
  // Uber/99/Táxi
  { keywords: ['uber', '99', 'taxi', 'táxi', 'corrida', '99pop', 'cabify', 'indriver'], categoryName: 'Transporte', subcategoryName: 'Aplicativo', confidence: 'high' },
  // Estacionamento
  { keywords: ['estacionamento', 'parking', 'valet', 'zona azul', 'rotativo', 'estacionar'], categoryName: 'Transporte', subcategoryName: 'Estacionamento', confidence: 'high' },
  // Manutenção carro
  { keywords: ['mecanico', 'mecânico', 'oficina', 'conserto', 'revisao', 'revisão', 'troca de oleo', 'oleo', 'pneu', 'borracharia', 'funilaria', 'lataria', 'alignment', 'balanceamento'], categoryName: 'Transporte', subcategoryName: 'Manutenção', confidence: 'high' },
  // Pedágio
  { keywords: ['pedagio', 'pedágio', 'sem parar', 'conectcar', 'veloe', 'move mais'], categoryName: 'Transporte', subcategoryName: 'Pedágio', confidence: 'high' },
  // Transporte público
  { keywords: ['onibus', 'ônibus', 'metro', 'metrô', 'trem', 'brt', 'vlt', 'bilhete', 'passagem', 'bilhete unico'], categoryName: 'Transporte', subcategoryName: 'Transporte Público', confidence: 'high' },
  // Seguro
  { keywords: ['seguro carro', 'seguro auto', 'seguro veiculo', 'porto seguro', 'suhai', 'azul seguros'], categoryName: 'Transporte', subcategoryName: 'Seguro', confidence: 'high' },
  // IPVA/Licenciamento
  { keywords: ['ipva', 'licenciamento', 'dpvat', 'detran', 'multa transito', 'multa'], categoryName: 'Transporte', subcategoryName: 'Impostos/Taxas', confidence: 'high' },
  
  // ========== MORADIA ==========
  // Aluguel
  { keywords: ['aluguel', 'aluguer', 'arrendamento', 'mensalidade casa', 'rent'], categoryName: 'Moradia', subcategoryName: 'Aluguel', confidence: 'high' },
  // Condomínio
  { keywords: ['condominio', 'condomínio', 'taxa condominial', 'síndico'], categoryName: 'Moradia', subcategoryName: 'Condomínio', confidence: 'high' },
  // Água
  { keywords: ['agua', 'água', 'sabesp', 'copasa', 'cedae', 'sanepar', 'conta de agua'], categoryName: 'Moradia', subcategoryName: 'Água', confidence: 'high' },
  // Luz/Energia
  { keywords: ['luz', 'energia', 'eletricidade', 'conta de luz', 'enel', 'cpfl', 'cemig', 'eletropaulo', 'light', 'celpe', 'coelba', 'elektro'], categoryName: 'Moradia', subcategoryName: 'Energia', confidence: 'high' },
  // Gás
  { keywords: ['gas', 'gás', 'botijão', 'botijao', 'gas encanado', 'comgas', 'supergasbras', 'ultragaz', 'liquigas'], categoryName: 'Moradia', subcategoryName: 'Gás', confidence: 'high' },
  // Internet/TV
  { keywords: ['internet', 'wifi', 'banda larga', 'fibra', 'net', 'claro', 'vivo', 'tim', 'oi', 'sky', 'tv a cabo', 'streaming'], categoryName: 'Moradia', subcategoryName: 'Internet/TV', confidence: 'high' },
  // Telefone
  { keywords: ['telefone', 'celular', 'linha', 'plano celular', 'recarga', 'credito celular'], categoryName: 'Moradia', subcategoryName: 'Telefone', confidence: 'high' },
  // IPTU
  { keywords: ['iptu', 'imposto predial', 'territorial urbano'], categoryName: 'Moradia', subcategoryName: 'IPTU', confidence: 'high' },
  // Manutenção casa
  { keywords: ['reforma', 'obra', 'pedreiro', 'pintor', 'eletricista', 'encanador', 'marceneiro', 'conserto casa', 'manutencao casa', 'material construcao', 'telhanorte', 'leroy merlin', 'c&c', 'madeireira'], categoryName: 'Moradia', subcategoryName: 'Manutenção', confidence: 'high' },
  // Móveis/Decoração
  { keywords: ['movel', 'móvel', 'moveis', 'móveis', 'decoracao', 'decoração', 'tapete', 'cortina', 'colchao', 'colchão', 'cama', 'sofa', 'sofá', 'mesa', 'cadeira', 'tok stok', 'tokstok', 'etna', 'mobly'], categoryName: 'Moradia', subcategoryName: 'Móveis', confidence: 'high' },
  // Eletrodomésticos
  { keywords: ['geladeira', 'fogao', 'fogão', 'microondas', 'maquina de lavar', 'lava e seca', 'ar condicionado', 'ventilador', 'liquidificador', 'batedeira', 'cafeteira', 'airfryer', 'aspirador'], categoryName: 'Moradia', subcategoryName: 'Eletrodomésticos', confidence: 'high' },
  // Faxineira/Diarista
  { keywords: ['faxineira', 'diarista', 'empregada', 'limpeza', 'doméstica', 'domestica'], categoryName: 'Moradia', subcategoryName: 'Serviços Domésticos', confidence: 'high' },
  
  // ========== SAÚDE ==========
  // Farmácia
  { keywords: ['farmacia', 'farmácia', 'remedio', 'remédio', 'medicamento', 'droga', 'drogaria', 'drogasil', 'pacheco', 'pague menos', 'raia', 'panvel', 'nissei'], categoryName: 'Saúde', subcategoryName: 'Farmácia', confidence: 'high' },
  // Médico/Consulta
  { keywords: ['medico', 'médico', 'consulta', 'doutor', 'doutora', 'clinica', 'clínica', 'hospital', 'pronto socorro', 'emergencia', 'urgencia', 'exame', 'laboratorio', 'dasa', 'fleury'], categoryName: 'Saúde', subcategoryName: 'Médico', confidence: 'high' },
  // Dentista
  { keywords: ['dentista', 'odonto', 'ortodontia', 'aparelho dentario', 'limpeza dente', 'canal', 'extração', 'extraçao', 'obturacao', 'obturação'], categoryName: 'Saúde', subcategoryName: 'Dentista', confidence: 'high' },
  // Plano de Saúde
  { keywords: ['plano de saude', 'plano saúde', 'convenio', 'convênio', 'unimed', 'amil', 'bradesco saude', 'sulamerica', 'notre dame', 'hapvida', 'notredame'], categoryName: 'Saúde', subcategoryName: 'Plano de Saúde', confidence: 'high' },
  // Academia/Esporte
  { keywords: ['academia', 'gym', 'musculação', 'musculacao', 'smartfit', 'smart fit', 'bluefit', 'bodytech', 'personal', 'personal trainer', 'pilates', 'yoga', 'crossfit', 'natacao', 'natação'], categoryName: 'Saúde', subcategoryName: 'Academia', confidence: 'high' },
  // Psicólogo/Terapia
  { keywords: ['psicologo', 'psicólogo', 'psicologa', 'terapia', 'terapeuta', 'psiquiatra', 'analise', 'sessao', 'sessão'], categoryName: 'Saúde', subcategoryName: 'Terapia', confidence: 'high' },
  // Ótica
  { keywords: ['otica', 'óptica', 'oculos', 'óculos', 'lente', 'lentes', 'armação', 'armacao', 'oftalmologista'], categoryName: 'Saúde', subcategoryName: 'Ótica', confidence: 'high' },
  
  // ========== EDUCAÇÃO ==========
  // Escola/Faculdade
  { keywords: ['escola', 'colegio', 'colégio', 'faculdade', 'universidade', 'mensalidade escolar', 'matricula', 'matrícula', 'material escolar', 'apostila'], categoryName: 'Educação', subcategoryName: 'Mensalidade', confidence: 'high' },
  // Cursos
  { keywords: ['curso', 'cursos', 'workshop', 'treinamento', 'capacitacao', 'capacitação', 'udemy', 'coursera', 'alura', 'rocketseat', 'origamid'], categoryName: 'Educação', subcategoryName: 'Cursos', confidence: 'high' },
  // Livros
  { keywords: ['livro', 'livros', 'livraria', 'amazon livro', 'saraiva', 'cultura', 'kindle', 'ebook'], categoryName: 'Educação', subcategoryName: 'Livros', confidence: 'high' },
  // Idiomas
  { keywords: ['ingles', 'inglês', 'espanhol', 'idioma', 'frances', 'francês', 'wizard', 'ccaa', 'cultura inglesa', 'fisk', 'cna', 'yazigi', 'italki', 'duolingo'], categoryName: 'Educação', subcategoryName: 'Idiomas', confidence: 'high' },
  
  // ========== LAZER/ENTRETENIMENTO ==========
  // Cinema/Teatro
  { keywords: ['cinema', 'filme', 'ingresso', 'cinemark', 'cinepolis', 'uci', 'teatro', 'musical', 'show', 'espetaculo', 'espetáculo'], categoryName: 'Lazer', subcategoryName: 'Cinema/Teatro', confidence: 'high' },
  // Streaming
  { keywords: ['netflix', 'prime video', 'amazon prime', 'disney', 'hbo', 'max', 'globoplay', 'spotify', 'deezer', 'apple music', 'youtube premium', 'streaming', 'assinatura'], categoryName: 'Lazer', subcategoryName: 'Streaming', confidence: 'high' },
  // Viagem
  { keywords: ['viagem', 'passagem aerea', 'voo', 'hotel', 'pousada', 'airbnb', 'booking', 'decolar', '123milhas', 'hospedagem', 'resort', 'turismo'], categoryName: 'Lazer', subcategoryName: 'Viagem', confidence: 'high' },
  // Jogos
  { keywords: ['jogo', 'games', 'videogame', 'playstation', 'xbox', 'nintendo', 'steam', 'ps5', 'ps4', 'console', 'game pass'], categoryName: 'Lazer', subcategoryName: 'Jogos', confidence: 'high' },
  // Festas/Eventos
  { keywords: ['festa', 'balada', 'evento', 'show', 'ingresso', 'casamento', 'aniversario', 'aniversário', 'formatura', 'churrasco'], categoryName: 'Lazer', subcategoryName: 'Eventos', confidence: 'high' },
  
  // ========== VESTUÁRIO/BELEZA ==========
  // Roupas
  { keywords: ['roupa', 'roupas', 'vestido', 'calca', 'calça', 'camisa', 'camiseta', 'blusa', 'shorts', 'saia', 'loja', 'shopping', 'renner', 'riachuelo', 'cea', 'c&a', 'zara', 'hm', 'shein', 'marisa'], categoryName: 'Vestuário', subcategoryName: 'Roupas', confidence: 'high' },
  // Calçados
  { keywords: ['sapato', 'tênis', 'tenis', 'sandalia', 'sandália', 'chinelo', 'bota', 'sapatênis', 'havaianas', 'centauro', 'netshoes'], categoryName: 'Vestuário', subcategoryName: 'Calçados', confidence: 'high' },
  // Beleza/Estética
  { keywords: ['salao', 'salão', 'cabelereiro', 'cabeleireira', 'corte', 'tintura', 'manicure', 'pedicure', 'unha', 'sobrancelha', 'depilacao', 'depilação', 'maquiagem', 'estetica', 'estética', 'spa', 'massagem', 'cosmetico', 'cosmético', 'perfume', 'boticario', 'boticário', 'natura', 'avon', 'sephora'], categoryName: 'Beleza', subcategoryName: 'Salão/Estética', confidence: 'high' },
  // Barbeiro
  { keywords: ['barbeiro', 'barbearia', 'barba', 'cabelo masculino'], categoryName: 'Beleza', subcategoryName: 'Barbearia', confidence: 'high' },
  
  // ========== FAMÍLIA/FILHOS ==========
  // Babá/Creche
  { keywords: ['baba', 'babá', 'creche', 'berçário', 'bercario', 'escolinha'], categoryName: 'Família', subcategoryName: 'Cuidados', confidence: 'high' },
  // Brinquedos
  { keywords: ['brinquedo', 'brinquedos', 'ri happy', 'pbkids', 'presente filho', 'presente criança', 'presente crianca'], categoryName: 'Família', subcategoryName: 'Brinquedos', confidence: 'high' },
  // Pet
  { keywords: ['pet', 'petshop', 'veterinario', 'veterinário', 'ração', 'racao', 'cachorro', 'gato', 'vacina pet', 'banho tosa', 'petz', 'cobasi'], categoryName: 'Família', subcategoryName: 'Pet', confidence: 'high' },
  // Pensão
  { keywords: ['pensao', 'pensão', 'pensão alimentícia', 'pensao alimenticia'], categoryName: 'Família', subcategoryName: 'Pensão', confidence: 'high' },
  
  // ========== COMPRAS/TECNOLOGIA ==========
  // Eletrônicos
  { keywords: ['celular', 'smartphone', 'iphone', 'samsung', 'xiaomi', 'notebook', 'computador', 'pc', 'tablet', 'ipad', 'monitor', 'fone', 'airpods', 'headset', 'mouse', 'teclado'], categoryName: 'Compras', subcategoryName: 'Eletrônicos', confidence: 'high' },
  // E-commerce
  { keywords: ['amazon', 'mercado livre', 'magalu', 'magazine luiza', 'americanas', 'submarino', 'casas bahia', 'shopee', 'aliexpress'], categoryName: 'Compras', subcategoryName: 'E-commerce', confidence: 'medium' },
  // Presentes
  { keywords: ['presente', 'gift', 'lembrança', 'lembrancinha', 'aniversário amigo'], categoryName: 'Compras', subcategoryName: 'Presentes', confidence: 'medium' },
  
  // ========== FINANCEIRO ==========
  // Investimentos
  { keywords: ['investimento', 'aplicacao', 'aplicação', 'tesouro direto', 'cdb', 'lci', 'lca', 'fundo', 'ações', 'acoes', 'bolsa', 'btg', 'xp', 'rico', 'clear', 'nuinvest'], categoryName: 'Investimentos', confidence: 'high' },
  // Empréstimo
  { keywords: ['emprestimo', 'empréstimo', 'parcela emprestimo', 'financiamento', 'credito pessoal', 'crédito pessoal', 'divida', 'dívida'], categoryName: 'Financeiro', subcategoryName: 'Empréstimo', confidence: 'high' },
  // Cartão de crédito
  { keywords: ['fatura', 'cartao', 'cartão', 'anuidade', 'juros cartão'], categoryName: 'Financeiro', subcategoryName: 'Cartão', confidence: 'medium' },
  // Taxas bancárias
  { keywords: ['taxa', 'tarifa', 'iof', 'ted', 'doc', 'manutencao conta'], categoryName: 'Financeiro', subcategoryName: 'Taxas Bancárias', confidence: 'high' },
  // Seguros
  { keywords: ['seguro vida', 'seguro residencial', 'previdencia', 'previdência', 'aposentadoria'], categoryName: 'Financeiro', subcategoryName: 'Seguros', confidence: 'high' },
  
  // ========== DOAÇÕES/IMPOSTOS ==========
  // Doações
  { keywords: ['doacao', 'doação', 'caridade', 'ong', 'ajuda', 'contribuicao', 'contribuição', 'esmola', 'ação social'], categoryName: 'Outros', subcategoryName: 'Doações', confidence: 'high' },
  // Impostos
  { keywords: ['imposto', 'ir', 'imposto de renda', 'darf', 'inss', 'contribuicao', 'tributo'], categoryName: 'Impostos', confidence: 'high' },
  
  // ========== RECEITAS ==========
  // Salário
  { keywords: ['salario', 'salário', 'pagamento', 'holerite', 'contracheque', 'vencimento', 'remuneracao', 'remuneração'], categoryName: 'Receitas', subcategoryName: 'Salário', confidence: 'high' },
  // Freelance
  { keywords: ['freela', 'freelance', 'job', 'projeto', 'trabalho extra', 'bico', 'renda extra'], categoryName: 'Receitas', subcategoryName: 'Freelance', confidence: 'high' },
  // Aluguel recebido
  { keywords: ['aluguel recebido', 'recebi aluguel', 'inquilino', 'locacao', 'locação'], categoryName: 'Receitas', subcategoryName: 'Aluguel', confidence: 'high' },
  // Dividendos
  { keywords: ['dividendo', 'jcp', 'rendimento', 'juros', 'proventos'], categoryName: 'Receitas', subcategoryName: 'Investimentos', confidence: 'high' },
  // Venda
  { keywords: ['vendi', 'venda', 'vendido', 'negócio', 'negocio'], categoryName: 'Receitas', subcategoryName: 'Vendas', confidence: 'high' },
  // Reembolso
  { keywords: ['reembolso', 'estorno', 'devolucao', 'devolução', 'cashback'], categoryName: 'Receitas', subcategoryName: 'Reembolsos', confidence: 'high' },
  // 13º/Férias
  { keywords: ['decimo terceiro', '13o', '13º', 'ferias', 'férias', 'abono', 'terço de ferias'], categoryName: 'Receitas', subcategoryName: 'Benefícios', confidence: 'high' },
];

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Parsear valores monetários
 */
export function parseMoneyValue(input: string): number | null {
  if (!input) return null;
  
  // Remove tudo exceto números, vírgula e ponto
  let cleaned = input.replace(/[^\d,\.]/g, '');
  
  if (!cleaned) return null;
  
  // Formato brasileiro: 1.234,56 -> 1234.56
  if (cleaned.includes(',')) {
    // Remove pontos de milhar
    cleaned = cleaned.replace(/\./g, '');
    // Troca vírgula por ponto
    cleaned = cleaned.replace(',', '.');
  }
  
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

/**
 * Formatar valor monetário
 */
export function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

/**
 * Verificar se resposta é positiva
 */
export function isPositive(input: string): boolean {
  const positives = ['sim', 's', 'yes', 'y', 'si', 'ok', 'tenho', 'tem', 'isso', 'exato', '1', 'claro', 'pode'];
  const normalized = input.toLowerCase().trim();
  return positives.some(p => normalized === p || normalized.startsWith(p + ' '));
}

/**
 * Verificar se resposta é negativa
 */
export function isNegative(input: string): boolean {
  const negatives = ['não', 'nao', 'n', 'no', 'nope', 'não tenho', 'nenhum', 'nada', '2', 'nunca'];
  const normalized = input.toLowerCase().trim();
  return negatives.some(p => normalized === p || normalized.startsWith(p + ' '));
}

/**
 * Extrair palavras-chave de uma descrição
 */
export function extractKeywords(text: string): string[] {
  const stopWords = ['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 
    'para', 'com', 'sem', 'por', 'um', 'uma', 'uns', 'umas', 'o', 'a', 'os', 'as',
    'e', 'ou', 'que', 'pra', 'pro'];
  
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .slice(0, 5); // Máximo 5 keywords
}

/**
 * Calcular similaridade entre keywords
 */
export function calculateSimilarity(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  
  let matches = 0;
  for (const word of set1) {
    if (set2.has(word)) matches++;
  }
  
  return matches / Math.max(set1.size, set2.size);
}

// ==================== SERVIÇO PRINCIPAL ====================

export class ChatbotService {
  
  /**
   * Obter ou criar sessão - agora persiste no banco!
   */
  async getOrCreateSession(tenantId: string, userId: string): Promise<ChatSession> {
    const sessionKey = `${tenantId}:${userId}`;
    
    // Primeiro, tentar carregar do cache em memória
    let session = sessions.get(sessionKey);
    
    if (session) {
      return session;
    }
    
    // Tentar carregar do banco de dados
    try {
      const dbSession = await prisma.chatSession.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 50, // Últimas 50 mensagens
          }
        }
      });
      
      if (dbSession) {
        // Restaurar sessão do banco
        const context = dbSession.context ? JSON.parse(dbSession.context) : {};
        const learnedPatterns = dbSession.learnedPatterns ? JSON.parse(dbSession.learnedPatterns) : [];
        
        session = {
          id: dbSession.id,
          tenantId: dbSession.tenantId,
          userId: dbSession.userId,
          state: dbSession.state as ChatState,
          context: {
            ...context,
            learnedPatterns: learnedPatterns.length > 0 ? learnedPatterns : await this.loadLearnedPatterns(tenantId),
          },
          history: dbSession.messages.reverse().map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: m.createdAt,
            options: m.options ? JSON.parse(m.options) : undefined,
            quickReplies: m.quickReplies ? JSON.parse(m.quickReplies) : undefined,
          })),
          createdAt: dbSession.createdAt,
          updatedAt: dbSession.updatedAt,
        };
        
        // Atualizar lastActiveAt
        await prisma.chatSession.update({
          where: { id: dbSession.id },
          data: { lastActiveAt: new Date() }
        });
        
        sessions.set(sessionKey, session);
        log.info(`Sessão do chatbot restaurada do banco: ${sessionKey}`);
        return session;
      }
    } catch (error) {
      log.warn('Erro ao carregar sessão do banco, criando nova:', error);
    }
    
    // Criar nova sessão
    const hasAccounts = await prisma.bankAccount.count({
      where: { tenantId, deletedAt: null }
    });
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true }
    });
    
    const learnedPatterns = await this.loadLearnedPatterns(tenantId);
    
    // Criar no banco
    const newDbSession = await prisma.chatSession.create({
      data: {
        tenantId,
        userId,
        state: hasAccounts > 0 ? ChatState.IDLE : ChatState.ONBOARDING_WELCOME,
        context: JSON.stringify({
          userName: user?.fullName?.split(' ')[0] || 'Usuário',
        }),
        learnedPatterns: JSON.stringify(learnedPatterns),
      }
    });
    
    session = {
      id: newDbSession.id,
      tenantId,
      userId,
      state: hasAccounts > 0 ? ChatState.IDLE : ChatState.ONBOARDING_WELCOME,
      context: {
        userName: user?.fullName?.split(' ')[0] || 'Usuário',
        learnedPatterns,
      },
      history: [],
      createdAt: newDbSession.createdAt,
      updatedAt: newDbSession.updatedAt,
    };
    
    sessions.set(sessionKey, session);
    log.info(`Nova sessão do chatbot criada: ${sessionKey}`);
    
    return session;
  }
  
  /**
   * Salvar sessão no banco (chamado após cada mensagem)
   */
  async saveSession(session: ChatSession): Promise<void> {
    try {
      const { learnedPatterns, ...contextWithoutPatterns } = session.context;
      
      await prisma.chatSession.update({
        where: { id: session.id },
        data: {
          state: session.state,
          context: JSON.stringify(contextWithoutPatterns),
          learnedPatterns: JSON.stringify(learnedPatterns || []),
          lastActiveAt: new Date(),
          updatedAt: new Date(),
        }
      });
    } catch (error) {
      log.error('Erro ao salvar sessão do chatbot:', error);
    }
  }
  
  /**
   * Salvar mensagem no histórico do banco
   */
  async saveMessage(
    sessionId: string, 
    role: 'user' | 'assistant', 
    content: string,
    options?: string[],
    quickReplies?: string[]
  ): Promise<void> {
    try {
      await prisma.chatMessage.create({
        data: {
          sessionId,
          role,
          content,
          options: options ? JSON.stringify(options) : null,
          quickReplies: quickReplies ? JSON.stringify(quickReplies) : null,
        }
      });
    } catch (error) {
      log.error('Erro ao salvar mensagem do chatbot:', error);
    }
  }
  
  /**
   * Carregar padrões aprendidos do banco
   */
  async loadLearnedPatterns(tenantId: string): Promise<LearnedPattern[]> {
    // Buscar transações dos últimos 6 meses agrupadas por descrição
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        deletedAt: null,
        description: { not: null },
        transactionDate: { gte: sixMonthsAgo },
      },
      select: {
        description: true,
        categoryId: true,
        category: { select: { name: true } },
        paymentMethodId: true,
        amount: true,
        transactionDate: true,
      },
      orderBy: { transactionDate: 'desc' },
    });
    
    // Agrupar por descrição normalizada
    const patternMap = new Map<string, LearnedPattern>();
    
    for (const tx of transactions) {
      if (!tx.description || !tx.categoryId) continue;
      
      const normalized = tx.description.toLowerCase().trim();
      const keywords = extractKeywords(tx.description);
      
      const existing = patternMap.get(normalized);
      
      if (existing) {
        existing.count++;
        existing.averageAmount = ((existing.averageAmount || 0) * (existing.count - 1) + Number(tx.amount)) / existing.count;
        if (tx.transactionDate > existing.lastUsed) {
          existing.lastUsed = tx.transactionDate;
          existing.paymentMethodId = tx.paymentMethodId || existing.paymentMethodId;
        }
      } else {
        patternMap.set(normalized, {
          description: normalized,
          keywords,
          categoryId: tx.categoryId,
          categoryName: tx.category?.name || '',
          paymentMethodId: tx.paymentMethodId || undefined,
          averageAmount: Number(tx.amount),
          count: 1,
          lastUsed: tx.transactionDate,
        });
      }
    }
    
    // Retornar ordenado por frequência
    return Array.from(patternMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 100); // Máximo 100 padrões
  }
  
  /**
   * Encontrar categoria sugerida baseada na descrição
   */
  findSuggestedCategory(description: string, patterns: LearnedPattern[]): LearnedPattern | null {
    if (!description || !patterns.length) return null;
    
    const inputKeywords = extractKeywords(description);
    const normalized = description.toLowerCase().trim();
    
    // Match exato primeiro
    const exactMatch = patterns.find(p => p.description === normalized);
    if (exactMatch) return exactMatch;
    
    // Match por similaridade de keywords
    let bestMatch: LearnedPattern | null = null;
    let bestScore = 0;
    
    for (const pattern of patterns) {
      const similarity = calculateSimilarity(inputKeywords, pattern.keywords);
      const frequencyBonus = Math.min(pattern.count / 10, 0.3); // Max 30% bonus
      const score = similarity + frequencyBonus;
      
      if (score > bestScore && similarity >= 0.5) { // Mínimo 50% similaridade
        bestScore = score;
        bestMatch = pattern;
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Encontrar sugestão de categoria baseada no mapa de palavras-chave
   * Retorna a sugestão mais relevante para a descrição fornecida
   */
  findCategorySuggestionFromMap(description: string): CategorySuggestion | null {
    if (!description) return null;
    
    const normalized = description
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .trim();
    
    let bestSuggestion: CategorySuggestion | null = null;
    let bestMatchCount = 0;
    
    for (const suggestion of CATEGORY_SUGGESTIONS) {
      let matchCount = 0;
      
      for (const keyword of suggestion.keywords) {
        const keywordNormalized = keyword
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        
        if (normalized.includes(keywordNormalized)) {
          matchCount++;
        }
      }
      
      // Priorizar por quantidade de matches e depois por confiança
      const confidenceBonus = suggestion.confidence === 'high' ? 1 : suggestion.confidence === 'medium' ? 0.5 : 0;
      const score = matchCount + confidenceBonus;
      
      if (matchCount > 0 && score > bestMatchCount + (bestSuggestion?.confidence === 'high' ? 1 : 0)) {
        bestMatchCount = matchCount;
        bestSuggestion = suggestion;
      }
    }
    
    return bestSuggestion;
  }
  
  /**
   * Buscar categoria pelo nome no banco de dados
   */
  async findCategoryByName(tenantId: string, categoryName: string, subcategoryName?: string, type: 'income' | 'expense' = 'expense'): Promise<{ category: any; subcategory?: any } | null> {
    try {
      // Normalizar para busca
      const normalizedCatName = categoryName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      
      // Buscar categorias L1 do usuário
      const categories = await prisma.category.findMany({
        where: {
          tenantId,
          level: 1,
          type,
          isActive: true,
          deletedAt: null,
        },
        include: {
          children: {
            where: {
              isActive: true,
              deletedAt: null,
            },
          },
        },
      });
      
      // Encontrar a categoria principal
      const category = categories.find(c => {
        const catNormalized = c.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/^[\W\s]+/, ''); // Remove emojis do início
        return catNormalized.includes(normalizedCatName) || normalizedCatName.includes(catNormalized);
      });
      
      if (!category) return null;
      
      // Se tem subcategoria, tentar encontrar
      if (subcategoryName && category.children.length > 0) {
        const normalizedSubName = subcategoryName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        
        const subcategory = category.children.find(s => {
          const subNormalized = s.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/^[\W\s]+/, '');
          return subNormalized.includes(normalizedSubName) || normalizedSubName.includes(subNormalized);
        });
        
        if (subcategory) {
          return { category, subcategory };
        }
      }
      
      return { category };
    } catch (error) {
      log.error('Erro ao buscar categoria por nome:', error);
      return null;
    }
  }
  
  /**
   * Processar mensagem do usuário
   */
  async processMessage(
    tenantId: string, 
    userId: string, 
    message: string
  ): Promise<{ response: string; options?: string[]; quickReplies?: string[] }> {
    const session = await this.getOrCreateSession(tenantId, userId);
    const input = message.trim();
    
    // Adicionar mensagem do usuário ao histórico
    session.history.push({
      role: 'user',
      content: input,
      timestamp: new Date(),
    });
    
    let result: { response: string; options?: string[]; quickReplies?: string[] };
    
    // Processar baseado no estado atual
    switch (session.state) {
      // ========== ONBOARDING ==========
      case ChatState.ONBOARDING_WELCOME:
        result = this.handleOnboardingWelcome(session);
        break;
        
      case ChatState.ONBOARDING_NAME:
        result = this.handleOnboardingName(session, input);
        break;
        
      case ChatState.ONBOARDING_PROFILE:
        result = this.handleOnboardingProfile(session, input);
        break;
        
      case ChatState.ONBOARDING_YEAR:
        result = this.handleOnboardingYear(session, input);
        break;
        
      case ChatState.ONBOARDING_ACCOUNTS:
        result = await this.handleOnboardingAccounts(session, input);
        break;
        
      case ChatState.ONBOARDING_ACCOUNTS_PF_PJ:
        result = this.handleOnboardingAccountsPfPj(session, input);
        break;
        
      case ChatState.ONBOARDING_ACCOUNTS_BALANCE:
        result = await this.handleOnboardingAccountsBalance(session, input);
        break;
        
      case ChatState.ONBOARDING_ACCOUNTS_MORE:
        result = await this.handleOnboardingAccountsMore(session, input);
        break;
        
      case ChatState.ONBOARDING_INCOME:
        result = await this.handleOnboardingIncome(session, input);
        break;
        
      case ChatState.ONBOARDING_INCOME_TYPE:
        result = this.handleOnboardingIncomeType(session, input);
        break;
        
      case ChatState.ONBOARDING_INCOME_AMOUNT:
        result = this.handleOnboardingIncomeAmount(session, input);
        break;
        
      case ChatState.ONBOARDING_INCOME_DAY:
        result = await this.handleOnboardingIncomeDay(session, input);
        break;
        
      case ChatState.ONBOARDING_INCOME_OCCURRENCES:
        result = await this.handleOnboardingIncomeOccurrences(session, input);
        break;
        
      case ChatState.ONBOARDING_INCOME_ACCOUNT:
        result = await this.handleOnboardingIncomeAccount(session, input);
        break;
        
      case ChatState.ONBOARDING_INCOME_MORE:
        result = await this.handleOnboardingIncomeMore(session, input);
        break;
        
      case ChatState.ONBOARDING_EXPENSES:
        result = await this.handleOnboardingExpenses(session, input);
        break;
        
      case ChatState.ONBOARDING_EXPENSE_AMOUNT:
        result = await this.handleOnboardingExpenseAmount(session, input);
        break;
        
      case ChatState.ONBOARDING_EXPENSE_DAY:
        result = await this.handleOnboardingExpenseDay(session, input);
        break;
        
      case ChatState.ONBOARDING_EXPENSE_OCCURRENCES:
        result = await this.handleOnboardingExpenseOccurrences(session, input);
        break;
        
      case ChatState.ONBOARDING_EXPENSE_ACCOUNT:
        result = await this.handleOnboardingExpenseAccount(session, input);
        break;
        
      case ChatState.ONBOARDING_EXPENSE_PAYMENT:
        result = await this.handleOnboardingExpensePayment(session, input);
        break;
        
      case ChatState.ONBOARDING_EXPENSE_MORE:
        result = await this.handleOnboardingExpenseMore(session, input);
        break;
        
      // ========== ASSISTÊNCIA DIÁRIA ==========
      case ChatState.IDLE:
        result = await this.handleIdle(session, input);
        break;
        
      case ChatState.ADDING_EXPENSE:
      case ChatState.ADDING_INCOME:
        result = await this.handleAddingTransaction(session, input);
        break;
        
      case ChatState.ASKING_CATEGORY:
        result = await this.handleAskingCategory(session, input);
        break;
        
      case ChatState.ASKING_SUBCATEGORY:
        result = await this.handleAskingSubcategory(session, input);
        break;
        
      case ChatState.CONFIRMING_SUGGESTION:
        result = await this.handleConfirmingSuggestion(session, input);
        break;
        
      case ChatState.ASKING_ACCOUNT:
        result = await this.handleAskingAccount(session, input);
        break;
        
      case ChatState.ASKING_PAYMENT_METHOD:
        result = await this.handleAskingPaymentMethod(session, input);
        break;
        
      case ChatState.ASKING_AMOUNT:
        result = await this.handleAskingAmount(session, input);
        break;
        
      case ChatState.ASKING_DESCRIPTION:
        result = await this.handleAskingDescription(session, input);
        break;
        
      case ChatState.CONFIRMING:
        result = await this.handleConfirming(session, input);
        break;
        
      default:
        result = { 
          response: FRIENDLY_ERRORS.genericError,
          quickReplies: ['Ajuda', 'Novo gasto', 'Meu saldo']
        };
    }
    
    // Adicionar resposta ao histórico
    session.history.push({
      role: 'assistant',
      content: result.response,
      timestamp: new Date(),
      options: result.options,
      quickReplies: result.quickReplies,
    });
    
    session.updatedAt = new Date();
    
    // Salvar no banco de dados
    await this.saveMessage(session.id, 'user', input);
    await this.saveMessage(session.id, 'assistant', result.response, result.options, result.quickReplies);
    await this.saveSession(session);
    
    return result;
  }
  
  // ==================== HANDLERS DE ONBOARDING ====================
  
  private handleOnboardingWelcome(session: ChatSession) {
    session.state = ChatState.ONBOARDING_NAME;
    return {
      response: `Olá! 👋 Eu sou a **Isis**, sua assistente financeira!\n\nVou te ajudar a organizar suas finanças de forma simples e rápida.\n\nPara começar, como posso te chamar?`,
    };
  }
  
  private handleOnboardingName(session: ChatSession, input: string) {
    // Palavras reservadas que não podem ser usadas como nome
    const reservedWords = ['menu', 'ajuda', 'help', 'sair', 'voltar', 'cancelar', 'sim', 'não', 'nao', 'ok', 'oi', 'olá', 'ola'];
    const normalized = input.toLowerCase().trim();
    
    if (reservedWords.includes(normalized)) {
      return {
        response: `"${input}" parece ser um comando, não um nome 😅\n\nPor favor, me diga seu **nome real** para eu te chamar!`,
      };
    }
    
    if (input.length < 2) {
      return {
        response: 'Por favor, me diga seu nome (mínimo 2 caracteres) 😊',
      };
    }
    
    // Extrair primeiro nome
    const firstName = input.split(' ')[0];
    const capitalizedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    
    session.context.userName = capitalizedName;
    session.state = ChatState.ONBOARDING_PROFILE;
    
    return {
      response: `Prazer em te conhecer, **${capitalizedName}**! 😊\n\nVocê vai usar o UTOP para finanças pessoais ou familiares?`,
      options: ['1️⃣ Pessoal (só eu)', '2️⃣ Familiar (casal/família)'],
      quickReplies: ['Pessoal', 'Familiar'],
    };
  }
  
  private handleOnboardingProfile(session: ChatSession, input: string) {
    const normalized = input.toLowerCase();
    
    if (normalized.includes('1') || normalized.includes('pessoal') || normalized.includes('eu')) {
      session.context.profileType = 'personal';
    } else if (normalized.includes('2') || normalized.includes('famil')) {
      session.context.profileType = 'family';
    } else {
      return {
        response: 'Por favor, escolha:\n\n1️⃣ Pessoal\n2️⃣ Familiar',
        quickReplies: ['Pessoal', 'Familiar'],
      };
    }
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    // Se estivermos em Nov/Dez, perguntar qual ano planejar
    if (currentMonth >= 11) {
      session.state = ChatState.ONBOARDING_YEAR;
      const monthName = currentMonth === 11 ? 'novembro' : 'dezembro';
      return {
        response: `Perfeito! Como estamos em ${monthName}, você quer planejar qual ano?`,
        options: [`1️⃣ ${currentYear} (terminar este ano)`, `2️⃣ ${currentYear + 1} (começar do zero)`],
        quickReplies: [`${currentYear}`, `${currentYear + 1}`],
      };
    }
    
    session.context.planningYear = currentYear;
    session.state = ChatState.ONBOARDING_ACCOUNTS;
    
    return {
      response: `Ótimo! Agora vamos cadastrar suas **contas bancárias** 🏦\n\nQual é seu banco principal?\n\n_(ex: Nubank, Inter, Bradesco, Itaú, Caixa, Santander...)_`,
    };
  }
  
  private handleOnboardingYear(session: ChatSession, input: string) {
    const currentYear = new Date().getFullYear();
    const normalized = input.toLowerCase();
    
    if (normalized.includes('1') || normalized.includes(String(currentYear))) {
      session.context.planningYear = currentYear;
    } else if (normalized.includes('2') || normalized.includes(String(currentYear + 1))) {
      session.context.planningYear = currentYear + 1;
    } else {
      return {
        response: `Por favor, escolha:\n\n1️⃣ ${currentYear}\n2️⃣ ${currentYear + 1}`,
        quickReplies: [`${currentYear}`, `${currentYear + 1}`],
      };
    }
    
    session.state = ChatState.ONBOARDING_ACCOUNTS;
    
    return {
      response: `Vamos planejar **${session.context.planningYear}**! 📅\n\nAgora me conta: qual é seu banco principal?\n\n_(ex: Nubank, Inter, Bradesco, Itaú...)_`,
    };
  }
  
  private async handleOnboardingAccounts(session: ChatSession, input: string) {
    // Capitalizar nome do banco (primeira letra maiúscula)
    const bankName = input.trim().split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Guardar nome do banco
    session.context.tempAccount = {
      institution: bankName,
    };
    
    session.state = ChatState.ONBOARDING_ACCOUNTS_PF_PJ;
    
    return {
      response: `**${bankName}**, ótima escolha! 👍\n\nEssa conta é PF (Pessoa Física) ou PJ (CNPJ)?`,
      options: ['1️⃣ PF (Pessoa Física)', '2️⃣ PJ (CNPJ)'],
      quickReplies: ['PF', 'PJ'],
    };
  }
  
  private handleOnboardingAccountsPfPj(session: ChatSession, input: string) {
    const normalized = input.toLowerCase();
    
    if (normalized.includes('2') || normalized.includes('pj') || normalized.includes('cnpj')) {
      session.context.tempAccount!.type = 'PJ';
    } else {
      session.context.tempAccount!.type = 'PF';
    }
    
    session.state = ChatState.ONBOARDING_ACCOUNTS_BALANCE;
    
    return {
      response: `Qual o **saldo atual** dessa conta?\n\n_(pode ser aproximado, ex: 5000 ou 5.000,00)_`,
    };
  }
  
  private async handleOnboardingAccountsBalance(session: ChatSession, input: string) {
    const value = parseMoneyValue(input);
    
    if (value === null) {
      return {
        response: 'Não entendi o valor. Por favor, digite apenas números.\n\nExemplos: 5000, 5.000,00, R$ 5000',
      };
    }
    
    session.context.tempAccount!.balance = value;
    
    // Criar a conta no banco
    const account = await prisma.bankAccount.create({
      data: {
        tenantId: session.tenantId,
        name: `${session.context.tempAccount!.institution} ${session.context.tempAccount!.type}`,
        type: 'bank',
        institution: session.context.tempAccount!.institution,
        currentBalance: value,
        initialBalance: value,
        isActive: true,
      },
    });
    
    // Adicionar à lista
    if (!session.context.bankAccounts) {
      session.context.bankAccounts = [];
    }
    session.context.bankAccounts.push(account);
    
    session.state = ChatState.ONBOARDING_ACCOUNTS_MORE;
    
    return {
      response: `✅ Conta cadastrada!\n\n🏦 **${account.name}**\n💰 Saldo: R$ ${formatMoney(value)}\n\nTem mais alguma conta bancária?`,
      quickReplies: ['Sim', 'Não'],
    };
  }
  
  private async handleOnboardingAccountsMore(session: ChatSession, input: string) {
    // Se veio do fluxo de despesa, retornar para continuar criando a despesa
    if ((session.context as any).returningToExpense) {
      // Usar a última conta criada
      const lastAccount = session.context.bankAccounts?.[session.context.bankAccounts.length - 1];
      if (lastAccount) {
        (session.context.tempExpense as any).accountId = lastAccount.id;
        (session.context.tempExpense as any).accountName = lastAccount.bankName;
      }
      
      // Limpar flag
      delete (session.context as any).returningToExpense;
      
      // Continuar para perguntar meio de pagamento
      return this.askPaymentMethod(session);
    }
    
    if (isPositive(input)) {
      session.state = ChatState.ONBOARDING_ACCOUNTS;
      session.context.tempAccount = {};
      return {
        response: 'Qual o próximo banco?',
      };
    }
    
    // Avançar para cadastro de receitas fixas
    const totalBalance = session.context.bankAccounts?.reduce(
      (sum, acc) => sum + Number(acc.currentBalance), 0
    ) || 0;
    
    session.state = ChatState.ONBOARDING_INCOME;
    
    return {
      response: `✅ **Contas cadastradas!**\n\n` +
        `🏦 ${session.context.bankAccounts?.length || 0} conta(s)\n` +
        `💰 Saldo total: R$ ${formatMoney(totalBalance)}\n\n` +
        `Agora vamos cadastrar suas **receitas fixas** 💵\n\n` +
        `Você tem alguma renda fixa mensal? (salário, aluguel recebido, pensão...)`,
      quickReplies: ['Sim', 'Não'],
    };
  }
  
  private async handleOnboardingIncome(session: ChatSession, input: string) {
    if (isNegative(input)) {
      // Pular para despesas fixas
      session.state = ChatState.ONBOARDING_EXPENSES;
      return {
        response: `Tudo bem! 👍\n\nE você tem **despesas fixas** mensais?\n\n_(aluguel, internet, luz, água, streaming...)_`,
        quickReplies: ['Sim', 'Não'],
      };
    }
    
    if (isPositive(input)) {
      session.state = ChatState.ONBOARDING_INCOME_TYPE;
      return {
        response: `Qual é a principal fonte de renda?`,
        options: ['1️⃣ Salário CLT', '2️⃣ Pró-labore', '3️⃣ Freelance', '4️⃣ Aluguel recebido', '5️⃣ Aposentadoria', '6️⃣ Outro'],
        quickReplies: ['Salário', 'Pró-labore', 'Freelance', 'Outro'],
      };
    }
    
    return {
      response: 'Você tem alguma renda fixa mensal?',
      quickReplies: ['Sim', 'Não'],
    };
  }
  
  private handleOnboardingIncomeType(session: ChatSession, input: string) {
    const normalized = input.toLowerCase();
    let source = 'Salário';
    let isFixed = true;
    
    if (normalized.includes('1') || normalized.includes('salário') || normalized.includes('salario') || normalized.includes('clt')) {
      source = 'Salário';
    } else if (normalized.includes('2') || normalized.includes('pró-labore') || normalized.includes('pro-labore') || normalized.includes('prolabore')) {
      source = 'Pró-labore';
    } else if (normalized.includes('3') || normalized.includes('freelance') || normalized.includes('freela')) {
      source = 'Freelance';
      isFixed = false;
    } else if (normalized.includes('4') || normalized.includes('aluguel')) {
      source = 'Aluguel Recebido';
    } else if (normalized.includes('5') || normalized.includes('aposentadoria') || normalized.includes('inss')) {
      source = 'Aposentadoria';
    } else {
      source = input.trim();
    }
    
    session.context.tempIncome = { source, isFixed };
    session.state = ChatState.ONBOARDING_INCOME_AMOUNT;
    
    return {
      response: `Qual o valor mensal de **${source}**?\n\n_(pode ser líquido ou bruto, ex: 5000)_`,
    };
  }
  
  private handleOnboardingIncomeAmount(session: ChatSession, input: string) {
    const amount = parseMoneyValue(input);
    
    if (amount === null || amount <= 0) {
      return {
        response: 'Não entendi o valor. Por favor, digite apenas números.\n\nExemplo: 5000',
      };
    }
    
    session.context.tempIncome!.amount = amount;
    session.state = ChatState.ONBOARDING_INCOME_DAY;
    
    return {
      response: `R$ ${formatMoney(amount)} 💰\n\nEm qual **dia do mês** você costuma receber?\n\n_(ex: 5, 10, 25)_`,
    };
  }
  
  private async handleOnboardingIncomeDay(session: ChatSession, input: string) {
    const day = parseInt(input);
    
    if (isNaN(day) || day < 1 || day > 31) {
      return {
        response: 'Por favor, digite um dia válido (1 a 31)',
      };
    }
    
    session.context.tempIncome!.dueDay = day;
    
    // Perguntar número de ocorrências
    session.state = ChatState.ONBOARDING_INCOME_OCCURRENCES;
    
    return {
      response: `📅 **Quantas vezes essa receita vai se repetir?**\n\n_(ex: 12 para 1 ano, 6 para 6 meses, ou "sempre" se não tem fim)_`,
      quickReplies: ['12', '6', '24', 'Sempre'],
    };
  }
  
  private async handleOnboardingIncomeOccurrences(session: ChatSession, input: string) {
    const normalized = input.toLowerCase().trim();
    
    // Se for "sempre", "infinito", "sem fim", não definir limite
    let totalOccurrences: number | undefined = undefined;
    
    if (normalized === 'sempre' || normalized === 'infinito' || normalized.includes('sem fim') || normalized.includes('indefinido')) {
      totalOccurrences = undefined;
    } else {
      const num = parseInt(input);
      if (!isNaN(num) && num >= 1 && num <= 120) {
        totalOccurrences = num;
      } else {
        return {
          response: 'Por favor, digite um número entre 1 e 120, ou "sempre" para repetir indefinidamente.',
          quickReplies: ['12', '6', '24', 'Sempre'],
        };
      }
    }
    
    (session.context.tempIncome as any).totalOccurrences = totalOccurrences;
    
    // Agora perguntar a conta
    session.state = ChatState.ONBOARDING_INCOME_ACCOUNT;
    
    const accounts = session.context.bankAccounts || [];
    
    if (accounts.length === 1) {
      // Só tem uma conta, usar ela
      return this.saveOnboardingIncome(session, accounts[0].id);
    }
    
    const options = accounts.map((a, i) => `${i + 1}️⃣ ${a.name}`);
    const quickReplies = accounts.slice(0, 4).map(a => a.name.split(' ')[0]);
    
    return {
      response: `Em qual conta cai esse dinheiro?`,
      options,
      quickReplies,
    };
  }
  
  private async handleOnboardingIncomeAccount(session: ChatSession, input: string) {
    const accounts = session.context.bankAccounts || [];
    const normalized = input.toLowerCase().trim();
    
    // Tentar encontrar por número
    const num = parseInt(normalized);
    if (!isNaN(num) && num >= 1 && num <= accounts.length) {
      return this.saveOnboardingIncome(session, accounts[num - 1].id);
    }
    
    // Tentar encontrar por nome
    const found = accounts.find(a => 
      a.name.toLowerCase().includes(normalized) ||
      a.institution?.toLowerCase().includes(normalized)
    );
    
    if (found) {
      return this.saveOnboardingIncome(session, found.id);
    }
    
    return {
      response: '🏦 Hmm, não encontrei essa conta. Tente digitar o número da lista:',
      options: accounts.map((a, i) => `${i + 1}️⃣ ${a.name}`),
    };
  }
  
  private async saveOnboardingIncome(session: ChatSession, accountId: string) {
    const income = session.context.tempIncome!;
    
    // Mapear fonte de renda para categoria
    const source = (income.source || '').toLowerCase();
    let categoryName = 'Salário'; // default
    
    if (source.includes('salário') || source.includes('salario') || source.includes('clt')) {
      categoryName = 'Salário';
    } else if (source.includes('pró-labore') || source.includes('pro-labore') || source.includes('prolabore')) {
      categoryName = 'Pró-labore';
    } else if (source.includes('freelance') || source.includes('autônomo') || source.includes('pj')) {
      categoryName = 'Freelance';
    } else if (source.includes('aluguel')) {
      categoryName = 'Aluguel Recebido';
    } else if (source.includes('aposentadoria') || source.includes('pensão')) {
      categoryName = 'Aposentadoria';
    } else if (source.includes('investimento') || source.includes('dividendo') || source.includes('rendimento')) {
      categoryName = 'Investimentos';
    }
    
    // Buscar categoria de receita pelo nome
    let category = await prisma.category.findFirst({
      where: {
        tenantId: session.tenantId,
        type: 'income',
        name: { contains: categoryName, mode: 'insensitive' },
        isActive: true,
        deletedAt: null,
      },
      orderBy: { level: 'desc' },
    });
    
    // Se não encontrar, buscar qualquer categoria de receita
    if (!category) {
      category = await prisma.category.findFirst({
        where: {
          tenantId: session.tenantId,
          type: 'income',
          level: 1,
          isActive: true,
          deletedAt: null,
        },
        orderBy: { name: 'asc' },
      });
    }
    
    // Calcular a data de vencimento
    const today = new Date();
    const dueDay = income.dueDay || 5;
    let dueMonth = today.getMonth();
    let dueYear = today.getFullYear();
    
    // Se o dia já passou neste mês, usar o próximo mês
    if (today.getDate() >= dueDay) {
      dueMonth++;
      if (dueMonth > 11) {
        dueMonth = 0;
        dueYear++;
      }
    }
    
    const lastDayOfMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
    const adjustedDay = Math.min(dueDay, lastDayOfMonth);
    const dueDate = new Date(dueYear, dueMonth, adjustedDay);
    
    // Buscar userId do tenant
    const tenantUser = await prisma.tenantUser.findFirst({
      where: { tenantId: session.tenantId },
    });
    
    if (!tenantUser) {
      throw new Error('Usuário não encontrado para o tenant');
    }
    
    // Usar o transactionService.createRecurring (igual ao formulário de Nova Transação)
    const totalOccurrences = (income as any).totalOccurrences;
    
    const transactionData = {
      type: 'income' as const,
      amount: income.amount!,
      description: income.source || 'Receita fixa',
      transactionDate: dueDate.toISOString().split('T')[0],
      categoryId: category?.id,
      bankAccountId: accountId,
      status: 'pending' as const,
      transactionType: 'recurring' as const,
      frequency: 'monthly' as const,
      frequencyInterval: 1,
      totalOccurrences: totalOccurrences || undefined,
    };
    
    log.info('Chatbot criando receita recorrente via transactionService', { transactionData, totalOccurrences });
    
    await transactionService.createRecurring(transactionData, tenantUser.userId, session.tenantId);
    
    const occurrencesText = totalOccurrences ? `${totalOccurrences}x` : 'sempre';
    
    session.state = ChatState.ONBOARDING_INCOME_MORE;
    
    let response = `✅ **Receita recorrente cadastrada!**\n\n`;
    response += `💵 **${income.source}**\n`;
    response += `💰 R$ ${formatMoney(income.amount!)} / mês\n`;
    response += `📅 Todo dia ${income.dueDay}\n`;
    response += `🔄 Repetição: ${occurrencesText}\n`;
    if (category) {
      response += `🏷️ Categoria: ${category.name}\n`;
    }
    response += `\n✨ Todas as ${totalOccurrences || 'futuras'} transações foram criadas!\n`;
    response += `\nTem mais alguma receita fixa?`;
    
    return {
      response,
      quickReplies: ['Sim', 'Não'],
    };
  }
  
  private async handleOnboardingIncomeMore(session: ChatSession, input: string) {
    if (isPositive(input)) {
      session.state = ChatState.ONBOARDING_INCOME_TYPE;
      session.context.tempIncome = {};
      return {
        response: 'Qual é a próxima fonte de renda?',
        options: ['1️⃣ Salário CLT', '2️⃣ Pró-labore', '3️⃣ Freelance', '4️⃣ Aluguel recebido', '5️⃣ Aposentadoria', '6️⃣ Outro'],
        quickReplies: ['Salário', 'Freelance', 'Outro'],
      };
    }
    
    // Avançar para despesas fixas
    session.state = ChatState.ONBOARDING_EXPENSES;
    
    return {
      response: `Ótimo! Agora vamos cadastrar suas **despesas fixas** 📋\n\nVocê tem contas que paga todo mês?\n\n_(aluguel, internet, luz, água, streaming, academia...)_`,
      quickReplies: ['Sim', 'Não'],
    };
  }
  
  private async handleOnboardingExpenses(session: ChatSession, input: string) {
    if (isNegative(input)) {
      // Finalizar onboarding
      return this.finishOnboarding(session);
    }
    
    if (isPositive(input)) {
      // Lista de despesas comuns para facilitar
      return {
        response: `Quais contas você tem? Me diga uma por uma 📝\n\nExemplos comuns:\n` +
          `• Aluguel\n` +
          `• Luz / Energia\n` +
          `• Água\n` +
          `• Internet\n` +
          `• Celular\n` +
          `• Netflix/Streaming\n` +
          `• Academia\n` +
          `• Plano de Saúde\n\n` +
          `Qual a primeira?`,
        quickReplies: ['Aluguel', 'Internet', 'Luz', 'Streaming'],
      };
    }
    
    // Usuário digitou o nome da despesa
    const expenseName = input.trim();
    
    // Capitalizar nome da despesa
    const capitalizedName = expenseName.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Inicializar tempExpense
    session.context.tempExpense = {
      description: capitalizedName,
    };
    
    session.state = ChatState.ONBOARDING_EXPENSE_AMOUNT;
    
    return {
      response: `Qual o valor mensal de **${capitalizedName}**?`,
    };
  }
  
  private async handleOnboardingExpenseAmount(session: ChatSession, input: string) {
    const amount = parseMoneyValue(input);
    
    if (amount === null || amount <= 0) {
      return {
        response: 'Não entendi o valor. Por favor, digite apenas números.\n\nExemplo: 150',
      };
    }
    
    session.context.tempExpense!.amount = amount;
    session.state = ChatState.ONBOARDING_EXPENSE_DAY;
    
    return {
      response: `R$ ${formatMoney(amount)}\n\nQual o **dia de vencimento**?\n\n_(ex: 10, 15, 20)_`,
    };
  }
  
  private async handleOnboardingExpenseDay(session: ChatSession, input: string) {
    const day = parseInt(input);
    
    if (isNaN(day) || day < 1 || day > 31) {
      return {
        response: 'Por favor, digite um dia válido (1 a 31)',
      };
    }
    
    session.context.tempExpense!.dueDay = day;
    
    // Perguntar número de ocorrências
    session.state = ChatState.ONBOARDING_EXPENSE_OCCURRENCES;
    
    return {
      response: `📅 **Quantas vezes essa despesa vai se repetir?**\n\n_(ex: 12 para 1 ano, 6 para 6 meses, ou "sempre" se não tem fim)_`,
      quickReplies: ['12', '6', '24', 'Sempre'],
    };
  }
  
  private async handleOnboardingExpenseOccurrences(session: ChatSession, input: string) {
    const normalized = input.toLowerCase().trim();
    
    // Se for "sempre", "infinito", "sem fim", não definir limite
    let totalOccurrences: number | undefined = undefined;
    
    if (normalized === 'sempre' || normalized === 'infinito' || normalized.includes('sem fim') || normalized.includes('indefinido')) {
      totalOccurrences = undefined; // Sem limite
    } else {
      const num = parseInt(input);
      if (!isNaN(num) && num >= 1 && num <= 120) {
        totalOccurrences = num;
      } else {
        return {
          response: 'Por favor, digite um número entre 1 e 120, ou "sempre" para repetir indefinidamente.',
          quickReplies: ['12', '6', '24', 'Sempre'],
        };
      }
    }
    
    (session.context.tempExpense as any).totalOccurrences = totalOccurrences;
    
    // Buscar contas bancárias do usuário
    const accounts = await prisma.bankAccount.findMany({
      where: {
        tenantId: session.tenantId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });
    
    // Guardar no contexto para uso posterior
    session.context.bankAccounts = accounts;
    
    if (accounts.length === 0) {
      // Sem contas, perguntar qual banco para criar
      session.state = ChatState.ONBOARDING_ACCOUNTS;
      (session.context as any).returningToExpense = true;
      return {
        response: `🏦 Você ainda não tem uma conta bancária cadastrada.\n\nQual é seu banco principal?\n\n_(ex: Nubank, Inter, Bradesco, Itaú...)_`,
      };
    }
    
    if (accounts.length === 1) {
      // Só uma conta, usar ela automaticamente
      (session.context.tempExpense as any).accountId = accounts[0].id;
      (session.context.tempExpense as any).accountName = accounts[0].name;
      return this.askPaymentMethod(session);
    }
    
    // Múltiplas contas, perguntar qual
    session.state = ChatState.ONBOARDING_EXPENSE_ACCOUNT;
    
    const options = accounts.map((a, i) => `${i + 1}️⃣ ${a.name}`);
    const quickReplies = accounts.slice(0, 4).map(a => a.name.split(' ')[0]);
    
    return {
      response: `🏦 **Qual conta será usada para pagar essa despesa?**`,
      options,
      quickReplies,
    };
  }
  
  private async handleOnboardingExpenseAccount(session: ChatSession, input: string) {
    const accounts = session.context.bankAccounts || [];
    const normalized = input.toLowerCase().trim();
    
    // Tentar encontrar por número
    const num = parseInt(normalized);
    if (!isNaN(num) && num >= 1 && num <= accounts.length) {
      (session.context.tempExpense as any).accountId = accounts[num - 1].id;
      (session.context.tempExpense as any).accountName = accounts[num - 1].name;
      return this.askPaymentMethod(session);
    }
    
    // Tentar encontrar por nome
    const found = accounts.find((a: any) => 
      a.name.toLowerCase().includes(normalized) ||
      a.institution?.toLowerCase().includes(normalized)
    );
    
    if (found) {
      (session.context.tempExpense as any).accountId = found.id;
      (session.context.tempExpense as any).accountName = found.name;
      return this.askPaymentMethod(session);
    }
    
    return {
      response: '🏦 Hmm, não encontrei essa conta. Tente digitar o número da lista:',
      options: accounts.map((a: any, i: number) => `${i + 1}️⃣ ${a.name}`),
    };
  }
  
  private async askPaymentMethod(session: ChatSession) {
    // Sempre perguntar o meio de pagamento (vamos criar se não existir)
    const options = [
      '1️⃣ Boleto',
      '2️⃣ Débito Automático',
      '3️⃣ PIX',
      '4️⃣ Cartão de Crédito',
      '5️⃣ Dinheiro',
    ];
    
    session.state = ChatState.ONBOARDING_EXPENSE_PAYMENT;
    
    return {
      response: `💳 **Como você paga essa conta?**`,
      options,
      quickReplies: ['Boleto', 'Débito', 'PIX', 'Cartão'],
    };
  }
  
  private async handleOnboardingExpensePayment(session: ChatSession, input: string) {
    const normalized = input.toLowerCase().trim();
    
    // Mapear resposta para tipo de pagamento
    let paymentType = 'boleto';
    let paymentName = 'Boleto';
    
    if (normalized.includes('1') || normalized.includes('boleto')) {
      paymentType = 'boleto';
      paymentName = 'Boleto';
    } else if (normalized.includes('2') || normalized.includes('débito') || normalized.includes('debito') || normalized.includes('automático') || normalized.includes('automatico')) {
      paymentType = 'automatic_debit';
      paymentName = 'Débito Automático';
    } else if (normalized.includes('3') || normalized.includes('pix')) {
      paymentType = 'pix';
      paymentName = 'PIX';
    } else if (normalized.includes('4') || normalized.includes('cartão') || normalized.includes('cartao') || normalized.includes('crédito') || normalized.includes('credito')) {
      paymentType = 'credit_card';
      paymentName = 'Cartão de Crédito';
    } else if (normalized.includes('5') || normalized.includes('dinheiro') || normalized.includes('cash')) {
      paymentType = 'cash';
      paymentName = 'Dinheiro';
    }
    
    // Buscar meio de pagamento existente
    let paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        tenantId: session.tenantId,
        type: paymentType,
        isActive: true,
        deletedAt: null,
      },
    });
    
    // Se não existir, criar automaticamente
    if (!paymentMethod) {
      paymentMethod = await prisma.paymentMethod.create({
        data: {
          tenantId: session.tenantId,
          name: paymentName,
          type: paymentType,
          isActive: true,
        },
      });
      log.info(`Meio de pagamento "${paymentName}" criado automaticamente pelo chatbot`);
    }
    
    (session.context.tempExpense as any).paymentMethodId = paymentMethod.id;
    (session.context.tempExpense as any).paymentMethodName = paymentName;
    
    return this.saveExpenseAndAskMore(session);
  }
  
  private async saveExpenseAndAskMore(session: ChatSession) {
    const expense = session.context.tempExpense!;
    
    // Mapear descrição para categoria correta
    const description = (expense.description || '').toLowerCase();
    let categoryName = 'Moradia'; // default
    
    // Mapeamento de palavras-chave para categorias
    if (description.includes('internet') || description.includes('wifi') || description.includes('fibra')) {
      categoryName = 'Internet';
    } else if (description.includes('luz') || description.includes('energia') || description.includes('enel') || description.includes('light')) {
      categoryName = 'Luz';
    } else if (description.includes('água') || description.includes('sanepar') || description.includes('sabesp') || description.includes('cedae')) {
      categoryName = 'Água';
    } else if (description.includes('aluguel') || description.includes('renda') || description.includes('moradia')) {
      categoryName = 'Aluguel';
    } else if (description.includes('netflix') || description.includes('spotify') || description.includes('prime') || description.includes('streaming') || description.includes('disney') || description.includes('hbo') || description.includes('youtube')) {
      categoryName = 'Streaming';
    } else if (description.includes('telefone') || description.includes('celular') || description.includes('vivo') || description.includes('claro') || description.includes('tim') || description.includes('oi')) {
      categoryName = 'Telefone';
    } else if (description.includes('seguro')) {
      categoryName = 'Seguros';
    } else if (description.includes('condomínio') || description.includes('condominio')) {
      categoryName = 'Condomínio';
    } else if (description.includes('gás') || description.includes('gas')) {
      categoryName = 'Gás';
    } else if (description.includes('iptu') || description.includes('ipva')) {
      categoryName = 'Impostos';
    } else if (description.includes('escola') || description.includes('faculdade') || description.includes('curso') || description.includes('educação')) {
      categoryName = 'Educação';
    } else if (description.includes('plano') && (description.includes('saúde') || description.includes('saude'))) {
      categoryName = 'Saúde';
    } else if (description.includes('academia') || description.includes('gym') || description.includes('fitness')) {
      categoryName = 'Academia';
    }
    
    // Buscar categoria pelo nome (level 2 primeiro, depois level 1)
    let category = await prisma.category.findFirst({
      where: {
        tenantId: session.tenantId,
        type: 'expense',
        name: { contains: categoryName, mode: 'insensitive' },
        isActive: true,
        deletedAt: null,
      },
      orderBy: { level: 'desc' }, // Prioriza level 2
    });
    
    // Se não encontrar, buscar qualquer categoria de despesa
    if (!category) {
      category = await prisma.category.findFirst({
        where: {
          tenantId: session.tenantId,
          type: 'expense',
          level: 1,
          isActive: true,
          deletedAt: null,
        },
        orderBy: { name: 'asc' },
      });
    }
    
    // Calcular a data de vencimento (próximo mês com o dia informado)
    const today = new Date();
    const dueDay = expense.dueDay || 1;
    let dueMonth = today.getMonth();
    let dueYear = today.getFullYear();
    
    // Se o dia já passou neste mês, usar o próximo mês
    if (today.getDate() >= dueDay) {
      dueMonth++;
      if (dueMonth > 11) {
        dueMonth = 0;
        dueYear++;
      }
    }
    
    // Ajustar para meses com menos dias
    const lastDayOfMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
    const adjustedDay = Math.min(dueDay, lastDayOfMonth);
    const dueDate = new Date(dueYear, dueMonth, adjustedDay);
    
    // Buscar userId do tenant (via TenantUser)
    const tenantUser = await prisma.tenantUser.findFirst({
      where: { tenantId: session.tenantId },
      include: { user: true },
    });
    
    if (!tenantUser) {
      throw new Error('Usuário não encontrado para o tenant');
    }
    
    // Usar o transactionService.createRecurring (igual ao formulário de Nova Transação)
    const totalOccurrences = (expense as any).totalOccurrences;
    
    const transactionData = {
      type: 'expense' as const,
      amount: expense.amount!,
      description: expense.description || 'Despesa fixa',
      transactionDate: dueDate.toISOString().split('T')[0], // formato YYYY-MM-DD
      categoryId: category?.id,
      bankAccountId: (expense as any).accountId || undefined,
      paymentMethodId: (expense as any).paymentMethodId || undefined,
      status: 'pending' as const,
      transactionType: 'recurring' as const,
      frequency: 'monthly' as const,
      frequencyInterval: 1,
      totalOccurrences: totalOccurrences || undefined, // undefined = infinito
    };
    
    log.info('Chatbot criando despesa recorrente via transactionService', { transactionData, totalOccurrences });
    
    await transactionService.createRecurring(transactionData, tenantUser.userId, session.tenantId);
    
    // Buscar nomes para exibição
    const accountName = (expense as any).accountName || null;
    const paymentMethodName = (expense as any).paymentMethodName || null;
    const occurrencesText = totalOccurrences ? `${totalOccurrences}x` : 'sempre';
    
    session.context.tempExpense = {};
    session.state = ChatState.ONBOARDING_EXPENSE_MORE;
    
    let response = `✅ **Despesa recorrente cadastrada!**\n\n`;
    response += `📋 **${expense.description}**\n`;
    response += `💰 R$ ${formatMoney(expense.amount!)} / mês\n`;
    response += `📅 Vencimento: dia ${expense.dueDay}\n`;
    response += `🔄 Repetição: ${occurrencesText}\n`;
    if (category) {
      response += `🏷️ Categoria: ${category.name}\n`;
    }
    if (accountName) {
      response += `🏦 Conta: ${accountName}\n`;
    }
    if (paymentMethodName) {
      response += `💳 Pagamento: ${paymentMethodName}\n`;
    }
    response += `\n✨ Todas as ${totalOccurrences || 'futuras'} transações foram criadas!\n`;
    response += `\nTem mais alguma despesa fixa?`;
    
    return {
      response,
      quickReplies: ['Sim', 'Não'],
    };
  }
  
  private async handleOnboardingExpenseMore(session: ChatSession, input: string) {
    if (isPositive(input)) {
      session.state = ChatState.ONBOARDING_EXPENSES;
      session.context.tempExpense = {};
      return {
        response: 'Qual a próxima despesa fixa?',
        quickReplies: ['Aluguel', 'Internet', 'Luz', 'Streaming'],
      };
    }
    
    // Finalizar onboarding
    return this.finishOnboarding(session);
  }
  
  private async finishOnboarding(session: ChatSession) {
    const totalBalance = session.context.bankAccounts?.reduce(
      (sum, acc) => sum + Number(acc.currentBalance), 0
    ) || 0;
    
    // Contar receitas e despesas criadas
    const incomeCount = await prisma.recurringBill.count({
      where: {
        tenantId: session.tenantId,
        type: 'income',
      },
    });
    
    const expenseCount = await prisma.recurringBill.count({
      where: {
        tenantId: session.tenantId,
        type: 'expense',
      },
    });
    
    session.state = ChatState.IDLE;
    
    return {
      response: `🎉 **Configuração inicial concluída!**\n\n` +
        `📊 **Resumo:**\n` +
        `• 🏦 ${session.context.bankAccounts?.length || 0} conta(s) bancária(s)\n` +
        `• 💵 ${incomeCount} receita(s) fixa(s)\n` +
        `• 📋 ${expenseCount} despesa(s) fixa(s)\n` +
        `• 💰 Saldo total: R$ ${formatMoney(totalBalance)}\n\n` +
        `Agora você pode:\n` +
        `• Dizer "**gastei 50 no mercado**" para registrar gastos\n` +
        `• Dizer "**recebi 3000**" para registrar receitas\n` +
        `• Perguntar "**meu saldo**" para ver quanto tem\n` +
        `• Perguntar "**planejamento**" para visão geral do mês\n` +
        `• Dizer "**ajuda**" para ver todos os comandos\n\n` +
        `Como posso te ajudar, ${session.context.userName}? 😊`,
      quickReplies: ['Planejamento', 'Meu saldo', 'Novo gasto', 'Ajuda'],
    };
  }
  
  // ==================== HANDLERS DE ASSISTÊNCIA ====================
  
  private async handleIdle(session: ChatSession, input: string) {
    const normalized = input.toLowerCase().trim();
    
    // Comando Menu - mostrar todas as funcionalidades
    if (MENU_PATTERNS.test(normalized)) {
      return this.showMenu(session);
    }
    
    // Atalhos numéricos do menu
    if (normalized === '1' || normalized === '1️⃣') return this.queryPlanning(session);
    if (normalized === '2' || normalized === '2️⃣') return this.queryBalance(session);
    if (normalized === '3' || normalized === '3️⃣') return this.queryExpenses(session);
    if (normalized === '4' || normalized === '4️⃣') return this.queryBills(session);
    if (normalized === '5' || normalized === '5️⃣') {
      session.state = ChatState.ASKING_AMOUNT;
      session.context.tempTransaction = { type: 'expense' };
      return { response: '💸 Qual o valor da despesa?' };
    }
    if (normalized === '6' || normalized === '6️⃣') {
      session.state = ChatState.ASKING_AMOUNT;
      session.context.tempTransaction = { type: 'income' };
      return { response: '💵 Qual o valor da receita?' };
    }
    if (normalized === '7' || normalized === '7️⃣' || normalized.includes('minhas contas') || normalized.includes('meus bancos')) {
      return this.queryAccounts(session);
    }
    if (normalized === '8' || normalized === '8️⃣' || normalized.includes('receitas fixas') || normalized.includes('rendas fixas')) {
      return this.queryFixedIncomes(session);
    }
    if (normalized === '9' || normalized === '9️⃣' || normalized.includes('despesas fixas') || normalized.includes('contas fixas')) {
      return this.queryFixedExpenses(session);
    }
    if (normalized === '0' || normalized === '0️⃣') return this.showHelp(session);
    
    // Saudações - com sugestões contextuais por horário
    if (GREETING_PATTERNS.test(normalized)) {
      return this.greetWithInsights(session);
    }
    
    // Consulta de saldo
    if (BALANCE_PATTERNS.test(normalized)) {
      return this.queryBalance(session);
    }
    
    // Consulta de gastos
    if (EXPENSES_PATTERNS.test(normalized)) {
      return this.queryExpenses(session);
    }
    
    // Contas a vencer
    if (BILLS_PATTERNS.test(normalized)) {
      return this.queryBills(session);
    }
    
    // Planejamento do mês
    if (PLANNING_PATTERNS.test(normalized)) {
      if (normalized.includes('anual') || normalized.includes('ano') || normalized.includes('12 meses')) {
        return this.showAnnualPlanning(session);
      }
      return this.queryPlanning(session);
    }
    
    // Comando específico: planejamento anual
    if (normalized.includes('planejar ano') || normalized.includes('configurar ano') || normalized.includes('onboarding')) {
      return this.startAnnualPlanningFlow(session);
    }
    
    // Detectar gasto com padrões expandidos
    for (const pattern of EXPENSE_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        // Extrair valor (pode estar em diferentes grupos)
        let amount: number | null = null;
        let description = '';
        
        for (let i = 1; i <= match.length; i++) {
          if (match[i]) {
            const parsed = parseMoneyValue(match[i]);
            if (parsed) {
              amount = parsed;
            } else if (match[i].length > 2) {
              description = match[i].trim();
            }
          }
        }
        
        if (amount) {
          session.context.tempTransaction = { type: 'expense', amount };
          session.state = ChatState.ADDING_EXPENSE;
          
          // Tentar extrair descrição do resto do texto
          if (!description) {
            const descMatch = input.match(/(?:no|na|em|de|com|para)\s+(.+?)(?:\s+[\d,\.]+)?$/i);
            if (descMatch) {
              description = descMatch[1].trim();
            }
          }
          
          if (description) {
            session.context.tempTransaction.description = description;
            return this.suggestCategoryFromDescription(session);
          }
          
          return {
            response: `💸 Despesa de **R$ ${formatMoney(amount)}**\n\n📝 Onde você gastou / qual a descrição?`,
          };
        }
      }
    }
    
    // Detectar receita com padrões expandidos
    for (const pattern of INCOME_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        let amount: number | null = null;
        
        for (let i = 1; i <= match.length; i++) {
          if (match[i]) {
            const parsed = parseMoneyValue(match[i]);
            if (parsed) {
              amount = parsed;
              break;
            }
          }
        }
        
        if (amount) {
          session.context.tempTransaction = { type: 'income', amount };
          session.state = ChatState.ADDING_INCOME;
          
          return {
            response: `💵 Receita de **R$ ${formatMoney(amount)}**\n\n📝 Qual a origem dessa entrada?`,
            quickReplies: ['Salário', 'Freelance', 'Vendas', 'Transferência', 'Outros'],
          };
        }
      }
    }
    
    // Detectar valor isolado
    const moneyMatch = normalized.match(/^r?\$?\s*([\d,\.]+)$/);
    if (moneyMatch) {
      const amount = parseMoneyValue(moneyMatch[1]);
      if (amount) {
        session.context.tempTransaction = { amount };
        return {
          response: `Vi o valor **R$ ${formatMoney(amount)}**.\n\n🤔 Isso foi uma despesa ou receita?`,
          options: ['1️⃣ 💸 Despesa', '2️⃣ 💵 Receita'],
          quickReplies: ['Despesa', 'Receita'],
        };
      }
    }
    
    // Comando: novo gasto
    if (normalized.includes('novo gasto') || normalized.includes('nova despesa') || normalized.includes('adicionar gasto')) {
      session.state = ChatState.ASKING_AMOUNT;
      session.context.tempTransaction = { type: 'expense' };
      return {
        response: 'Qual o valor da despesa?',
      };
    }
    
    // Comando: nova receita
    if (normalized.includes('nova receita') || normalized.includes('adicionar receita')) {
      session.state = ChatState.ASKING_AMOUNT;
      session.context.tempTransaction = { type: 'income' };
      return {
        response: 'Qual o valor da receita?',
      };
    }
    
    // Comando: adicionar despesa fixa / receita fixa (recorrente)
    if (normalized.includes('despesa fixa') || normalized.includes('conta fixa') || normalized.includes('gasto fixo')) {
      session.state = ChatState.ONBOARDING_EXPENSES;
      return {
        response: `📋 **Nova Despesa Fixa**\n\nQual o nome dessa despesa?\n\n_(ex: Aluguel, Internet, Luz, Netflix...)_`,
      };
    }
    
    if (normalized.includes('receita fixa') || normalized.includes('renda fixa') || normalized.includes('salário fixo')) {
      session.state = ChatState.ONBOARDING_INCOME_TYPE;
      return {
        response: `💵 **Nova Receita Fixa**\n\nQual é a fonte de renda?`,
        options: ['1️⃣ Salário CLT', '2️⃣ Pró-labore', '3️⃣ Freelance', '4️⃣ Aluguel recebido', '5️⃣ Aposentadoria', '6️⃣ Outro'],
        quickReplies: ['Salário', 'Pró-labore', 'Freelance', 'Outro'],
      };
    }
    
    // Não entendeu
    return {
      response: `Não entendi "${input}".\n\nVocê pode:\n• Dizer "gastei 50 no mercado"\n• Dizer "recebi 3000"\n• Perguntar "meu saldo"\n• Dizer "ajuda" para mais opções`,
      quickReplies: ['Novo gasto', 'Nova receita', 'Meu saldo', 'Ajuda'],
    };
  }
  
  private async handleAddingTransaction(session: ChatSession, input: string) {
    // Se não tem descrição ainda
    if (!session.context.tempTransaction?.description) {
      session.context.tempTransaction!.description = input.trim();
      return this.suggestCategoryFromDescription(session);
    }
    
    return this.handleAskingCategory(session, input);
  }
  
  private async suggestCategoryFromDescription(session: ChatSession) {
    const description = session.context.tempTransaction?.description || '';
    const patterns = session.context.learnedPatterns || [];
    const type = session.context.tempTransaction?.type || 'expense';
    
    // 1. Primeiro, tentar encontrar padrão aprendido do histórico do usuário
    const learnedSuggestion = this.findSuggestedCategory(description, patterns);
    
    if (learnedSuggestion) {
      session.context.tempTransaction!.categoryId = learnedSuggestion.categoryId;
      session.context.tempTransaction!.categoryName = learnedSuggestion.categoryName;
      
      if (learnedSuggestion.paymentMethodId) {
        session.context.tempTransaction!.paymentMethodId = learnedSuggestion.paymentMethodId;
      }
      
      // Ir direto para perguntar conta
      return this.askAccountAfterCategory(session, learnedSuggestion.categoryName, learnedSuggestion.averageAmount);
    }
    
    // 2. Se não encontrou padrão aprendido, tentar sugestão do mapa de palavras-chave
    const mapSuggestion = this.findCategorySuggestionFromMap(description);
    
    if (mapSuggestion) {
      // Verificar se a categoria existe no banco do usuário
      const found = await this.findCategoryByName(
        session.tenantId, 
        mapSuggestion.categoryName, 
        mapSuggestion.subcategoryName,
        type
      );
      
      if (found) {
        // Guardar sugestão pendente e perguntar se está correta
        session.context.pendingSuggestion = {
          categoryName: mapSuggestion.categoryName,
          subcategoryName: mapSuggestion.subcategoryName,
          confidence: mapSuggestion.confidence,
        };
        
        // Preencher dados da categoria encontrada
        if (found.subcategory) {
          session.context.tempTransaction!.categoryId = found.subcategory.id;
          session.context.tempTransaction!.categoryName = `${found.category.name} > ${found.subcategory.name}`;
          session.context.tempTransaction!.subcategoryId = found.subcategory.id;
          session.context.tempTransaction!.subcategoryName = found.subcategory.name;
        } else {
          session.context.tempTransaction!.categoryId = found.category.id;
          session.context.tempTransaction!.categoryName = found.category.name;
        }
        
        session.state = ChatState.CONFIRMING_SUGGESTION;
        
        const amount = session.context.tempTransaction?.amount || 0;
        const catDisplay = found.subcategory 
          ? `${found.category.icon || '📁'} ${found.category.name} > ${found.subcategory.icon || ''} ${found.subcategory.name}`.trim()
          : `${found.category.icon || '📁'} ${found.category.name}`;
        
        const confidenceEmoji = mapSuggestion.confidence === 'high' ? '🎯' : mapSuggestion.confidence === 'medium' ? '💡' : '🤔';
        
        return {
          response: `${confidenceEmoji} **Sugestão de categoria**\n\n` +
            `📝 "${description}"\n` +
            `💰 R$ ${formatMoney(amount)}\n\n` +
            `Parece ser **${catDisplay}**, certo?\n`,
          quickReplies: ['Sim, confirmar', 'Escolher outra', 'Cancelar'],
        };
      }
    }
    
    // 3. Não encontrou nenhuma sugestão, perguntar categoria normalmente
    session.state = ChatState.ASKING_CATEGORY;
    return this.askCategory(session);
  }
  
  /**
   * Handler para confirmar sugestão de categoria
   */
  private async handleConfirmingSuggestion(session: ChatSession, input: string) {
    const normalized = input.toLowerCase().trim();
    
    // Usuário confirmou a sugestão
    if (isPositive(normalized) || normalized.includes('confirmar') || normalized.includes('correto') || normalized.includes('isso')) {
      // Categoria já está preenchida, ir para conta
      return this.askAccountAfterCategory(session, session.context.tempTransaction?.categoryName || '');
    }
    
    // Usuário quer escolher outra categoria
    if (normalized.includes('outra') || normalized.includes('escolher') || normalized.includes('mudar') || normalized.includes('trocar')) {
      session.context.tempTransaction!.categoryId = undefined;
      session.context.tempTransaction!.categoryName = undefined;
      session.context.tempTransaction!.subcategoryId = undefined;
      session.context.tempTransaction!.subcategoryName = undefined;
      session.context.pendingSuggestion = undefined;
      
      session.state = ChatState.ASKING_CATEGORY;
      return this.askCategory(session);
    }
    
    // Cancelar
    if (isNegative(normalized) || normalized.includes('cancelar') || normalized.includes('cancela')) {
      session.state = ChatState.IDLE;
      session.context.tempTransaction = undefined;
      session.context.pendingSuggestion = undefined;
      
      return {
        response: '❌ Lançamento cancelado.\n\nPosso ajudar em algo mais?',
        quickReplies: ['Novo gasto', 'Nova receita', 'Meu saldo'],
      };
    }
    
    // Não entendeu, repetir pergunta
    return {
      response: `Não entendi. A categoria sugerida está correta?`,
      quickReplies: ['Sim, confirmar', 'Escolher outra', 'Cancelar'],
    };
  }
  
  /**
   * Continuar para perguntar conta após ter categoria definida
   */
  private async askAccountAfterCategory(session: ChatSession, categoryName: string, averageAmount?: number) {
    const description = session.context.tempTransaction?.description || '';
    const amount = session.context.tempTransaction?.amount || 0;
    
    const avgInfo = averageAmount 
      ? `\n📊 _Média histórica: R$ ${formatMoney(averageAmount)}_`
      : '';
    
    // Carregar contas
    if (!session.context.bankAccounts) {
      session.context.bankAccounts = await prisma.bankAccount.findMany({
        where: {
          tenantId: session.tenantId,
          isActive: true,
          deletedAt: null,
        },
        orderBy: { name: 'asc' },
      });
    }
    
    const accounts = session.context.bankAccounts;
    session.state = ChatState.ASKING_ACCOUNT;
    
    // Se só tem uma conta, usar e confirmar
    if (accounts.length === 1) {
      session.context.tempTransaction!.bankAccountId = accounts[0].id;
      session.state = ChatState.CONFIRMING;
      
      return {
        response: `🧠 Reconheci!\n\n` +
          `📝 ${description}\n` +
          `💰 R$ ${formatMoney(amount)}\n` +
          `🏷️ ${categoryName}\n` +
          `🏦 ${accounts[0].name}${avgInfo}\n\n` +
          `Está correto?`,
        quickReplies: ['Sim, confirmar', 'Mudar categoria', 'Cancelar'],
      };
    }
    
    // Se tem múltiplas contas, perguntar
    const options = accounts.map((a, i) => `${i + 1}️⃣ ${a.name}`);
    const quickReplies = accounts.slice(0, 4).map(a => a.name.split(' ')[0]);
    
    return {
      response: `📝 ${description}\n` +
        `💰 R$ ${formatMoney(amount)}\n` +
        `🏷️ ${categoryName}${avgInfo}\n\n` +
        `🏦 De qual conta?`,
      options,
      quickReplies,
    };
  }
  
  private async askCategory(session: ChatSession) {
    const type = session.context.tempTransaction?.type || 'expense';
    const description = session.context.tempTransaction?.description || '';
    
    // Carregar categorias L1 do usuário
    if (!session.context.categories) {
      session.context.categories = await prisma.category.findMany({
        where: {
          tenantId: session.tenantId,
          level: 1,
          type,
          isActive: true,
          deletedAt: null,
        },
        orderBy: { name: 'asc' },
      });
    }
    
    const categories = session.context.categories.filter(c => c.type === type);
    const options = categories.map((c, i) => `${i + 1}️⃣ ${c.name}`);
    const quickReplies = categories.slice(0, 4).map(c => c.name.replace(/^\W+\s*/, '')); // Remove emoji
    
    // Adicionar dica baseada na descrição
    let hint = '';
    if (description) {
      hint = `\n\n_Para "${description}"_`;
    }
    
    return {
      response: `Em qual categoria?${hint}`,
      options: options.slice(0, 10),
      quickReplies,
    };
  }
  
  private async handleAskingCategory(session: ChatSession, input: string) {
    const type = session.context.tempTransaction?.type || 'expense';
    
    // Carregar categorias se não tiver
    if (!session.context.categories) {
      session.context.categories = await prisma.category.findMany({
        where: {
          tenantId: session.tenantId,
          level: 1,
          type,
          isActive: true,
          deletedAt: null,
        },
        orderBy: { name: 'asc' },
      });
    }
    
    const categories = session.context.categories.filter(c => c.type === type);
    const normalized = input.toLowerCase().trim();
    
    let selectedCategory: any = null;
    
    // Tentar encontrar por número
    const num = parseInt(normalized);
    if (!isNaN(num) && num >= 1 && num <= categories.length) {
      selectedCategory = categories[num - 1];
    } else {
      // Tentar encontrar por nome
      selectedCategory = categories.find(c => 
        c.name.toLowerCase().includes(normalized) ||
        normalized.includes(c.name.toLowerCase().replace(/^\W+\s*/, ''))
      );
    }
    
    if (selectedCategory) {
      session.context.tempTransaction!.categoryId = selectedCategory.id;
      session.context.tempTransaction!.categoryName = selectedCategory.name;
      
      // Verificar se tem subcategorias
      return this.askSubcategoryOrContinue(session, selectedCategory.id);
    }
    
    return {
      response: `🤔 Não encontrei "${input}". Escolha uma categoria pelo número ou digite parte do nome:`,
      options: categories.slice(0, 10).map((c, i) => `${i + 1}️⃣ ${c.name}`),
    };
  }
  
  private async askSubcategoryOrContinue(session: ChatSession, parentCategoryId: string) {
    // Buscar subcategorias
    const subcategories = await prisma.category.findMany({
      where: {
        tenantId: session.tenantId,
        parentId: parentCategoryId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });
    
    if (subcategories.length === 0) {
      // Sem subcategorias, ir para conta
      return this.askAccount(session);
    }
    
    // Guardar subcategorias no contexto
    (session.context as any).subcategories = subcategories;
    session.state = ChatState.ASKING_SUBCATEGORY;
    
    const options = subcategories.map((s, i) => `${i + 1}️⃣ ${s.icon || ''} ${s.name}`.trim());
    const quickReplies = subcategories.slice(0, 4).map(s => s.name);
    
    return {
      response: `📂 **${session.context.tempTransaction!.categoryName}**\n\nQual subcategoria?`,
      options: options.slice(0, 10),
      quickReplies,
    };
  }
  
  private async handleAskingSubcategory(session: ChatSession, input: string) {
    const subcategories = (session.context as any).subcategories || [];
    const normalized = input.toLowerCase().trim();
    
    let selected: any = null;
    
    // Tentar encontrar por número
    const num = parseInt(normalized);
    if (!isNaN(num) && num >= 1 && num <= subcategories.length) {
      selected = subcategories[num - 1];
    } else {
      // Tentar encontrar por nome
      selected = subcategories.find((s: any) => 
        s.name.toLowerCase().includes(normalized) ||
        normalized.includes(s.name.toLowerCase())
      );
    }
    
    if (selected) {
      // Usar a subcategoria ao invés da categoria pai
      session.context.tempTransaction!.categoryId = selected.id;
      session.context.tempTransaction!.categoryName = `${session.context.tempTransaction!.categoryName} > ${selected.name}`;
      return this.askAccount(session);
    }
    
    // Se o usuário digitar "pular" ou "nenhuma", usar a categoria pai
    if (normalized.includes('pular') || normalized.includes('nenhum') || normalized.includes('outr')) {
      return this.askAccount(session);
    }
    
    return {
      response: `🤔 Não encontrei "${input}". Escolha pelo número ou digite "pular" para usar a categoria principal:`,
      options: subcategories.slice(0, 10).map((s: any, i: number) => `${i + 1}️⃣ ${s.icon || ''} ${s.name}`.trim()),
      quickReplies: ['Pular'],
    };
  }
  
  private async askAccount(session: ChatSession) {
    // Carregar contas se não tiver
    if (!session.context.bankAccounts) {
      session.context.bankAccounts = await prisma.bankAccount.findMany({
        where: {
          tenantId: session.tenantId,
          isActive: true,
          deletedAt: null,
        },
        orderBy: { name: 'asc' },
      });
    }
    
    const accounts = session.context.bankAccounts;
    session.state = ChatState.ASKING_ACCOUNT;
    
    if (accounts.length === 0) {
      // Sem contas, pular para meio de pagamento
      return this.askPaymentMethodForTransaction(session);
    }
    
    if (accounts.length === 1) {
      // Se só tem uma conta, usar ela e ir para meio de pagamento
      session.context.tempTransaction!.bankAccountId = accounts[0].id;
      return this.askPaymentMethodForTransaction(session);
    }
    
    const options = accounts.map((a, i) => `${i + 1}️⃣ ${a.name}`);
    const quickReplies = accounts.slice(0, 4).map(a => a.name.split(' ')[0]);
    
    return {
      response: 'De qual conta saiu/entrou?',
      options,
      quickReplies,
    };
  }
  
  private async handleAskingAccount(session: ChatSession, input: string) {
    const accounts = session.context.bankAccounts || [];
    const normalized = input.toLowerCase().trim();
    
    // Tentar encontrar por número
    const num = parseInt(normalized);
    if (!isNaN(num) && num >= 1 && num <= accounts.length) {
      session.context.tempTransaction!.bankAccountId = accounts[num - 1].id;
      return this.askPaymentMethodForTransaction(session);
    }
    
    // Tentar encontrar por nome
    const found = accounts.find(a => 
      a.name.toLowerCase().includes(normalized) ||
      a.institution?.toLowerCase().includes(normalized)
    );
    
    if (found) {
      session.context.tempTransaction!.bankAccountId = found.id;
      return this.askPaymentMethodForTransaction(session);
    }
    
    return {
      response: `🏦 Não encontrei "${input}". Escolha a conta pelo número ou nome:`,
      options: accounts.map((a, i) => `${i + 1}️⃣ ${a.name}`),
    };
  }
  
  private async askPaymentMethodForTransaction(session: ChatSession) {
    // Carregar meios de pagamento do usuário
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: {
        tenantId: session.tenantId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });
    
    // Guardar no contexto
    session.context.paymentMethods = paymentMethods;
    session.state = ChatState.ASKING_PAYMENT_METHOD;
    
    // Opções padrão + meios do usuário
    const defaultOptions = ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Boleto'];
    
    // Combinar meios existentes com padrão
    const userMethodNames = paymentMethods.map(p => p.name);
    const allOptions = [...new Set([...userMethodNames, ...defaultOptions])];
    
    const options = allOptions.slice(0, 8).map((name, i) => `${i + 1}️⃣ ${name}`);
    const quickReplies = allOptions.slice(0, 4);
    
    return {
      response: '💳 **Qual o meio de pagamento?**',
      options,
      quickReplies,
    };
  }
  
  private async handleAskingPaymentMethod(session: ChatSession, input: string) {
    const normalized = input.toLowerCase().trim();
    const paymentMethods = session.context.paymentMethods || [];
    
    // Mapear entrada para tipo de pagamento
    let paymentType = 'other';
    let paymentName = input.trim();
    
    // Tentar encontrar por número na lista
    const num = parseInt(normalized);
    const defaultOptions = ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Boleto'];
    const userMethodNames = paymentMethods.map((p: any) => p.name);
    const allOptions = [...new Set([...userMethodNames, ...defaultOptions])];
    
    if (!isNaN(num) && num >= 1 && num <= allOptions.length) {
      paymentName = allOptions[num - 1];
    }
    
    // Detectar tipo pelo nome
    const paymentLower = paymentName.toLowerCase();
    if (paymentLower.includes('pix')) {
      paymentType = 'pix';
      paymentName = 'PIX';
    } else if (paymentLower.includes('crédito') || paymentLower.includes('credito') || paymentLower.includes('credit')) {
      paymentType = 'credit_card';
      paymentName = 'Cartão de Crédito';
    } else if (paymentLower.includes('débito') || paymentLower.includes('debito') || paymentLower.includes('debit')) {
      paymentType = 'debit_card';
      paymentName = 'Cartão de Débito';
    } else if (paymentLower.includes('dinheiro') || paymentLower.includes('cash') || paymentLower.includes('espécie')) {
      paymentType = 'cash';
      paymentName = 'Dinheiro';
    } else if (paymentLower.includes('boleto')) {
      paymentType = 'boleto';
      paymentName = 'Boleto';
    } else if (paymentLower.includes('transf')) {
      paymentType = 'transfer';
      paymentName = 'Transferência';
    }
    
    // Buscar ou criar meio de pagamento
    let paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        tenantId: session.tenantId,
        OR: [
          { type: paymentType },
          { name: { contains: paymentName, mode: 'insensitive' } },
        ],
        isActive: true,
        deletedAt: null,
      },
    });
    
    if (!paymentMethod) {
      // Criar novo meio de pagamento
      paymentMethod = await prisma.paymentMethod.create({
        data: {
          tenantId: session.tenantId,
          name: paymentName,
          type: paymentType,
          isActive: true,
        },
      });
      log.info(`Meio de pagamento "${paymentName}" criado automaticamente pelo chatbot`);
    }
    
    session.context.tempTransaction!.paymentMethodId = paymentMethod.id;
    
    return this.confirmTransaction(session);
  }

  private async handleAskingAmount(session: ChatSession, input: string) {
    const amount = parseMoneyValue(input);
    
    if (amount === null || amount <= 0) {
      return {
        response: 'Por favor, digite um valor válido.\n\nExemplos: 50, 150.00, R$ 250,00',
      };
    }
    
    session.context.tempTransaction!.amount = amount;
    session.state = ChatState.ASKING_DESCRIPTION;
    
    const type = session.context.tempTransaction?.type;
    const question = type === 'income' ? 'Qual a origem?' : 'Onde você gastou?';
    
    return {
      response: `R$ ${formatMoney(amount)}\n\n${question}`,
    };
  }
  
  private async handleAskingDescription(session: ChatSession, input: string) {
    session.context.tempTransaction!.description = input.trim();
    return this.suggestCategoryFromDescription(session);
  }
  
  private async confirmTransaction(session: ChatSession) {
    const tx = session.context.tempTransaction!;
    const type = tx.type === 'income' ? '💵 Receita' : '💸 Despesa';
    const account = session.context.bankAccounts?.find(a => a.id === tx.bankAccountId);
    const paymentMethod = session.context.paymentMethods?.find((p: any) => p.id === tx.paymentMethodId);
    
    session.state = ChatState.CONFIRMING;
    
    let confirmMessage = `📋 **Confirma o lançamento?**\n\n` +
      `${type}\n` +
      `📝 ${tx.description}\n` +
      `💰 R$ ${formatMoney(tx.amount!)}\n` +
      `🏷️ ${tx.categoryName}\n` +
      `🏦 ${account?.name || 'Não definido'}`;
    
    if (paymentMethod) {
      confirmMessage += `\n💳 ${paymentMethod.name}`;
    }
    
    return {
      response: confirmMessage,
      options: ['✅ Confirmar', '❌ Cancelar', '✏️ Editar'],
      quickReplies: ['Confirmar', 'Cancelar'],
    };
  }
  
  private async handleConfirming(session: ChatSession, input: string) {
    const normalized = input.toLowerCase();
    
    if (normalized.includes('cancel') || normalized.includes('não') || normalized.includes('nao')) {
      session.state = ChatState.IDLE;
      session.context.tempTransaction = undefined;
      return {
        response: '❌ Lançamento cancelado.\n\nPosso ajudar com mais alguma coisa?',
        quickReplies: ['Novo gasto', 'Nova receita', 'Meu saldo'],
      };
    }
    
    if (normalized.includes('mudar') || normalized.includes('editar') || normalized.includes('categoria')) {
      session.state = ChatState.ASKING_CATEGORY;
      return this.askCategory(session);
    }
    
    if (isPositive(normalized) || normalized.includes('confirm')) {
      // Salvar transação
      const tx = session.context.tempTransaction!;
      
      const transaction = await prisma.transaction.create({
        data: {
          tenantId: session.tenantId,
          userId: session.userId,
          type: tx.type || 'expense',
          categoryId: tx.categoryId,
          bankAccountId: tx.bankAccountId,
          paymentMethodId: tx.paymentMethodId,
          amount: tx.amount!,
          description: tx.description,
          transactionDate: new Date(),
          status: 'completed',
          transactionType: 'single',
          isFixed: false,
        },
      });
      
      // Atualizar saldo da conta
      if (tx.bankAccountId) {
        const multiplier = tx.type === 'income' ? 1 : -1;
        await prisma.bankAccount.update({
          where: { id: tx.bankAccountId },
          data: {
            currentBalance: {
              increment: tx.amount! * multiplier,
            },
          },
        });
      }
      
      // Atualizar padrões aprendidos
      if (tx.description && tx.categoryId) {
        const newPattern: LearnedPattern = {
          description: tx.description.toLowerCase(),
          keywords: extractKeywords(tx.description),
          categoryId: tx.categoryId,
          categoryName: tx.categoryName || '',
          paymentMethodId: tx.paymentMethodId,
          averageAmount: tx.amount,
          count: 1,
          lastUsed: new Date(),
        };
        
        // Adicionar ou atualizar no contexto
        if (!session.context.learnedPatterns) {
          session.context.learnedPatterns = [];
        }
        
        const existing = session.context.learnedPatterns.find(
          p => p.description === newPattern.description
        );
        
        if (existing) {
          existing.count++;
          existing.lastUsed = new Date();
        } else {
          session.context.learnedPatterns.unshift(newPattern);
        }
      }
      
      session.state = ChatState.IDLE;
      session.context.tempTransaction = undefined;
      
      const emoji = tx.type === 'income' ? '🎉' : '✅';
      
      return {
        response: `${emoji} **Lançamento registrado!**\n\n` +
          `${tx.type === 'income' ? '💵' : '💸'} ${tx.description}: R$ ${formatMoney(tx.amount!)}\n\n` +
          `_Dica: Na próxima vez que você mencionar "${tx.description}", vou sugerir a mesma categoria automaticamente!_ 🧠`,
        quickReplies: ['Novo gasto', 'Meu saldo', 'Quanto gastei'],
      };
    }
    
    return {
      response: 'Não entendi. O que deseja fazer?',
      options: ['✅ Confirmar', '❌ Cancelar', '✏️ Mudar categoria'],
      quickReplies: ['Confirmar', 'Cancelar'],
    };
  }
  
  // ==================== CONSULTAS ====================
  
  private showMenu(session: ChatSession) {
    return {
      response: `📋 **MENU PRINCIPAL**\n\n` +
        `Escolha uma opção ou digite o número:\n\n` +
        `**📊 CONSULTAS**\n` +
        `1️⃣ **Planejamento** - Visão geral do mês\n` +
        `2️⃣ **Meu Saldo** - Saldo das suas contas\n` +
        `3️⃣ **Quanto Gastei** - Resumo de gastos\n` +
        `4️⃣ **Contas a Vencer** - Próximos vencimentos\n\n` +
        `**💰 LANÇAMENTOS**\n` +
        `5️⃣ **Novo Gasto** - Registrar despesa\n` +
        `6️⃣ **Nova Receita** - Registrar entrada\n\n` +
        `**⚙️ CONFIGURAÇÕES**\n` +
        `7️⃣ **Minhas Contas** - Ver contas bancárias\n` +
        `8️⃣ **Receitas Fixas** - Gerenciar receitas\n` +
        `9️⃣ **Despesas Fixas** - Gerenciar despesas\n\n` +
        `**❓ AJUDA**\n` +
        `0️⃣ **Ajuda** - Como usar a Isis\n\n` +
        `_Ou me diga o que precisa em linguagem natural!_`,
      options: ['1️⃣ Planejamento', '2️⃣ Meu Saldo', '3️⃣ Quanto Gastei', '4️⃣ Contas a Vencer', '5️⃣ Novo Gasto', '6️⃣ Nova Receita'],
      quickReplies: ['Planejamento', 'Meu Saldo', 'Novo Gasto', 'Ajuda'],
    };
  }
  
  private showHelp(session: ChatSession) {
    return {
      response: `🤖 **Como usar a Isis**\n\n` +
        `**📝 Para registrar gastos, diga:**\n` +
        `• "Gastei 50 no mercado"\n` +
        `• "Paguei 150 de luz"\n` +
        `• "Comprei 30 de gasolina"\n\n` +
        `**💵 Para registrar receitas:**\n` +
        `• "Recebi 3000"\n` +
        `• "Entrou 500 de freela"\n\n` +
        `**🔍 Para consultar:**\n` +
        `• "Meu saldo" - Ver saldo das contas\n` +
        `• "Quanto gastei" - Ver gastos do mês\n` +
        `• "Contas a vencer" - Próximos vencimentos\n` +
        `• "Planejamento" - Visão geral do mês\n\n` +
        `**📋 Outros comandos:**\n` +
        `• "Menu" - Ver todas as opções\n` +
        `• "Minhas contas" - Ver contas bancárias\n\n` +
        `**💡 Dica:** Eu aprendo com seus lançamentos!\n` +
        `Quanto mais você usa, mais esperta fico 🧠`,
      quickReplies: ['Menu', 'Planejamento', 'Meu saldo', 'Novo gasto'],
    };
  }
  
  private greet(session: ChatSession) {
    const hour = getBrazilHour();
    let greeting = 'Olá';
    
    if (hour >= 5 && hour < 12) greeting = 'Bom dia';
    else if (hour >= 12 && hour < 18) greeting = 'Boa tarde';
    else greeting = 'Boa noite';
    
    return {
      response: `${greeting}, ${session.context.userName}! 👋\n\nComo posso te ajudar?`,
      quickReplies: ['Planejamento', 'Meu saldo', 'Novo gasto', 'Ajuda'],
    };
  }
  
  /**
   * Saudação com insights proativos e sugestões contextuais
   */
  private async greetWithInsights(session: ChatSession) {
    const hour = getBrazilHour();
    const now = new Date();
    let greeting = 'Olá';
    let contextualTip = '';
    let priorityInfo = '';
    
    // Saudação por horário (usando fuso de Brasília)
    if (hour >= 5 && hour < 12) greeting = '☀️ Bom dia';
    else if (hour >= 12 && hour < 18) greeting = '🌤️ Boa tarde';
    else greeting = '🌙 Boa noite';
    
    try {
      // 1. Verificar contas a vencer nos próximos 3 dias (PRIORIDADE)
      const in3Days = new Date();
      in3Days.setDate(now.getDate() + 3);
      
      const pendingBills = await prisma.recurringBillOccurrence.findMany({
        where: {
          tenantId: session.tenantId,
          status: 'pending',
          dueDate: {
            gte: now,
            lte: in3Days,
          },
        },
        include: { recurringBill: true },
        orderBy: { dueDate: 'asc' },
        take: 3,
      });
      
      if (pendingBills.length > 0) {
        const totalPending = pendingBills.reduce((sum, b) => sum + Number(b.amount), 0);
        priorityInfo = `\n\n⚠️ **Atenção!** Você tem ${pendingBills.length} conta(s) vencendo em breve:\n`;
        for (const bill of pendingBills) {
          const daysUntil = Math.ceil((bill.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const dayLabel = daysUntil === 0 ? '**HOJE**' : daysUntil === 1 ? 'amanhã' : `em ${daysUntil} dias`;
          priorityInfo += `• ${bill.recurringBill.name}: R$ ${formatMoney(Number(bill.amount))} (${dayLabel})\n`;
        }
        priorityInfo += `\n💰 Total: R$ ${formatMoney(totalPending)}`;
      }
      
      // 2. Insight de gastos (comparação com mês anterior)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const dayOfMonth = now.getDate();
      
      // Gastos até hoje no mês atual
      const currentMonthExpenses = await prisma.transaction.aggregate({
        where: {
          tenantId: session.tenantId,
          type: 'expense',
          transactionDate: { gte: startOfMonth, lte: now },
          deletedAt: null,
        },
        _sum: { amount: true },
      });
      
      // Mesmo período do mês passado
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthSameDay = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth);
      
      const lastMonthExpenses = await prisma.transaction.aggregate({
        where: {
          tenantId: session.tenantId,
          type: 'expense',
          transactionDate: { gte: lastMonthStart, lte: lastMonthSameDay },
          deletedAt: null,
        },
        _sum: { amount: true },
      });
      
      const currentTotal = Number(currentMonthExpenses._sum.amount) || 0;
      const lastTotal = Number(lastMonthExpenses._sum.amount) || 0;
      
      if (lastTotal > 0 && currentTotal > 0) {
        const percentChange = ((currentTotal - lastTotal) / lastTotal) * 100;
        
        if (percentChange > 15) {
          contextualTip = `\n\n📊 **Insight:** Você gastou ${percentChange.toFixed(0)}% a mais que no mesmo período do mês passado. Quer ver um detalhamento?`;
        } else if (percentChange < -15) {
          contextualTip = `\n\n🎉 **Parabéns!** Você está gastando ${Math.abs(percentChange).toFixed(0)}% a menos que no mês passado. Continue assim!`;
        }
      }
      
      // 3. Sugestão contextual por horário
      let suggestion = '';
      if (hour >= 7 && hour <= 9) {
        suggestion = '\n\n💡 _Dica matinal: Já registrou os gastos de ontem?_';
      } else if (hour >= 12 && hour <= 14) {
        suggestion = '\n\n💡 _Hora do almoço! Lembre-se de registrar se comer fora._';
      } else if (hour >= 18 && hour <= 20) {
        suggestion = '\n\n💡 _Final do dia! Que tal conferir seus gastos de hoje?_';
      }
      
    } catch (error) {
      log.error('Erro ao gerar insights:', error);
    }
    
    return {
      response: `${greeting}, ${session.context.userName}! 👋${priorityInfo}${contextualTip}\n\nComo posso te ajudar?`,
      quickReplies: priorityInfo ? ['Ver contas', 'Pagar conta', 'Novo gasto'] : ['Planejamento', 'Meu saldo', 'Novo gasto', 'Ajuda'],
    };
  }

  private async queryBalance(session: ChatSession) {
    const accounts = await prisma.bankAccount.findMany({
      where: {
        tenantId: session.tenantId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { currentBalance: 'desc' },
    });
    
    const total = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    
    let response = `💰 **Seu saldo total: R$ ${formatMoney(total)}**\n\n`;
    
    if (accounts.length > 1) {
      response += `📊 Por conta:\n`;
      for (const acc of accounts) {
        response += `• ${acc.name}: R$ ${formatMoney(Number(acc.currentBalance))}\n`;
      }
    }
    
    return {
      response,
      quickReplies: ['Quanto gastei', 'Novo gasto', 'Contas a vencer'],
    };
  }
  
  private async queryExpenses(session: ChatSession) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const result = await prisma.transaction.aggregate({
      where: {
        tenantId: session.tenantId,
        type: 'expense',
        transactionDate: { gte: startOfMonth },
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
    });
    
    const total = Number(result._sum.amount) || 0;
    const count = result._count || 0;
    
    // Top categorias
    const byCategory = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        tenantId: session.tenantId,
        type: 'expense',
        transactionDate: { gte: startOfMonth },
        deletedAt: null,
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    });
    
    const categoryIds = byCategory.map(c => c.categoryId).filter(Boolean) as string[];
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });
    
    let response = `📊 **Gastos deste mês**\n\n` +
      `💸 Total: **R$ ${formatMoney(total)}**\n` +
      `📝 ${count} lançamento(s)\n`;
    
    if (byCategory.length > 0) {
      response += `\n🏷️ **Top categorias:**\n`;
      for (const item of byCategory) {
        const cat = categories.find(c => c.id === item.categoryId);
        if (cat) {
          response += `• ${cat.name}: R$ ${formatMoney(Number(item._sum.amount))}\n`;
        }
      }
    }
    
    return {
      response,
      quickReplies: ['Meu saldo', 'Novo gasto', 'Contas a vencer'],
    };
  }
  
  private async queryBills(session: ChatSession) {
    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(now.getDate() + 7);
    
    // Buscar recorrentes pendentes
    const occurrences = await prisma.recurringBillOccurrence.findMany({
      where: {
        tenantId: session.tenantId,
        status: 'pending',
        dueDate: {
          gte: now,
          lte: in7Days,
        },
      },
      include: {
        recurringBill: true,
      },
      orderBy: { dueDate: 'asc' },
    });
    
    if (occurrences.length === 0) {
      return {
        response: `✅ Você não tem contas vencendo nos próximos 7 dias!\n\nAproveite a tranquilidade 😊`,
        quickReplies: ['Meu saldo', 'Quanto gastei', 'Novo gasto'],
      };
    }
    
    let response = `📅 **Contas dos próximos 7 dias:**\n\n`;
    let total = 0;
    
    for (const occ of occurrences) {
      const day = occ.dueDate.getDate();
      const month = occ.dueDate.getMonth() + 1;
      response += `• ${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')} - ${occ.recurringBill.name}: R$ ${formatMoney(Number(occ.amount))}\n`;
      total += Number(occ.amount);
    }
    
    response += `\n💰 **Total: R$ ${formatMoney(total)}**`;
    
    return {
      response,
      quickReplies: ['Meu saldo', 'Pagar conta', 'Novo gasto'],
    };
  }
  
  private async queryPlanning(session: ChatSession) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Buscar saldo total
    const accounts = await prisma.bankAccount.findMany({
      where: {
        tenantId: session.tenantId,
        isActive: true,
        deletedAt: null,
      },
    });
    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    
    // Buscar receitas do mês (realizadas)
    const incomeResult = await prisma.transaction.aggregate({
      where: {
        tenantId: session.tenantId,
        type: 'income',
        status: 'completed',
        transactionDate: { gte: startOfMonth, lte: endOfMonth },
        deletedAt: null,
      },
      _sum: { amount: true },
    });
    const totalIncome = Number(incomeResult._sum.amount) || 0;
    
    // Buscar receitas previstas (pendentes)
    const pendingIncomeResult = await prisma.transaction.aggregate({
      where: {
        tenantId: session.tenantId,
        type: 'income',
        status: { in: ['pending', 'scheduled'] },
        transactionDate: { gte: startOfMonth, lte: endOfMonth },
        deletedAt: null,
      },
      _sum: { amount: true },
    });
    const pendingIncome = Number(pendingIncomeResult._sum.amount) || 0;
    
    // Buscar despesas do mês (realizadas)
    const expenseResult = await prisma.transaction.aggregate({
      where: {
        tenantId: session.tenantId,
        type: 'expense',
        status: 'completed',
        transactionDate: { gte: startOfMonth, lte: endOfMonth },
        deletedAt: null,
      },
      _sum: { amount: true },
    });
    const totalExpenses = Number(expenseResult._sum.amount) || 0;
    
    // Buscar despesas pendentes (contas a pagar)
    const pendingExpenseResult = await prisma.transaction.aggregate({
      where: {
        tenantId: session.tenantId,
        type: 'expense',
        status: { in: ['pending', 'scheduled'] },
        transactionDate: { gte: startOfMonth, lte: endOfMonth },
        deletedAt: null,
      },
      _sum: { amount: true },
    });
    const pendingExpenses = Number(pendingExpenseResult._sum.amount) || 0;
    
    // Buscar recorrentes pendentes do mês
    const recurringPending = await prisma.recurringBillOccurrence.aggregate({
      where: {
        tenantId: session.tenantId,
        status: 'pending',
        dueDate: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
      _count: true,
    });
    const recurringAmount = Number(recurringPending._sum.amount) || 0;
    const recurringCount = recurringPending._count || 0;
    
    // Calcular projeções
    const totalReceitas = totalIncome + pendingIncome;
    const totalDespesas = totalExpenses + pendingExpenses + recurringAmount;
    const saldoPrevisto = totalBalance - pendingExpenses - recurringAmount;
    const sobraOuFalta = totalReceitas - totalDespesas;
    
    // Montar resposta
    const monthName = now.toLocaleDateString('pt-BR', { month: 'long' });
    const emoji = sobraOuFalta >= 0 ? '✅' : '⚠️';
    const statusText = sobraOuFalta >= 0 ? 'sobra' : 'falta';
    
    let response = `📊 **Planejamento de ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}**\n\n`;
    
    response += `💰 **Saldo atual:** R$ ${formatMoney(totalBalance)}\n\n`;
    
    response += `📥 **Receitas:**\n`;
    response += `• Recebido: R$ ${formatMoney(totalIncome)}\n`;
    if (pendingIncome > 0) {
      response += `• A receber: R$ ${formatMoney(pendingIncome)}\n`;
    }
    response += `• **Total:** R$ ${formatMoney(totalReceitas)}\n\n`;
    
    response += `📤 **Despesas:**\n`;
    response += `• Pago: R$ ${formatMoney(totalExpenses)}\n`;
    if (pendingExpenses + recurringAmount > 0) {
      response += `• A pagar: R$ ${formatMoney(pendingExpenses + recurringAmount)}`;
      if (recurringCount > 0) {
        response += ` (${recurringCount} contas)`;
      }
      response += `\n`;
    }
    response += `• **Total:** R$ ${formatMoney(totalDespesas)}\n\n`;
    
    response += `${emoji} **Balanço:** ${statusText} R$ ${formatMoney(Math.abs(sobraOuFalta))}\n`;
    response += `💳 **Saldo previsto:** R$ ${formatMoney(saldoPrevisto)}`;
    
    return {
      response,
      quickReplies: ['Contas a vencer', 'Meu saldo', 'Quanto gastei'],
    };
  }
  
  private async queryAccounts(session: ChatSession) {
    const accounts = await prisma.bankAccount.findMany({
      where: {
        tenantId: session.tenantId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });
    
    if (accounts.length === 0) {
      return {
        response: `❌ Você ainda não tem contas cadastradas.\n\nVamos cadastrar uma agora?`,
        quickReplies: ['Sim', 'Menu'],
      };
    }
    
    const total = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    
    let response = `🏦 **Suas Contas Bancárias**\n\n`;
    
    for (const acc of accounts) {
      const balance = Number(acc.currentBalance);
      const emoji = balance >= 0 ? '✅' : '🔴';
      response += `${emoji} **${acc.name}**\n`;
      response += `   💰 Saldo: R$ ${formatMoney(balance)}\n`;
      if (acc.institution) {
        response += `   🏛️ ${acc.institution}\n`;
      }
      response += `\n`;
    }
    
    response += `📊 **Total: R$ ${formatMoney(total)}**`;
    
    return {
      response,
      quickReplies: ['Menu', 'Planejamento', 'Novo gasto'],
    };
  }
  
  private async queryFixedIncomes(session: ChatSession) {
    const incomes = await prisma.recurringBill.findMany({
      where: {
        tenantId: session.tenantId,
        type: 'income',
        status: 'active',
        deletedAt: null,
      },
      include: {
        bankAccount: true,
      },
      orderBy: { dueDay: 'asc' },
    });
    
    if (incomes.length === 0) {
      return {
        response: `💵 Você ainda não tem receitas fixas cadastradas.\n\nExemplos:\n• Salário\n• Pró-labore\n• Aluguel recebido\n\nQuer cadastrar uma receita fixa?`,
        quickReplies: ['Sim', 'Menu'],
      };
    }
    
    const total = incomes.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    
    let response = `💵 **Suas Receitas Fixas**\n\n`;
    
    for (const income of incomes) {
      response += `• **${income.name}**\n`;
      response += `   💰 R$ ${formatMoney(Number(income.amount || 0))} / mês\n`;
      response += `   📅 Dia ${income.dueDay}\n`;
      if (income.bankAccount) {
        response += `   🏦 ${income.bankAccount.name}\n`;
      }
      response += `\n`;
    }
    
    response += `📊 **Total mensal: R$ ${formatMoney(total)}**`;
    
    return {
      response,
      quickReplies: ['Menu', 'Despesas Fixas', 'Planejamento'],
    };
  }
  
  private async queryFixedExpenses(session: ChatSession) {
    const expenses = await prisma.recurringBill.findMany({
      where: {
        tenantId: session.tenantId,
        type: 'expense',
        status: 'active',
        deletedAt: null,
      },
      include: {
        bankAccount: true,
        category: true,
      },
      orderBy: { dueDay: 'asc' },
    });
    
    if (expenses.length === 0) {
      return {
        response: `📋 Você ainda não tem despesas fixas cadastradas.\n\nExemplos:\n• Aluguel\n• Internet\n• Luz\n• Academia\n\nQuer cadastrar uma despesa fixa?`,
        quickReplies: ['Sim', 'Menu'],
      };
    }
    
    const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    
    let response = `📋 **Suas Despesas Fixas**\n\n`;
    
    for (const expense of expenses) {
      response += `• **${expense.name}**\n`;
      response += `   💰 R$ ${formatMoney(Number(expense.amount || 0))} / mês\n`;
      response += `   📅 Vence dia ${expense.dueDay}\n`;
      if (expense.category) {
        response += `   🏷️ ${expense.category.name}\n`;
      }
      response += `\n`;
    }
    
    response += `📊 **Total mensal: R$ ${formatMoney(total)}**\n\n`;
    response += `💡 _Suas contas são geradas automaticamente todo mês!_`;
    
    return {
      response,
      quickReplies: ['Menu', 'Receitas Fixas', 'Contas a vencer'],
    };
  }
  
  /**
   * Mostra resumo do planejamento anual
   */
  private async showAnnualPlanning(session: ChatSession) {
    const currentYear = new Date().getFullYear();
    
    // Buscar totais de recorrentes
    const incomeTotal = await prisma.recurringBill.aggregate({
      where: {
        tenantId: session.tenantId,
        type: 'income',
        status: 'active',
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
    });
    
    const expenseTotal = await prisma.recurringBill.aggregate({
      where: {
        tenantId: session.tenantId,
        type: 'expense',
        status: 'active',
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
    });
    
    const monthlyIncome = Number(incomeTotal._sum.amount) || 0;
    const monthlyExpense = Number(expenseTotal._sum.amount) || 0;
    const monthlyBalance = monthlyIncome - monthlyExpense;
    
    // Saldo atual
    const accounts = await prisma.bankAccount.aggregate({
      where: {
        tenantId: session.tenantId,
        isActive: true,
        deletedAt: null,
      },
      _sum: { currentBalance: true },
    });
    const currentBalance = Number(accounts._sum.currentBalance) || 0;
    
    // Projeção
    const currentMonth = new Date().getMonth();
    const remainingMonths = 12 - currentMonth;
    const projectedYearEnd = currentBalance + (monthlyBalance * remainingMonths);
    
    let response = `📅 **Planejamento Anual ${currentYear}**\n\n`;
    
    response += `💰 **Saldo atual:** R$ ${formatMoney(currentBalance)}\n\n`;
    
    response += `📊 **Resumo Mensal Planejado:**\n`;
    response += `• 💵 Receitas: R$ ${formatMoney(monthlyIncome)} (${incomeTotal._count} fonte${incomeTotal._count !== 1 ? 's' : ''})\n`;
    response += `• 📋 Despesas: R$ ${formatMoney(monthlyExpense)} (${expenseTotal._count} conta${expenseTotal._count !== 1 ? 's' : ''})\n`;
    response += `• ${monthlyBalance >= 0 ? '✅' : '⚠️'} Sobra: R$ ${formatMoney(monthlyBalance)}\n\n`;
    
    response += `📈 **Projeção Anual:**\n`;
    response += `• Receita total: R$ ${formatMoney(monthlyIncome * 12)}\n`;
    response += `• Despesa total: R$ ${formatMoney(monthlyExpense * 12)}\n`;
    response += `• Saldo previsto fim do ano: R$ ${formatMoney(projectedYearEnd)}\n\n`;
    
    response += `👉 Para ver detalhes completos, acesse a página **Planejamento Anual** no menu lateral!\n\n`;
    response += `Quer configurar receitas ou despesas fixas agora?`;
    
    return {
      response,
      options: ['1️⃣ Adicionar receita fixa', '2️⃣ Adicionar despesa fixa', '3️⃣ Ver minhas contas'],
      quickReplies: ['Adicionar receita', 'Adicionar despesa', 'Menu'],
      navigate: '/dashboard/planning',
    };
  }
  
  /**
   * Inicia fluxo guiado de planejamento anual
   */
  private startAnnualPlanningFlow(session: ChatSession) {
    // Resetar estado para onboarding de receitas
    session.state = ChatState.ONBOARDING_INCOME;
    
    return {
      response: `🎯 **Vamos configurar seu planejamento anual!**\n\n` +
        `Vou te guiar passo a passo para cadastrar:\n\n` +
        `1️⃣ Suas receitas fixas (salário, etc)\n` +
        `2️⃣ Suas despesas fixas (aluguel, contas, etc)\n\n` +
        `Você tem alguma **receita fixa** mensal?\n_(salário, aluguel recebido, pensão...)_`,
      quickReplies: ['Sim', 'Não'],
    };
  }
}

// Singleton
export const chatbotService = new ChatbotService();
