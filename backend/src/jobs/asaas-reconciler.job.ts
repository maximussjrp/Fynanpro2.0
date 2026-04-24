/**
 * C5.4 — Asaas reconciler cron job.
 *
 * Wrapper mínimo sobre `runReconcilerOnce`. Gated por
 * `FF_ASAAS_RECONCILER_ENABLED` (default OFF em produção).
 *
 * Startup guard obrigatório: `FF_ASAAS_RECONCILER_MODE=autofix` sem
 * `FF_ASAAS_RECONCILER_AUTOFIX=true` **falha a inicialização do job**
 * (exigência 2 do escopo da subfase). Autofix real é reservado para C5.5+.
 */

import cron, { ScheduledTask } from 'node-cron';
import { log } from '../utils/logger';
import { prisma } from '../utils/prisma-client';
import { buildAsaasClientFromEnv } from '../services/asaas/asaas-client';
import {
  assertAutofixAllowed,
  readReconcilerConfigFromEnv,
  type ReconcilerConfig,
} from '../services/asaas/reconciler.config';
import { runReconcilerOnce } from '../services/asaas/reconciler.service';

let scheduled: ScheduledTask | null = null;
let running = false;

/**
 * Gera expressão cron a partir do intervalo em minutos.
 * Intervalos >= 60min viram "0 (slash-star)N * * *" (hourly multiplier).
 */
function toCronExpr(intervalMin: number): string {
  if (intervalMin >= 60) {
    const hours = Math.min(24, Math.max(1, Math.floor(intervalMin / 60)));
    return `0 */${hours} * * *`;
  }
  return `*/${intervalMin} * * * *`;
}

export interface StartReconcilerResult {
  started: boolean;
  reason?: string;
  mode?: ReconcilerConfig['mode'];
  cronExpr?: string;
}

/**
 * Inicia o job. Sempre aplica o startup guard antes da checagem de flag —
 * a intenção é: uma config errada (autofix sem permissão) deve abortar
 * deploy mesmo que o usuário tenha deixado enabled=false, evitando
 * armadilha "liguei a flag e fui surpreendido".
 */
export function startAsaasReconcilerJob(): StartReconcilerResult {
  const cfg = readReconcilerConfigFromEnv();

  // Startup guard — SEMPRE executa, independentemente de enabled.
  assertAutofixAllowed(cfg);

  if (!cfg.enabled) {
    log.info('asaas-reconciler.job: FF_ASAAS_RECONCILER_ENABLED OFF — não iniciado');
    return { started: false, reason: 'flag_off' };
  }
  if (scheduled) {
    return { started: true, reason: 'already_scheduled', mode: cfg.mode };
  }

  const asaas = buildAsaasClientFromEnv();
  if (!asaas) {
    log.warn('asaas-reconciler.job: ASAAS_API_KEY ausente — não iniciado');
    return { started: false, reason: 'no_api_key' };
  }

  const cronExpr = toCronExpr(cfg.intervalMin);

  scheduled = cron.schedule(cronExpr, async () => {
    if (running) {
      log.warn('asaas-reconciler.job: tick anterior ainda rodando, skip');
      return;
    }
    running = true;
    try {
      const result = await runReconcilerOnce({
        db: prisma,
        asaas,
        config: readReconcilerConfigFromEnv(), // hot-reload por tick
      });
      log.info('asaas-reconciler.job: tick', result);
    } catch (err) {
      log.error('asaas-reconciler.job: erro inesperado no tick', {
        err: (err as Error).message,
      });
    } finally {
      running = false;
    }
  });

  log.info('asaas-reconciler.job: iniciado', {
    mode: cfg.mode,
    cronExpr,
    batchSize: cfg.batchSize,
    intervalMin: cfg.intervalMin,
    allowlistSize: cfg.tenantAllowlist.length,
    inSyncSampling: cfg.inSyncSampling,
  });

  return { started: true, mode: cfg.mode, cronExpr };
}

/** Para o job (testes/shutdown). */
export function stopAsaasReconcilerJob(): void {
  if (scheduled) {
    scheduled.stop();
    scheduled = null;
  }
}
