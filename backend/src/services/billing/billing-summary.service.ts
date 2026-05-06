/**
 * Billing Summary Service (Sprint B)
 *
 * Lê Tenant + Subscription + último PaymentRecord para consolidar a visão
 * de cobrança de um tenant em um único objeto consumível pelo frontend
 * (`/dashboard/settings/billing`).
 *
 * Substitui o `paymentService.getSubscription` para a tela de billing —
 * sem dependência de `@ts-nocheck` e usando os models reais do schema.
 *
 * Gateway único: **Asaas**. Stripe não é considerado nesta sprint.
 */

import type { PrismaClient } from '@prisma/client';

export type BillingProvider = 'asaas' | 'stripe' | 'manual' | 'trial' | null;

export interface BillingSummary {
  tenantId: string;
  plan: string;
  status: string; // active | suspended | cancelled | past_due | trialing
  isTrial: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  billingSource: BillingProvider;
  subscription: {
    id: string;
    provider: string;
    status: string;
    cycle: string;
    amountCents: number;
    currency: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelledAt: string | null;
  } | null;
  lastPayment: {
    id: string;
    status: string;
    amountCents: number;
    currency: string;
    paymentMethod: string | null;
    dueDate: string | null;
    paidAt: string | null;
    failedAt: string | null;
  } | null;
  /** UI helpers */
  ui: {
    /** verde | amber | laranja | vermelho */
    severity: 'green' | 'amber' | 'orange' | 'red';
    /** mensagem curta para badge */
    headline: string;
    /** CTA recomendado: 'upgrade' | 'manage' | 'retry' | null */
    cta: 'upgrade' | 'manage' | 'retry' | null;
  };
}

interface BuildDeps {
  db: PrismaClient;
}

function diffDays(target: Date, now = new Date()): number {
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function deriveUi(args: {
  isTrial: boolean;
  trialDaysRemaining: number | null;
  status: string;
  paymentStatus: string | null;
}): BillingSummary['ui'] {
  const { isTrial, trialDaysRemaining, status, paymentStatus } = args;

  if (status === 'cancelled' || status === 'canceled') {
    return {
      severity: 'red',
      headline: 'Assinatura cancelada',
      cta: 'upgrade',
    };
  }
  if (status === 'suspended' || status === 'past_due' || paymentStatus === 'failed') {
    return {
      severity: 'red',
      headline: 'Pagamento pendente — acesso suspenso',
      cta: 'retry',
    };
  }
  if (isTrial) {
    if (trialDaysRemaining == null) {
      return { severity: 'amber', headline: 'Período de teste', cta: 'upgrade' };
    }
    if (trialDaysRemaining <= 0) {
      return {
        severity: 'red',
        headline: 'Período de teste encerrado',
        cta: 'upgrade',
      };
    }
    if (trialDaysRemaining <= 3) {
      return {
        severity: 'red',
        headline: `Trial termina em ${trialDaysRemaining} dia(s)`,
        cta: 'upgrade',
      };
    }
    if (trialDaysRemaining <= 7) {
      return {
        severity: 'orange',
        headline: `Trial termina em ${trialDaysRemaining} dias`,
        cta: 'upgrade',
      };
    }
    return {
      severity: 'amber',
      headline: `${trialDaysRemaining} dias de teste restantes`,
      cta: 'upgrade',
    };
  }
  if (status === 'active') {
    return { severity: 'green', headline: 'Assinatura ativa', cta: 'manage' };
  }
  return { severity: 'amber', headline: 'Status desconhecido', cta: null };
}

export interface BillingSummaryService {
  getSummary(tenantId: string): Promise<BillingSummary>;
}

export function buildBillingSummaryService(deps: BuildDeps): BillingSummaryService {
  const { db } = deps;

  return {
    async getSummary(tenantId: string): Promise<BillingSummary> {
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          billingSource: true,
          trialEndsAt: true,
        },
      });

      if (!tenant) {
        throw new Error(`Tenant ${tenantId} não encontrado`);
      }

      const isTrial = (tenant.subscriptionPlan ?? 'trial') === 'trial';
      const trialEndsAt = tenant.trialEndsAt ?? null;
      const trialDaysRemaining =
        isTrial && trialEndsAt ? Math.max(0, diffDays(trialEndsAt)) : null;

      // Última subscription (qualquer provider) para consultar período/valor
      const subscription = await db.subscription.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });

      // Último pagamento do tenant (cobre owner=tenant)
      const lastPayment = await db.paymentRecord.findFirst({
        where: { ownerType: 'tenant', ownerTenantId: tenantId },
        orderBy: { createdAt: 'desc' },
      });

      const ui = deriveUi({
        isTrial,
        trialDaysRemaining,
        status: tenant.subscriptionStatus ?? 'active',
        paymentStatus: lastPayment?.status ?? null,
      });

      return {
        tenantId: tenant.id,
        plan: tenant.subscriptionPlan ?? 'trial',
        status: tenant.subscriptionStatus ?? 'active',
        isTrial,
        trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
        trialDaysRemaining,
        billingSource: (tenant.billingSource ?? null) as BillingProvider,
        subscription: subscription
          ? {
              id: subscription.id,
              provider: subscription.provider,
              status: subscription.status,
              cycle: subscription.cycle,
              amountCents: subscription.amountCents,
              currency: subscription.currency,
              currentPeriodStart: subscription.currentPeriodStart
                ? subscription.currentPeriodStart.toISOString()
                : null,
              currentPeriodEnd: subscription.currentPeriodEnd
                ? subscription.currentPeriodEnd.toISOString()
                : null,
              cancelledAt: subscription.cancelledAt
                ? subscription.cancelledAt.toISOString()
                : null,
            }
          : null,
        lastPayment: lastPayment
          ? {
              id: lastPayment.id,
              status: lastPayment.status,
              amountCents: lastPayment.amountCents,
              currency: lastPayment.currency,
              paymentMethod: lastPayment.paymentMethod,
              dueDate: lastPayment.dueDate ? lastPayment.dueDate.toISOString() : null,
              paidAt: lastPayment.paidAt ? lastPayment.paidAt.toISOString() : null,
              failedAt: lastPayment.failedAt ? lastPayment.failedAt.toISOString() : null,
            }
          : null,
        ui,
      };
    },
  };
}
