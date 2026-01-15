/**
 * FASE 2.4: Utilities for normalizing and analyzing transaction descriptions
 * Used for transfer detection, dedupe, and categorization
 */

// ==================== NORMALIZATION ====================

/**
 * Normalize a transaction description for matching
 * - Uppercase
 * - Remove accents
 * - Remove special characters
 * - Collapse whitespace
 * - Remove masked tokens (CPF, card numbers, etc.)
 */
export function normalizeDescription(text: string | null | undefined): string {
  if (!text) return '';
  
  let normalized = text
    // Uppercase
    .toUpperCase()
    // Remove accents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove special chars but keep alphanumeric and spaces
    .replace(/[•…*#@$%&()[\]{}|\\/<>+=_~`^"']/g, ' ')
    // Remove masked tokens like **** or XXXX or CPF partially hidden
    .replace(/\*{2,}/g, ' ')
    .replace(/X{2,}/g, ' ')
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, ' ') // CPF
    .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, ' ') // CNPJ
    .replace(/\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/g, ' ') // Card number
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
  
  return normalized;
}

/**
 * Extract meaningful tokens from normalized description
 */
export function extractTokens(normalized: string): string[] {
  if (!normalized) return [];
  
  // Split by space and filter short/common words
  const stopWords = new Set([
    'DE', 'DA', 'DO', 'DOS', 'DAS', 'EM', 'NO', 'NA', 'NOS', 'NAS',
    'PARA', 'POR', 'COM', 'SEM', 'ENTRE', 'SOBRE', 'ATE', 'E', 'OU',
    'A', 'O', 'AS', 'OS', 'UM', 'UMA', 'UNS', 'UMAS', 'LTDA', 'SA',
    'ME', 'EIRELI', 'EPP', 'BR', 'CONTA', 'REF', 'NR', 'CPF', 'CNPJ'
  ]);
  
  return normalized
    .split(/\s+/)
    .filter(token => 
      token.length >= 2 && 
      !stopWords.has(token) &&
      !/^\d+$/.test(token) // Remove pure numbers
    );
}

// ==================== TRANSFER DETECTION TOKENS ====================

/**
 * Tokens that indicate a transfer (high confidence)
 */
export const TRANSFER_TOKENS = [
  'TRANSFERENCIA', 'TRANSFER', 'TRANSF',
  'TED', 'DOC', 'PIX',
  'ENVIO', 'ENVIADA', 'ENVIADO', 'ENVIAR',
  'RECEBIDO', 'RECEBIDA', 'RECEBER',
  'ENTRE CONTAS', 'MESMA TITULARIDADE',
  'CREDITO CONTA', 'DEBITO CONTA'
];

/**
 * Tokens that indicate invoice payment (fatura)
 */
export const INVOICE_PAYMENT_TOKENS = [
  'PAGAMENTO FATURA', 'PAGAMENTO DE FATURA', 'PGTO FATURA',
  'FATURA CARTAO', 'FATURA DO CARTAO',
  'PAG FATURA', 'PGTO FAT',
  'PARCIAL FATURA', 'FATURA PARCIAL'
];

/**
 * Tokens that indicate fees/charges (LOSS)
 */
export const FEE_TOKENS = [
  'JUROS', 'MULTA', 'TARIFA', 'TAXA',
  'ENCARGO', 'ENCARGOS', 'IOF',
  'ANUIDADE', 'MORA', 'ADICIONAL',
  'COBRANCA', 'ATRASO'
];

/**
 * Tokens that indicate purchases/merchants (NOT transfers)
 */
export const PURCHASE_TOKENS = [
  'SUPERMERCADO', 'MERCADO', 'RESTAURANTE', 'LANCHONETE',
  'FARMACIA', 'DROGARIA', 'POSTO', 'COMBUSTIVEL', 'GASOLINA',
  'LOJA', 'SHOPPING', 'COMPRA', 'IFOOD', 'RAPPI', 'UBER EATS',
  'NETFLIX', 'SPOTIFY', 'AMAZON', 'MERCADO LIVRE', 'MAGAZINE',
  'PADARIA', 'CAFETERIA', 'BAR', 'PUB', 'CINEMA', 'TEATRO'
];

/**
 * Bank-specific tokens for better matching
 */
export const BANK_TOKENS: Record<string, string[]> = {
  NUBANK: ['NUBANK', 'NU PAGAMENTOS', 'NUCONTA'],
  INTER: ['INTER', 'BANCO INTER', 'INTERMEDIUM'],
  ITAU: ['ITAU', 'ITAUCARD', 'ITAU UNIBANCO'],
  BRADESCO: ['BRADESCO', 'BRADESCARD'],
  SANTANDER: ['SANTANDER', 'GETNET'],
  BB: ['BANCO DO BRASIL', 'BB', 'OUROCARD'],
  CAIXA: ['CAIXA', 'CEF', 'CAIXA ECONOMICA'],
  C6: ['C6', 'C6 BANK'],
  ORIGINAL: ['ORIGINAL', 'BANCO ORIGINAL'],
  PAN: ['PAN', 'BANCO PAN'],
  NEON: ['NEON', 'BANCO NEON'],
  NEXT: ['NEXT', 'BANCO NEXT'],
  PICPAY: ['PICPAY', 'PIC PAY'],
  MERCADOPAGO: ['MERCADOPAGO', 'MERCADO PAGO', 'ML']
};

// ==================== SCORING FUNCTIONS ====================

export interface TransferScore {
  score: number;
  reasons: string[];
  isLikelyTransfer: boolean;
}

/**
 * Score how likely a description represents a transfer
 * Higher score = more likely to be transfer
 */
export function scoreTransferLikelihood(normalized: string): TransferScore {
  const reasons: string[] = [];
  let score = 0;
  
  const upper = normalized.toUpperCase();
  
  // Check transfer tokens (+3 each)
  for (const token of TRANSFER_TOKENS) {
    if (upper.includes(token)) {
      score += 3;
      reasons.push(`contains_${token.toLowerCase().replace(/\s+/g, '_')}`);
    }
  }
  
  // Check if mentions same bank/account transfer (+2)
  if (upper.includes('ENTRE CONTAS') || upper.includes('MESMA TITULAR')) {
    score += 2;
    reasons.push('between_accounts');
  }
  
  // Check for bank names (indicates inter-bank transfer) (+2)
  for (const [bank, tokens] of Object.entries(BANK_TOKENS)) {
    if (tokens.some(t => upper.includes(t))) {
      score += 1;
      reasons.push(`bank_${bank.toLowerCase()}`);
    }
  }
  
  // Check for purchase tokens (decreases score) (-5)
  for (const token of PURCHASE_TOKENS) {
    if (upper.includes(token)) {
      score -= 5;
      reasons.push(`purchase_${token.toLowerCase()}`);
      break; // Only penalize once
    }
  }
  
  return {
    score,
    reasons,
    isLikelyTransfer: score >= 3
  };
}

export interface InvoicePaymentScore {
  score: number;
  reasons: string[];
  isLikelyInvoicePayment: boolean;
}

/**
 * Score how likely a description represents an invoice/credit card payment
 */
export function scoreInvoicePaymentLikelihood(normalized: string): InvoicePaymentScore {
  const reasons: string[] = [];
  let score = 0;
  
  const upper = normalized.toUpperCase();
  
  // Check invoice payment tokens (+5 each)
  for (const token of INVOICE_PAYMENT_TOKENS) {
    if (upper.includes(token)) {
      score += 5;
      reasons.push(`contains_${token.toLowerCase().replace(/\s+/g, '_')}`);
    }
  }
  
  // Check for generic payment + card reference (+3)
  if (upper.includes('PAGAMENTO') && (upper.includes('CARTAO') || upper.includes('CREDITO'))) {
    score += 3;
    reasons.push('payment_card_reference');
  }
  
  // Check for specific bank card names
  if (upper.includes('NUCARD') || upper.includes('ITAUCARD') || 
      upper.includes('BRADESCARD') || upper.includes('OUROCARD')) {
    score += 3;
    reasons.push('card_brand');
  }
  
  return {
    score,
    reasons,
    isLikelyInvoicePayment: score >= 5
  };
}

export interface FeeScore {
  score: number;
  reasons: string[];
  isLikelyFee: boolean;
}

/**
 * Score how likely a description represents a fee/charge (LOSS)
 */
export function scoreFeeLikelihood(normalized: string): FeeScore {
  const reasons: string[] = [];
  let score = 0;
  
  const upper = normalized.toUpperCase();
  
  // Check fee tokens (+4 each)
  for (const token of FEE_TOKENS) {
    if (upper.includes(token)) {
      score += 4;
      reasons.push(`contains_${token.toLowerCase()}`);
    }
  }
  
  return {
    score,
    reasons,
    isLikelyFee: score >= 4
  };
}

// ==================== HASH GENERATION ====================

/**
 * Generate a deduplication hash for a transaction
 * Used when FITID is not available
 */
export function generateDedupeHash(
  date: Date,
  amount: number,
  normalizedDescription: string,
  accountId: string
): string {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const amountStr = Math.abs(amount).toFixed(2);
  
  // Simple hash - in production could use crypto.createHash('sha256')
  const input = `${dateStr}|${amountStr}|${normalizedDescription.substring(0, 50)}|${accountId}`;
  
  // Simple string hash for now
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `hash-${Math.abs(hash).toString(16)}`;
}

// ==================== TRANSFER PAIRING ====================

export interface TransactionCandidate {
  id: string;
  date: Date;
  amount: number;
  normalizedDescription: string;
  accountId: string;
  type: 'income' | 'expense';
}

export interface TransferMatch {
  outTransaction: TransactionCandidate;
  inTransaction: TransactionCandidate;
  score: number;
  reasons: string[];
}

/**
 * Find matching transfer pairs from a list of transactions
 * Returns pairs where one is outgoing (expense) and one is incoming (income)
 */
export function findTransferPairs(transactions: TransactionCandidate[]): TransferMatch[] {
  const matches: TransferMatch[] = [];
  const usedIds = new Set<string>();
  
  // Separate by type
  const outgoing = transactions.filter(t => t.type === 'expense' && t.amount < 0);
  const incoming = transactions.filter(t => t.type === 'income' && t.amount > 0);
  
  // For each outgoing, find best matching incoming
  for (const out of outgoing) {
    if (usedIds.has(out.id)) continue;
    
    let bestMatch: TransferMatch | null = null;
    let bestScore = 0;
    
    for (const inc of incoming) {
      if (usedIds.has(inc.id)) continue;
      
      // Check amount match (tolerance 0.01)
      if (Math.abs(Math.abs(out.amount) - Math.abs(inc.amount)) > 0.01) continue;
      
      // Check date match (±1 day)
      const dayDiff = Math.abs(
        (out.date.getTime() - inc.date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (dayDiff > 1) continue;
      
      // Must be different accounts (or at least not the same)
      const differentAccounts = out.accountId !== inc.accountId;
      
      // Score this match
      let score = 0;
      const reasons: string[] = [];
      
      // Same date bonus
      if (dayDiff === 0) {
        score += 2;
        reasons.push('same_date');
      } else {
        score += 1;
        reasons.push('adjacent_date');
      }
      
      // Different accounts bonus
      if (differentAccounts) {
        score += 2;
        reasons.push('different_accounts');
      }
      
      // Check transfer tokens in descriptions
      const outScore = scoreTransferLikelihood(out.normalizedDescription);
      const inScore = scoreTransferLikelihood(inc.normalizedDescription);
      
      if (outScore.isLikelyTransfer) {
        score += 3;
        reasons.push('out_transfer_tokens');
      }
      if (inScore.isLikelyTransfer) {
        score += 3;
        reasons.push('in_transfer_tokens');
      }
      
      // Check if both mention same bank
      for (const [bank, tokens] of Object.entries(BANK_TOKENS)) {
        const outHasBank = tokens.some(t => out.normalizedDescription.includes(t));
        const inHasBank = tokens.some(t => inc.normalizedDescription.includes(t));
        if (outHasBank && inHasBank) {
          score += 2;
          reasons.push(`same_bank_${bank.toLowerCase()}`);
          break;
        }
      }
      
      if (score >= 3 && score > bestScore) {
        bestScore = score;
        bestMatch = {
          outTransaction: out,
          inTransaction: inc,
          score,
          reasons
        };
      }
    }
    
    if (bestMatch) {
      matches.push(bestMatch);
      usedIds.add(bestMatch.outTransaction.id);
      usedIds.add(bestMatch.inTransaction.id);
    }
  }
  
  return matches;
}
