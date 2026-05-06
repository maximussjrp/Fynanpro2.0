/**
 * Tool: create_transaction
 *
 * Cria uma transação financeira para o tenant autenticado. Reutiliza
 * `TransactionService.create` (fonte da verdade de regra de negócio:
 * validação de categoria/conta/meio de pagamento, atualização atômica
 * de saldo e invalidação de cache).
 *
 * Decisões:
 *   - Reuso de service existente em vez de Prisma direto → uma única
 *     regra de negócio, uma única semântica de saldo, uma única
 *     invalidação de cache.
 *   - Quando `ctx.source === 'chatbot'`, constrói a atribuição do
 *     assistant e injeta em `TransactionService.create(..., { attribution })`,
 *     preservando a rastreabilidade já validada no Sprint 1.1.
 *   - Sempre registra AuditLog (`CHATBOT_TRANSACTION_CREATE`) quando a
 *     origem é o chatbot — fail-open, via `logAssistantAction`.
 *   - Suporta `dryRun`: valida input + existência de conta/categoria
 *     e retorna um preview **sem** gravar nem alterar saldo.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import { transactionService } from '../../services/transaction.service';
import { prisma } from '../../utils/prisma-client';
import {
  buildAssistantAttribution,
  logAssistantAction,
} from '../../services/assistant-audit.service';
import type { ToolDefinition, ToolResult } from './types';

const inputSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('amount deve ser maior que zero'),
  description: z.string().trim().min(1).max(500),
  categoryId: z.string().uuid('categoryId inválido'),
  bankAccountId: z.string().uuid('bankAccountId inválido'),
  paymentMethodId: z.string().uuid('paymentMethodId inválido').optional(),
  /** Perfil (e-Financeira) associado à transação. Opcional. */
  userProfileId: z.string().uuid('userProfileId inválido').optional(),
  /** Gasto fixo? Default do schema é true; chatbot de lançamento pontual passa false. */
  isFixed: z.boolean().optional(),
  /** Status de liquidação. Default do service é 'pending' (flipa para 'completed' só se data < hoje). */
  status: z.enum(['completed', 'pending', 'overdue']).optional(),
  /** ISO date (YYYY-MM-DD). Default: hoje. */
  date: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export interface CreateTransactionOutput {
  id: string | null;
  type: string;
  amount: number;
  description: string;
  categoryId: string;
  bankAccountId: string;
  paymentMethodId: string | null;
  status: string;
  transactionDate: string;
  attribution: {
    source: string;
    createdByAssistant: boolean;
    sourceSessionId: string | null;
    sourceMessageId: string | null;
    assistantRunId: string | null;
  } | null;
  auditLogId: string | null;
  dryRun: boolean;
}

export const createTransactionTool: ToolDefinition<typeof inputSchema, CreateTransactionOutput> = {
  name: 'create_transaction',
  description: 'Cria uma transação (receita/despesa) para o tenant autenticado. Reutiliza o TransactionService (valida referências e atualiza saldo atomicamente). Persiste rastreabilidade + AuditLog quando a origem é o chatbot. Suporta dryRun.',
  kind: 'write',
  input: inputSchema,
  confirmation: 'soft',
  async execute(input, ctx): Promise<ToolResult<CreateTransactionOutput>> {
    const today = new Date();
    const dateStr = input.date || today.toISOString().slice(0, 10);

    const fromChatbot = ctx.source === 'chatbot';
    const runId = ctx.runId || randomUUID();

    // Atribuição (apenas para chamadas originadas pelo chatbot)
    const attribution = fromChatbot
      ? buildAssistantAttribution({
          sessionId: ctx.sessionId || '',
          messageId: ctx.messageId || null,
          runId,
        })
      : null;

    // --- DRY-RUN --------------------------------------------------------
    // Valida existência de categoria/conta/pagamento no tenant sem criar.
    if (ctx.dryRun) {
      const [category, account, paymentMethod] = await Promise.all([
        prisma.category.findFirst({
          where: { id: input.categoryId, tenantId: ctx.tenantId, deletedAt: null },
          select: { id: true, type: true },
        }),
        prisma.bankAccount.findFirst({
          where: { id: input.bankAccountId, tenantId: ctx.tenantId, deletedAt: null },
          select: { id: true },
        }),
        input.paymentMethodId
          ? prisma.paymentMethod.findFirst({
              where: { id: input.paymentMethodId, tenantId: ctx.tenantId, deletedAt: null },
              select: { id: true },
            })
          : Promise.resolve(null),
      ]);

      if (!category) {
        return { ok: false, kind: 'NOT_FOUND', code: 'CATEGORY_NOT_FOUND', message: 'Categoria não encontrada' };
      }
      if (category.type !== input.type) {
        return {
          ok: false,
          kind: 'BUSINESS_RULE',
          code: 'CATEGORY_TYPE_MISMATCH',
          message: `Categoria é do tipo '${category.type}', incompatível com '${input.type}'`,
        };
      }
      if (!account) {
        return { ok: false, kind: 'NOT_FOUND', code: 'ACCOUNT_NOT_FOUND', message: 'Conta bancária não encontrada' };
      }
      if (input.paymentMethodId && !paymentMethod) {
        return { ok: false, kind: 'NOT_FOUND', code: 'PAYMENT_METHOD_NOT_FOUND', message: 'Meio de pagamento não encontrado' };
      }

      return {
        ok: true,
        dryRun: true,
        data: {
          id: null,
          type: input.type,
          amount: input.amount,
          description: input.description,
          categoryId: input.categoryId,
          bankAccountId: input.bankAccountId,
          paymentMethodId: input.paymentMethodId ?? null,
          status: 'preview',
          transactionDate: dateStr,
          attribution: attribution
            ? {
                source: attribution.source,
                createdByAssistant: attribution.createdByAssistant,
                sourceSessionId: attribution.sourceSessionId,
                sourceMessageId: attribution.sourceMessageId,
                assistantRunId: attribution.assistantRunId,
              }
            : null,
          auditLogId: null,
          dryRun: true,
        },
      };
    }

    // --- IDEMPOTÊNCIA DO CHATBOT ----------------------------------------
    // Mesmo (tenantId, sourceSessionId, sourceMessageId) com source='chatbot'
    // NÃO pode gerar transação duplicada (double-click do botão Confirmar,
    // retry de rede, reenvio de webhook etc.).
    //
    // Pre-check: se já existe uma transação para esta mensagem, devolve a
    // existente sem criar nada nem mexer em saldo.
    //
    // O índice único parcial (migration 20260506_reliability_sprint2) é a
    // garantia final em caso de race condition — o catch de P2002 abaixo
    // recupera a linha vencedora.
    if (fromChatbot && attribution && attribution.sourceMessageId) {
      const existing = await prisma.transaction.findFirst({
        where: {
          tenantId: ctx.tenantId,
          source: 'chatbot',
          sourceSessionId: attribution.sourceSessionId,
          sourceMessageId: attribution.sourceMessageId,
          deletedAt: null,
        },
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          categoryId: true,
          bankAccountId: true,
          paymentMethodId: true,
          status: true,
          transactionDate: true,
        },
      });
      if (existing) {
        return {
          ok: true,
          data: {
            id: existing.id,
            type: existing.type,
            amount: Number(existing.amount),
            description: existing.description ?? '',
            categoryId: existing.categoryId!,
            bankAccountId: existing.bankAccountId!,
            paymentMethodId: existing.paymentMethodId ?? null,
            status: existing.status,
            transactionDate: new Date(existing.transactionDate).toISOString().slice(0, 10),
            attribution: {
              source: attribution.source,
              createdByAssistant: attribution.createdByAssistant,
              sourceSessionId: attribution.sourceSessionId,
              sourceMessageId: attribution.sourceMessageId,
              assistantRunId: attribution.assistantRunId,
            },
            auditLogId: null, // não relogar, evento já registrado na 1ª execução
            dryRun: false,
          },
        };
      }
    }

    // --- EXECUÇÃO REAL --------------------------------------------------
    let created: any;
    try {
      const svcOptions: {
        attribution?: typeof attribution extends null ? never : any;
        userProfileId?: string | null;
        isFixed?: boolean;
      } = {};
      if (attribution) svcOptions.attribution = attribution;
      if (input.userProfileId !== undefined) svcOptions.userProfileId = input.userProfileId;
      if (input.isFixed !== undefined) svcOptions.isFixed = input.isFixed;

      created = await transactionService.create(
        {
          type: input.type,
          amount: input.amount,
          description: input.description,
          transactionDate: dateStr,
          categoryId: input.categoryId,
          bankAccountId: input.bankAccountId,
          paymentMethodId: input.paymentMethodId,
          status: input.status,
        } as any,
        ctx.userId,
        ctx.tenantId,
        Object.keys(svcOptions).length > 0 ? (svcOptions as any) : undefined,
      );
    } catch (err: any) {
      const msg = err?.message || String(err);
      // Race condition: índice único parcial (chatbot idempotency) já gravou
      // a transação concorrente. Recupera e devolve como sucesso.
      if (
        err?.code === 'P2002' &&
        fromChatbot &&
        attribution &&
        attribution.sourceMessageId
      ) {
        const winner = await prisma.transaction.findFirst({
          where: {
            tenantId: ctx.tenantId,
            source: 'chatbot',
            sourceSessionId: attribution.sourceSessionId,
            sourceMessageId: attribution.sourceMessageId,
            deletedAt: null,
          },
        });
        if (winner) {
          created = winner;
          // Cai para o fluxo de sucesso (audit log + return) abaixo.
        } else {
          throw err;
        }
      } else if (/Categoria não encontrada/i.test(msg)) {
        return { ok: false, kind: 'NOT_FOUND', code: 'CATEGORY_NOT_FOUND', message: msg };
      } else if (/Conta bancária não encontrada/i.test(msg)) {
        return { ok: false, kind: 'NOT_FOUND', code: 'ACCOUNT_NOT_FOUND', message: msg };
      } else if (/Meio de pagamento não encontrado/i.test(msg)) {
        return { ok: false, kind: 'NOT_FOUND', code: 'PAYMENT_METHOD_NOT_FOUND', message: msg };
      } else if (/Categoria não é de/i.test(msg)) {
        return { ok: false, kind: 'BUSINESS_RULE', code: 'CATEGORY_TYPE_MISMATCH', message: msg };
      } else {
        throw err;
      }
    }

    // --- AUDIT LOG (fail-open, só quando origem é chatbot) --------------
    let auditLogId: string | null = null;
    if (fromChatbot && attribution) {
      auditLogId = await logAssistantAction({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'CHATBOT_TRANSACTION_CREATE',
        resourceType: 'Transaction',
        resourceId: created.id,
        sessionId: ctx.sessionId || '',
        messageId: ctx.messageId || null,
        runId,
        details: {
          type: created.type,
          amount: Number(created.amount),
          categoryId: created.categoryId,
          bankAccountId: created.bankAccountId,
          paymentMethodId: created.paymentMethodId,
          tool: 'create_transaction',
        },
      });
    }

    return {
      ok: true,
      data: {
        id: created.id,
        type: created.type,
        amount: Number(created.amount),
        description: created.description,
        categoryId: created.categoryId,
        bankAccountId: created.bankAccountId,
        paymentMethodId: created.paymentMethodId ?? null,
        status: created.status,
        transactionDate: new Date(created.transactionDate).toISOString().slice(0, 10),
        attribution: attribution
          ? {
              source: attribution.source,
              createdByAssistant: attribution.createdByAssistant,
              sourceSessionId: attribution.sourceSessionId,
              sourceMessageId: attribution.sourceMessageId,
              assistantRunId: attribution.assistantRunId,
            }
          : null,
        auditLogId,
        dryRun: false,
      },
    };
  },
};
