/**
 * Asaas webhook consumer job — Fase A2A (C4)
 *
 * Loop simples (cron) que processa rows pendentes em `AsaasWebhookEvent`.
 * Gated por feature flag `asaas.consumer.enabled` (default OFF). Em produção,
 * o job NÃO inicia até que a flag seja ligada explicitamente.
 *
 * Schedule: a cada 1 minuto. Batch máx 50 (default do processor).
 *
 * Reentrante? Não há lock distribuído aqui. C4 roda 1 instância backend; se
 * escalar pra N réplicas, mover para uma fila (BullMQ / pgmq) em fase futura.
 */

import cron, { ScheduledTask } from 'node-cron';
import { isFeatureEnabled } from '../config/feature-flags';
import { log } from '../utils/logger';
import { prisma } from '../utils/prisma-client';
import { buildWebhookProcessor } from '../services/asaas/webhook-processor.service';

let scheduled: ScheduledTask | null = null;
let running = false;

/**
 * Inicia o job. NO-OP quando `asaas.consumer.enabled` está OFF.
 * Chamável várias vezes (idempotente: só agenda uma vez).
 */
export function startAsaasConsumerJob(): { started: boolean; reason?: string } {
  if (!isFeatureEnabled('asaas.consumer.enabled')) {
    log.info('asaas-consumer.job: flag asaas.consumer.enabled OFF — não iniciado');
    return { started: false, reason: 'flag_off' };
  }
  if (scheduled) {
    return { started: true, reason: 'already_scheduled' };
  }

  const processor = buildWebhookProcessor({ db: prisma });

  scheduled = cron.schedule('*/1 * * * *', async () => {
    if (running) {
      log.warn('asaas-consumer.job: tick anterior ainda rodando, skip');
      return;
    }
    running = true;
    try {
      const result = await processor.processBatch();
      if (result.total > 0) {
        log.info('asaas-consumer.job: batch', result);
      }
    } catch (err) {
      log.error('asaas-consumer.job: erro inesperado no batch', {
        err: (err as Error).message,
      });
    } finally {
      running = false;
    }
  });

  log.info('asaas-consumer.job: iniciado (cron */1 * * * *)');
  return { started: true };
}

/** Para o job (testes/shutdown). */
export function stopAsaasConsumerJob(): void {
  if (scheduled) {
    scheduled.stop();
    scheduled = null;
  }
}
