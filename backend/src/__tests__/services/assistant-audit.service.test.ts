/**
 * assistant-audit.service tests
 *
 * Cobre:
 *  - buildAssistantAttribution: contrato dos campos de rastreabilidade
 *  - logAssistantAction: fail-open contra falhas do AuditLog
 */

import { mockPrisma } from '../setup';
import {
  buildAssistantAttribution,
  logAssistantAction,
  ASSISTANT_SOURCE,
} from '../../services/assistant-audit.service';

// mockPrisma nÃ£o inclui auditLog por padrÃ£o â€” adicionar localmente.
const mp = mockPrisma as any;
mp.auditLog = {
  create: jest.fn(),
};

describe('assistant-audit.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildAssistantAttribution()', () => {
    it('deve retornar todos os campos de atribuiÃ§Ã£o com messageId', () => {
      const attr = buildAssistantAttribution({
        sessionId: 'sess-1',
        messageId: 'msg-1',
        runId: 'run-1',
      });

      expect(attr).toEqual({
        source: ASSISTANT_SOURCE,
        createdByAssistant: true,
        sourceSessionId: 'sess-1',
        sourceMessageId: 'msg-1',
        assistantRunId: 'run-1',
      });
      expect(attr.source).toBe('chatbot');
    });

    it('deve tolerar messageId null (ex: saveMessage falhou)', () => {
      const attr = buildAssistantAttribution({
        sessionId: 'sess-2',
        messageId: null,
        runId: 'run-2',
      });

      expect(attr.sourceSessionId).toBe('sess-2');
      expect(attr.sourceMessageId).toBeNull();
      expect(attr.assistantRunId).toBe('run-2');
      expect(attr.createdByAssistant).toBe(true);
    });
  });

  describe('logAssistantAction()', () => {
    it('deve gravar AuditLog com action, resourceId, tenantId e changes JSON', async () => {
      (mp.auditLog.create as jest.Mock).mockResolvedValueOnce({
        id: 'audit-1',
      });

      const id = await logAssistantAction({
        tenantId: 't-1',
        userId: 'u-1',
        action: 'CHATBOT_TRANSACTION_CREATE',
        resourceType: 'Transaction',
        resourceId: 'tx-1',
        sessionId: 'sess-1',
        messageId: 'msg-1',
        runId: 'run-1',
        details: { amount: 50 },
      });

      expect(id).toBe('audit-1');
      expect(mp.auditLog.create).toHaveBeenCalledTimes(1);

      const callArg = (mp.auditLog.create as jest.Mock).mock.calls[0][0];
      expect(callArg.data.action).toBe('CHATBOT_TRANSACTION_CREATE');
      expect(callArg.data.resourceType).toBe('Transaction');
      expect(callArg.data.resourceId).toBe('tx-1');
      expect(callArg.data.tenantId).toBe('t-1');
      expect(callArg.data.userId).toBe('u-1');

      const changes = JSON.parse(callArg.data.changes);
      expect(changes.actor).toBe('isis');
      expect(changes.source).toBe('chatbot');
      expect(changes.sessionId).toBe('sess-1');
      expect(changes.messageId).toBe('msg-1');
      expect(changes.runId).toBe('run-1');
      expect(changes.amount).toBe(50);
    });

    it('fail-open: se prisma.auditLog.create falhar, retorna null SEM lanÃ§ar', async () => {
      (mp.auditLog.create as jest.Mock).mockRejectedValueOnce(
        new Error('boom')
      );

      let thrown: unknown = null;
      let result: string | null = 'sentinel' as any;
      try {
        result = await logAssistantAction({
          tenantId: 't-1',
          userId: 'u-1',
          action: 'CHATBOT_BANK_ACCOUNT_CREATE',
          resourceType: 'BankAccount',
          resourceId: 'ba-1',
          sessionId: 'sess-1',
          messageId: null,
          runId: 'run-1',
        });
      } catch (e) {
        thrown = e;
      }

      expect(thrown).toBeNull();
      expect(result).toBeNull();
    });

    it('aceita messageId null e ainda grava a entrada', async () => {
      (mp.auditLog.create as jest.Mock).mockResolvedValueOnce({
        id: 'audit-2',
      });

      const id = await logAssistantAction({
        tenantId: 't-2',
        userId: 'u-2',
        action: 'CHATBOT_BANK_ACCOUNT_CREATE',
        resourceType: 'BankAccount',
        resourceId: 'ba-2',
        sessionId: 'sess-2',
        messageId: null,
        runId: 'run-2',
      });

      expect(id).toBe('audit-2');
      const changes = JSON.parse(
        (mp.auditLog.create as jest.Mock).mock.calls[0][0].data.changes
      );
      expect(changes.messageId).toBeNull();
    });
  });
});
