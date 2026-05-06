/**
 * UTOP Reliability Sprint 3 — Subscription Lifecycle Job.
 *
 * Job HORÁRIO que executa, de forma atômica e idempotente, três transições
 * que ANTES estavam espalhadas por middleware (escrita reativa em request
 * cycle) ou simplesmente não aconteciam:
 *
 * 1. EXPIRAR TRIAL
 *    `Tenant.subscriptionPlan = 'trial'`
 *    AND `Tenant.subscriptionStatus = 'active'`
 *    AND `Tenant.trialEndsAt < now`
 *    → flipa Tenant.subscriptionStatus para 'suspended'.
 *
 *    Antes: middleware escrevia 'suspended' em DURANTE um request do user,
 *    causando race (request começou em trial, terminou em suspended).
 *
 * 2. PAST_DUE → SUSPENDED após período de graça
 *    `Subscription.status = 'past_due'`
 *    AND `Subscription.lastAsaasEventAt + PAST_DUE_GRACE_DAYS < now`
 *    AND `Tenant.subscriptionStatus != 'suspended'`
 *    → flipa subscription.status='suspended' E tenant.subscriptionStatus='suspended'.
 *
 *    Antes: past_due era mapeado para 'active' indefinidamente — usuário
 *    inadimplente nunca era bloqueado.
 *
 * 3. CANCELAMENTO AGENDADO efetivado
 *    `Subscription.cancelledAt IS NOT NULL`
 *    AND `Subscription.status = 'active'`  -- cancelamento "no fim do período"
 *    AND `Subscription.currentPeriodEnd < now`
 *    → flipa subscription.status='cancelled' E tenant.subscriptionStatus='cancelled'.
 *
 *    Antes: cancelamento era imediato → bloqueava acesso no mesmo segundo
 *    em que o user clicava "cancelar", mesmo que ainda houvesse 25 dias pagos.
 *
 * Idempotência: filtros são auto-suficientes. Re-rodar 2× no mesmo minuto
 * produz o mesmo estado (a 2ª varredura encontra zero linhas elegíveis).
 *
 * Atomicidade: cada flip roda em `prisma.$transaction` curto envolvendo a
 * mutação + cache invalidation. Se a tx falhar, nada é gravado.
 */

import cron from 'node-cron';
import type { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';
import { invalidateTenantBillingCache } from '../services/billing/tenant-billing-cache';

/** Dias de tolerância após past_due antes de virar suspended. */
export const PAST_DUE_GRACE_DAYS = 3;

export interface LifecycleStats {
  trialsExpired: number;
  pastDueSuspended: number;
  cancellationsClosed: number;
  failures: number;
}

interface BuildDeps {
  db: PrismaClient;
  now?: () => Date;
  graceDays?: number;
  /** Override do invalidador de cache (testes). */
  invalidateCache?: (tenantId: string) => void;
}

export function buildSubscriptionLifecycleJob(deps: BuildDeps) {
  const {
    db,
    now = () => new Date(),
    graceDays = PAST_DUE_GRACE_DAYS,
    invalidateCache = invalidateTenantBillingCache,
  } = deps;

  async function expireTrials(): Promise<{ expired: number; failures: number }> {
    let expired = 0;
    let failures = 0;
    const t = now();
    const tenants = await db.tenant.findMany({
      where: {
        deletedAt: null,
        subscriptionPlan: 'trial',
        subscriptionStatus: 'active',
        trialEndsAt: { lt: t },
      },
      select: { id: true },
    });
    for (const tenant of tenants) {
      try {
        await db.$transaction(async (tx) => {
          // Re-checa dentro da tx (defesa contra race com webhook que
          // acabou de promover o tenant a 'active' por pagamento).
          const fresh = await tx.tenant.findUnique({
            where: { id: tenant.id },
            select: {
              subscriptionPlan: true,
              subscriptionStatus: true,
              trialEndsAt: true,
              deletedAt: true,
            },
          });
          if (!fresh) return;
          if (fresh.deletedAt) return;
          if (fresh.subscriptionPlan !== 'trial') return;
          if (fresh.subscriptionStatus !== 'active') return;
          if (!fresh.trialEndsAt || fresh.trialEndsAt >= t) return;
          await tx.tenant.update({
            where: { id: tenant.id },
            data: { subscriptionStatus: 'suspended' },
          });
        });
        invalidateCache(tenant.id);
        expired++;
        log.info('[lifecycle] trial expirado pelo job', { tenantId: tenant.id });
      } catch (err: any) {
        failures++;
        log.error('[lifecycle] falha ao expirar trial', {
          tenantId: tenant.id,
          error: err?.message,
        });
      }
    }
    return { expired, failures };
  }

  async function suspendPastDue(): Promise<{ suspended: number; failures: number }> {
    let suspended = 0;
    let failures = 0;
    const t = now();
    const cutoff = new Date(t.getTime() - graceDays * 24 * 60 * 60 * 1000);

    const subs = await db.subscription.findMany({
      where: {
        status: 'past_due',
        OR: [
          { lastAsaasEventAt: { lt: cutoff } },
          // Sem evento recente registrado: usa updatedAt como proxy.
          { lastAsaasEventAt: null, updatedAt: { lt: cutoff } },
        ],
      },
      select: { id: true, tenantId: true },
    });
    for (const sub of subs) {
      try {
        await db.$transaction(async (tx) => {
          const fresh = await tx.subscription.findUnique({
            where: { id: sub.id },
            select: { status: true, lastAsaasEventAt: true, updatedAt: true },
          });
          if (!fresh || fresh.status !== 'past_due') return;
          const ref = fresh.lastAsaasEventAt ?? fresh.updatedAt;
          if (ref && ref >= cutoff) return;
          await tx.subscription.update({
            where: { id: sub.id },
            data: { status: 'suspended' },
          });
          await tx.tenant.update({
            where: { id: sub.tenantId },
            data: { subscriptionStatus: 'suspended' },
          });
        });
        invalidateCache(sub.tenantId);
        suspended++;
        log.info('[lifecycle] past_due → suspended (grace expirou)', {
          subscriptionId: sub.id,
          tenantId: sub.tenantId,
        });
      } catch (err: any) {
        failures++;
        log.error('[lifecycle] falha ao suspender past_due', {
          subscriptionId: sub.id,
          error: err?.message,
        });
      }
    }
    return { suspended, failures };
  }

  async function closeScheduledCancellations(): Promise<{
    closed: number;
    failures: number;
  }> {
    let closed = 0;
    let failures = 0;
    const t = now();
    // Subscription com cancelledAt setado mas ainda com status='active'
    // significa "cancelado para fim de período". Quando currentPeriodEnd
    // passa, vira terminal.
    const subs = await db.subscription.findMany({
      where: {
        cancelledAt: { not: null },
        status: 'active',
        currentPeriodEnd: { lt: t },
      },
      select: { id: true, tenantId: true },
    });
    for (const sub of subs) {
      try {
        await db.$transaction(async (tx) => {
          const fresh = await tx.subscription.findUnique({
            where: { id: sub.id },
            select: {
              status: true,
              cancelledAt: true,
              currentPeriodEnd: true,
            },
          });
          if (!fresh) return;
          if (fresh.status !== 'active') return;
          if (!fresh.cancelledAt) return;
          if (!fresh.currentPeriodEnd || fresh.currentPeriodEnd >= t) return;
          await tx.subscription.update({
            where: { id: sub.id },
            data: { status: 'cancelled' },
          });
          await tx.tenant.update({
            where: { id: sub.tenantId },
            data: { subscriptionStatus: 'cancelled' },
          });
        });
        invalidateCache(sub.tenantId);
        closed++;
        log.info('[lifecycle] cancelamento agendado efetivado', {
          subscriptionId: sub.id,
          tenantId: sub.tenantId,
        });
      } catch (err: any) {
        failures++;
        log.error('[lifecycle] falha ao fechar cancelamento agendado', {
          subscriptionId: sub.id,
          error: err?.message,
        });
      }
    }
    return { closed, failures };
  }

  async function runOnce(): Promise<LifecycleStats> {
    log.info('[lifecycle] iniciando varredura horária');
    const trials = await expireTrials();
    const pastDue = await suspendPastDue();
    const cancellations = await closeScheduledCancellations();
    const stats: LifecycleStats = {
      trialsExpired: trials.expired,
      pastDueSuspended: pastDue.suspended,
      cancellationsClosed: cancellations.closed,
      failures: trials.failures + pastDue.failures + cancellations.failures,
    };
    log.info('[lifecycle] varredura concluída', stats);
    return stats;
  }

  return { runOnce, expireTrials, suspendPastDue, closeScheduledCancellations };
}

export function startSubscriptionLifecycleJob(deps?: { db?: PrismaClient }) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prisma } = deps?.db ? { prisma: deps.db } : require('../main');
  const job = buildSubscriptionLifecycleJob({ db: prisma });

  // Roda no minuto 7 de cada hora — fora dos horários de pico de webhooks
  // (que costumam disparar em :00).
  cron.schedule(
    '7 * * * *',
    async () => {
      try {
        await job.runOnce();
      } catch (err: any) {
        log.error('[lifecycle] erro no run agendado', { error: err?.message });
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );

  log.info('✅ Job subscription-lifecycle configurado: horário (minuto 7)');
}
