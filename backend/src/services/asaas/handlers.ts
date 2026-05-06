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
 *   - past_due   → 'past_due'  ← Sprint 3 (estado distinto, n/ bloqueia mas sinaliza)
 *   - suspended  → 'suspended'
 *   - cancelled  → 'cancelled'
 *   - pending    → não toca no Tenant (mantém estado anterior)
 */

import type { Prisma } from '@prisma/client';
import { log } from '../../utils/logger';
import type {
  AsaasWebhookPayload,
  AsaasPaymentObject,
  AsaasSubscriptionObject,
  AsaasSubscriptionStatus,
} from './asaas-types';
import {
  canProviderWriteTenant,
  shouldPromoteBillingSource,
  type BillingSource,
} from './billing-source.guard';
import { advancePeriod } from '../billing/billing-cycle';

export interface WebhookHandlerContext {
  tx: Prisma.TransactionClient;
  payload: AsaasWebhookPayload;
  /** id do AsaasWebhookEvent que originou esta chamada (rastreabilidade). */
  eventId: string;
  /**
   * C5.0 — handlers que alterarem `Tenant.subscriptionStatus` devem empurrar
   * o `tenantId` aqui. O processor invalida o cache PÓS-commit (não dentro
   * da tx), evitando race com falha/rollback da transação.
   *
   * Opcional para compat com chamadas diretas em testes; processor sempre
   * injeta um Set.
   */
  invalidateTenantIds?: Set<string>;
}

export type WebhookHandler = (ctx: WebhookHandlerContext) => Promise<void>;

/**
 * Tabela de mapeamento. Exportada para teste.
 *
 * Sprint Corretivo 3: `past_due` agora MAPEIA PARA 'past_due' (estado
 * próprio), não mais 'active'. O middleware permite passagem (não
 * bloqueia), mas o front recebe X-Subscription-State='past_due' para
 * exibir banner. O job `subscription-lifecycle` flipa para 'suspended'
 * após PAST_DUE_GRACE_DAYS (3 dias) sem retomada de pagamento.
 */
export const SUBSCRIPTION_STATUS_TO_TENANT_CACHE: Record<
  string,
  string | null
> = {
  active: 'active',
  past_due: 'past_due', // Sprint 3: estado distinto, não mais 'active'
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
 * C5.0/C5.1 — helper centralizado para aplicar o cache legado em
 * `Tenant.subscriptionStatus` respeitando `billingSource` guard.
 *
 * Retorna `true` se escreveu (handler deve sinalizar invalidação),
 * `false` se foi bloqueado pelo guard (apenas log WARN, SEM exceção).
 *
 * NUNCA lança: falha de guard é caminho esperado (tenant de outro provider
 * ou zona protegida trial/manual). Só lança se houver erro de DB real.
 */
async function writeTenantCacheWithGuard(
  ctx: WebhookHandlerContext,
  tenantId: string,
  cacheValue: string,
  handlerName: string,
): Promise<boolean> {
  const tenantRow = await ctx.tx.tenant.findUnique({
    where: { id: tenantId },
    select: { billingSource: true },
  });
  const source = (tenantRow?.billingSource ?? null) as BillingSource;
  if (!canProviderWriteTenant('asaas', source)) {
    log.warn(`handler ${handlerName}: skip Tenant write (billingSource guard)`, {
      eventId: ctx.eventId,
      tenantId,
      billingSource: source,
      reason: 'PROVIDER_MISMATCH',
    });
    return false;
  }
  await ctx.tx.tenant.update({
    where: { id: tenantId },
    data: {
      subscriptionStatus: cacheValue,
      ...(shouldPromoteBillingSource(source)
        ? { billingSource: 'asaas' }
        : {}),
    },
  });
  ctx.invalidateTenantIds?.add(tenantId);
  return true;
}

/**
 * Conjunto de status de PaymentRecord considerados TERMINAIS positivos
 * para PAYMENT_OVERDUE. Se o registro já estiver em um desses, o handler
 * de OVERDUE NÃO regride (log WARN out-of-order + só atualiza rawPayload).
 */
const PAYMENT_TERMINAL_STATUSES_FOR_OVERDUE = new Set<string>([
  'paid',
  'refunded',
  'chargeback',
]);

/**
 * Conjunto de status de Subscription considerados terminais.
 * Handlers de C5.1 não regridem para `past_due`/`suspended` se já cancelled.
 */
const SUBSCRIPTION_TERMINAL_STATUSES = new Set<string>(['cancelled']);

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
 * PAYMENT_CONFIRMED — pagamento confirmado pelo Asaas.
 *
 * Semântica Asaas (ver `PAYMENT_RECEIVED` abaixo — é o mesmo handler):
 *   - PAYMENT_CONFIRMED: pagamento confirmado mas ainda não liquidado
 *     (ex.: PIX/CC aprovado; boleto compensando). Em muitos cenários o
 *     Asaas pula direto para PAYMENT_RECEIVED e nunca emite CONFIRMED
 *     (sandbox + "Confirmar recebimento em dinheiro" em boleto).
 *   - PAYMENT_RECEIVED: valor efetivamente liquidado / recebido.
 *
 * Para o UTOP (C4.1), ambos significam "pagamento concluído" e devem
 * disparar o mesmo efeito: marcar `PaymentRecord=paid`, ativar Subscription
 * e atualizar o cache legado em Tenant. Por isso exportamos um alias
 * `PAYMENT_RECEIVED = PAYMENT_CONFIRMED` e registramos os dois no processor.
 *
 *   1. upsert PaymentRecord → status='paid', paidAt
 *   2. se há Subscription associada: status='active', mexe em currentPeriodStart/End
 *   3. atualiza Tenant.subscriptionStatus via mapping (cache legado)
 *
 * Idempotente: chamadas repetidas (inclusive CONFIRMED seguido de RECEIVED
 * para o mesmo `asaasPaymentId`) mantêm o mesmo estado final — o upsert é
 * chaveado por `asaasPaymentId` e todas as atualizações são convergentes.
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

  // Sprint Corretivo 3: avança `currentPeriodEnd` pelo CICLO real da
  // Subscription, não por hardcode de "+30d". Estratégia:
  //   1. Se subscription tem currentPeriodEnd no futuro → avança a partir
  //      dele (cobertura contínua, sem "sumir" dias do período anterior).
  //   2. Senão → avança a partir de agora.
  // O webhook SUBSCRIPTION_UPDATED do Asaas (sempre disparado em sequência)
  // re-sincroniza com o nextDueDate exato do provedor.
  const now = new Date();
  const currentSubData = await ctx.tx.subscription.findUnique({
    where: { id: sub.id },
    select: { cycle: true, currentPeriodEnd: true },
  });
  const baseForAdvance =
    currentSubData?.currentPeriodEnd && currentSubData.currentPeriodEnd > now
      ? currentSubData.currentPeriodEnd
      : now;
  const nextPeriodEnd = advancePeriod(baseForAdvance, currentSubData?.cycle);

  const updatedSub = await ctx.tx.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: nextPeriodEnd,
      lastAsaasEventAt: now,
    },
    select: { id: true, status: true, tenantId: true },
  });

  // Sincroniza cache legado em Tenant — respeitando billingSource guard (C5.0).
  const cacheValue = SUBSCRIPTION_STATUS_TO_TENANT_CACHE[updatedSub.status];
  if (cacheValue) {
    await writeTenantCacheWithGuard(
      ctx,
      updatedSub.tenantId,
      cacheValue,
      'PAYMENT_CONFIRMED',
    );
  }

  log.info('handler PAYMENT_CONFIRMED ok', {
    eventId: ctx.eventId,
    eventType: ctx.payload?.event,
    asaasPaymentId: payment.id,
    subscriptionId: updatedSub.id,
    tenantCache: cacheValue,
  });
};

/**
 * PAYMENT_RECEIVED — alias semântico de PAYMENT_CONFIRMED.
 *
 * O Asaas emite `PAYMENT_RECEIVED` quando o pagamento é liquidado (boleto
 * compensado, "recebimento em dinheiro" confirmado no painel sandbox, etc.).
 * Em muitos fluxos é o ÚNICO evento de conclusão que o Asaas envia — ele
 * pula `PAYMENT_CONFIRMED`. Por isso tratamos os dois com a mesma lógica
 * (ver docblock de `PAYMENT_CONFIRMED`).
 *
 * Idempotência: mesmo `asaasPaymentId` em eventos distintos (CONFIRMED +
 * RECEIVED, ou RECEIVED duplicado) produz o mesmo estado final graças ao
 * upsert por chave única.
 */
export const PAYMENT_RECEIVED: WebhookHandler = PAYMENT_CONFIRMED;

/**
 * PAYMENT_OVERDUE — pagamento vencido e ainda não pago.
 *
 * Política Sprint Corretivo 3:
 *   - Cache `Tenant.subscriptionStatus` agora mapeia `past_due` para
 *     `'past_due'` (não mais 'active'). Middleware permite passagem porém
 *     sinaliza o estado via header `X-Subscription-State` para o front.
 *   - Job `subscription-lifecycle` flipa para 'suspended' após
 *     PAST_DUE_GRACE_DAYS (3) sem retomada (ver lastAsaasEventAt).
 *
 * Transições:
 *   - PaymentRecord: NÃO regride se já terminal positivo (paid/refunded/chargeback);
 *     caso contrário marca `overdueAt = now()` (auditabilidade explícita — o
 *     enum PaymentStatus não tem valor `overdue`; o carimbo temporal é a
 *     evidência rastreável requisitada).
 *   - Subscription: → 'past_due' (exceto se já 'cancelled').
 *   - Tenant cache: aplica mapping ('past_due' → 'active') via guard.
 *
 * Idempotência: chamadas repetidas mantêm o `overdueAt` original
 * (o update NÃO sobrescreve se já preenchido), evitando reset espúrio
 * por webhook retry do Asaas.
 */
export const PAYMENT_OVERDUE: WebhookHandler = async (ctx) => {
  const payment = ctx.payload.payment!;
  const sub = await findLocalSubscription(ctx.tx, payment);
  const now = new Date();

  // Busca estado atual para decidir se regride ou não.
  const existing = await ctx.tx.paymentRecord.findUnique({
    where: { asaasPaymentId: payment.id },
    select: { status: true, overdueAt: true },
  });

  const outOfOrder =
    existing &&
    PAYMENT_TERMINAL_STATUSES_FOR_OVERDUE.has(existing.status as string);

  if (outOfOrder) {
    log.warn('handler PAYMENT_OVERDUE: out-of-order event, mantendo status atual', {
      eventId: ctx.eventId,
      asaasPaymentId: payment.id,
      existingStatus: existing!.status,
    });
    // Só atualiza rawPayload (auditoria) sem mexer em status nem em Subscription.
    await ctx.tx.paymentRecord.update({
      where: { asaasPaymentId: payment.id },
      data: { rawPayload: ctx.payload as any },
    });
    return;
  }

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
      status: 'pending', // não há enum overdue — atraso é evidenciado por overdueAt
      paymentMethod: payment.billingType,
      dueDate: asaasDateToDate(payment.dueDate),
      overdueAt: now,
      rawPayload: ctx.payload as any,
    },
    update: {
      subscriptionId: sub?.id ?? undefined,
      ownerTenantId: sub?.tenantId ?? undefined,
      paymentMethod: payment.billingType,
      dueDate: asaasDateToDate(payment.dueDate),
      // Preserva overdueAt original em re-entregas (idempotência):
      // só preenche se ainda estava null.
      ...(existing?.overdueAt ? {} : { overdueAt: now }),
      rawPayload: ctx.payload as any,
    },
  });

  if (!sub) {
    log.info('handler PAYMENT_OVERDUE: payment sem subscription local', {
      eventId: ctx.eventId,
      asaasPaymentId: payment.id,
    });
    return;
  }

  // Checa estado atual da Subscription antes de regredir.
  const currentSub = await ctx.tx.subscription.findUnique({
    where: { id: sub.id },
    select: { status: true },
  });
  if (currentSub && SUBSCRIPTION_TERMINAL_STATUSES.has(currentSub.status as string)) {
    log.warn('handler PAYMENT_OVERDUE: subscription em estado terminal, não regride', {
      eventId: ctx.eventId,
      subscriptionId: sub.id,
      currentStatus: currentSub.status,
    });
    return;
  }

  const updatedSub = await ctx.tx.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'past_due',
      lastAsaasEventAt: now,
    },
    select: { id: true, status: true, tenantId: true },
  });

  const cacheValue = SUBSCRIPTION_STATUS_TO_TENANT_CACHE[updatedSub.status];
  // Sprint 3: past_due mapeia para 'past_due' (cache distinto). Middleware
  // permite acesso mas sinaliza o estado.
  if (cacheValue) {
    await writeTenantCacheWithGuard(
      ctx,
      updatedSub.tenantId,
      cacheValue,
      'PAYMENT_OVERDUE',
    );
  }

  log.info('handler PAYMENT_OVERDUE ok', {
    eventId: ctx.eventId,
    asaasPaymentId: payment.id,
    subscriptionId: updatedSub.id,
    subscriptionStatus: updatedSub.status,
    tenantCache: cacheValue,
    overdueAt: now.toISOString(),
  });
};

/**
 * PAYMENT_REFUNDED — pagamento estornado pelo Asaas.
 *
 * Transições:
 *   - PaymentRecord: status='refunded', refundedAt=paymentDate || now.
 *     Idempotente: refundedAt NÃO é sobrescrito se já preenchido.
 *   - Subscription: status='suspended' (exceto se já 'cancelled').
 *   - Tenant cache: 'suspended'.
 */
export const PAYMENT_REFUNDED: WebhookHandler = async (ctx) => {
  const payment = ctx.payload.payment!;
  const sub = await findLocalSubscription(ctx.tx, payment);
  const refundedAt = asaasDateToDate(payment.paymentDate) ?? new Date();

  const existing = await ctx.tx.paymentRecord.findUnique({
    where: { asaasPaymentId: payment.id },
    select: { refundedAt: true },
  });

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
      status: 'refunded',
      paymentMethod: payment.billingType,
      dueDate: asaasDateToDate(payment.dueDate),
      refundedAt,
      rawPayload: ctx.payload as any,
    },
    update: {
      subscriptionId: sub?.id ?? undefined,
      ownerTenantId: sub?.tenantId ?? undefined,
      paymentMethod: payment.billingType,
      dueDate: asaasDateToDate(payment.dueDate),
      status: 'refunded',
      ...(existing?.refundedAt ? {} : { refundedAt }),
      rawPayload: ctx.payload as any,
    },
  });

  if (!sub) {
    log.info('handler PAYMENT_REFUNDED: payment sem subscription local', {
      eventId: ctx.eventId,
      asaasPaymentId: payment.id,
    });
    return;
  }

  const currentSub = await ctx.tx.subscription.findUnique({
    where: { id: sub.id },
    select: { status: true },
  });
  if (currentSub && SUBSCRIPTION_TERMINAL_STATUSES.has(currentSub.status as string)) {
    log.warn('handler PAYMENT_REFUNDED: subscription em estado terminal, não regride', {
      eventId: ctx.eventId,
      subscriptionId: sub.id,
      currentStatus: currentSub.status,
    });
    return;
  }

  const now = new Date();
  const updatedSub = await ctx.tx.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'suspended',
      lastAsaasEventAt: now,
    },
    select: { id: true, status: true, tenantId: true },
  });

  const cacheValue = SUBSCRIPTION_STATUS_TO_TENANT_CACHE[updatedSub.status];
  if (cacheValue) {
    await writeTenantCacheWithGuard(
      ctx,
      updatedSub.tenantId,
      cacheValue,
      'PAYMENT_REFUNDED',
    );
  }

  log.info('handler PAYMENT_REFUNDED ok', {
    eventId: ctx.eventId,
    asaasPaymentId: payment.id,
    subscriptionId: updatedSub.id,
    tenantCache: cacheValue,
  });
};

/**
 * PAYMENT_CHARGEBACK_REQUESTED — chargeback solicitado pela bandeira.
 *
 * Transições:
 *   - PaymentRecord: status='chargeback'. NÃO usamos refundedAt nem
 *     overdueAt; a evidência fica em rawPayload + status enum.
 *   - Subscription: status='suspended' (exceto se já 'cancelled').
 *   - Tenant cache: 'suspended'.
 */
export const PAYMENT_CHARGEBACK_REQUESTED: WebhookHandler = async (ctx) => {
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
      status: 'chargeback',
      paymentMethod: payment.billingType,
      dueDate: asaasDateToDate(payment.dueDate),
      rawPayload: ctx.payload as any,
    },
    update: {
      subscriptionId: sub?.id ?? undefined,
      ownerTenantId: sub?.tenantId ?? undefined,
      paymentMethod: payment.billingType,
      dueDate: asaasDateToDate(payment.dueDate),
      status: 'chargeback',
      rawPayload: ctx.payload as any,
    },
  });

  if (!sub) {
    log.info('handler PAYMENT_CHARGEBACK_REQUESTED: payment sem subscription local', {
      eventId: ctx.eventId,
      asaasPaymentId: payment.id,
    });
    return;
  }

  const currentSub = await ctx.tx.subscription.findUnique({
    where: { id: sub.id },
    select: { status: true },
  });
  if (currentSub && SUBSCRIPTION_TERMINAL_STATUSES.has(currentSub.status as string)) {
    log.warn('handler PAYMENT_CHARGEBACK_REQUESTED: subscription em estado terminal, não regride', {
      eventId: ctx.eventId,
      subscriptionId: sub.id,
      currentStatus: currentSub.status,
    });
    return;
  }

  const now = new Date();
  const updatedSub = await ctx.tx.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'suspended',
      lastAsaasEventAt: now,
    },
    select: { id: true, status: true, tenantId: true },
  });

  const cacheValue = SUBSCRIPTION_STATUS_TO_TENANT_CACHE[updatedSub.status];
  if (cacheValue) {
    await writeTenantCacheWithGuard(
      ctx,
      updatedSub.tenantId,
      cacheValue,
      'PAYMENT_CHARGEBACK_REQUESTED',
    );
  }

  log.info('handler PAYMENT_CHARGEBACK_REQUESTED ok', {
    eventId: ctx.eventId,
    asaasPaymentId: payment.id,
    subscriptionId: updatedSub.id,
    tenantCache: cacheValue,
  });
};

/**
 * PAYMENT_DELETED — cobrança removida no Asaas (ex: cancelamento admin
 * antes do vencimento). Decisão deliberada:
 *   - Marca PaymentRecord como 'failed' (enum PaymentStatus não tem
 *     'deleted'; 'failed' é o mais próximo semanticamente) + failedAt.
 *   - NÃO mexe em Subscription nem em Tenant — a remoção de UMA cobrança
 *     não deve rebaixar a assinatura. Se a intenção for cancelar a
 *     assinatura, o evento correto é SUBSCRIPTION_DELETED (C5.x).
 */
export const PAYMENT_DELETED: WebhookHandler = async (ctx) => {
  const payment = ctx.payload.payment!;
  const sub = await findLocalSubscription(ctx.tx, payment);
  const now = new Date();

  const existing = await ctx.tx.paymentRecord.findUnique({
    where: { asaasPaymentId: payment.id },
    select: { failedAt: true },
  });

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
      status: 'failed',
      paymentMethod: payment.billingType,
      dueDate: asaasDateToDate(payment.dueDate),
      failedAt: now,
      rawPayload: ctx.payload as any,
    },
    update: {
      subscriptionId: sub?.id ?? undefined,
      ownerTenantId: sub?.tenantId ?? undefined,
      paymentMethod: payment.billingType,
      dueDate: asaasDateToDate(payment.dueDate),
      status: 'failed',
      ...(existing?.failedAt ? {} : { failedAt: now }),
      rawPayload: ctx.payload as any,
    },
  });

  log.info('handler PAYMENT_DELETED ok', {
    eventId: ctx.eventId,
    asaasPaymentId: payment.id,
    subscriptionId: sub?.id,
    // Subscription e Tenant intocados por decisão de design.
  });
};

// ============================================================================
// C5.2 — Subscription lifecycle handlers (sem payment.id no payload)
// ============================================================================

/**
 * Mapeamento AsaasSubscriptionStatus → Subscription.status local.
 *
 * Exportado para teste e para eventual override em integrações futuras.
 *
 *   ACTIVE   → 'active'   — cache legado: 'active'
 *   EXPIRED  → 'past_due' — cache legado: 'past_due' (Sprint 3, sinaliza ao front)
 *   INACTIVE → 'suspended'— cache legado: 'suspended'
 *
 * Status Asaas desconhecidos/ausentes NÃO alteram Subscription.status local.
 */
export const ASAAS_SUB_STATUS_TO_LOCAL: Record<
  AsaasSubscriptionStatus,
  'active' | 'past_due' | 'suspended'
> = {
  ACTIVE: 'active',
  EXPIRED: 'past_due',
  INACTIVE: 'suspended',
};

/**
 * Localiza Subscription local a partir de um objeto AsaasSubscriptionObject.
 * Estratégia (idêntica a findLocalSubscription mas sem ir via payment):
 *   1. por `asaasSubscriptionId` (provider='asaas' + id Asaas)
 *   2. por `externalReference` (id local — fallback de C3)
 */
async function findLocalSubscriptionByAsaasRef(
  tx: Prisma.TransactionClient,
  asaasSub: AsaasSubscriptionObject,
): Promise<{ id: string; tenantId: string; status: string } | null> {
  const byAsaas = await tx.subscription.findFirst({
    where: { provider: 'asaas', asaasSubscriptionId: asaasSub.id },
    select: { id: true, tenantId: true, status: true },
  });
  if (byAsaas) return byAsaas;
  if (asaasSub.externalReference) {
    const byExt = await tx.subscription.findUnique({
      where: { id: asaasSub.externalReference },
      select: { id: true, tenantId: true, status: true },
    });
    if (byExt) return byExt;
  }
  return null;
}

/**
 * Valor em reais (float do Asaas) → centavos inteiros.
 * Retorna undefined se o valor não for um número finito (para NÃO sobrescrever
 * amountCents local com 0 em updates parciais).
 */
function asaasValueToCentsOrUndefined(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !isFinite(value)) return undefined;
  return Math.round(value * 100);
}

/**
 * SUBSCRIPTION_UPDATED — Asaas notifica mudança de status/value/cycle/dueDate
 * da assinatura. Aplica projeção respeitando:
 *   - não regride se local já 'cancelled' (regra C5.2.1)
 *   - guard de billingSource antes de escrever Tenant
 *   - idempotência: escrita só quando há diferença real
 */
export const SUBSCRIPTION_UPDATED: WebhookHandler = async (ctx) => {
  const asaasSub = ctx.payload.subscription;
  if (!asaasSub) {
    log.warn('handler SUBSCRIPTION_UPDATED: payload sem subscription', {
      eventId: ctx.eventId,
    });
    return;
  }

  const local = await findLocalSubscriptionByAsaasRef(ctx.tx, asaasSub);
  if (!local) {
    log.warn('handler SUBSCRIPTION_UPDATED: subscription local não encontrada', {
      eventId: ctx.eventId,
      asaasSubscriptionId: asaasSub.id,
    });
    return;
  }

  // Regra C5.2.1: cancelled é terminal absoluto.
  if (SUBSCRIPTION_TERMINAL_STATUSES.has(local.status)) {
    log.warn('handler SUBSCRIPTION_UPDATED: subscription local em estado terminal, no-op de status', {
      eventId: ctx.eventId,
      subscriptionId: local.id,
      currentStatus: local.status,
    });
    // Preserva rastreabilidade: só toca lastAsaasEventAt + rawPayload de evento.
    await ctx.tx.subscription.update({
      where: { id: local.id },
      data: { lastAsaasEventAt: new Date() },
    });
    return;
  }

  const now = new Date();
  const mappedStatus = ASAAS_SUB_STATUS_TO_LOCAL[asaasSub.status];
  const amountCents = asaasValueToCentsOrUndefined(asaasSub.value);
  const nextDueDate = asaasDateToDate(asaasSub.nextDueDate);

  const updateData: Prisma.SubscriptionUpdateInput = {
    lastAsaasEventAt: now,
  };
  if (mappedStatus && mappedStatus !== local.status) {
    updateData.status = mappedStatus;
  }
  if (amountCents !== undefined) {
    updateData.amountCents = amountCents;
  }
  if (nextDueDate) {
    updateData.currentPeriodEnd = nextDueDate;
  }

  const updatedSub = await ctx.tx.subscription.update({
    where: { id: local.id },
    data: updateData,
    select: { id: true, status: true, tenantId: true },
  });

  // Sincroniza cache legado em Tenant (política past_due→active preservada).
  const cacheValue = SUBSCRIPTION_STATUS_TO_TENANT_CACHE[updatedSub.status];
  if (cacheValue) {
    await writeTenantCacheWithGuard(
      ctx,
      updatedSub.tenantId,
      cacheValue,
      'SUBSCRIPTION_UPDATED',
    );
  }

  log.info('handler SUBSCRIPTION_UPDATED ok', {
    eventId: ctx.eventId,
    subscriptionId: updatedSub.id,
    asaasStatus: asaasSub.status,
    localStatus: updatedSub.status,
    tenantCache: cacheValue,
  });
};

/**
 * SUBSCRIPTION_DELETED — Asaas removeu a assinatura. Transição terminal NO
 * PROVEDOR, mas no UTOP respeitamos o período pago:
 *
 *   - Sempre grava `cancelledAt` (se ainda não tiver sido setado).
 *   - Se `currentPeriodEnd` no futuro → mantém `status='active'` (cancelamento
 *     agendado). O job `subscription-lifecycle` flipa para 'cancelled' quando
 *     o período expirar. Tenant cache NÃO é alterado.
 *   - Se já vencido / null → flipa para 'cancelled' imediatamente + cache.
 *   - Idempotente: 2ª chamada respeita estado terminal.
 */
export const SUBSCRIPTION_DELETED: WebhookHandler = async (ctx) => {
  const asaasSub = ctx.payload.subscription;
  if (!asaasSub) {
    log.warn('handler SUBSCRIPTION_DELETED: payload sem subscription', {
      eventId: ctx.eventId,
    });
    return;
  }

  const local = await findLocalSubscriptionByAsaasRef(ctx.tx, asaasSub);
  if (!local) {
    log.warn('handler SUBSCRIPTION_DELETED: subscription local não encontrada', {
      eventId: ctx.eventId,
      asaasSubscriptionId: asaasSub.id,
    });
    return;
  }

  const now = new Date();

  const existing = await ctx.tx.subscription.findUnique({
    where: { id: local.id },
    select: {
      cancelledAt: true,
      currentPeriodEnd: true,
      status: true,
    },
  });

  // Se já está cancelled, no-op (idempotente).
  if (existing?.status === 'cancelled') {
    await ctx.tx.subscription.update({
      where: { id: local.id },
      data: { lastAsaasEventAt: now },
    });
    log.info('handler SUBSCRIPTION_DELETED: já cancelled, no-op', {
      eventId: ctx.eventId,
      subscriptionId: local.id,
    });
    return;
  }

  // Período ainda válido → cancelamento agendado (preserva acesso).
  const isWithinPaidPeriod =
    existing?.currentPeriodEnd != null && existing.currentPeriodEnd > now;

  const updatedSub = await ctx.tx.subscription.update({
    where: { id: local.id },
    data: {
      status: isWithinPaidPeriod ? 'active' : 'cancelled',
      lastAsaasEventAt: now,
      ...(existing?.cancelledAt ? {} : { cancelledAt: now }),
    },
    select: { id: true, status: true, tenantId: true },
  });

  // Só sincroniza cache do tenant se REALMENTE cancelou (período já vencido).
  if (!isWithinPaidPeriod) {
    const cacheValue = SUBSCRIPTION_STATUS_TO_TENANT_CACHE[updatedSub.status];
    if (cacheValue) {
      await writeTenantCacheWithGuard(
        ctx,
        updatedSub.tenantId,
        cacheValue,
        'SUBSCRIPTION_DELETED',
      );
    }
  }

  log.info('handler SUBSCRIPTION_DELETED ok', {
    eventId: ctx.eventId,
    subscriptionId: updatedSub.id,
    scheduledForPeriodEnd: isWithinPaidPeriod,
    status: updatedSub.status,
  });
};

/**
 * SUBSCRIPTION_INACTIVATED — assinatura suspensa/desativada no Asaas (não
 * terminal — pode ser reativada). Projeção em 'suspended'.
 *
 *   - NÃO regride se local já 'cancelled' (regra C5.2.1).
 *   - Se local já 'suspended', no-op de status (só lastAsaasEventAt).
 */
export const SUBSCRIPTION_INACTIVATED: WebhookHandler = async (ctx) => {
  const asaasSub = ctx.payload.subscription;
  if (!asaasSub) {
    log.warn('handler SUBSCRIPTION_INACTIVATED: payload sem subscription', {
      eventId: ctx.eventId,
    });
    return;
  }

  const local = await findLocalSubscriptionByAsaasRef(ctx.tx, asaasSub);
  if (!local) {
    log.warn('handler SUBSCRIPTION_INACTIVATED: subscription local não encontrada', {
      eventId: ctx.eventId,
      asaasSubscriptionId: asaasSub.id,
    });
    return;
  }

  const now = new Date();

  if (SUBSCRIPTION_TERMINAL_STATUSES.has(local.status)) {
    log.warn('handler SUBSCRIPTION_INACTIVATED: subscription local em estado terminal, no-op', {
      eventId: ctx.eventId,
      subscriptionId: local.id,
      currentStatus: local.status,
    });
    await ctx.tx.subscription.update({
      where: { id: local.id },
      data: { lastAsaasEventAt: now },
    });
    return;
  }

  const updatedSub = await ctx.tx.subscription.update({
    where: { id: local.id },
    data: {
      status: 'suspended',
      lastAsaasEventAt: now,
    },
    select: { id: true, status: true, tenantId: true },
  });

  const cacheValue = SUBSCRIPTION_STATUS_TO_TENANT_CACHE[updatedSub.status];
  if (cacheValue) {
    await writeTenantCacheWithGuard(
      ctx,
      updatedSub.tenantId,
      cacheValue,
      'SUBSCRIPTION_INACTIVATED',
    );
  }

  log.info('handler SUBSCRIPTION_INACTIVATED ok', {
    eventId: ctx.eventId,
    subscriptionId: updatedSub.id,
    tenantCache: cacheValue,
  });
};

