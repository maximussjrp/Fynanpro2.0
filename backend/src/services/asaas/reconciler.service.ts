/**
 * C5.4 — Asaas reconciler service (dryrun-only; autofix é stub).
 *
 * Roda em 3 estágios dentro de uma invocação:
 *   1. Snapshot local: Subscription provider='asaas' filtrado por
 *      Tenant.billingSource='asaas' (exigência 3 do escopo).
 *   2. Fetch remoto: `getSubscription` + `listPaymentsBySubscription` com
 *      concorrência + delay mínimo + backoff 429.
 *   3. Diff + persistência: cria ReconciliationRun (status='success'|'partial'
 *      |'failed') e N ReconciliationFinding.
 *
 * Não altera Subscription/Tenant/PaymentRecord. Autofix fica fora desta fase.
 *
 * Consumido pela C5.3 via `getLastSuccessfulRunAt(db)` — mesma tabela serve
 * como sinal `lastSuccessfulRunAt` (em runs mode!='shadow').
 */

import type {
  PrismaClient,
  ReconciliationRun,
  ReconciliationFindingKind,
} from '@prisma/client';
import { log } from '../../utils/logger';
import type { AsaasClient } from './asaas-client';
import type { AsaasSubscriptionStatus } from './asaas-types';
import type { ReconcilerConfig } from './reconciler.config';

/** Row local usada no diff. */
export interface LocalSubscriptionSnapshot {
  id: string;
  tenantId: string;
  status: string;
  asaasSubscriptionId: string | null;
  lastAsaasEventAt: Date | null;
  currentPeriodEnd: Date | null;
}

/** Projeção mínima necessária para o diff. */
export interface RemoteSubscriptionSnapshot {
  status: AsaasSubscriptionStatus | string;
  lastPaymentStatus?: string;
  lastPaymentDate?: Date;
}

export interface ReconcilerDeps {
  db: PrismaClient;
  asaas: AsaasClient;
  config: ReconcilerConfig;
  /** Override de clock para testes. */
  now?: () => Date;
  /** RNG para amostragem IN_SYNC. Testes injetam determinístico. */
  random?: () => number;
  /**
   * Bypass do filtro billingSource='asaas' — reservado **APENAS** para testes
   * controlados (exigência 3). Não expor via env.
   */
  testBypassBillingSourceFilter?: boolean;
}

export interface ReconcilerRunResult {
  runId: string;
  mode: ReconcilerConfig['mode'];
  status: 'success' | 'partial' | 'failed';
  subscriptionsScanned: number;
  findingsCount: number;
  asaasApiCalls: number;
  asaasRateLimitHits: number;
  durationMs: number;
}

interface FindingDraft {
  tenantId: string;
  subscriptionId: string | null;
  asaasSubscriptionId: string | null;
  kind: ReconciliationFindingKind;
  localStatus: string | null;
  remoteStatus: string | null;
  remoteLastPaymentStatus: string | null;
  remoteLastPaymentDate: Date | null;
  detail: Record<string, unknown> | null;
}

/**
 * Mapeia uma tripla (localStatus, remoteStatus, lastPaymentStatus)
 * no enum `ReconciliationFindingKind`.
 *
 * Exportado para testes.
 */
export function classifyFinding(args: {
  localStatus: string;
  remote: RemoteSubscriptionSnapshot | 'not_found';
  now: Date;
  lastAsaasEventAt: Date | null;
}): ReconciliationFindingKind {
  const { localStatus, remote, now, lastAsaasEventAt } = args;

  if (remote === 'not_found') {
    if (localStatus === 'cancelled') return 'IN_SYNC';
    return 'REMOTE_NOT_FOUND';
  }

  const remoteStatus = (remote.status || '').toUpperCase();

  // Local cancelled: C5.2 define como terminal absoluto. Qualquer remoto ativo
  // é divergência que precisa de investigação manual, nunca regressão auto.
  if (localStatus === 'cancelled') {
    if (remoteStatus === 'ACTIVE') return 'LOCAL_CANCELLED_REMOTE_ACTIVE';
    return 'IN_SYNC';
  }

  // Local suspended.
  if (localStatus === 'suspended') {
    if (remoteStatus === 'ACTIVE') return 'LOCAL_SUSPENDED_REMOTE_ACTIVE';
    return 'IN_SYNC';
  }

  // Local past_due.
  if (localStatus === 'past_due') {
    if (remoteStatus === 'ACTIVE') {
      // Crítico para C5.3: local acha que está em mora, Asaas acha que está ok.
      return 'LOCAL_PAST_DUE_REMOTE_ACTIVE';
    }
    return 'IN_SYNC';
  }

  // Local active.
  if (localStatus === 'active') {
    if (remoteStatus === 'ACTIVE') {
      // Pode ainda ser PAYMENT_LAG: Asaas tem pagamento recente recebido
      // que não foi processado localmente (lastAsaasEventAt muito antigo).
      if (remote.lastPaymentStatus && remote.lastPaymentDate && lastAsaasEventAt) {
        const remoteRecent =
          now.getTime() - remote.lastPaymentDate.getTime() < 24 * 3600 * 1000;
        const localStale =
          remote.lastPaymentDate.getTime() > lastAsaasEventAt.getTime();
        if (remoteRecent && localStale) return 'PAYMENT_LAG';
      }
      return 'IN_SYNC';
    }
    if (remoteStatus === 'EXPIRED') return 'LOCAL_ACTIVE_REMOTE_EXPIRED';
    if (remoteStatus === 'INACTIVE') return 'LOCAL_ACTIVE_REMOTE_INACTIVE';
    // Asaas pode devolver status que não está no enum local. Defensivo.
    return 'UNKNOWN_REMOTE_STATUS';
  }

  // Local em estado não-rastreado (pending etc): reportar como unknown.
  return 'UNKNOWN_REMOTE_STATUS';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Busca subscription remota no Asaas com backoff para 429.
 * Retorna `'not_found'` para 404, throws para demais erros.
 */
async function fetchRemoteSubscription(
  asaas: AsaasClient,
  id: string,
  cfg: ReconcilerConfig,
  counters: { apiCalls: number; rateLimitHits: number },
): Promise<RemoteSubscriptionSnapshot | 'not_found' | 'error'> {
  for (let attempt = 1; attempt <= 1 + cfg.rateLimitMaxRetries; attempt++) {
    try {
      counters.apiCalls++;
      const sub = await asaas.getSubscription(id);
      // Busca últimos pagamentos para detectar PAYMENT_LAG.
      counters.apiCalls++;
      const payments = await asaas.request<{
        data?: Array<{ status?: string; paymentDate?: string; dueDate?: string }>;
      }>('GET', `/subscriptions/${encodeURIComponent(id)}/payments?limit=5`);
      const last = payments.data?.[0];
      const lastPaymentDate = last?.paymentDate
        ? new Date(last.paymentDate)
        : last?.dueDate
          ? new Date(last.dueDate)
          : undefined;
      return {
        status: (sub as { status?: string }).status ?? '',
        lastPaymentStatus: last?.status,
        lastPaymentDate: lastPaymentDate && !Number.isNaN(lastPaymentDate.getTime())
          ? lastPaymentDate
          : undefined,
      };
    } catch (err: any) {
      const status = err?.status;
      if (status === 404) return 'not_found';
      if (status === 429) {
        counters.rateLimitHits++;
        if (attempt <= cfg.rateLimitMaxRetries) {
          await sleep(cfg.rateLimitBackoffBaseMs * 2 ** (attempt - 1));
          continue;
        }
      }
      log.warn('reconciler.fetchRemoteSubscription error', {
        asaasSubscriptionId: id,
        status,
        message: err?.message,
        attempt,
      });
      return 'error';
    }
  }
  return 'error';
}

/**
 * Roda uma iteração completa do reconciliador.
 *
 *   - Cria ReconciliationRun (startedAt=now).
 *   - Varre até `batchSize` subscriptions locais.
 *   - Persiste findings conforme modo:
 *       shadow → só grava `IN_SYNC` amostrado; demais kinds apenas logam.
 *       dryrun → grava TODOS os kinds; `IN_SYNC` é amostrado.
 *       autofix → idem dryrun (autofix real é stub — exige flag separada).
 *   - Finaliza run com status=success/partial/failed.
 */
export async function runReconcilerOnce(
  deps: ReconcilerDeps,
): Promise<ReconcilerRunResult> {
  const { db, asaas, config } = deps;
  const now = deps.now ?? (() => new Date());
  const random = deps.random ?? Math.random;

  const startedAt = now();
  const run = await db.reconciliationRun.create({
    data: {
      mode: config.mode,
      status: 'partial', // será atualizado no finally
      startedAt,
    },
    select: { id: true, startedAt: true },
  });

  const counters = { apiCalls: 0, rateLimitHits: 0 };
  let subscriptionsScanned = 0;
  let runStatus: 'success' | 'partial' | 'failed' = 'success';
  let errorMsg: string | null = null;
  const drafts: FindingDraft[] = [];

  try {
    // Estágio 1: snapshot local.
    const whereTenant = deps.testBypassBillingSourceFilter
      ? {}
      : { tenant: { billingSource: 'asaas' as const } };
    const allowlist = config.tenantAllowlist;
    const whereAllow = allowlist.length > 0 ? { tenantId: { in: [...allowlist] } } : {};

    const locals = (await db.subscription.findMany({
      where: {
        provider: 'asaas',
        status: { in: ['active', 'past_due', 'suspended', 'cancelled'] },
        ...whereTenant,
        ...whereAllow,
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        asaasSubscriptionId: true,
        lastAsaasEventAt: true,
        currentPeriodEnd: true,
      },
      take: config.batchSize,
      orderBy: { updatedAt: 'asc' }, // prioriza o que não é tocado há mais tempo
    })) as unknown as LocalSubscriptionSnapshot[];

    subscriptionsScanned = locals.length;

    // Estágio 2 + 3: fetch + classify. Concorrência controlada por janela.
    let cursor = 0;
    const workers = Array.from({ length: config.concurrency }, async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= locals.length) return;
        const local = locals[idx];
        if (!local.asaasSubscriptionId) {
          drafts.push(mkDraft(local, 'LOCAL_NOT_FOUND', null, { reason: 'missing_asaasSubscriptionId' }));
          continue;
        }
        const remote = await fetchRemoteSubscription(
          asaas,
          local.asaasSubscriptionId,
          config,
          counters,
        );
        if (remote === 'error') {
          runStatus = 'partial';
          drafts.push(
            mkDraft(local, 'UNKNOWN_REMOTE_STATUS', null, { reason: 'remote_fetch_error' }),
          );
          continue;
        }
        const kind = classifyFinding({
          localStatus: local.status,
          remote,
          now: now(),
          lastAsaasEventAt: local.lastAsaasEventAt,
        });
        drafts.push(
          mkDraft(
            local,
            kind,
            remote === 'not_found' ? null : remote,
            null,
          ),
        );
        if (config.minIntervalMs > 0) await sleep(config.minIntervalMs);
      }
    });
    await Promise.all(workers);

    // Estágio 3: persiste de acordo com modo + amostragem.
    const toPersist = filterForPersistence(drafts, config, random);

    if (toPersist.length > 0) {
      await db.reconciliationFinding.createMany({
        data: toPersist.map((d) => ({
          runId: run.id,
          tenantId: d.tenantId,
          subscriptionId: d.subscriptionId,
          asaasSubscriptionId: d.asaasSubscriptionId,
          kind: d.kind,
          localStatus: d.localStatus,
          remoteStatus: d.remoteStatus,
          remoteLastPaymentStatus: d.remoteLastPaymentStatus,
          remoteLastPaymentDate: d.remoteLastPaymentDate,
          detail: d.detail as any,
        })),
      });
    }

    // Log estruturado consumível por scraper.
    const byKind: Record<string, number> = {};
    for (const d of drafts) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1;
    log.info('metric:reconciler.run', {
      runId: run.id,
      mode: config.mode,
      status: runStatus,
      subscriptionsScanned,
      findingsTotal: drafts.length,
      findingsPersisted: toPersist.length,
      findingsByKind: byKind,
      asaasApiCalls: counters.apiCalls,
      asaasRateLimitHits: counters.rateLimitHits,
    });
  } catch (err: any) {
    runStatus = 'failed';
    errorMsg = String(err?.message ?? err).slice(0, 500);
    log.error('reconciler.run failed', { runId: run.id, error: errorMsg });
  }

  const finishedAt = now();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  await db.reconciliationRun.update({
    where: { id: run.id },
    data: {
      status: runStatus,
      finishedAt,
      durationMs,
      subscriptionsScanned,
      findingsCount: drafts.length,
      asaasApiCalls: counters.apiCalls,
      asaasRateLimitHits: counters.rateLimitHits,
      error: errorMsg,
    },
  });

  return {
    runId: run.id,
    mode: config.mode,
    status: runStatus,
    subscriptionsScanned,
    findingsCount: drafts.length,
    asaasApiCalls: counters.apiCalls,
    asaasRateLimitHits: counters.rateLimitHits,
    durationMs,
  };
}

function mkDraft(
  local: LocalSubscriptionSnapshot,
  kind: ReconciliationFindingKind,
  remote: RemoteSubscriptionSnapshot | null,
  detail: Record<string, unknown> | null,
): FindingDraft {
  return {
    tenantId: local.tenantId,
    subscriptionId: local.id,
    asaasSubscriptionId: local.asaasSubscriptionId,
    kind,
    localStatus: local.status,
    remoteStatus: remote ? String(remote.status ?? '') || null : null,
    remoteLastPaymentStatus: remote?.lastPaymentStatus ?? null,
    remoteLastPaymentDate: remote?.lastPaymentDate ?? null,
    detail,
  };
}

/**
 * Aplica regras de persistência por modo + amostragem IN_SYNC.
 *
 * shadow → só IN_SYNC amostrado entra no banco (resto só loga).
 * dryrun/autofix → tudo entra, IN_SYNC amostrado.
 *
 * Exportado para testes.
 */
export function filterForPersistence(
  drafts: readonly FindingDraft[],
  cfg: ReconcilerConfig,
  random: () => number,
): FindingDraft[] {
  return drafts.filter((d) => {
    const isInSync = d.kind === 'IN_SYNC';
    if (cfg.mode === 'shadow') {
      // Em shadow só IN_SYNC amostrado — valida o fetch sem poluir com falsos.
      return isInSync && random() < cfg.inSyncSampling;
    }
    // dryrun / autofix
    if (isInSync) return random() < cfg.inSyncSampling;
    return true;
  });
}

/**
 * Consumido pelo gate da C5.3. Retorna o `finishedAt` do último run
 * `success` em modo não-shadow, ou `null` se não existir.
 */
export async function getLastSuccessfulRunAt(
  db: PrismaClient,
): Promise<Date | null> {
  const row = await db.reconciliationRun.findFirst({
    where: {
      status: 'success',
      mode: { in: ['dryrun', 'autofix'] },
      finishedAt: { not: null },
    },
    orderBy: { finishedAt: 'desc' },
    select: { finishedAt: true },
  });
  return row?.finishedAt ?? null;
}
