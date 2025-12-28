import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { importService, ColumnMapping, ImportedTransaction } from '../services/import.service';
import { ofxPipelineService } from '../services/ofx-pipeline.service';
import { log } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Estender Request para incluir file do multer
interface MulterRequest extends AuthRequest {
  file?: Express.Multer.File;
}

// Configuração do Multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = ['text/csv', 'text/plain', 'application/x-ofx', 'application/ofx', 'text/xml', 'application/xml'];
    const allowedExtensions = ['.csv', '.ofx', '.txt', '.xml'];
    
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não suportado. Use CSV, OFX ou XML.'));
    }
  },
});

// ==================== ENDPOINTS ====================

/**
 * POST /import/upload
 * Upload de arquivo e criação de preview
 */
router.post('/upload', authMiddleware, upload.single('file'), async (req: MulterRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const tenantId = req.tenantId!;
    
    log.info(`[Import] Upload iniciado - userId: ${userId}, tenantId: ${tenantId}`);
    
    if (!req.file) {
      log.warn('[Import] Nenhum arquivo no request');
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    
    log.info(`[Import] Arquivo recebido: ${req.file.originalname}, size: ${req.file.size}, mimetype: ${req.file.mimetype}`);
    
    const content = req.file.buffer.toString('utf-8');
    const fileName = req.file.originalname;
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
    
    // Detectar tipo de arquivo
    let fileType: 'csv' | 'ofx' | 'xml' = 'csv';
    
    if (ext === '.ofx' || content.includes('<OFX>') || content.includes('<STMTTRN>')) {
      fileType = 'ofx';
    } else if (ext === '.xml' || (content.includes('<?xml') && (content.includes('<extrato>') || content.includes('<transacao>') || content.includes('<lancamento>')))) {
      fileType = 'xml';
    }
    
    log.info(`[Import] Tipo detectado: ${fileType}, extensão: ${ext}`);
    
    // Parsing opcional de colunas (para CSV)
    let columnMapping: ColumnMapping | undefined;
    if (req.body.columnMapping) {
      try {
        columnMapping = JSON.parse(req.body.columnMapping);
      } catch (e) {
        // Ignorar erro de parse
      }
    }
    
    // Criar preview
    let preview;
    
    if (fileType === 'ofx') {
      preview = await importService.createOFXPreview(tenantId, userId, fileName, content);
    } else if (fileType === 'xml') {
      preview = await importService.createXMLPreview(tenantId, userId, fileName, content);
    } else {
      preview = await importService.createCSVPreview(tenantId, userId, fileName, content, columnMapping);
    }
    
    log.info(`[Import] Preview criado: ${preview.id} - ${preview.totalTransactions} transações`);
    
    res.json({
      success: true,
      preview: {
        id: preview.id,
        fileName: preview.fileName,
        fileType: preview.fileType,
        totalTransactions: preview.totalTransactions,
        totalIncome: preview.totalIncome,
        totalExpense: preview.totalExpense,
        duplicates: preview.duplicates,
        transactions: preview.transactions,
        columnMapping: preview.columnMapping,
      },
    });
  } catch (error: any) {
    log.error('[Import] Erro no upload:', { message: error.message, stack: error.stack });
    res.status(400).json({ error: error.message || 'Erro ao processar arquivo' });
  }
});

/**
 * POST /import/preview/:id/update
 * Atualizar transação no preview
 */
router.post('/preview/:id/update', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { transactionId, updates } = req.body;
    
    if (!transactionId) {
      return res.status(400).json({ error: 'ID da transação é obrigatório' });
    }
    
    const success = importService.updatePreviewTransaction(id, transactionId, updates);
    
    if (!success) {
      return res.status(404).json({ error: 'Preview ou transação não encontrada' });
    }
    
    // Retornar preview atualizado
    const preview = importService.getPreview(id);
    
    res.json({
      success: true,
      preview,
    });
  } catch (error: any) {
    log.error('[Import] Erro ao atualizar preview:', error);
    res.status(400).json({ error: error.message || 'Erro ao atualizar' });
  }
});

/**
 * POST /import/preview/:id/remap
 * Remapear colunas do CSV
 */
router.post('/preview/:id/remap', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const { columnMapping, content, fileName } = req.body;
    
    if (!columnMapping || !content || !fileName) {
      return res.status(400).json({ error: 'Dados insuficientes para remapear' });
    }
    
    // Recriar preview com novo mapeamento
    const preview = await importService.createCSVPreview(
      tenantId,
      userId,
      fileName,
      content,
      columnMapping
    );
    
    res.json({
      success: true,
      preview: {
        id: preview.id,
        fileName: preview.fileName,
        fileType: preview.fileType,
        totalTransactions: preview.totalTransactions,
        totalIncome: preview.totalIncome,
        totalExpense: preview.totalExpense,
        duplicates: preview.duplicates,
        transactions: preview.transactions,
        columnMapping: preview.columnMapping,
      },
    });
  } catch (error: any) {
    log.error('[Import] Erro ao remapear:', error);
    res.status(400).json({ error: error.message || 'Erro ao remapear colunas' });
  }
});

/**
 * GET /import/preview/:id
 * Obter preview atual
 */
router.get('/preview/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const preview = importService.getPreview(id);
    
    if (!preview) {
      return res.status(404).json({ error: 'Preview não encontrado ou expirado' });
    }
    
    res.json({ preview });
  } catch (error: any) {
    log.error('[Import] Erro ao obter preview:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /import/confirm
 * Confirmar importação e salvar transações
 */
router.post('/confirm', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const tenantId = req.tenantId!;
    const { previewId, bankAccountId, paymentMethodId, transactions } = req.body;
    
    if (!previewId) {
      return res.status(400).json({ error: 'ID do preview é obrigatório' });
    }
    
    if (!bankAccountId) {
      return res.status(400).json({ error: 'Conta bancária é obrigatória' });
    }
    
    // Verificar se a conta existe
    const account = await prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        tenantId,
        isActive: true,
        deletedAt: null,
      },
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Conta bancária não encontrada' });
    }

    // Verificar meio de pagamento se fornecido
    if (paymentMethodId) {
      const paymentMethod = await prisma.paymentMethod.findFirst({
        where: {
          id: paymentMethodId,
          tenantId,
          deletedAt: null,
        },
      });
      if (!paymentMethod) {
        return res.status(404).json({ error: 'Meio de pagamento não encontrado' });
      }
    }
    
    // Atualizar transações do preview se enviadas (com edições do usuário)
    if (transactions && Array.isArray(transactions)) {
      for (const tx of transactions) {
        if (tx.id) {
          importService.updatePreviewTransaction(previewId, tx.id, tx);
        }
      }
    }
    
    // Confirmar importação
    const result = await importService.confirmImport(tenantId, userId, previewId, bankAccountId, paymentMethodId);
    
    log.info(`[Import] Importação concluída: ${result.imported} importadas, ${result.skipped} ignoradas, ${result.duplicates} duplicadas`);
    
    res.json({
      success: result.success,
      imported: result.imported,
      skipped: result.skipped,
      duplicates: result.duplicates,
      errors: result.errors,
      message: `${result.imported} transações importadas com sucesso!`,
    });
  } catch (error: any) {
    log.error('[Import] Erro ao confirmar importação:', error);
    res.status(400).json({ error: error.message || 'Erro ao importar' });
  }
});

/**
 * GET /import/history
 * Listar histórico de importações
 */
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const history = await importService.getHistory(tenantId);
    
    res.json({ history });
  } catch (error: any) {
    log.error('[Import] Erro ao listar histórico:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /import/:id
 * Desfazer importação (soft delete das transações)
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    
    const count = await importService.undoImport(tenantId, id);
    
    log.info(`[Import] Importação desfeita: ${count} transações removidas`);
    
    res.json({
      success: true,
      deleted: count,
      message: `${count} transações removidas com sucesso!`,
    });
  } catch (error: any) {
    log.error('[Import] Erro ao desfazer importação:', error);
    res.status(400).json({ error: error.message || 'Erro ao desfazer' });
  }
});

/**
 * GET /import/accounts
 * Listar contas bancárias disponíveis para importação
 */
router.get('/accounts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    
    const accounts = await prisma.bankAccount.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        institution: true,
        type: true,
        currentBalance: true,
      },
      orderBy: { order: 'asc' },
    });
    
    res.json({ accounts });
  } catch (error: any) {
    log.error('[Import] Erro ao listar contas:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /import/categories
 * Listar categorias para seleção
 */
router.get('/categories', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { type } = req.query;
    
    const categories = await prisma.category.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
        ...(type ? { type: type as string } : {}),
      },
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        level: true,
        icon: true,
        color: true,
      },
      orderBy: [{ level: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    });
    
    res.json({ categories });
  } catch (error: any) {
    log.error('[Import] Erro ao listar categorias:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== FASE 2.4: OFX PIPELINE ROUTES ====================

/**
 * POST /import/ofx
 * Upload OFX with full pipeline processing (transfers, dedupe, review)
 */
router.post('/ofx', authMiddleware, upload.single('file'), async (req: MulterRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const tenantId = req.tenantId!;
    const { accountId } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    
    if (!accountId) {
      return res.status(400).json({ error: 'Conta bancária é obrigatória (accountId)' });
    }
    
    // Verify account exists
    const account = await prisma.bankAccount.findFirst({
      where: { id: accountId, tenantId, isActive: true, deletedAt: null }
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Conta bancária não encontrada' });
    }
    
    const content = req.file.buffer.toString('utf-8');
    const fileName = req.file.originalname;
    
    log.info(`[Import] OFX Pipeline started: ${fileName} for account ${account.name}`);
    
    // Process with new pipeline
    const result = await ofxPipelineService.processOFXImport(
      tenantId,
      userId,
      accountId,
      content,
      fileName
    );
    
    // Save to database
    const { savedCount, errors } = await ofxPipelineService.saveBatch(
      tenantId,
      userId,
      accountId,
      result.batchId,
      result.transactions,
      fileName
    );
    
    log.info(`[Import] OFX Pipeline complete: ${savedCount} saved, ${result.deduped} deduped, ${result.transferPairs} transfer pairs`);
    
    res.json({
      success: true,
      batchId: result.batchId,
      created: savedCount,
      deduped: result.deduped,
      transferPairs: result.transferPairs,
      invoicePayments: result.invoicePayments,
      needsReviewCount: result.needsReviewCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `${savedCount} transações importadas. ${result.transferPairs} pares de transferência detectados.${result.needsReviewCount > 0 ? ` ${result.needsReviewCount} itens para revisar.` : ''}`
    });
  } catch (error: any) {
    log.error('[Import] OFX Pipeline error:', error);
    res.status(400).json({ error: error.message || 'Erro ao processar OFX' });
  }
});

/**
 * GET /import/review/:batchId
 * Get transactions for review from a batch
 */
router.get('/review/:batchId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { batchId } = req.params;
    const { filter } = req.query;
    
    const validFilters = ['all', 'suspects', 'transfers', 'invoice_payments', 'needs_review', 'fees'];
    const filterValue = validFilters.includes(filter as string) 
      ? (filter as 'all' | 'suspects' | 'transfers' | 'invoice_payments' | 'needs_review' | 'fees')
      : 'all';
    
    const result = await ofxPipelineService.getReviewItems(tenantId, batchId, filterValue);
    
    res.json({
      batchId,
      summary: result.summary,
      items: result.items
    });
  } catch (error: any) {
    log.error('[Import] Review get error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /import/review/:batchId
 * Apply batch actions to transactions
 */
router.put('/review/:batchId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { batchId } = req.params;
    const { transactionIds, action, payload } = req.body;
    
    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ error: 'transactionIds é obrigatório (array)' });
    }
    
    const validActions = ['mark_transfer', 'unmark_transfer', 'mark_invoice_payment', 'toggle_excluded', 'set_category'];
    if (!action || !validActions.includes(action)) {
      return res.status(400).json({ error: `action inválida. Valores: ${validActions.join(', ')}` });
    }
    
    if (action === 'set_category' && (!payload || !payload.categoryId)) {
      return res.status(400).json({ error: 'payload.categoryId é obrigatório para set_category' });
    }
    
    const result = await ofxPipelineService.applyBatchAction(
      tenantId,
      transactionIds,
      action,
      payload
    );
    
    log.info(`[Import] Review action applied: ${action} to ${transactionIds.length} transactions`);
    
    res.json({
      success: true,
      updated: result.updated,
      transferPairsCreated: result.transferPairsCreated,
      transferPairsRemoved: result.transferPairsRemoved
    });
  } catch (error: any) {
    log.error('[Import] Review action error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /import/batches
 * List recent import batches
 */
router.get('/batches', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    
    const batches = await prisma.import.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        fileName: true,
        fileType: true,
        bankAccountId: true,
        status: true,
        totalRows: true,
        createdCount: true,
        dedupedCount: true,
        transferPairs: true,
        invoicePayments: true,
        needsReviewCount: true,
        excludedFromEnergyCount: true,
        createdAt: true,
        completedAt: true
      }
    });
    
    res.json({ batches });
  } catch (error: any) {
    log.error('[Import] List batches error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
