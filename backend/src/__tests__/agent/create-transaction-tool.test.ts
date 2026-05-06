/**
 * create_transaction tool — testes.
 *
 * Mocks:
 *   - transactionService.create: fonte da verdade, mockada para isolar o tool
 *   - prisma (via setup): categoria/conta/payment no dry-run
 *   - auditLog.create: validamos que é chamada quando origem é chatbot
 */

import { mockPrisma } from '../setup';

// Mock antes do import do tool.
jest.mock('../../services/transaction.service', () => ({
  transactionService: {
    create: jest.fn(),
  },
}));

import { ToolRegistry } from '../../agent/tools/registry';
import { createTransactionTool } from '../../agent/tools/create-transaction.tool';
import { transactionService } from '../../services/transaction.service';
import type { ToolContext } from '../../agent/tools/types';

const mp = mockPrisma as any;
if (!mp.auditLog) mp.auditLog = { create: jest.fn() };

const TX_SVC = transactionService.create as jest.Mock;
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';

const baseInput = {
  type: 'expense' as const,
  amount: 10,
  description: 'Café',
  categoryId: UUID_A,
  bankAccountId: UUID_B,
};

const apiCtx: ToolContext = {
  tenantId: 'tenant-A',
  userId: 'user-1',
  source: 'api',
};

const chatbotCtx: ToolContext = {
  tenantId: 'tenant-A',
  userId: 'user-1',
  source: 'chatbot',
  sessionId: 'sess-99',
  messageId: 'msg-77',
  runId: 'run-55',
};

describe('create_transaction tool', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new ToolRegistry();
    registry.register(createTransactionTool);
  });

  it('input inválido → VALIDATION_ERROR (sem chamar service)', async () => {
    const r = await registry.invoke('create_transaction', { ...baseInput, amount: -5 }, apiCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('VALIDATION_ERROR');
    expect(TX_SVC).not.toHaveBeenCalled();
  });

  it('chamada via API: reutiliza TransactionService SEM atribuição e SEM auditLog', async () => {
    TX_SVC.mockResolvedValueOnce({
      id: 'tx-1',
      type: 'expense',
      amount: 10,
      description: 'Café',
      categoryId: UUID_A,
      bankAccountId: UUID_B,
      paymentMethodId: null,
      status: 'completed',
      transactionDate: new Date('2026-04-24T12:00:00.000Z'),
    });

    const r = await registry.invoke('create_transaction', baseInput, apiCtx);

    expect(r.ok).toBe(true);
    expect(TX_SVC).toHaveBeenCalledTimes(1);
    const [, userId, tenantId, options] = TX_SVC.mock.calls[0];
    expect(tenantId).toBe('tenant-A');
    expect(userId).toBe('user-1');
    expect(options).toBeUndefined(); // nenhuma atribuição
    expect(mp.auditLog.create).not.toHaveBeenCalled();
    if (r.ok) {
      expect((r.data as any).attribution).toBeNull();
      expect((r.data as any).auditLogId).toBeNull();
      expect((r.data as any).id).toBe('tx-1');
    }
  });

  it('chamada via chatbot: envia attribution + escreve AuditLog', async () => {
    TX_SVC.mockResolvedValueOnce({
      id: 'tx-2',
      type: 'expense',
      amount: 10,
      description: 'Café',
      categoryId: UUID_A,
      bankAccountId: UUID_B,
      paymentMethodId: UUID_C,
      status: 'completed',
      transactionDate: new Date('2026-04-24T12:00:00.000Z'),
    });
    (mp.auditLog.create as jest.Mock).mockResolvedValueOnce({ id: 'audit-99' });

    const r = await registry.invoke(
      'create_transaction',
      { ...baseInput, paymentMethodId: UUID_C },
      chatbotCtx,
    );

    expect(r.ok).toBe(true);
    const options = TX_SVC.mock.calls[0][3];
    expect(options?.attribution).toMatchObject({
      source: 'chatbot',
      createdByAssistant: true,
      sourceSessionId: 'sess-99',
      sourceMessageId: 'msg-77',
      assistantRunId: 'run-55',
    });

    expect(mp.auditLog.create).toHaveBeenCalledTimes(1);
    const auditArg = (mp.auditLog.create as jest.Mock).mock.calls[0][0];
    expect(auditArg.data.action).toBe('CHATBOT_TRANSACTION_CREATE');
    expect(auditArg.data.resourceId).toBe('tx-2');
    const changes = JSON.parse(auditArg.data.changes);
    expect(changes.actor).toBe('isis');
    expect(changes.runId).toBe('run-55');
    expect(changes.tool).toBe('create_transaction');

    if (r.ok) {
      expect((r.data as any).auditLogId).toBe('audit-99');
      expect((r.data as any).attribution?.assistantRunId).toBe('run-55');
      expect((r.data as any).dryRun).toBe(false);
    }
  });

  it('dryRun: valida refs e retorna preview sem chamar service nem auditLog', async () => {
    (mp.category.findFirst as jest.Mock).mockResolvedValueOnce({ id: UUID_A, type: 'expense' });
    (mp.bankAccount.findFirst as jest.Mock).mockResolvedValueOnce({ id: UUID_B });
    (mp.paymentMethod.findFirst as jest.Mock).mockResolvedValueOnce({ id: UUID_C });

    const r = await registry.invoke(
      'create_transaction',
      { ...baseInput, paymentMethodId: UUID_C },
      { ...chatbotCtx, dryRun: true },
    );

    expect(r.ok).toBe(true);
    expect(TX_SVC).not.toHaveBeenCalled();
    expect(mp.auditLog.create).not.toHaveBeenCalled();
    if (r.ok) {
      expect(r.dryRun).toBe(true);
      expect((r.data as any).id).toBeNull();
      expect((r.data as any).status).toBe('preview');
      expect((r.data as any).attribution?.source).toBe('chatbot'); // atribuição no preview
    }
  });

  it('dryRun: categoria de tipo divergente → BUSINESS_RULE/CATEGORY_TYPE_MISMATCH', async () => {
    (mp.category.findFirst as jest.Mock).mockResolvedValueOnce({ id: UUID_A, type: 'income' });
    (mp.bankAccount.findFirst as jest.Mock).mockResolvedValueOnce({ id: UUID_B });

    const r = await registry.invoke(
      'create_transaction',
      baseInput, // type=expense
      { ...apiCtx, dryRun: true },
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('BUSINESS_RULE');
      expect(r.code).toBe('CATEGORY_TYPE_MISMATCH');
    }
  });

  it('service lança "Categoria não encontrada" → NOT_FOUND/CATEGORY_NOT_FOUND', async () => {
    TX_SVC.mockRejectedValueOnce(new Error('Categoria não encontrada'));
    const r = await registry.invoke('create_transaction', baseInput, apiCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('NOT_FOUND');
      expect(r.code).toBe('CATEGORY_NOT_FOUND');
    }
  });

  it('fail-open auditLog: se AuditLog falhar, tool ainda retorna ok=true', async () => {
    TX_SVC.mockResolvedValueOnce({
      id: 'tx-3', type: 'expense', amount: 10, description: 'x',
      categoryId: UUID_A, bankAccountId: UUID_B, paymentMethodId: null,
      status: 'completed', transactionDate: new Date(),
    });
    (mp.auditLog.create as jest.Mock).mockRejectedValueOnce(new Error('db down'));

    const r = await registry.invoke('create_transaction', baseInput, chatbotCtx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.data as any).id).toBe('tx-3');
      expect((r.data as any).auditLogId).toBeNull();
      expect((r.data as any).attribution).not.toBeNull();
    }
  });
});
