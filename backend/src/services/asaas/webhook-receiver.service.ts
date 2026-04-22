/**
 * Webhook Receiver — Fase A1
 *
 * Responsabilidade única: receber payload do Asaas, validar token,
 * deduplicar por `asaasEventId` e persistir em `AsaasWebhookEvent`.
 *
 * SEM side-effects de domínio nesta fase. O processamento
 * (emitir DomainEvent, atualizar Subscription, etc) virá na Fase A2+.
 *
 * Política:
 *   - Token inválido → 401 (não persiste)
 *   - Payload sem `event` → 400
 *   - Evento duplicado (mesmo asaasEventId) → 200 idempotent (retorna o registro anterior)
 *   - Qualquer outro evento (mesmo desconhecido) → 200 `received`
 *
 * Retornar 200 rápido é crítico: Asaas considera 4xx/5xx falha e retenta,
 * inflando a tabela `AsaasWebhookEvent`.
 */

import { prisma } from '../../utils/prisma-client';
import { log } from '../../utils/logger';
import type { AsaasWebhookPayload } from './asaas-types';

export interface ReceiveResult {
  id: string;
  duplicated: boolean;
  eventType: string;
}

export class InvalidWebhookTokenError extends Error {
  readonly code = 'INVALID_TOKEN';
  constructor() {
    super('Token de webhook inválido');
  }
}

export class InvalidWebhookPayloadError extends Error {
  readonly code = 'INVALID_PAYLOAD';
  constructor(message: string) {
    super(message);
  }
}

export interface ReceiverOptions {
  expectedToken: string;
  providedToken: string | undefined;
  payload: unknown;
}

function assertToken(expected: string, provided: string | undefined): void {
  if (!expected) {
    // Conf. inexistente → trata como inválido (fail-closed).
    throw new InvalidWebhookTokenError();
  }
  if (!provided || provided !== expected) {
    throw new InvalidWebhookTokenError();
  }
}

function assertPayload(p: unknown): asserts p is AsaasWebhookPayload {
  if (!p || typeof p !== 'object') {
    throw new InvalidWebhookPayloadError('payload ausente');
  }
  const ev = (p as any).event;
  if (typeof ev !== 'string' || ev.trim() === '') {
    throw new InvalidWebhookPayloadError('campo "event" ausente ou inválido');
  }
}

export const asaasWebhookReceiver = {
  async receive(opts: ReceiverOptions): Promise<ReceiveResult> {
    assertToken(opts.expectedToken, opts.providedToken);
    assertPayload(opts.payload);

    const payload = opts.payload as AsaasWebhookPayload;
    const asaasEventId = typeof payload.id === 'string' ? payload.id : null;

    // Dedup idempotente.
    if (asaasEventId) {
      const existing = await prisma.asaasWebhookEvent.findUnique({
        where: { asaasEventId },
        select: { id: true, eventType: true },
      });
      if (existing) {
        log.info('Asaas webhook duplicado (idempotent)', {
          asaasEventId,
          eventType: existing.eventType,
        });
        return { id: existing.id, duplicated: true, eventType: existing.eventType };
      }
    }

    const created = await prisma.asaasWebhookEvent.create({
      data: {
        asaasEventId,
        eventType: payload.event,
        payload: payload as any,
        status: 'received',
        signatureValid: true, // token já validado
      },
      select: { id: true, eventType: true },
    });

    log.info('Asaas webhook recebido', {
      id: created.id,
      asaasEventId,
      eventType: created.eventType,
    });

    return { id: created.id, duplicated: false, eventType: created.eventType };
  },
};
