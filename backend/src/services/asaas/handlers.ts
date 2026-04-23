/**
 * Asaas webhook handlers — Fase A2A (C4)
 *
 * Cada handler:
 *   - recebe um TransactionClient (rule #2: tudo na mesma transação)
 *   - é idempotente por `asaasPaymentId` (upsert)
 *   - não faz logging de domínio fora da transação
 *
 * MAPEAMENTO Subscription.status → Tenant.subscriptionStatus (cache legado):
 *   - active     → 'active'
 *   - past_due   → 'active'   ← política C4 (não bloquear ainda)
 *   - suspended  → 'suspended'
 *   - cancelled  → 'cancelled'
 *   - pending    → não toca no Tenant (mantém estado anterior)
 */

import type { Prisma } from '@prisma/client';
import { log } from '../../utils/logger';
import type { AsaasWebhookPayload, AsaasPaymentObject } from './asaas-types';

export interface WebhookHandlerContext {
  tx: Prisma.TransactionClient;
  payload: AsaasWebhookPayload;
  /** id do AsaasWebhookEvent que originou esta chamada (rastreabilidade). */
  eventId: string;
}

export type WebhookHandler = (ctx: WebhookHandlerContext) => Promise<void>;

/**
 * Tabela de mapeamento. Exportada para teste.
 *
 * Política C4: `past_due` mapeia para `active` no cache legado
 * (`Tenant.subscriptionStatus`) até definirmos a política de bloqueio
 * em fase posterior. Não bloquear acesso por past_due AINDA.
 */
export const SUBSCRIPTION_STATUS_TO_TENANT_CACHE: Record<
  string,
  string | null
> = {
  active: 'active',
  past_due: 'active', // ← decisão explícita da fase
  suspended: 'suspended',
  cancelled: 'cancelled',
  pending: null, // null = não tocar no Tenant
};

/** Localiza Subscription local pelo payment do Asaas:
 *  1. via payment.subscription (asaasSubscriptionId)
 *  2. via payment.externalReference (Subscription.id local — fallback de C3)
 */
async function findLocalSubscription(
  tx: Prisma.TransactionClient,
  payment: AsaasPaymentObject,
): Promise<{ id: string; tenantId: string } | null> {
  if (payment.subscription) {
    const bySubId = await tx.subscription.findFirst({
      where: { provider: 'asaas', asaasSubscriptionId: payment.subscription },
      select: { id: true, tenantId: true },
    });
    if (bySubId) return bySubId;
  }
  if (payment.externalReference) {
    const byExtRef = await tx.subscription.findUnique({
      where: { id: payment.externalReference },
      select: { id: true, tenantId: true },
    });
    if (byExtRef) return byExtRef;
  }
  return null;
}

function asaasDateToDate(s: string | undefined | null): Date | undefined {
  if (!s) return undefined;
  // Asaas usa "YYYY-MM-DD" para dueDate/paymentDate.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00.000Z`);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

function asaasValueToCents(value: number | undefined): number {
  if (typeof value !== 'number' || !isFinite(value)) return 0;
  return Math.round(value * 100);
}

/**
 * PAYMENT_CREATED — apenas projeta o PaymentRecord como pending.
 * NÃO mexe em Subscription.status nem em Tenant.subscriptionStatus.
 */
export const PAYMENT_CREATED: WebhookHandler = async (ctx) => {
  const payment = ctx.payload.payment!;
  const sub = await findLocalSubscription(ctx.tx, payment);

  await ctx.tx.paymentRecord.upsert({
    where: { asaasPaymentId: payment.id },
    create: {
      provider: 'asaas',
      asaasPaymentId: payment.id,
      subscriptionId: sub?.id ?? null,
      ownerType: 'tenant',
      ownerTenantId: sub?.tenantId ?? null,
      amountCents: asaasValueToCents(payment.value),
      currency: 'BRL',
      status: 'pending',
      paymentMethod: payment.billingType,
      dueDate: asaasDateToDate(payment.dueDate),
      rawPayload: ctx.payload as any,
    },
    update: {
      // Só atualiza campos descritivos. NÃO regride status (idempotência).
      subscriptionId: sub?.id ?? undefined,
      ownerTenantId: sub?.tenantId ?? undefined,
      paymentMethod: payment.billingType,
      dueDate: asaasDateToDate(payment.dueDate),
      rawPayload: ctx.payload as any,
    },
  });

  log.info('handler PAYMENT_CREATED ok', {
    eventId: ctx.eventId,
    asaasPaymentId: payment.id,
    subscriptionId: sub?.id,
  });
};

/**
 * PAYMENT_CONFIRMED — pagamento confirmado (PIX/CC) ou recebido (boleto baixado).
 *   1. upsert PaymentRecord → status='paid', paidAt
 *   2. se há Subscription associada: status='active', mexe em currentPeriodStart/End
 *   3. atualiza Tenant.subscriptionStatus via mapping (cache legado)
 *
 * Idempotente: chamadas repetidas mantêm o mesmo estado final.
 */
export const PAYMENT_CONFIRMED: WebhookHandler = async (ctx) => {
  const payment = ctx.payload.payment!;
  const sub = await findLocalSubscription(ctx.tx, payment);
  const paidAt = asaasDateToDate(payment.paymentDate) ?? new Date();

  await ctx.tx.paymentRecord.upsert({
    where: { asaasPaymentId: payment.id },
    create: {
      provider: 'asaas',
      asaasPaymentId: payment.id,
      subscriptionId: sub?.id ?? null,
      ownerType: 'tenant',
      ownerTenantId: sub?.tenantId ?? null,
      amountCents: asaasValueToCents(payment.value),
      currency: 'BRL',
      status: 'paid',
      paymentMethod: payment.billingType,
      dueDate: asaasDateToDate(payment.dueDate),
      paidAt,
      rawPayload: ctx.payload as any,
    },
    update: {
      subscriptionId: sub?.id ?? undefined,
      ownerTenantId: sub?.tenantId ?? undefined,
      paymentMethod: payment.billingType,
      dueDate: asaasDateToDate(payment.dueDate),
      status: 'paid',
      paidAt,
      rawPayload: ctx.payload as any,
    },
  });

  if (!sub) {
    // Pagamento sem Subscription local (avulso ou ainda não conhecido).
    // Não é erro: apenas registramos o PaymentRecord.
    log.info('handler PAYMENT_CONFIRMED: payment sem subscription local', {
      eventId: ctx.eventId,
      asaasPaymentId: payment.id,
    });
    return;
  }

  // Atualiza Subscription → active, calcula próximo período (mensal +30d).
  const now = new Date();
  const nextPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const updatedSub = await ctx.tx.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: nextPeriodEnd,
    },
    select: { id: true, status: true, tenantId: true },
  });

  // Sincroniza cache legado em Tenant.
  const cacheValue = SUBSCRIPTION_STATUS_TO_TENANT_CACHE[updatedSub.status];
  if (cacheValue) {
    await ctx.tx.tenant.update({
      where: { id: updatedSub.tenantId },
      data: { subscriptionStatus: cacheValue },
    });
  }

  log.info('handler PAYMENT_CONFIRMED ok', {
    eventId: ctx.eventId,
    asaasPaymentId: payment.id,
    subscriptionId: updatedSub.id,
    tenantCache: cacheValue,
  });
};
