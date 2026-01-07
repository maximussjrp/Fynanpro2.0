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
  ASKING_ACCOUNT = 'asking_account',
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
    bankAccountId?: string;
    paymentMethodId?: string;
    date?: Date;
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

// Cache de sessões em memória (em produção usar Redis)
const sessions = new Map<string, ChatSession>();

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
   * Obter ou criar sessão
   */
  async getOrCreateSession(tenantId: string, userId: string): Promise<ChatSession> {
    const sessionKey = `${tenantId}:${userId}`;
    
    let session = sessions.get(sessionKey);
    
    if (!session) {
      // Verificar se usuário já fez onboarding
      const hasAccounts = await prisma.bankAccount.count({
        where: { tenantId, deletedAt: null }
      });
      
      // Carregar dados do usuário
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true }
      });
      
      // Carregar padrões aprendidos
      const learnedPatterns = await this.loadLearnedPatterns(tenantId);
      
      session = {
        id: sessionKey,
        tenantId,
        userId,
        state: hasAccounts > 0 ? ChatState.IDLE : ChatState.ONBOARDING_WELCOME,
        context: {
          userName: user?.fullName?.split(' ')[0] || 'Usuário',
          learnedPatterns,
        },
        history: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      sessions.set(sessionKey, session);
    }
    
    return session;
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
        
      case ChatState.ASKING_ACCOUNT:
        result = await this.handleAskingAccount(session, input);
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
          response: 'Desculpe, algo deu errado. Digite "ajuda" para ver os comandos disponíveis.',
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
      response: 'Não encontrei essa conta. Por favor, escolha uma da lista:',
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
      response: 'Não encontrei essa conta. Por favor, escolha uma da lista:',
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
    if (normalized === 'menu' || normalized.includes('menu principal')) {
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
      return { response: 'Qual o valor da despesa?' };
    }
    if (normalized === '6' || normalized === '6️⃣') {
      session.state = ChatState.ASKING_AMOUNT;
      session.context.tempTransaction = { type: 'income' };
      return { response: 'Qual o valor da receita?' };
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
    
    // Comandos de ajuda
    if (normalized.includes('ajuda') || normalized.includes('help') || normalized === '?') {
      return this.showHelp(session);
    }
    
    // Saudações
    if (['oi', 'olá', 'ola', 'hey', 'bom dia', 'boa tarde', 'boa noite', 'e ai', 'eai'].some(g => normalized.startsWith(g))) {
      return this.greet(session);
    }
    
    // Consulta de saldo
    if (normalized.includes('saldo') || normalized.includes('quanto tenho') || normalized.includes('meu dinheiro')) {
      return this.queryBalance(session);
    }
    
    // Consulta de gastos
    if (normalized.includes('quanto gastei') || normalized.includes('meus gastos') || normalized.includes('minhas despesas')) {
      return this.queryExpenses(session);
    }
    
    // Contas a vencer
    if (normalized.includes('venc') || normalized.includes('pagar') || normalized.includes('pendente')) {
      return this.queryBills(session);
    }
    
    // Planejamento do mês
    if (normalized.includes('planejamento') || normalized.includes('planejar') || normalized.includes('resumo do mês') || normalized.includes('visão geral')) {
      // Se pedir planejamento anual, redirecionar para página
      if (normalized.includes('anual') || normalized.includes('ano') || normalized.includes('12 meses')) {
        return this.showAnnualPlanning(session);
      }
      return this.queryPlanning(session);
    }
    
    // Comando específico: planejamento anual
    if (normalized.includes('planejar ano') || normalized.includes('configurar ano') || normalized.includes('onboarding')) {
      return this.startAnnualPlanningFlow(session);
    }
    
    // Detectar gasto
    const expensePatterns = [
      /gastei\s+r?\$?\s*([\d,\.]+)\s*(?:reais|real)?(?:\s+(?:no|na|em|de|com|pra|para)\s+(.+))?/i,
      /paguei\s+r?\$?\s*([\d,\.]+)\s*(?:reais|real)?(?:\s+(?:no|na|em|de|com|pra|para)\s+(.+))?/i,
      /comprei\s+(.+?)\s+(?:por\s+)?r?\$?\s*([\d,\.]+)/i,
      /^r?\$?\s*([\d,\.]+)\s+(?:no|na|em|de|com)\s+(.+)/i,
    ];
    
    for (const pattern of expensePatterns) {
      const match = input.match(pattern);
      if (match) {
        // Para o padrão "comprei X por Y", o valor está no grupo 2 e descrição no grupo 1
        let amount: number | null;
        let description: string | undefined;
        
        if (pattern.source.startsWith('comprei')) {
          amount = parseMoneyValue(match[2]);
          description = match[1]?.trim();
        } else {
          amount = parseMoneyValue(match[1]);
          description = match[2]?.trim();
        }
        
        if (amount) {
          session.context.tempTransaction = { type: 'expense', amount };
          if (description) {
            session.context.tempTransaction.description = description;
          }
          session.state = ChatState.ADDING_EXPENSE;
          
          // Se temos descrição, sugerir categoria
          if (description) {
            return this.suggestCategoryFromDescription(session);
          }
          
          return {
            response: `💸 Despesa de **R$ ${formatMoney(amount)}**\n\nOnde você gastou?`,
          };
        }
      }
    }
    
    // Detectar receita
    const incomePatterns = [
      /recebi\s+r?\$?\s*([\d,\.]+)\s*(?:reais|real)?(?:\s+(?:de|do|da)\s+(.+))?/i,
      /entrou\s+r?\$?\s*([\d,\.]+)\s*(?:reais|real)?/i,
      /ganhei\s+r?\$?\s*([\d,\.]+)\s*(?:reais|real)?/i,
    ];
    
    for (const pattern of incomePatterns) {
      const match = input.match(pattern);
      if (match) {
        const amount = parseMoneyValue(match[1]);
        if (amount) {
          session.context.tempTransaction = { type: 'income', amount };
          // Se tiver descrição da origem, salvar
          if (match[2]) {
            session.context.tempTransaction.description = match[2].trim();
          }
          session.state = ChatState.ADDING_INCOME;
          return {
            response: `💵 Receita de **R$ ${formatMoney(amount)}**\n\nQual a origem?`,
            quickReplies: ['Salário', 'Freelance', 'Vendas', 'Outros'],
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
          response: `Vi o valor **R$ ${formatMoney(amount)}**.\n\nIsso foi uma despesa ou receita?`,
          options: ['1️⃣ Despesa', '2️⃣ Receita'],
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
    
    // Tentar encontrar padrão aprendido
    const suggested = this.findSuggestedCategory(description, patterns);
    
    if (suggested) {
      session.context.tempTransaction!.categoryId = suggested.categoryId;
      session.context.tempTransaction!.categoryName = suggested.categoryName;
      
      // Se tiver meio de pagamento frequente, sugerir
      if (suggested.paymentMethodId) {
        session.context.tempTransaction!.paymentMethodId = suggested.paymentMethodId;
      }
      
      // Mesmo reconhecendo, precisa perguntar a conta
      session.state = ChatState.ASKING_ACCOUNT;
      
      const amount = session.context.tempTransaction?.amount || 0;
      const avgInfo = suggested.averageAmount 
        ? `\n📊 _Média histórica: R$ ${formatMoney(suggested.averageAmount)}_`
        : '';
      
      // Carregar contas para perguntar
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
      
      // Se só tem uma conta, usar e confirmar
      if (accounts.length === 1) {
        session.context.tempTransaction!.bankAccountId = accounts[0].id;
        session.state = ChatState.CONFIRMING;
        
        return {
          response: `🧠 Reconheci! Baseado no seu histórico:\n\n` +
            `📝 ${description}\n` +
            `💰 R$ ${formatMoney(amount)}\n` +
            `🏷️ ${suggested.categoryName}\n` +
            `🏦 ${accounts[0].name}${avgInfo}\n\n` +
            `Está correto?`,
          quickReplies: ['Sim, confirmar', 'Mudar categoria', 'Cancelar'],
        };
      }
      
      // Se tem múltiplas contas, perguntar
      const options = accounts.map((a, i) => `${i + 1}️⃣ ${a.name}`);
      const quickReplies = accounts.slice(0, 4).map(a => a.name.split(' ')[0]);
      
      return {
        response: `🧠 Reconheci! Baseado no seu histórico:\n\n` +
          `📝 ${description}\n` +
          `💰 R$ ${formatMoney(amount)}\n` +
          `🏷️ ${suggested.categoryName}${avgInfo}\n\n` +
          `De qual conta saiu o dinheiro?`,
        options,
        quickReplies,
      };
    }
    
    // NOVO: Tentar encontrar subcategoria pelo nome da descrição
    const normalizedDesc = description.toLowerCase().trim();
    const subcategoryMatch = await prisma.category.findFirst({
      where: {
        tenantId: session.tenantId,
        type,
        level: { gte: 2 }, // Apenas subcategorias (L2 ou L3)
        isActive: true,
        deletedAt: null,
        name: { contains: normalizedDesc, mode: 'insensitive' },
      },
      include: {
        parent: true,
      },
    });
    
    if (subcategoryMatch) {
      // Encontrou subcategoria direta (ex: "cigarro" -> Cigarro)
      session.context.tempTransaction!.categoryId = subcategoryMatch.id;
      session.context.tempTransaction!.categoryName = subcategoryMatch.name;
      session.state = ChatState.ASKING_ACCOUNT;
      
      const amount = session.context.tempTransaction?.amount || 0;
      const parentName = subcategoryMatch.parent?.name || '';
      
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
      
      if (accounts.length === 1) {
        session.context.tempTransaction!.bankAccountId = accounts[0].id;
        session.state = ChatState.CONFIRMING;
        
        return {
          response: `🎯 Encontrei a categoria!\n\n` +
            `📝 ${description}\n` +
            `💰 R$ ${formatMoney(amount)}\n` +
            `🏷️ ${subcategoryMatch.name}${parentName ? ` (${parentName})` : ''}\n` +
            `🏦 ${accounts[0].name}\n\n` +
            `Está correto?`,
          quickReplies: ['Sim, confirmar', 'Mudar categoria', 'Cancelar'],
        };
      }
      
      const options = accounts.map((a, i) => `${i + 1}️⃣ ${a.name}`);
      const quickReplies = accounts.slice(0, 4).map(a => a.name.split(' ')[0]);
      
      return {
        response: `🎯 Encontrei a categoria!\n\n` +
          `📝 ${description}\n` +
          `💰 R$ ${formatMoney(amount)}\n` +
          `🏷️ ${subcategoryMatch.name}${parentName ? ` (${parentName})` : ''}\n\n` +
          `De qual conta saiu o dinheiro?`,
        options,
        quickReplies,
      };
    }
    
    // Não encontrou padrão, perguntar categoria
    session.state = ChatState.ASKING_CATEGORY;
    return this.askCategory(session);
  }
  
  private async askCategory(session: ChatSession) {
    const type = session.context.tempTransaction?.type || 'expense';
    
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
    
    return {
      response: `Em qual categoria?`,
      options: options.slice(0, 10),
      quickReplies,
    };
  }
  
  private async handleAskingCategory(session: ChatSession, input: string) {
    const type = session.context.tempTransaction?.type || 'expense';
    
    // Se está pedindo subcategoria
    if (session.context.askingSubcategory && session.context.selectedParentCategory) {
      return this.handleAskingSubcategory(session, input);
    }
    
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
    
    // Primeiro, tentar encontrar subcategoria direta pelo nome (ex: "cigarro")
    const subcategory = await prisma.category.findFirst({
      where: {
        tenantId: session.tenantId,
        type,
        level: { gte: 2 },
        isActive: true,
        deletedAt: null,
        name: { contains: normalized, mode: 'insensitive' },
      },
      include: { parent: true },
    });
    
    if (subcategory) {
      session.context.tempTransaction!.categoryId = subcategory.id;
      session.context.tempTransaction!.categoryName = subcategory.name;
      session.state = ChatState.ASKING_ACCOUNT;
      return this.askAccount(session);
    }
    
    // Tentar encontrar por número
    const num = parseInt(normalized);
    let selected: any = null;
    
    if (!isNaN(num) && num >= 1 && num <= categories.length) {
      selected = categories[num - 1];
    } else {
      // Tentar encontrar por nome
      selected = categories.find(c => 
        c.name.toLowerCase().includes(normalized) ||
        normalized.includes(c.name.toLowerCase().replace(/^\W+\s*/, ''))
      );
    }
    
    if (selected) {
      // Verificar se a categoria tem subcategorias
      const subcategories = await prisma.category.findMany({
        where: {
          tenantId: session.tenantId,
          parentId: selected.id,
          isActive: true,
          deletedAt: null,
        },
        orderBy: { name: 'asc' },
      });
      
      if (subcategories.length > 0) {
        // Perguntar pela subcategoria
        session.context.selectedParentCategory = selected;
        session.context.subcategories = subcategories;
        session.context.askingSubcategory = true;
        
        const options = subcategories.map((s, i) => `${i + 1}️⃣ ${s.icon || '📝'} ${s.name}`);
        options.push(`${subcategories.length + 1}️⃣ Usar categoria principal`);
        
        const quickReplies = subcategories.slice(0, 3).map(s => s.name);
        quickReplies.push(selected.name.replace(/^\W+\s*/, ''));
        
        return {
          response: `📁 **${selected.name}** tem subcategorias.\n\nQual você quer usar?`,
          options: options.slice(0, 10),
          quickReplies: quickReplies.slice(0, 4),
        };
      }
      
      // Sem subcategorias, usar diretamente
      session.context.tempTransaction!.categoryId = selected.id;
      session.context.tempTransaction!.categoryName = selected.name;
      session.state = ChatState.ASKING_ACCOUNT;
      return this.askAccount(session);
    }
    
    return {
      response: `Não encontrei a categoria "${input}". Por favor, escolha uma da lista:`,
      options: categories.slice(0, 10).map((c, i) => `${i + 1}️⃣ ${c.name}`),
    };
  }
  
  private async handleAskingSubcategory(session: ChatSession, input: string) {
    const parent = session.context.selectedParentCategory;
    const subcategories = session.context.subcategories || [];
    const normalized = input.toLowerCase().trim();
    
    // Opção de usar categoria principal
    const num = parseInt(normalized);
    if (num === subcategories.length + 1 || normalized.includes('principal') || normalized.includes(parent.name.toLowerCase().replace(/^\W+\s*/, ''))) {
      session.context.tempTransaction!.categoryId = parent.id;
      session.context.tempTransaction!.categoryName = parent.name;
      session.context.askingSubcategory = false;
      session.context.selectedParentCategory = null;
      session.context.subcategories = null;
      session.state = ChatState.ASKING_ACCOUNT;
      return this.askAccount(session);
    }
    
    // Tentar encontrar por número
    if (!isNaN(num) && num >= 1 && num <= subcategories.length) {
      const selected = subcategories[num - 1];
      session.context.tempTransaction!.categoryId = selected.id;
      session.context.tempTransaction!.categoryName = selected.name;
      session.context.askingSubcategory = false;
      session.context.selectedParentCategory = null;
      session.context.subcategories = null;
      session.state = ChatState.ASKING_ACCOUNT;
      return this.askAccount(session);
    }
    
    // Tentar encontrar por nome
    const found = subcategories.find((s: any) => 
      s.name.toLowerCase().includes(normalized) ||
      normalized.includes(s.name.toLowerCase())
    );
    
    if (found) {
      session.context.tempTransaction!.categoryId = found.id;
      session.context.tempTransaction!.categoryName = found.name;
      session.context.askingSubcategory = false;
      session.context.selectedParentCategory = null;
      session.context.subcategories = null;
      session.state = ChatState.ASKING_ACCOUNT;
      return this.askAccount(session);
    }
    
    // Não encontrou, mostrar opções novamente
    const options = subcategories.map((s: any, i: number) => `${i + 1}️⃣ ${s.icon || '📝'} ${s.name}`);
    options.push(`${subcategories.length + 1}️⃣ Usar categoria principal`);
    
    return {
      response: `Não entendi. Por favor, escolha uma subcategoria:`,
      options: options.slice(0, 10),
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
    
    if (accounts.length === 1) {
      // Se só tem uma conta, usar ela
      session.context.tempTransaction!.bankAccountId = accounts[0].id;
      return this.confirmTransaction(session);
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
      return this.confirmTransaction(session);
    }
    
    // Tentar encontrar por nome
    const found = accounts.find(a => 
      a.name.toLowerCase().includes(normalized) ||
      a.institution?.toLowerCase().includes(normalized)
    );
    
    if (found) {
      session.context.tempTransaction!.bankAccountId = found.id;
      return this.confirmTransaction(session);
    }
    
    return {
      response: `Não encontrei a conta "${input}". Por favor, escolha uma da lista:`,
      options: accounts.map((a, i) => `${i + 1}️⃣ ${a.name}`),
    };
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
    
    session.state = ChatState.CONFIRMING;
    
    return {
      response: `📋 **Confirma o lançamento?**\n\n` +
        `${type}\n` +
        `📝 ${tx.description}\n` +
        `💰 R$ ${formatMoney(tx.amount!)}\n` +
        `🏷️ ${tx.categoryName}\n` +
        `🏦 ${account?.name || 'Não definido'}`,
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
    const hour = new Date().getHours();
    let greeting = 'Olá';
    
    if (hour >= 5 && hour < 12) greeting = 'Bom dia';
    else if (hour >= 12 && hour < 18) greeting = 'Boa tarde';
    else greeting = 'Boa noite';
    
    return {
      response: `${greeting}, ${session.context.userName}! 👋\n\nComo posso te ajudar?`,
      quickReplies: ['Planejamento', 'Meu saldo', 'Novo gasto', 'Ajuda'],
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
