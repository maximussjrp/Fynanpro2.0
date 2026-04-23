/**
 * Webhook Processor — Fase A2A (C4)
 *
 * Consome rows de `AsaasWebhookEvent` que ainda estão `received`,
 * roteia por `eventType` para um handler e atualiza o status do evento.
 *
 * REGRAS (C4):
 *   - Idempotência total por `asaasPaymentId` (handlers usam upsert).
 *   - Eventos sem `payment.id` NÃO podem quebrar o processor:
 *     marcamos `status='failed'` + `lastError='NO_PAYMENT_ID'` e seguimos.
 *   - Eventos não-roteáveis (eventType desconhecido) viram `status='skipped'`.
 *   - DI 100% explícita (db + handlers obrigatórios; sem fallback implícito).
 *   - Não toca em Stripe, frontend, MLM ou cursos.
 *
 * O processor NÃO sabe sobre flags. O caller (job) é que decide quando rodar.
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import { log } from '../../utils/logger';
import type { AsaasWebhookPayload } from './asaas-types';
import {
  PAYMENT_CREATED,
  PAYMENT_CONFIRMED,
  PAYMENT_RECEIVED,
  PAYMENT_OVERDUE,
  PAYMENT_REFUNDED,
  PAYMENT_CHARGEBACK_REQUESTED,
  PAYMENT_DELETED,
  SUBSCRIPTION_UPDATED,
  SUBSCRIPTION_DELETED,
  SUBSCRIPTION_INACTIVATED,
  type WebhookHandler,
  type WebhookHandlerContext,
} from './handlers';
import { invalidateTenantBillingCache } from '../billing/tenant-billing-cache';

/** Subset mínimo do PrismaClient consumido. */
export type ProcessorDb = Pick<
  PrismaClient,
  'asaasWebhookEvent' | 'paymentRecord' | 'subscription' | 'tenant' | '$transaction'
>;

/**
 * C5.0 — Spec de handler no registry. Permite especificar por handler se
 * a validação `payment.id != null` deve ser aplicada (handlers SUBSCRIPTION_*
 * não carregam `payment` no payload).
 *
 * Aceita também um `WebhookHandler` cru (backward-compat C4): nesse caso
 * assume `requiresPaymentId: true`.
 */
export interface WebhookHandlerSpec {
  handler: WebhookHandler;
  requiresPaymentId: boolean;
}

export type WebhookHandlerRegistry = Record<
  string,
  WebhookHandler | WebhookHandlerSpec
>;

function normalizeSpec(v: WebhookHandler | WebhookHandlerSpec): WebhookHandlerSpec {
  return typeof v === 'function'
    ? { handler: v, requiresPaymentId: true }
    : v;
}

export interface ProcessSingleResult {
  id: string;
  eventType: string;
  outcome: 'processed' | 'skipped' | 'failed' | 'already_processed';
  error?: string;
}

export interface ProcessBatchResult {
  total: number;
  processed: number;
  skipped: number;
  failed: number;
  alreadyProcessed: number;
}

export interface WebhookProcessorDeps {
  db: ProcessorDb;
  /**
   * Map de eventType → handler. Por padrão (factory abaixo) registra
   * PAYMENT_CREATED, PAYMENT_CONFIRMED e PAYMENT_RECEIVED (C4.1: RECEIVED
   * é alias semântico de CONFIRMED — ver `handlers.ts`). Demais eventos →
   * skipped.
   */
  handlers?: WebhookHandlerRegistry;
  /** Limite de eventos por chamada de processBatch. Default 50. */
  batchSize?: number;
}

export interface WebhookProcessor {
  processOne(eventId: string): Promise<ProcessSingleResult>;
  processBatch(): Promise<ProcessBatchResult>;
}

const TERMINAL_STATUSES = ['processed', 'skipped'] as const;

export function buildWebhookProcessor(
  deps: WebhookProcessorDeps,
): WebhookProcessor {
  if (!deps?.db) {
    throw new Error('buildWebhookProcessor: db é obrigatório (DI explícita)');
  }
  const db = deps.db;
  const batchSize = deps.batchSize ?? 50;
  const handlers: WebhookHandlerRegistry =
    deps.handlers ?? {
      PAYMENT_CREATED,
      PAYMENT_CONFIRMED,
      PAYMENT_RECEIVED,
      PAYMENT_OVERDUE,
      PAYMENT_REFUNDED,
      PAYMENT_CHARGEBACK_REQUESTED,
      PAYMENT_DELETED,
      // C5.2 — subscription lifecycle (NÃO portam payment.id).
      SUBSCRIPTION_UPDATED: {
        handler: SUBSCRIPTION_UPDATED,
        requiresPaymentId: false,
      },
      SUBSCRIPTION_DELETED: {
        handler: SUBSCRIPTION_DELETED,
        requiresPaymentId: false,
      },
      SUBSCRIPTION_INACTIVATED: {
        handler: SUBSCRIPTION_INACTIVATED,
        requiresPaymentId: false,
      },
    };

  // Pré-normaliza o registry uma vez para eficiência em processBatch.
  const specs: Record<string, WebhookHandlerSpec> = Object.fromEntries(
    Object.entries(handlers).map(([k, v]) => [k, normalizeSpec(v)]),
  );

  async function markFailed(
    eventId: string,
    err: Error,
  ): Promise<void> {
    try {
      await db.asaasWebhookEvent.update({
        where: { id: eventId },
        data: {
          status: 'failed',
          lastError: err.message?.slice(0, 1000) ?? String(err),
        },
      });
    } catch (updateErr) {
      log.error('webhook-processor: falha ao marcar evento como failed', {
        eventId,
        err: (updateErr as Error).message,
      });
    }
  }

  async function processSingle(
    event: {
      id: string;
      eventType: string;
      payload: any;
      status: string;
    },
  ): Promise<ProcessSingleResult> {
    // Idempotência grossa: já em estado terminal? não reprocessa.
    if (TERMINAL_STATUSES.includes(event.status as any)) {
      return {
        id: event.id,
        eventType: event.eventType,
        outcome: 'already_processed',
      };
    }

    const spec = specs[event.eventType];
    if (!spec) {
      await db.asaasWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'skipped',
          processedAt: new Date(),
          lastError: null,
        },
      });
      return { id: event.id, eventType: event.eventType, outcome: 'skipped' };
    }

    const payload = event.payload as AsaasWebhookPayload;

    // C5.0: validação de payment.id virou POR-handler (spec.requiresPaymentId).
    if (spec.requiresPaymentId) {
      const paymentId =
        payload && typeof payload === 'object' && payload.payment
          ? payload.payment.id
          : undefined;
      if (!paymentId || typeof paymentId !== 'string') {
        const err = new Error('NO_PAYMENT_ID');
        await markFailed(event.id, err);
        log.warn('webhook-processor: evento sem payment.id', {
          eventId: event.id,
          eventType: event.eventType,
        });
        return {
          id: event.id,
          eventType: event.eventType,
          outcome: 'failed',
          error: err.message,
        };
      }
    }

    // Cache invalidation buffer — handlers empurram tenantIds a invalidar.
    // Invalidação roda DEPOIS do commit (evita race com rollback da tx).
    const invalidateTenantIds = new Set<string>();

    try {
      // RULE #2: handler + atualização do AsaasWebhookEvent na MESMA transação.
      await db.$transaction(async (tx) => {
        const ctx: WebhookHandlerContext = {
          tx: tx as unknown as Prisma.TransactionClient,
          payload,
          eventId: event.id,
          invalidateTenantIds,
        };
        await spec.handler(ctx);
        await tx.asaasWebhookEvent.update({
          where: { id: event.id },
          data: {
            status: 'processed',
            processedAt: new Date(),
            lastError: null,
          },
        });
      });

      // C5.0: invalidação de cache PÓS-commit (se tx falhou, não chegamos aqui).
      if (invalidateTenantIds.size > 0) {
        for (const tenantId of invalidateTenantIds) {
          invalidateTenantBillingCache(tenantId);
        }
        log.debug('webhook-processor: tenant billing cache invalidated', {
          eventId: event.id,
          eventType: event.eventType,
          tenantCount: invalidateTenantIds.size,
        });
      }

      return { id: event.id, eventType: event.eventType, outcome: 'processed' };
    } catch (err) {
      const e = err as Error;
      log.error('webhook-processor: handler falhou', {
        eventId: event.id,
        eventType: event.eventType,
        err: e.message,
      });
      await markFailed(event.id, e);
      return {
        id: event.id,
        eventType: event.eventType,
        outcome: 'failed',
        error: e.message,
      };
    }
  }

  return {
    async processOne(eventId: string): Promise<ProcessSingleResult> {
      const event = await db.asaasWebhookEvent.findUnique({
        where: { id: eventId },
        select: { id: true, eventType: true, payload: true, status: true },
      });
      if (!event) {
        return {
          id: eventId,
          eventType: 'UNKNOWN',
          outcome: 'failed',
          error: 'EVENT_NOT_FOUND',
        };
      }
      return processSingle(event as any);
    },

    async processBatch(): Promise<ProcessBatchResult> {
      const pending = await db.asaasWebhookEvent.findMany({
        where: { status: 'received' },
        orderBy: { receivedAt: 'asc' },
        take: batchSize,
        select: { id: true, eventType: true, payload: true, status: true },
      });

      const result: ProcessBatchResult = {
        total: pending.length,
        processed: 0,
        skipped: 0,
        failed: 0,
        alreadyProcessed: 0,
      };

      for (const ev of pending) {
        const out = await processSingle(ev as any);
        if (out.outcome === 'processed') result.processed++;
        else if (out.outcome === 'skipped') result.skipped++;
        else if (out.outcome === 'failed') result.failed++;
        else if (out.outcome === 'already_processed') result.alreadyProcessed++;
      }

      if (result.total > 0) {
        log.info('webhook-processor: batch concluído', result);
      }
      return result;
    },
  };
}
