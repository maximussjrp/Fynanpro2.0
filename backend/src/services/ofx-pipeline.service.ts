/**
 * FASE 2.4: OFX Import Pipeline Service
 * 
 * Handles:
 * - Transfer detection (internal transfers between user's accounts)
 * - Invoice payment detection (credit card payments)
 * - Deduplication by FITID or hash
 * - Review queue generation
 */

import { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';
import { 
  normalizeDescription, 
  extractTokens,
  scoreTransferLikelihood,
  scoreInvoicePaymentLikelihood,
  scoreFeeLikelihood,
  generateDedupeHash,
  findTransferPairs,
  TransactionCandidate,
  TransferMatch
} from '../utils/description-normalizer';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// ==================== TYPES ====================

export interface RawOFXTransaction {
  fitId: string;
  date: Date;
  amount: number;
  description: string;
  trnType?: string;
  balance?: number;
}

export interface ProcessedTransaction {
  // Core fields
  id: string;
  date: Date;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  rawDescription: string;
  normalizedDescription: string;
  
  // Import tracking
  externalFitId: string;
  importSource: 'ofx' | 'csv' | 'xml';
  
  // Flags
  isDuplicate: boolean;
  duplicateOfId?: string;
  isTransfer: boolean;
  transferGroupId?: string;
  linkedTransactionId?: string;
  transactionKind: 'bank' | 'card' | 'invoice_payment' | 'transfer' | 'fee' | 'unknown';
  excludedFromEnergy: boolean;
  excludedReason?: string;
  
  // Review
  needsReview: boolean;
  reviewSuggestion?: {
    action: 'mark_transfer' | 'mark_invoice_payment' | 'mark_loss' | 'none';
    confidence: number;
    reason: string;
  };
  
  // Category suggestion
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
}

export interface ImportBatchResult {
  batchId: string;
  created: number;
  deduped: number;
  transferPairs: number;
  invoicePayments: number;
  fees: number;
  excludedFromEnergy: number;
  needsReviewCount: number;
  transactions: ProcessedTransaction[];
}

export interface ReviewItem {
  transactionId: string;
  date: string;
  amount: number;
  rawDescription: string;
  normalizedDescription: string;
  accountId: string;
  categoryId?: string;
  categoryName?: string;
  flags: {
    isTransfer: boolean;
    transactionKind: string;
    excludedFromEnergy: boolean;
  };
  suggestions: {
    suggestedAction: string;
    confidence: number;
    reason: string;
  };
}

export interface ReviewSummary {
  created: number;
  deduped: number;
  transferPairs: number;
  invoicePayments: number;
  excludedFromEnergy: number;
  needsReview: number;
}

// ==================== SERVICE ====================

export class OFXPipelineService {
  
  /**
   * Parse raw OFX content to extract transactions
   */
  parseOFX(content: string): RawOFXTransaction[] {
    const transactions: RawOFXTransaction[] = [];
    
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
      
      // Parse OFX date: YYYYMMDD or YYYYMMDDHHMMSS
      let date: Date | null = null;
      if (dtPosted && dtPosted.length >= 8) {
        const year = parseInt(dtPosted.substring(0, 4));
        const month = parseInt(dtPosted.substring(4, 6)) - 1;
        const day = parseInt(dtPosted.substring(6, 8));
        date = new Date(year, month, day);
      }
      
      const amount = parseFloat(trnAmt);
      
      if (date && !isNaN(amount)) {
        transactions.push({
          fitId: fitId || `ofx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          date,
          amount,
          description: name,
          trnType
        });
      }
    }
    
    return transactions;
  }
  
  /**
   * Check if a transaction already exists (dedupe)
   */
  async checkDuplicate(
    tenantId: string, 
    fitId: string, 
    date: Date, 
    amount: number, 
    normalizedDesc: string,
    accountId: string
  ): Promise<{ isDuplicate: boolean; duplicateOfId?: string }> {
    
    // First check by FITID (most reliable)
    if (fitId && !fitId.startsWith('ofx-') && !fitId.startsWith('hash-')) {
      const byFitId = await prisma.transaction.findFirst({
        where: {
          tenantId,
          externalFitId: fitId,
          deletedAt: null
        },
        select: { id: true }
      });
      
      if (byFitId) {
        return { isDuplicate: true, duplicateOfId: byFitId.id };
      }
    }
    
    // Fallback: check by hash (date + amount + description + account)
    const hash = generateDedupeHash(date, amount, normalizedDesc, accountId);
    
    const byHash = await prisma.transaction.findFirst({
      where: {
        tenantId,
        externalFitId: hash,
        deletedAt: null
      },
      select: { id: true }
    });
    
    if (byHash) {
      return { isDuplicate: true, duplicateOfId: byHash.id };
    }
    
    // Check by date + amount + similar description (legacy dedupe)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const similar = await prisma.transaction.findFirst({
      where: {
        tenantId,
        bankAccountId: accountId,
        deletedAt: null,
        transactionDate: { gte: startOfDay, lte: endOfDay },
        amount: { gte: Math.abs(amount) - 0.01, lte: Math.abs(amount) + 0.01 }
      },
      select: { id: true, normalizedDescription: true, description: true }
    });
    
    if (similar) {
      const existingNorm = similar.normalizedDescription || 
        normalizeDescription(similar.description);
      
      // Check if descriptions are similar enough
      const existingTokens = new Set(extractTokens(existingNorm));
      const newTokens = extractTokens(normalizedDesc);
      
      let matches = 0;
      for (const token of newTokens) {
        if (existingTokens.has(token)) matches++;
      }
      
      const similarity = newTokens.length > 0 ? matches / newTokens.length : 0;
      
      if (similarity >= 0.5) {
        return { isDuplicate: true, duplicateOfId: similar.id };
      }
    }
    
    return { isDuplicate: false };
  }
  
  /**
   * Detect if transaction is an invoice/credit card payment
   */
  detectInvoicePayment(normalizedDesc: string): { isInvoice: boolean; confidence: number; reason: string } {
    const score = scoreInvoicePaymentLikelihood(normalizedDesc);
    
    return {
      isInvoice: score.isLikelyInvoicePayment,
      confidence: Math.min(score.score / 10, 1),
      reason: score.reasons.join(', ')
    };
  }
  
  /**
   * Detect if transaction is a fee/charge (LOSS)
   */
  detectFee(normalizedDesc: string): { isFee: boolean; confidence: number; reason: string } {
    const score = scoreFeeLikelihood(normalizedDesc);
    
    return {
      isFee: score.isLikelyFee,
      confidence: Math.min(score.score / 8, 1),
      reason: score.reasons.join(', ')
    };
  }
  
  /**
   * Check if user has card purchases in period (for invoice payment logic)
   */
  async hasCardPurchasesInPeriod(tenantId: string, startDate: Date, endDate: Date): Promise<boolean> {
    const count = await prisma.transaction.count({
      where: {
        tenantId,
        deletedAt: null,
        transactionDate: { gte: startDate, lte: endDate },
        OR: [
          { transactionKind: 'card' },
          { description: { contains: 'COMPRA', mode: 'insensitive' } },
          { description: { contains: 'CARTAO', mode: 'insensitive' } }
        ]
      }
    });
    
    return count > 0;
  }
  
  /**
   * Main pipeline: process OFX content and return batch result
   */
  async processOFXImport(
    tenantId: string,
    userId: string,
    accountId: string,
    content: string,
    fileName: string
  ): Promise<ImportBatchResult> {
    const batchId = uuidv4();
    
    log.info(`[OFXPipeline] Starting import batch ${batchId} for tenant ${tenantId}`);
    
    // Step 1: Parse OFX
    const rawTransactions = this.parseOFX(content);
    log.info(`[OFXPipeline] Parsed ${rawTransactions.length} raw transactions`);
    
    // Step 2: Process each transaction
    const processed: ProcessedTransaction[] = [];
    let dedupedCount = 0;
    
    for (const raw of rawTransactions) {
      const normalizedDesc = normalizeDescription(raw.description);
      
      // Dedupe check
      const { isDuplicate, duplicateOfId } = await this.checkDuplicate(
        tenantId, 
        raw.fitId, 
        raw.date, 
        raw.amount, 
        normalizedDesc,
        accountId
      );
      
      if (isDuplicate) {
        dedupedCount++;
        continue; // Skip duplicates
      }
      
      // Determine type based on amount sign
      const type: 'income' | 'expense' = raw.amount >= 0 ? 'income' : 'expense';
      
      // Detect invoice payment
      const invoiceCheck = this.detectInvoicePayment(normalizedDesc);
      
      // Detect fee
      const feeCheck = this.detectFee(normalizedDesc);
      
      // Detect transfer likelihood
      const transferScore = scoreTransferLikelihood(normalizedDesc);
      
      // Determine transaction kind and flags
      let transactionKind: ProcessedTransaction['transactionKind'] = 'bank';
      let excludedFromEnergy = false;
      let excludedReason: string | undefined;
      let needsReview = false;
      let reviewSuggestion: ProcessedTransaction['reviewSuggestion'];
      
      if (invoiceCheck.isInvoice) {
        transactionKind = 'invoice_payment';
        excludedFromEnergy = true;
        excludedReason = 'invoice_payment';
        
        // Check if user has card purchases - if not, might need review
        const periodStart = new Date(raw.date);
        periodStart.setDate(periodStart.getDate() - 30);
        const hasCards = await this.hasCardPurchasesInPeriod(tenantId, periodStart, raw.date);
        
        if (!hasCards) {
          needsReview = true;
          reviewSuggestion = {
            action: 'mark_invoice_payment',
            confidence: invoiceCheck.confidence,
            reason: `Detected invoice payment (${invoiceCheck.reason}). No card purchases found - verify if you want to exclude from expenses.`
          };
        }
      } else if (feeCheck.isFee) {
        transactionKind = 'fee';
        needsReview = true;
        reviewSuggestion = {
          action: 'mark_loss',
          confidence: feeCheck.confidence,
          reason: `Detected fee/charge (${feeCheck.reason}). Consider marking as LOSS in energy.`
        };
      } else if (transferScore.isLikelyTransfer) {
        // Will be processed later in pairing
        needsReview = true;
        reviewSuggestion = {
          action: 'mark_transfer',
          confidence: Math.min(transferScore.score / 10, 1),
          reason: `Possible transfer (${transferScore.reasons.join(', ')}). Will try to pair with counterpart.`
        };
      }
      
      // Generate FITID for storage (use original or hash)
      const storageFitId = raw.fitId && !raw.fitId.startsWith('ofx-') 
        ? raw.fitId 
        : generateDedupeHash(raw.date, raw.amount, normalizedDesc, accountId);
      
      processed.push({
        id: uuidv4(),
        date: raw.date,
        amount: Math.abs(raw.amount),
        type,
        description: raw.description,
        rawDescription: raw.description,
        normalizedDescription: normalizedDesc,
        externalFitId: storageFitId,
        importSource: 'ofx',
        isDuplicate: false,
        isTransfer: false,
        transactionKind,
        excludedFromEnergy,
        excludedReason,
        needsReview,
        reviewSuggestion
      });
    }
    
    log.info(`[OFXPipeline] After dedupe: ${processed.length} transactions, ${dedupedCount} duplicates skipped`);
    
    // Step 3: Detect transfer pairs
    const candidates: TransactionCandidate[] = processed.map(p => ({
      id: p.id,
      date: p.date,
      amount: p.type === 'expense' ? -p.amount : p.amount,
      normalizedDescription: p.normalizedDescription,
      accountId,
      type: p.type
    }));
    
    const transferPairs = findTransferPairs(candidates);
    log.info(`[OFXPipeline] Found ${transferPairs.length} transfer pairs`);
    
    // Mark transfer pairs
    for (const pair of transferPairs) {
      const groupId = uuidv4();
      
      const outTx = processed.find(p => p.id === pair.outTransaction.id);
      const inTx = processed.find(p => p.id === pair.inTransaction.id);
      
      if (outTx) {
        outTx.isTransfer = true;
        outTx.transferGroupId = groupId;
        outTx.linkedTransactionId = pair.inTransaction.id;
        outTx.transactionKind = 'transfer';
        outTx.excludedFromEnergy = true;
        outTx.excludedReason = 'transfer';
        outTx.needsReview = false; // Paired successfully
        outTx.reviewSuggestion = undefined;
      }
      
      if (inTx) {
        inTx.isTransfer = true;
        inTx.transferGroupId = groupId;
        inTx.linkedTransactionId = pair.outTransaction.id;
        inTx.transactionKind = 'transfer';
        inTx.excludedFromEnergy = true;
        inTx.excludedReason = 'transfer';
        inTx.needsReview = false; // Paired successfully
        inTx.reviewSuggestion = undefined;
      }
    }
    
    // Step 4: Calculate stats
    const invoicePayments = processed.filter(p => p.transactionKind === 'invoice_payment').length;
    const fees = processed.filter(p => p.transactionKind === 'fee').length;
    const excludedFromEnergy = processed.filter(p => p.excludedFromEnergy).length;
    const needsReviewCount = processed.filter(p => p.needsReview).length;
    
    log.info(`[OFXPipeline] Batch ${batchId} complete:`, {
      created: processed.length,
      deduped: dedupedCount,
      transferPairs: transferPairs.length,
      invoicePayments,
      fees,
      excludedFromEnergy,
      needsReviewCount
    });
    
    return {
      batchId,
      created: processed.length,
      deduped: dedupedCount,
      transferPairs: transferPairs.length,
      invoicePayments,
      fees,
      excludedFromEnergy,
      needsReviewCount,
      transactions: processed
    };
  }
  
  /**
   * Save processed transactions to database
   */
  async saveBatch(
    tenantId: string,
    userId: string,
    accountId: string,
    batchId: string,
    transactions: ProcessedTransaction[],
    fileName: string
  ): Promise<{ savedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let savedCount = 0;
    
    // Create Import record first
    const importRecord = await prisma.import.create({
      data: {
        id: batchId,
        tenantId,
        userId,
        fileName,
        fileType: 'ofx',
        bankAccountId: accountId,
        status: 'processing',
        totalRows: transactions.length
      }
    });
    
    // Save transactions in batches
    for (const tx of transactions) {
      try {
        await prisma.transaction.create({
          data: {
            id: tx.id,
            tenantId,
            userId,
            type: tx.type,
            bankAccountId: accountId,
            amount: tx.amount,
            description: tx.description,
            transactionDate: tx.date,
            status: 'completed',
            transactionType: 'single',
            isFixed: false,
            
            // FASE 2.4 fields
            importBatchId: batchId,
            importSource: 'ofx',
            externalFitId: tx.externalFitId,
            rawDescription: tx.rawDescription,
            normalizedDescription: tx.normalizedDescription,
            isTransfer: tx.isTransfer,
            transferGroupId: tx.transferGroupId,
            linkedTransactionId: tx.linkedTransactionId,
            transactionKind: tx.transactionKind,
            excludedFromEnergy: tx.excludedFromEnergy,
            excludedReason: tx.excludedReason,
            needsReview: tx.needsReview,
            reviewSuggestion: tx.reviewSuggestion ? JSON.stringify(tx.reviewSuggestion) : null,
            
            notes: `Importado de: ${fileName}`
          }
        });
        
        // Update account balance (only for non-transfers to avoid double counting)
        if (!tx.excludedFromEnergy || tx.transactionKind !== 'transfer') {
          const multiplier = tx.type === 'income' ? 1 : -1;
          await prisma.bankAccount.update({
            where: { id: accountId },
            data: {
              currentBalance: { increment: tx.amount * multiplier }
            }
          });
        }
        
        savedCount++;
      } catch (error: any) {
        errors.push(`Failed to save transaction ${tx.id}: ${error.message}`);
      }
    }
    
    // Update Import record
    await prisma.import.update({
      where: { id: batchId },
      data: {
        status: errors.length > 0 ? 'partial' : 'completed',
        processedRows: savedCount,
        errorRows: errors.length,
        errorLog: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt: new Date(),
        createdCount: savedCount,
        dedupedCount: 0, // Already handled in processing
        transferPairs: transactions.filter(t => t.isTransfer).length / 2,
        invoicePayments: transactions.filter(t => t.transactionKind === 'invoice_payment').length,
        needsReviewCount: transactions.filter(t => t.needsReview).length,
        excludedFromEnergyCount: transactions.filter(t => t.excludedFromEnergy).length
      }
    });
    
    return { savedCount, errors };
  }
  
  /**
   * Get transactions for review by batch
   */
  async getReviewItems(
    tenantId: string,
    batchId: string,
    filter?: 'all' | 'suspects' | 'transfers' | 'invoice_payments' | 'needs_review' | 'fees'
  ): Promise<{ summary: ReviewSummary; items: ReviewItem[] }> {
    
    // Build where clause
    const where: any = {
      tenantId,
      importBatchId: batchId,
      deletedAt: null
    };
    
    if (filter === 'suspects' || filter === 'needs_review') {
      where.needsReview = true;
    } else if (filter === 'transfers') {
      where.isTransfer = true;
    } else if (filter === 'invoice_payments') {
      where.transactionKind = 'invoice_payment';
    } else if (filter === 'fees') {
      where.transactionKind = 'fee';
    }
    
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        bankAccount: { select: { id: true, name: true } }
      },
      orderBy: [
        { needsReview: 'desc' },
        { amount: 'desc' }
      ],
      take: 200
    });
    
    // Get summary
    const summary = await prisma.transaction.aggregate({
      where: { tenantId, importBatchId: batchId, deletedAt: null },
      _count: true
    });
    
    const needsReviewCount = await prisma.transaction.count({
      where: { tenantId, importBatchId: batchId, needsReview: true, deletedAt: null }
    });
    
    const transfersCount = await prisma.transaction.count({
      where: { tenantId, importBatchId: batchId, isTransfer: true, deletedAt: null }
    });
    
    const invoiceCount = await prisma.transaction.count({
      where: { tenantId, importBatchId: batchId, transactionKind: 'invoice_payment', deletedAt: null }
    });
    
    const excludedCount = await prisma.transaction.count({
      where: { tenantId, importBatchId: batchId, excludedFromEnergy: true, deletedAt: null }
    });
    
    const items: ReviewItem[] = transactions.map(t => ({
      transactionId: t.id,
      date: t.transactionDate.toISOString().split('T')[0],
      amount: Number(t.amount) * (t.type === 'expense' ? -1 : 1),
      rawDescription: t.rawDescription || t.description || '',
      normalizedDescription: t.normalizedDescription || '',
      accountId: t.bankAccountId || '',
      categoryId: t.categoryId || undefined,
      categoryName: t.category?.name || undefined,
      flags: {
        isTransfer: t.isTransfer,
        transactionKind: t.transactionKind,
        excludedFromEnergy: t.excludedFromEnergy
      },
      suggestions: t.reviewSuggestion 
        ? JSON.parse(t.reviewSuggestion as string) 
        : { suggestedAction: 'none', confidence: 0, reason: '' }
    }));
    
    return {
      summary: {
        created: summary._count,
        deduped: 0, // Not tracked per-query
        transferPairs: Math.floor(transfersCount / 2),
        invoicePayments: invoiceCount,
        excludedFromEnergy: excludedCount,
        needsReview: needsReviewCount
      },
      items
    };
  }
  
  /**
   * Apply batch action to transactions
   */
  async applyBatchAction(
    tenantId: string,
    transactionIds: string[],
    action: 'mark_transfer' | 'unmark_transfer' | 'mark_invoice_payment' | 'toggle_excluded' | 'set_category',
    payload?: { categoryId?: string; pairTransactionId?: string }
  ): Promise<{ updated: number; transferPairsCreated: number; transferPairsRemoved: number }> {
    let updated = 0;
    let transferPairsCreated = 0;
    let transferPairsRemoved = 0;
    
    if (action === 'mark_transfer') {
      // If two transactions selected, pair them
      if (transactionIds.length === 2) {
        const groupId = uuidv4();
        
        await prisma.transaction.updateMany({
          where: { id: { in: transactionIds }, tenantId },
          data: {
            isTransfer: true,
            transferGroupId: groupId,
            transactionKind: 'transfer',
            excludedFromEnergy: true,
            excludedReason: 'transfer',
            needsReview: false,
            reviewSuggestion: null,
            reviewedAt: new Date()
          }
        });
        
        // Link them to each other
        await prisma.transaction.update({
          where: { id: transactionIds[0] },
          data: { linkedTransactionId: transactionIds[1] }
        });
        await prisma.transaction.update({
          where: { id: transactionIds[1] },
          data: { linkedTransactionId: transactionIds[0] }
        });
        
        updated = 2;
        transferPairsCreated = 1;
      } else {
        // Mark as transfer without pair
        await prisma.transaction.updateMany({
          where: { id: { in: transactionIds }, tenantId },
          data: {
            isTransfer: true,
            transactionKind: 'transfer',
            excludedFromEnergy: true,
            excludedReason: 'transfer',
            needsReview: false,
            reviewedAt: new Date()
          }
        });
        updated = transactionIds.length;
      }
    } else if (action === 'unmark_transfer') {
      // Get current transfer groups to properly unlink
      const transactions = await prisma.transaction.findMany({
        where: { id: { in: transactionIds }, tenantId },
        select: { id: true, transferGroupId: true, linkedTransactionId: true }
      });
      
      for (const tx of transactions) {
        // Unlink the paired transaction too
        if (tx.linkedTransactionId) {
          await prisma.transaction.update({
            where: { id: tx.linkedTransactionId },
            data: {
              isTransfer: false,
              transferGroupId: null,
              linkedTransactionId: null,
              transactionKind: 'bank',
              excludedFromEnergy: false,
              excludedReason: null
            }
          });
          transferPairsRemoved++;
        }
      }
      
      await prisma.transaction.updateMany({
        where: { id: { in: transactionIds }, tenantId },
        data: {
          isTransfer: false,
          transferGroupId: null,
          linkedTransactionId: null,
          transactionKind: 'bank',
          excludedFromEnergy: false,
          excludedReason: null,
          reviewedAt: new Date()
        }
      });
      
      updated = transactionIds.length;
    } else if (action === 'mark_invoice_payment') {
      await prisma.transaction.updateMany({
        where: { id: { in: transactionIds }, tenantId },
        data: {
          transactionKind: 'invoice_payment',
          excludedFromEnergy: true,
          excludedReason: 'invoice_payment',
          needsReview: false,
          reviewedAt: new Date()
        }
      });
      updated = transactionIds.length;
    } else if (action === 'toggle_excluded') {
      // Get current state and toggle
      const transactions = await prisma.transaction.findMany({
        where: { id: { in: transactionIds }, tenantId },
        select: { id: true, excludedFromEnergy: true }
      });
      
      for (const tx of transactions) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            excludedFromEnergy: !tx.excludedFromEnergy,
            excludedReason: tx.excludedFromEnergy ? null : 'user_excluded',
            reviewedAt: new Date()
          }
        });
        updated++;
      }
    } else if (action === 'set_category' && payload?.categoryId) {
      await prisma.transaction.updateMany({
        where: { id: { in: transactionIds }, tenantId },
        data: {
          categoryId: payload.categoryId,
          needsReview: false,
          reviewedAt: new Date()
        }
      });
      updated = transactionIds.length;
    }
    
    return { updated, transferPairsCreated, transferPairsRemoved };
  }
  
  /**
   * Get transfer pairs for audit - shows both sides of each transfer
   */
  async getTransferPairs(
    tenantId: string,
    batchId?: string,
    limit: number = 50
  ): Promise<TransferPairAudit[]> {
    const where: any = {
      tenantId,
      isTransfer: true,
      transferGroupId: { not: null },
      deletedAt: null
    };
    
    if (batchId) {
      where.importBatchId = batchId;
    }
    
    const transfers = await prisma.transaction.findMany({
      where,
      include: {
        bankAccount: { select: { id: true, name: true } }
      },
      orderBy: { transactionDate: 'desc' },
      take: limit * 2 // Get enough to form pairs
    });
    
    // Group by transferGroupId
    const groups = new Map<string, typeof transfers>();
    for (const t of transfers) {
      if (t.transferGroupId) {
        const arr = groups.get(t.transferGroupId) || [];
        arr.push(t);
        groups.set(t.transferGroupId, arr);
      }
    }
    
    // Build pairs
    const pairs: TransferPairAudit[] = [];
    for (const [groupId, txs] of groups.entries()) {
      const outbound = txs.find(t => t.type === 'expense') || txs[0];
      const inbound = txs.find(t => t.type === 'income') || txs[1];
      
      pairs.push({
        transferGroupId: groupId,
        outbound: outbound ? {
          transactionId: outbound.id,
          date: outbound.transactionDate.toISOString().split('T')[0],
          amount: Number(outbound.amount),
          description: (outbound as any).rawDescription || outbound.description || '',
          accountName: outbound.bankAccount?.name || 'N/A'
        } : null,
        inbound: inbound && inbound.id !== outbound?.id ? {
          transactionId: inbound.id,
          date: inbound.transactionDate.toISOString().split('T')[0],
          amount: Number(inbound.amount),
          description: (inbound as any).rawDescription || inbound.description || '',
          accountName: inbound.bankAccount?.name || 'N/A'
        } : null,
        matchScore: (outbound as any)?.reviewSuggestion 
          ? JSON.parse((outbound as any).reviewSuggestion as string)?.confidence 
          : null,
        isValidPair: !!(outbound && inbound && outbound.id !== inbound.id)
      });
      
      if (pairs.length >= limit) break;
    }
    
    return pairs;
  }
  
  /**
   * Get batch statistics from Import record (more accurate)
   */
  async getBatchStatistics(tenantId: string, batchId: string): Promise<BatchStatistics | null> {
    const importRecord = await prisma.import.findFirst({
      where: { id: batchId, tenantId }
    });
    
    if (!importRecord) return null;
    
    // Also get live counts for validation
    const liveStats = await prisma.$transaction([
      prisma.transaction.count({ 
        where: { tenantId, importBatchId: batchId, deletedAt: null } 
      }),
      prisma.transaction.count({ 
        where: { tenantId, importBatchId: batchId, isTransfer: true, deletedAt: null } 
      }),
      prisma.transaction.count({ 
        where: { tenantId, importBatchId: batchId, transactionKind: 'invoice_payment', deletedAt: null } 
      }),
      prisma.transaction.count({ 
        where: { tenantId, importBatchId: batchId, excludedFromEnergy: true, deletedAt: null } 
      }),
      prisma.transaction.count({ 
        where: { tenantId, importBatchId: batchId, needsReview: true, deletedAt: null } 
      }),
      prisma.transaction.count({ 
        where: { tenantId, importBatchId: batchId, transactionKind: 'fee', deletedAt: null } 
      })
    ]);
    
    return {
      batchId,
      fileName: importRecord.fileName,
      importedAt: importRecord.createdAt,
      status: importRecord.status,
      
      // From Import record (original import stats)
      fromImport: {
        totalRows: importRecord.totalRows || 0,
        created: importRecord.createdCount || 0,
        deduped: importRecord.dedupedCount || 0,
        transferPairs: importRecord.transferPairs || 0,
        invoicePayments: importRecord.invoicePayments || 0,
        needsReview: importRecord.needsReviewCount || 0,
        excludedFromEnergy: importRecord.excludedFromEnergyCount || 0
      },
      
      // Live counts (may differ after user edits)
      live: {
        total: liveStats[0],
        transfers: liveStats[1],
        transferPairs: Math.floor(liveStats[1] / 2),
        invoicePayments: liveStats[2],
        excludedFromEnergy: liveStats[3],
        needsReview: liveStats[4],
        fees: liveStats[5]
      }
    };
  }
  
  /**
   * Validate dedupe: check if re-importing same file would create duplicates
   */
  async validateDedupe(
    tenantId: string,
    accountId: string,
    content: string
  ): Promise<DedupeValidation> {
    const rawTransactions = this.parseOFX(content);
    
    let wouldDedupe = 0;
    let wouldCreate = 0;
    const samples: { fitId: string; description: string; status: 'duplicate' | 'new' }[] = [];
    
    for (const raw of rawTransactions.slice(0, 50)) { // Check first 50
      const fitId = raw.fitId || null;
      const normalizedDesc = normalizeDescription(raw.description);
      const hash = generateDedupeHash(raw.date, raw.amount, normalizedDesc, accountId);
      
      let isDuplicate = false;
      
      // Check by FITID first
      if (fitId) {
        const existing = await prisma.transaction.findFirst({
          where: { tenantId, externalFitId: fitId, deletedAt: null }
        });
        isDuplicate = !!existing;
      }
      
      // If no match, check by date+amount+description combo
      if (!isDuplicate) {
        const dateStart = new Date(raw.date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(raw.date);
        dateEnd.setHours(23, 59, 59, 999);
        
        const existingByCombo = await prisma.transaction.findFirst({
          where: { 
            tenantId, 
            bankAccountId: accountId,
            amount: Math.abs(raw.amount),
            transactionDate: { gte: dateStart, lte: dateEnd },
            normalizedDescription: normalizedDesc,
            deletedAt: null 
          }
        });
        isDuplicate = !!existingByCombo;
      }
      
      if (isDuplicate) {
        wouldDedupe++;
        if (samples.length < 5) {
          samples.push({ 
            fitId: fitId || hash.slice(0, 12), 
            description: normalizedDesc.slice(0, 40),
            status: 'duplicate'
          });
        }
      } else {
        wouldCreate++;
        if (samples.length < 10 && samples.filter(s => s.status === 'new').length < 3) {
          samples.push({ 
            fitId: fitId || hash.slice(0, 12), 
            description: normalizedDesc.slice(0, 40),
            status: 'new'
          });
        }
      }
    }
    
    return {
      totalChecked: Math.min(rawTransactions.length, 50),
      wouldDedupe,
      wouldCreate,
      dedupeRate: rawTransactions.length > 0 
        ? Math.round((wouldDedupe / Math.min(rawTransactions.length, 50)) * 100) 
        : 0,
      samples
    };
  }
}

// Types for new methods
interface TransferPairAudit {
  transferGroupId: string;
  outbound: {
    transactionId: string;
    date: string;
    amount: number;
    description: string;
    accountName: string;
  } | null;
  inbound: {
    transactionId: string;
    date: string;
    amount: number;
    description: string;
    accountName: string;
  } | null;
  matchScore: number | null;
  isValidPair: boolean;
}

interface BatchStatistics {
  batchId: string;
  fileName: string;
  importedAt: Date;
  status: string;
  fromImport: {
    totalRows: number;
    created: number;
    deduped: number;
    transferPairs: number;
    invoicePayments: number;
    needsReview: number;
    excludedFromEnergy: number;
  };
  live: {
    total: number;
    transfers: number;
    transferPairs: number;
    invoicePayments: number;
    excludedFromEnergy: number;
    needsReview: number;
    fees: number;
  };
}

interface DedupeValidation {
  totalChecked: number;
  wouldDedupe: number;
  wouldCreate: number;
  dedupeRate: number;
  samples: { fitId: string; description: string; status: 'duplicate' | 'new' }[];
}

// Singleton
export const ofxPipelineService = new OFXPipelineService();
