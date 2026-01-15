import { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';
import { extractKeywords, calculateSimilarity } from './chatbot.service';
import { cacheService, CacheNamespace } from './cache.service';
import { bankProfileService } from './bank-profiles.service';

const prisma = new PrismaClient();

// ==================== TIPOS ====================

export interface ImportedTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  balance?: number;
  
  // Campos para categorização
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
  categoryId?: string;
  categoryName?: string;
  
  // Status
  isDuplicate?: boolean;
  duplicateOf?: string;
  isSelected?: boolean;
}

export interface ImportPreview {
  id: string;
  fileName: string;
  fileType: 'csv' | 'ofx' | 'xml';
  bankAccount?: {
    id: string;
    name: string;
  };
  totalTransactions: number;
  totalIncome: number;
  totalExpense: number;
  duplicates: number;
  transactions: ImportedTransaction[];
  columnMapping?: ColumnMapping;
  createdAt: Date;
}

export interface ColumnMapping {
  date: number | string;
  description: number | string;
  amount: number | string;
  balance?: number | string;
  type?: number | string;
  dateFormat?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: string[];
}

export interface ImportHistory {
  id: string;
  tenantId: string;
  userId: string;
  fileName: string;
  fileType: string;
  bankAccountId?: string;
  bankAccountName?: string;
  totalImported: number;
  totalSkipped: number;
  totalDuplicates: number;
  status: 'completed' | 'partial' | 'failed';
  createdAt: Date;
}

// Cache de previews em memória (em produção usar Redis)
const previewCache = new Map<string, ImportPreview>();

// ==================== SERVIÇO PRINCIPAL ====================

export class ImportService {
  
  // ==================== PARSE CSV ====================
  
  /**
   * Detectar delimitador do CSV
   */
  detectDelimiter(content: string): string {
    const firstLine = content.split('\n')[0];
    const delimiters = [';', ',', '\t', '|'];
    
    let bestDelimiter = ',';
    let maxCount = 0;
    
    for (const d of delimiters) {
      const count = (firstLine.match(new RegExp(`\\${d}`, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = d;
      }
    }
    
    return bestDelimiter;
  }
  
  /**
   * Parse CSV para array de objetos
   */
  parseCSV(content: string, delimiter?: string): { headers: string[]; rows: string[][] } {
    const lines = content.trim().split('\n').map(l => l.trim()).filter(l => l);
    
    if (lines.length < 2) {
      throw new Error('Arquivo CSV deve ter pelo menos 2 linhas (cabeçalho + dados)');
    }
    
    const actualDelimiter = delimiter || this.detectDelimiter(content);
    
    // Parse com suporte a aspas
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === actualDelimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      
      return result;
    };
    
    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    
    return { headers, rows };
  }
  
  /**
   * Detectar mapeamento automático de colunas
   */
  autoDetectColumns(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = {
      date: -1,
      description: -1,
      amount: -1,
      dateFormat: 'DD/MM/YYYY',
    };
    
    const headerPatterns = {
      date: ['data', 'date', 'dt', 'vencimento', 'lancamento', 'lançamento'],
      description: ['descricao', 'descrição', 'historico', 'histórico', 'memo', 'description', 'nome', 'favorecido'],
      amount: ['valor', 'value', 'amount', 'quantia', 'vlr'],
      balance: ['saldo', 'balance', 'saldo final'],
      type: ['tipo', 'type', 'natureza', 'dc', 'd/c'],
    };
    
    headers.forEach((header, index) => {
      const normalized = header.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      for (const [field, patterns] of Object.entries(headerPatterns)) {
        if (patterns.some(p => normalized.includes(p))) {
          (mapping as any)[field] = index;
          break;
        }
      }
    });
    
    return mapping;
  }
  
  /**
   * Parse data em vários formatos
   */
  parseDate(value: string, format?: string): Date | null {
    if (!value) return null;
    
    // Limpar
    const cleaned = value.trim().replace(/"/g, '');
    
    // Tentar formatos comuns
    const formats = [
      // DD/MM/YYYY
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
      // YYYY-MM-DD
      /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
      // DD/MM/YY
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/,
    ];
    
    for (const regex of formats) {
      const match = cleaned.match(regex);
      if (match) {
        let year: number, month: number, day: number;
        
        if (match[1].length === 4) {
          // YYYY-MM-DD
          year = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          day = parseInt(match[3]);
        } else if (match[3].length === 2) {
          // DD/MM/YY
          day = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          year = 2000 + parseInt(match[3]);
        } else {
          // DD/MM/YYYY
          day = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          year = parseInt(match[3]);
        }
        
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    // Fallback: tentar Date.parse
    const parsed = new Date(cleaned);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  
  /**
   * Parse valor monetário
   */
  parseAmount(value: string): number | null {
    if (!value) return null;
    
    // Limpar
    let cleaned = value.trim().replace(/"/g, '').replace(/\s/g, '');
    
    // Detectar se é negativo
    const isNegative = cleaned.includes('-') || cleaned.includes('(') || cleaned.toLowerCase().includes('d');
    
    // Remover tudo exceto números, vírgula e ponto
    cleaned = cleaned.replace(/[^\d,\.]/g, '');
    
    if (!cleaned) return null;
    
    // Formato brasileiro: 1.234,56 -> 1234.56
    if (cleaned.includes(',')) {
      // Verificar se vírgula é separador decimal
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      
      if (lastComma > lastDot) {
        // Vírgula é decimal: 1.234,56
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // Ponto é decimal: 1,234.56
        cleaned = cleaned.replace(/,/g, '');
      }
    }
    
    const amount = parseFloat(cleaned);
    if (isNaN(amount)) return null;
    
    return isNegative ? -Math.abs(amount) : amount;
  }
  
  // ==================== PARSE OFX ====================
  
  /**
   * Parse arquivo OFX
   */
  parseOFX(content: string): ImportedTransaction[] {
    const transactions: ImportedTransaction[] = [];
    
    // OFX usa tags tipo SGML
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    const matches = content.matchAll(stmtTrnRegex);
    
    for (const match of matches) {
      const block = match[1];
      
      const getValue = (tag: string): string => {
        const regex = new RegExp(`<${tag}>([^<\\n]+)`, 'i');
        const m = block.match(regex);
        return m ? m[1].trim() : '';
      };
      
      const dtPosted = getValue('DTPOSTED');
      const trnAmt = getValue('TRNAMT');
      const name = getValue('NAME') || getValue('MEMO');
      const fitId = getValue('FITID');
      const trnType = getValue('TRNTYPE');
      
      // Parse data OFX: YYYYMMDD ou YYYYMMDDHHMMSS
      let date: Date | null = null;
      if (dtPosted) {
        const year = parseInt(dtPosted.substring(0, 4));
        const month = parseInt(dtPosted.substring(4, 6)) - 1;
        const day = parseInt(dtPosted.substring(6, 8));
        date = new Date(year, month, day);
      }
      
      const amount = parseFloat(trnAmt);
      
      if (date && !isNaN(amount)) {
        // Determinar tipo baseado no valor, TRNTYPE e descrição
        // No OFX: valores positivos = crédito (receita), negativos = débito (despesa)
        // TRNTYPE pode ser: CREDIT, DEBIT, INT, DIV, FEE, SRVCHG, DEP, ATM, POS, XFER, CHECK, PAYMENT, CASH, DIRECTDEP, DIRECTDEBIT, REPEATPMT, OTHER
        let type: 'income' | 'expense';
        
        // Verificar descrição para identificar transferências enviadas/recebidas
        // IMPORTANTE: Verificar "recebida" PRIMEIRO, pois tem prioridade
        const descLower = name.toLowerCase();
        const isRecebida = descLower.includes('recebida') || descLower.includes('recebido') || 
                          descLower.includes('deposito') || descLower.includes('depósito') ||
                          descLower.includes('credito em conta') || descLower.includes('crédito em conta');
        const isEnviada = descLower.includes('enviada') || descLower.includes('enviado') || 
                         descLower.includes('envio') || descLower.includes('debito') ||
                         descLower.includes('débito') || descLower.includes('saque');
        
        // Prioridade: "recebida" sempre é receita, mesmo se contiver outras palavras
        if (isRecebida) {
          // Transferência recebida = RECEITA
          type = 'income';
        } else if (isEnviada) {
          // Transferência enviada = DESPESA
          type = 'expense';
        } else if (trnType) {
          const upperType = trnType.toUpperCase();
          const incomeTypes = ['CREDIT', 'DEP', 'INT', 'DIV', 'DIRECTDEP'];
          const expenseTypes = ['DEBIT', 'FEE', 'SRVCHG', 'ATM', 'POS', 'CHECK', 'PAYMENT', 'DIRECTDEBIT', 'REPEATPMT', 'CASH', 'XFER'];
          
          if (incomeTypes.includes(upperType)) {
            type = 'income';
          } else if (expenseTypes.includes(upperType)) {
            type = 'expense';
          } else {
            // Fallback para o sinal do valor
            type = amount >= 0 ? 'income' : 'expense';
          }
        } else {
          // Sem TRNTYPE, usar sinal do valor
          type = amount >= 0 ? 'income' : 'expense';
        }
        
        transactions.push({
          id: fitId || `ofx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          date,
          description: name,
          amount: Math.abs(amount),
          type,
          isSelected: true,
        });
      }
    }
    
    return transactions;
  }
  
  // ==================== PARSE XML ====================
  
  /**
   * Parse arquivo XML de extrato bancário
   * Suporta formatos comuns de bancos brasileiros
   */
  parseXML(content: string): ImportedTransaction[] {
    const transactions: ImportedTransaction[] = [];
    
    // Função helper para extrair valor de tag
    const getTagValue = (block: string, tagName: string): string => {
      // Tentar vários formatos de tags
      const patterns = [
        new RegExp(`<${tagName}>([^<]+)</${tagName}>`, 'i'),
        new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`, 'i'),
        new RegExp(`<${tagName}[^>]*/>`, 'i'),
      ];
      
      for (const regex of patterns) {
        const match = block.match(regex);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      return '';
    };
    
    // Detectar padrão do XML (diferentes bancos usam diferentes estruturas)
    const lowerContent = content.toLowerCase();
    
    // Padrão 1: Tags <transacao> ou <lancamento>
    let transactionTagPattern: RegExp;
    let dateTag: string, descTag: string, amountTag: string, typeTag: string;
    
    if (lowerContent.includes('<transacao>') || lowerContent.includes('<transacao ')) {
      transactionTagPattern = /<transacao[^>]*>([\s\S]*?)<\/transacao>/gi;
      dateTag = 'data';
      descTag = 'descricao';
      amountTag = 'valor';
      typeTag = 'tipo';
    } else if (lowerContent.includes('<lancamento>') || lowerContent.includes('<lancamento ')) {
      transactionTagPattern = /<lancamento[^>]*>([\s\S]*?)<\/lancamento>/gi;
      dateTag = 'data';
      descTag = 'historico';
      amountTag = 'valor';
      typeTag = 'natureza';
    } else if (lowerContent.includes('<movimento>')) {
      transactionTagPattern = /<movimento[^>]*>([\s\S]*?)<\/movimento>/gi;
      dateTag = 'dataMovimento';
      descTag = 'descricao';
      amountTag = 'valor';
      typeTag = 'tipoMovimento';
    } else if (lowerContent.includes('<registro>')) {
      transactionTagPattern = /<registro[^>]*>([\s\S]*?)<\/registro>/gi;
      dateTag = 'data';
      descTag = 'descricao';
      amountTag = 'valor';
      typeTag = 'dc';
    } else if (lowerContent.includes('<item>')) {
      transactionTagPattern = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      dateTag = 'date';
      descTag = 'description';
      amountTag = 'amount';
      typeTag = 'type';
    } else {
      // Tentar detectar qualquer tag que pareça conter transações
      const possibleTags = content.match(/<([a-z_]+)[^>]*>(?:(?!<\/\1>).)*<data|date|DATA|Date/gi);
      if (possibleTags && possibleTags.length > 0) {
        const tagName = possibleTags[0].match(/<([a-z_]+)/i)?.[1] || 'row';
        transactionTagPattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi');
        dateTag = 'data';
        descTag = 'descricao';
        amountTag = 'valor';
        typeTag = 'tipo';
      } else {
        log.warn('[Import] Formato XML não reconhecido');
        return transactions;
      }
    }
    
    const matches = content.matchAll(transactionTagPattern);
    
    for (const match of matches) {
      const block = match[1];
      
      // Extrair valores com fallbacks para nomes de tags alternativos
      let dateStr = getTagValue(block, dateTag) || 
                    getTagValue(block, 'data') || 
                    getTagValue(block, 'date') || 
                    getTagValue(block, 'dtMovimento') ||
                    getTagValue(block, 'dataMovimento');
                    
      let description = getTagValue(block, descTag) || 
                        getTagValue(block, 'descricao') || 
                        getTagValue(block, 'historico') ||
                        getTagValue(block, 'description') ||
                        getTagValue(block, 'memo') ||
                        getTagValue(block, 'nome');
                        
      let amountStr = getTagValue(block, amountTag) || 
                      getTagValue(block, 'valor') || 
                      getTagValue(block, 'amount') ||
                      getTagValue(block, 'vlr');
                      
      let typeStr = getTagValue(block, typeTag) || 
                    getTagValue(block, 'tipo') ||
                    getTagValue(block, 'natureza') ||
                    getTagValue(block, 'dc') ||
                    getTagValue(block, 'type');
      
      // Parse da data
      const date = this.parseDate(dateStr);
      if (!date) continue;
      
      // Parse do valor
      const amount = this.parseAmount(amountStr);
      if (amount === null || amount === 0) continue;
      
      // Determinar tipo
      let type: 'income' | 'expense';
      
      const typeUpper = typeStr.toUpperCase();
      const descLower = description.toLowerCase();
      
      if (typeUpper === 'C' || typeUpper === 'CREDITO' || typeUpper === 'CREDIT' || typeUpper === 'RECEITA' || typeUpper === 'INCOME') {
        type = 'income';
      } else if (typeUpper === 'D' || typeUpper === 'DEBITO' || typeUpper === 'DEBIT' || typeUpper === 'DESPESA' || typeUpper === 'EXPENSE') {
        type = 'expense';
      } else if (descLower.includes('recebid') || descLower.includes('deposito') || descLower.includes('credito')) {
        type = 'income';
      } else if (descLower.includes('pagamento') || descLower.includes('debito') || descLower.includes('saque')) {
        type = 'expense';
      } else {
        type = amount >= 0 ? 'income' : 'expense';
      }
      
      transactions.push({
        id: `xml-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        date,
        description,
        amount: Math.abs(amount),
        type,
        isSelected: true,
      });
    }
    
    log.info(`[Import] XML parseado: ${transactions.length} transações encontradas`);
    return transactions;
  }
  
  // ==================== CATEGORIZAÇÃO ====================
  
  /**
   * Carregar padrões de categorização do tenant
   */
  async loadCategorizationPatterns(tenantId: string) {
    // Buscar transações recentes para aprender padrões - APENAS com categorias L2/L3
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        deletedAt: null,
        description: { not: null },
        categoryId: { not: null },
        category: {
          level: { gte: 2 }, // Apenas subcategorias L2 ou L3
        },
      },
      select: {
        description: true,
        categoryId: true,
        category: { select: { name: true, type: true, level: true } },
      },
      orderBy: { transactionDate: 'desc' },
      take: 500,
    });
    
    // Agrupar por descrição normalizada
    const patterns = new Map<string, { categoryId: string; categoryName: string; count: number }>();
    
    for (const tx of transactions) {
      if (!tx.description) continue;
      
      const normalized = tx.description.toLowerCase().trim();
      const existing = patterns.get(normalized);
      
      if (existing) {
        existing.count++;
      } else {
        patterns.set(normalized, {
          categoryId: tx.categoryId!,
          categoryName: tx.category?.name || '',
          count: 1,
        });
      }
    }
    
    return Array.from(patterns.entries()).map(([desc, data]) => ({
      description: desc,
      keywords: extractKeywords(desc),
      ...data,
    }));
  }
  
  /**
   * Sugerir categoria para uma descrição
   * Usa padrões do histórico do usuário + padrões globais do banco
   */
  async suggestCategory(
    tenantId: string,
    description: string,
    type: 'income' | 'expense',
    patterns: any[],
    bankCode?: string
  ): Promise<{ categoryId: string; categoryName: string } | null> {
    const normalized = description.toLowerCase().trim();
    const keywords = extractKeywords(description);
    
    // Match exato no histórico do usuário
    const exact = patterns.find(p => p.description === normalized);
    if (exact) {
      return { categoryId: exact.categoryId, categoryName: exact.categoryName };
    }
    
    // Match por similaridade no histórico
    let bestMatch: any = null;
    let bestScore = 0;
    
    for (const pattern of patterns) {
      const similarity = calculateSimilarity(keywords, pattern.keywords);
      if (similarity > bestScore && similarity >= 0.5) {
        bestScore = similarity;
        bestMatch = pattern;
      }
    }
    
    if (bestMatch) {
      return { categoryId: bestMatch.categoryId, categoryName: bestMatch.categoryName };
    }
    
    // NOVO: Usar padrões globais do bank-profiles.service
    // Buscar o perfil do banco se tiver o código
    const bankProfile = bankCode ? bankProfileService.getProfileByCode(bankCode) : null;
    const suggestedCategory = bankProfileService.suggestCategoryFromPatterns(description, type, bankProfile);
    if (suggestedCategory) {
      // Buscar categoria correspondente no tenant - APENAS L2 ou L3 (subcategorias)
      const categoryName = suggestedCategory.categoryName.split(' > ')[0];
      const category = await prisma.category.findFirst({
        where: {
          tenantId,
          type,
          name: { contains: categoryName, mode: 'insensitive' },
          isActive: true,
          deletedAt: null,
          level: { gte: 2 }, // Apenas subcategorias L2 ou L3
        },
      });
      
      if (category) {
        return { categoryId: category.id, categoryName: category.name };
      }
    }
    
    // Fallback: buscar por palavras-chave locais
    const keywordCategories: Record<string, string[]> = {
      'Alimentação': ['mercado', 'supermercado', 'restaurante', 'ifood', 'padaria', 'lanchonete', 'pizzaria', 'hamburgueria'],
      'Transporte': ['uber', '99', 'combustível', 'gasolina', 'estacionamento', 'pedágio', 'ipva'],
      'Moradia': ['aluguel', 'condomínio', 'iptu', 'luz', 'energia', 'água', 'gás'],
      'Saúde': ['farmácia', 'drogaria', 'hospital', 'médico', 'plano de saúde', 'unimed'],
      'Educação': ['escola', 'faculdade', 'curso', 'livro', 'udemy'],
      'Lazer': ['cinema', 'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'steam', 'playstation'],
      'Vestuário': ['roupa', 'calçado', 'tênis', 'renner', 'riachuelo', 'c&a', 'zara'],
      'Tecnologia': ['celular', 'notebook', 'computador', 'eletrônico', 'kabum', 'pichau'],
    };
    
    for (const [categoryName, words] of Object.entries(keywordCategories)) {
      if (words.some(w => normalized.includes(w))) {
        // Buscar categoria correspondente - APENAS L2 ou L3 (subcategorias)
        const category = await prisma.category.findFirst({
          where: {
            tenantId,
            type,
            name: { contains: categoryName, mode: 'insensitive' },
            isActive: true,
            deletedAt: null,
            level: { gte: 2 }, // Apenas subcategorias L2 ou L3
          },
        });
        
        if (category) {
          return { categoryId: category.id, categoryName: category.name };
        }
      }
    }
    
    return null;
  }
  
  // ==================== DETECÇÃO DE DUPLICATAS ====================
  
  /**
   * Verificar se transação já existe
   */
  async checkDuplicate(
    tenantId: string,
    date: Date,
    amount: number,
    description: string
  ): Promise<string | null> {
    // Buscar transações no mesmo dia com mesmo valor
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existing = await prisma.transaction.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        transactionDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        amount: {
          gte: amount - 0.01,
          lte: amount + 0.01,
        },
      },
      select: { id: true, description: true },
    });
    
    if (existing) {
      // Verificar similaridade da descrição
      const similarity = calculateSimilarity(
        extractKeywords(description),
        extractKeywords(existing.description || '')
      );
      
      if (similarity >= 0.5) {
        return existing.id;
      }
    }
    
    return null;
  }
  
  // ==================== CRIAR PREVIEW ====================
  
  /**
   * Criar preview de importação CSV
   */
  async createCSVPreview(
    tenantId: string,
    userId: string,
    fileName: string,
    content: string,
    columnMapping?: ColumnMapping
  ): Promise<ImportPreview> {
    const { headers, rows } = this.parseCSV(content);
    
    // Auto detectar colunas se não informado
    const mapping = columnMapping || this.autoDetectColumns(headers);
    
    // Validar mapeamento
    if (mapping.date === -1 || mapping.description === -1 || mapping.amount === -1) {
      throw new Error('Não foi possível detectar as colunas automaticamente. Por favor, mapeie manualmente.');
    }
    
    // Carregar padrões de categorização
    const patterns = await this.loadCategorizationPatterns(tenantId);
    
    const transactions: ImportedTransaction[] = [];
    let totalIncome = 0;
    let totalExpense = 0;
    let duplicates = 0;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      const dateValue = typeof mapping.date === 'number' ? row[mapping.date] : row[headers.indexOf(mapping.date as string)];
      const descValue = typeof mapping.description === 'number' ? row[mapping.description] : row[headers.indexOf(mapping.description as string)];
      const amountValue = typeof mapping.amount === 'number' ? row[mapping.amount] : row[headers.indexOf(mapping.amount as string)];
      
      const date = this.parseDate(dateValue, mapping.dateFormat);
      const amount = this.parseAmount(amountValue);
      const description = descValue?.trim() || '';
      
      if (!date || amount === null) {
        continue; // Pular linhas inválidas
      }
      
      const type: 'income' | 'expense' = amount >= 0 ? 'income' : 'expense';
      const absAmount = Math.abs(amount);
      
      // Verificar duplicata
      const duplicateOf = await this.checkDuplicate(tenantId, date, absAmount, description);
      
      // Sugerir categoria
      const suggested = await this.suggestCategory(tenantId, description, type, patterns);
      
      const tx: ImportedTransaction = {
        id: `csv-${i}-${Date.now()}`,
        date,
        description,
        amount: absAmount,
        type,
        suggestedCategoryId: suggested?.categoryId,
        suggestedCategoryName: suggested?.categoryName,
        categoryId: suggested?.categoryId,
        categoryName: suggested?.categoryName,
        isDuplicate: !!duplicateOf,
        duplicateOf: duplicateOf || undefined,
        isSelected: !duplicateOf,
      };
      
      transactions.push(tx);
      
      if (type === 'income') {
        totalIncome += absAmount;
      } else {
        totalExpense += absAmount;
      }
      
      if (duplicateOf) {
        duplicates++;
      }
    }
    
    const preview: ImportPreview = {
      id: `preview-${tenantId}-${Date.now()}`,
      fileName,
      fileType: 'csv',
      totalTransactions: transactions.length,
      totalIncome,
      totalExpense,
      duplicates,
      transactions,
      columnMapping: mapping,
      createdAt: new Date(),
    };
    
    // Salvar em cache
    previewCache.set(preview.id, preview);
    
    return preview;
  }
  
  /**
   * Criar preview de importação OFX
   */
  async createOFXPreview(
    tenantId: string,
    userId: string,
    fileName: string,
    content: string
  ): Promise<ImportPreview> {
    const transactions = this.parseOFX(content);
    
    // Carregar padrões de categorização
    const patterns = await this.loadCategorizationPatterns(tenantId);
    
    let totalIncome = 0;
    let totalExpense = 0;
    let duplicates = 0;
    
    // Processar cada transação
    for (const tx of transactions) {
      // Verificar duplicata
      const duplicateOf = await this.checkDuplicate(tenantId, tx.date, tx.amount, tx.description);
      tx.isDuplicate = !!duplicateOf;
      tx.duplicateOf = duplicateOf || undefined;
      tx.isSelected = !duplicateOf;
      
      // Sugerir categoria
      const suggested = await this.suggestCategory(tenantId, tx.description, tx.type, patterns);
      tx.suggestedCategoryId = suggested?.categoryId;
      tx.suggestedCategoryName = suggested?.categoryName;
      tx.categoryId = suggested?.categoryId;
      tx.categoryName = suggested?.categoryName;
      
      if (tx.type === 'income') {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
      }
      
      if (duplicateOf) {
        duplicates++;
      }
    }
    
    const preview: ImportPreview = {
      id: `preview-${tenantId}-${Date.now()}`,
      fileName,
      fileType: 'ofx',
      totalTransactions: transactions.length,
      totalIncome,
      totalExpense,
      duplicates,
      transactions,
      createdAt: new Date(),
    };
    
    // Salvar em cache
    previewCache.set(preview.id, preview);
    
    return preview;
  }
  
  /**
   * Criar preview de importação XML
   */
  async createXMLPreview(
    tenantId: string,
    userId: string,
    fileName: string,
    content: string
  ): Promise<ImportPreview> {
    const transactions = this.parseXML(content);
    
    if (transactions.length === 0) {
      throw new Error('Nenhuma transação encontrada no arquivo XML. Verifique se o formato é suportado.');
    }
    
    // Carregar padrões de categorização
    const patterns = await this.loadCategorizationPatterns(tenantId);
    
    let totalIncome = 0;
    let totalExpense = 0;
    let duplicates = 0;
    
    // Processar cada transação
    for (const tx of transactions) {
      // Verificar duplicata
      const duplicateOf = await this.checkDuplicate(tenantId, tx.date, tx.amount, tx.description);
      tx.isDuplicate = !!duplicateOf;
      tx.duplicateOf = duplicateOf || undefined;
      tx.isSelected = !duplicateOf;
      
      // Sugerir categoria
      const suggested = await this.suggestCategory(tenantId, tx.description, tx.type, patterns);
      tx.suggestedCategoryId = suggested?.categoryId;
      tx.suggestedCategoryName = suggested?.categoryName;
      tx.categoryId = suggested?.categoryId;
      tx.categoryName = suggested?.categoryName;
      
      if (tx.type === 'income') {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
      }
      
      if (duplicateOf) {
        duplicates++;
      }
    }
    
    const preview: ImportPreview = {
      id: `preview-${tenantId}-${Date.now()}`,
      fileName,
      fileType: 'xml',
      totalTransactions: transactions.length,
      totalIncome,
      totalExpense,
      duplicates,
      transactions,
      createdAt: new Date(),
    };
    
    // Salvar em cache
    previewCache.set(preview.id, preview);
    
    log.info(`[Import] XML preview criado: ${preview.id} - ${transactions.length} transações`);
    
    return preview;
  }
  
  /**
   * Obter preview do cache
   */
  getPreview(previewId: string): ImportPreview | null {
    return previewCache.get(previewId) || null;
  }
  
  /**
   * Atualizar transação no preview
   */
  updatePreviewTransaction(
    previewId: string,
    transactionId: string,
    updates: Partial<ImportedTransaction>
  ): boolean {
    const preview = previewCache.get(previewId);
    if (!preview) return false;
    
    const tx = preview.transactions.find(t => t.id === transactionId);
    if (!tx) return false;
    
    Object.assign(tx, updates);
    return true;
  }
  
  // ==================== CONFIRMAR IMPORTAÇÃO ====================
  
  /**
   * Confirmar e salvar transações
   */
  async confirmImport(
    tenantId: string,
    userId: string,
    previewId: string,
    bankAccountId: string,
    paymentMethodId?: string
  ): Promise<ImportResult> {
    const preview = previewCache.get(previewId);
    
    if (!preview) {
      throw new Error('Preview não encontrado ou expirado');
    }
    
    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      duplicates: 0,
      errors: [],
    };
    
    // Filtrar transações selecionadas
    const selected = preview.transactions.filter(t => t.isSelected && !t.isDuplicate);
    const duplicatesSkipped = preview.transactions.filter(t => t.isDuplicate);
    const unselected = preview.transactions.filter(t => !t.isSelected && !t.isDuplicate);
    
    result.duplicates = duplicatesSkipped.length;
    result.skipped = unselected.length;
    
    // Importar em lote
    for (const tx of selected) {
      try {
        await prisma.transaction.create({
          data: {
            tenantId,
            userId,
            type: tx.type,
            categoryId: tx.categoryId || null,
            bankAccountId,
            paymentMethodId: paymentMethodId || null,
            amount: tx.amount,
            description: tx.description,
            transactionDate: tx.date,
            status: 'completed',
            transactionType: 'single',
            isFixed: false,
            notes: `Importado de: ${preview.fileName}`,
          },
        });
        
        // Atualizar saldo da conta
        const multiplier = tx.type === 'income' ? 1 : -1;
        await prisma.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            currentBalance: {
              increment: tx.amount * multiplier,
            },
          },
        });
        
        result.imported++;
      } catch (error: any) {
        result.errors.push(`Erro ao importar "${tx.description}": ${error.message}`);
      }
    }
    
    // Log do histórico (sem salvar em tabela por enquanto)
    log.info(`[Import] Histórico: ${preview.fileName} - ${result.imported} importadas, ${result.skipped} ignoradas, ${result.duplicates} duplicadas`);
    
    // Limpar cache do preview
    previewCache.delete(previewId);
    
    // Invalidar cache do dashboard para forçar recálculo
    await cacheService.invalidateNamespace(CacheNamespace.DASHBOARD);
    log.info(`[Import] Cache do dashboard invalidado após importação`);
    
    return result;
  }
  
  /**
   * Obter histórico de importações
   * TODO: Implementar tabela ImportHistory no schema se necessário
   */
  async getHistory(tenantId: string): Promise<ImportHistory[]> {
    // ImportHistory table não existe no schema atual
    // Retorna lista vazia por enquanto
    log.info(`[Import] getHistory chamado para tenant ${tenantId} - tabela ImportHistory não implementada`);
    return [];
  }
  
  /**
   * Desfazer importação
   * TODO: Implementar quando tabela ImportHistory for criada
   */
  async undoImport(tenantId: string, historyId: string): Promise<number> {
    // ImportHistory table não existe no schema atual
    log.warn(`[Import] undoImport não disponível - tabela ImportHistory não implementada`);
    throw new Error('Funcionalidade de desfazer importação ainda não disponível');
  }
}

// Singleton
export const importService = new ImportService();
