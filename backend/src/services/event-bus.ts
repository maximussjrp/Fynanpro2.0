/**
 * Event Bus — outbox minimalista (Fase A1).
 *
 * Responsabilidade única: persistir eventos de domínio em `DomainEvent`.
 * Nenhum dispatcher/worker é implementado aqui — virá na Fase A2+.
 *
 * Por que existe já em A1?
 *   - Garante que qualquer código futuro (webhook-receiver, billing-service)
 *     tenha UM ponto canônico para emitir eventos.
 *   - Evita ficar espalhando `prisma.domainEvent.create` pelo código.
 *
 * Semântica:
 *   - status inicial: 'pending'
 *   - attempts: 0
 *   - nextAttemptAt: now() (pronto para ser consumido)
 *
 * Falhas em `publish` NUNCA devem propagar para o caller quando opts.swallow=true.
 * Perder um evento é ruim, mas travar um webhook receiver é pior (Asaas reenviaria).
 */

import { prisma } from '../utils/prisma-client';
import { log } from '../utils/logger';

export interface PublishEventInput {
  eventType: string;
  aggregateType?: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
}

export interface PublishOptions {
  /** Se true, loga o erro mas não relança. Default: false. */
  swallow?: boolean;
}

export async function publishDomainEvent(
  input: PublishEventInput,
  opts: PublishOptions = {},
): Promise<{ id: string } | null> {
  try {
    const created = await prisma.domainEvent.create({
      data: {
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payload: input.payload as any,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(),
      },
      select: { id: true },
    });
    return created;
  } catch (err) {
    log.error('publishDomainEvent failed', {
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      err: (err as Error)?.message,
    });
    if (opts.swallow) return null;
    throw err;
  }
}
