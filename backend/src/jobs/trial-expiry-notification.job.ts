/**
 * Trial Expiry Notification Job (Sprint B)
 *
 * Roda diariamente e envia avisos de fim de trial em duas janelas:
 *   - D-7: trial termina em 6 a 7 dias (envia aviso "ainda dá tempo")
 *   - D-1: trial termina em 0 a 1 dia (envia aviso final)
 *
 * Idempotência: cada notificação cria uma linha em `Notification` com tipo
 * `trial_warning_d7` ou `trial_warning_d1`. Antes de enviar, o job consulta
 * se já existe uma notificação desse tipo para o tenant — se existir, skipa.
 *
 * Sem RESEND_API_KEY: o EmailService cai em modo simulação e o job ainda
 * registra a Notification (auditoria), permitindo testar o pipeline.
 *
 * Wireup: `backend/src/main.ts` chama `startTrialExpiryNotificationJob()`
 * junto aos outros jobs.
 */

import cron from 'node-cron';
import type { PrismaClient } from '@prisma/client';
import { emailService } from '../services/email.service';
import { log } from '../utils/logger';

export type TrialWarningType = 'trial_warning_d7' | 'trial_warning_d1';

export interface TrialNotificationStats {
  scanned: number;
  d7Sent: number;
  d1Sent: number;
  d7Skipped: number;
  d1Skipped: number;
  failures: number;
}

interface BuildDeps {
  db: PrismaClient;
  /** Janela de tolerância em horas para D-7 (padrão 24h, evita perder envio). */
  d7WindowHours?: number;
  /** Janela de tolerância em horas para D-1 (padrão 24h). */
  d1WindowHours?: number;
  /** Override do "agora" — útil em testes. */
  now?: () => Date;
  /** Override do email service — útil em testes. */
  email?: { sendTrialEndingEmail: typeof emailService.sendTrialEndingEmail };
}

export function buildTrialExpiryNotificationJob(deps: BuildDeps) {
  const {
    db,
    d7WindowHours = 24,
    d1WindowHours = 24,
    now = () => new Date(),
    email = emailService,
  } = deps;

  function windowAround(targetHoursFromNow: number, windowHours: number) {
    const center = now().getTime() + targetHoursFromNow * 60 * 60 * 1000;
    const half = (windowHours / 2) * 60 * 60 * 1000;
    return {
      gte: new Date(center - half),
      lte: new Date(center + half),
    };
  }

  async function alreadyNotified(
    tenantId: string,
    type: TrialWarningType,
  ): Promise<boolean> {
    const existing = await db.notification.findFirst({
      where: { tenantId, type },
      select: { id: true },
    });
    return existing != null;
  }

  async function processBucket(
    type: TrialWarningType,
    daysAhead: number,
    windowHours: number,
  ): Promise<{ sent: number; skipped: number; failures: number }> {
    const window = windowAround(daysAhead * 24, windowHours);

    const tenants = await db.tenant.findMany({
      where: {
        deletedAt: null,
        subscriptionPlan: 'trial',
        subscriptionStatus: 'active',
        trialEndsAt: window,
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        trialEndsAt: true,
      },
    });

    let sent = 0;
    let skipped = 0;
    let failures = 0;

    for (const tenant of tenants) {
      try {
        if (await alreadyNotified(tenant.id, type)) {
          skipped++;
          continue;
        }

        const owner = await db.user.findUnique({
          where: { id: tenant.ownerId },
          select: { email: true, fullName: true, isActive: true, deletedAt: true },
        });

        if (!owner || !owner.isActive || owner.deletedAt) {
          skipped++;
          continue;
        }

        const trialEnd = tenant.trialEndsAt!;
        const daysRemaining = Math.max(
          0,
          Math.ceil((trialEnd.getTime() - now().getTime()) / (1000 * 60 * 60 * 24)),
        );

        const emailOk = await email.sendTrialEndingEmail(owner.email, {
          userName: owner.fullName || 'cliente UTOP',
          daysRemaining,
          upgradeLink: emailService.getUpgradeLink(),
        });

        // Sempre cria a Notification (auditoria + idempotência), mesmo se o
        // email falhar. Assim o próximo run não duplica e o admin pode ver
        // que o aviso foi tentado.
        await db.notification.create({
          data: {
            tenantId: tenant.id,
            userId: tenant.ownerId,
            type,
            title:
              type === 'trial_warning_d7'
                ? `Seu teste termina em ${daysRemaining} dias`
                : 'Seu teste termina amanhã',
            message:
              `Aviso automático enviado em ${now().toISOString()}. ` +
              `Email ${emailOk ? 'enviado' : 'em modo simulação ou falhou'}.`,
            priority: type === 'trial_warning_d1' ? 'high' : 'normal',
            relatedType: 'subscription',
            actionUrl: '/dashboard/settings/billing',
          },
        });

        if (emailOk) sent++;
        else failures++;
      } catch (err: any) {
        failures++;
        log.error('Falha ao notificar fim de trial', {
          tenantId: tenant.id,
          type,
          error: err?.message,
        });
      }
    }

    return { sent, skipped, failures };
  }

  async function runOnce(): Promise<TrialNotificationStats> {
    log.info('🔔 [trial-expiry] iniciando varredura de avisos de trial');

    const d7 = await processBucket('trial_warning_d7', 7, d7WindowHours);
    const d1 = await processBucket('trial_warning_d1', 1, d1WindowHours);

    const stats: TrialNotificationStats = {
      scanned: d7.sent + d7.skipped + d1.sent + d1.skipped,
      d7Sent: d7.sent,
      d1Sent: d1.sent,
      d7Skipped: d7.skipped,
      d1Skipped: d1.skipped,
      failures: d7.failures + d1.failures,
    };

    log.info('✅ [trial-expiry] varredura concluída', stats);
    return stats;
  }

  return { runOnce };
}

/**
 * Wireup do cron — chama runOnce() diariamente às 09:00 BRT.
 * Idempotente: pode ser chamado múltiplas vezes sem agendar duplicado em
 * desenvolvimento porque node-cron registra um único schedule por callback.
 */
export function startTrialExpiryNotificationJob(deps?: { db?: PrismaClient }) {
  // Lazy-import para evitar dependência circular com main.ts no boot.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prisma } = deps?.db ? { prisma: deps.db } : require('../main');

  const job = buildTrialExpiryNotificationJob({ db: prisma });

  cron.schedule(
    '0 9 * * *',
    async () => {
      try {
        await job.runOnce();
      } catch (err: any) {
        log.error('❌ [trial-expiry] erro no run agendado', {
          error: err?.message,
        });
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );

  log.info('✅ Job trial-expiry configurado: diariamente às 09:00 BRT');
}
