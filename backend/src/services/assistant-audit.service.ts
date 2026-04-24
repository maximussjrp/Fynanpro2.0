/**
 * Assistant Audit Service — Sprint 1
 *
 * Camada fina de rastreabilidade e auditoria para ações originadas pelo
 * assistente conversacional (Isis).
 *
 * Decisão de política:
 *   - Fail-open: falhas ao escrever AuditLog NÃO abortam o fluxo do usuário.
 *     O dado primário (Transaction/BankAccount) já fica rastreável via os
 *     campos `source`, `createdByAssistant`, `sourceSessionId`,
 *     `sourceMessageId` e `assistantRunId` gravados diretamente nas próprias
 *     tabelas. O AuditLog é uma segunda camada (timeline, LGPD, suporte).
 *     Quebrar a UX do chat por uma falha de logging seria perda maior que
 *     um log faltante. Toda falha é logada como `error` para monitoração.
 *
 * Escopo:
 *   - Apenas rastreabilidade/auditoria. Não faz validação de negócio,
 *     não toca em serviços de domínio.
 */

import { log } from '../utils/logger';
import { prisma } from '../utils/prisma-client';

export const ASSISTANT_SOURCE = 'chatbot' as const;
export const ASSISTANT_ACTOR = 'isis' as const;

export interface AssistantAttribution {
  source: typeof ASSISTANT_SOURCE;
  createdByAssistant: true;
  sourceSessionId: string;
  sourceMessageId: string | null;
  assistantRunId: string;
}

/**
 * Monta o bloco de atribuição para gravar em Transaction / BankAccount
 * quando a criação é originada pelo chatbot.
 */
export function buildAssistantAttribution(params: {
  sessionId: string;
  messageId: string | null;
  runId: string;
}): AssistantAttribution {
  return {
    source: ASSISTANT_SOURCE,
    createdByAssistant: true,
    sourceSessionId: params.sessionId,
    sourceMessageId: params.messageId,
    assistantRunId: params.runId,
  };
}

export type AssistantAuditAction =
  | 'CHATBOT_TRANSACTION_CREATE'
  | 'CHATBOT_BANK_ACCOUNT_CREATE';

export interface AssistantAuditInput {
  tenantId: string;
  userId: string;
  action: AssistantAuditAction;
  resourceType: 'Transaction' | 'BankAccount';
  resourceId: string;
  sessionId: string;
  messageId: string | null;
  runId: string;
  details?: Record<string, unknown>;
}

/**
 * Escreve uma entrada em AuditLog para uma ação executada pelo assistente.
 *
 * **Fail-open**: exceções são capturadas e logadas, nunca propagadas.
 * Sempre retorna o id do AuditLog criado, ou `null` em caso de falha.
 */
export async function logAssistantAction(
  input: AssistantAuditInput
): Promise<string | null> {
  try {
    const changes = JSON.stringify({
      actor: ASSISTANT_ACTOR,
      source: ASSISTANT_SOURCE,
      sessionId: input.sessionId,
      messageId: input.messageId,
      runId: input.runId,
      ...(input.details || {}),
    });

    const created = await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        changes,
      },
      select: { id: true },
    });

    return created.id;
  } catch (error: any) {
    // Fail-open: nunca derruba o fluxo do chat.
    log.error('assistant-audit: falha ao escrever AuditLog (fail-open)', {
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      runId: input.runId,
      error: error?.message || String(error),
    });
    return null;
  }
}
