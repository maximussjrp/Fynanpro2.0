/**
 * Asaas webhook handlers — unit tests (C4 + C5.0 + C5.1)
 */

import {
  PAYMENT_CREATED,
  PAYMENT_CONFIRMED,
  PAYMENT_RECEIVED,
  PAYMENT_OVERDUE,
  PAYMENT_REFUNDED,
  PAYMENT_CHARGEBACK_REQUESTED,
  PAYMENT_DELETED,
  SUBSCRIPTION_UPDATED,
  SUBSCRIPTION_DELETED,
  SUBSCRIPTION_INACTIVATED,
  ASAAS_SUB_STATUS_TO_LOCAL,
  SUBSCRIPTION_STATUS_TO_TENANT_CACHE,
} from '../../services/asaas/handlers';

function makeTx() {
  return {
    paymentRecord: {
      upsert: jest.fn(),
      // C5.1 — handlers OVERDUE/REFUNDED/DELETED pré-consultam estado atual.
      // Default: registro ainda não existe.
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    subscription: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    tenant: {
      update: jest.fn(),
      // C5.0 — default: tenant sem billingSource (zona neutra, guard permite).
      findUnique: jest.fn().mockResolvedValue({ billingSource: null }),
    },
  } as any;
}

const samplePayment = {
  id: 'pay_1',
  customer: 'cus_1',
  subscription: 'asaas_sub_1',
  value: 29.9,
  billingType: 'PIX',
  status: 'CONFIRMED',
  dueDate: '2026-05-01',
  paymentDate: '2026-05-01',
  externalReference: undefined,
};

describe('SUBSCRIPTION_STATUS_TO_TENANT_CACHE — política C4', () => {
  it('past_due mapeia para active (não bloquear)', () => {
    expect(SUBSCRIPTION_STATUS_TO_TENANT_CACHE.past_due).toBe('active');
  });

  it('active → active', () => {
    expect(SUBSCRIPTION_STATUS_TO_TENANT_CACHE.active).toBe('active');
  });

  it('suspended → suspended', () => {
    expect(SUBSCRIPTION_STATUS_TO_TENANT_CACHE.suspended).toBe('suspended');
  });

  it('cancelled → cancelled', () => {
    expect(SUBSCRIPTION_STATUS_TO_TENANT_CACHE.cancelled).toBe('cancelled');
  });

  it('pending → null (não tocar Tenant)', () => {
    expect(SUBSCRIPTION_STATUS_TO_TENANT_CACHE.pending).toBeNull();
  });
});

describe('PAYMENT_CREATED handler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cria PaymentRecord pending vinculado à Subscription via asaasSubscriptionId', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });

    await PAYMENT_CREATED({
      tx,
      payload: { event: 'PAYMENT_CREATED', payment: samplePayment as any },
      eventId: 'evt_1',
    });

    expect(tx.subscription.findFirst).toHaveBeenCalledWith({
      where: { provider: 'asaas', asaasSubscriptionId: 'asaas_sub_1' },
      select: { id: true, tenantId: true },
    });
    const upsertArg = tx.paymentRecord.upsert.mock.calls[0][0];
    expect(upsertArg.where.asaasPaymentId).toBe('pay_1');
    expect(upsertArg.create.status).toBe('pending');
    expect(upsertArg.create.subscriptionId).toBe('sub_local_1');
    expect(upsertArg.create.ownerTenantId).toBe('t1');
    expect(upsertArg.create.amountCents).toBe(2990);
    expect(upsertArg.create.paymentMethod).toBe('PIX');
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('fallback via externalReference quando subscription Asaas não bate', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue(null);
    tx.subscription.findUnique.mockResolvedValue({ id: 'sub_ext', tenantId: 't2' });

    await PAYMENT_CREATED({
      tx,
      payload: {
        event: 'PAYMENT_CREATED',
        payment: { ...samplePayment, subscription: undefined, externalReference: 'sub_ext' } as any,
      },
      eventId: 'evt_2',
    });

    expect(tx.subscription.findUnique).toHaveBeenCalledWith({
      where: { id: 'sub_ext' },
      select: { id: true, tenantId: true },
    });
    expect(tx.paymentRecord.upsert.mock.calls[0][0].create.subscriptionId).toBe('sub_ext');
  });

  it('payment sem subscription local → cria PaymentRecord avulso', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue(null);

    await PAYMENT_CREATED({
      tx,
      payload: {
        event: 'PAYMENT_CREATED',
        payment: { ...samplePayment, externalReference: undefined } as any,
      },
      eventId: 'evt_3',
    });

    const upsertArg = tx.paymentRecord.upsert.mock.calls[0][0];
    expect(upsertArg.create.subscriptionId).toBeNull();
    expect(upsertArg.create.ownerTenantId).toBeNull();
  });
});

describe('PAYMENT_CONFIRMED handler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upsert paid + Subscription active + Tenant cache=active', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'active',
      tenantId: 't1',
    });

    await PAYMENT_CONFIRMED({
      tx,
      payload: { event: 'PAYMENT_CONFIRMED', payment: samplePayment as any },
      eventId: 'evt_c1',
    });

    const upsertArg = tx.paymentRecord.upsert.mock.calls[0][0];
    expect(upsertArg.create.status).toBe('paid');
    expect(upsertArg.create.paidAt).toBeInstanceOf(Date);
    expect(upsertArg.update.status).toBe('paid');
    expect(upsertArg.update.paidAt).toBeInstanceOf(Date);

    const subArg = tx.subscription.update.mock.calls[0][0];
    expect(subArg.where.id).toBe('sub_local_1');
    expect(subArg.data.status).toBe('active');
    expect(subArg.data.currentPeriodStart).toBeInstanceOf(Date);
    expect(subArg.data.currentPeriodEnd).toBeInstanceOf(Date);

    const tenantArg = tx.tenant.update.mock.calls[0][0];
    expect(tenantArg.where.id).toBe('t1');
    expect(tenantArg.data.subscriptionStatus).toBe('active');
  });

  it('payment confirmado sem Subscription local → só PaymentRecord (não toca Tenant)', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue(null);

    await PAYMENT_CONFIRMED({
      tx,
      payload: {
        event: 'PAYMENT_CONFIRMED',
        payment: { ...samplePayment, externalReference: undefined } as any,
      },
      eventId: 'evt_c2',
    });

    expect(tx.paymentRecord.upsert).toHaveBeenCalledTimes(1);
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('idempotente: chamadas repetidas mantêm status=paid e não regridem', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'active',
      tenantId: 't1',
    });

    await PAYMENT_CONFIRMED({
      tx,
      payload: { event: 'PAYMENT_CONFIRMED', payment: samplePayment as any },
      eventId: 'evt_dup',
    });
    await PAYMENT_CONFIRMED({
      tx,
      payload: { event: 'PAYMENT_CONFIRMED', payment: samplePayment as any },
      eventId: 'evt_dup',
    });

    // upsert por @unique(asaasPaymentId) garante 1 row final.
    expect(tx.paymentRecord.upsert).toHaveBeenCalledTimes(2);
    const both = tx.paymentRecord.upsert.mock.calls.map((c: any[]) => c[0].where.asaasPaymentId);
    expect(both).toEqual(['pay_1', 'pay_1']);
  });

  it('paymentDate ausente → paidAt = now()', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_x', tenantId: 'tx' });
    tx.subscription.update.mockResolvedValue({ id: 'sub_x', status: 'active', tenantId: 'tx' });

    const before = Date.now();
    await PAYMENT_CONFIRMED({
      tx,
      payload: {
        event: 'PAYMENT_CONFIRMED',
        payment: { ...samplePayment, paymentDate: undefined } as any,
      },
      eventId: 'evt_nodate',
    });
    const after = Date.now();

    const paidAt: Date = tx.paymentRecord.upsert.mock.calls[0][0].create.paidAt;
    expect(paidAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(paidAt.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('PAYMENT_RECEIVED handler (C4.1 — alias de PAYMENT_CONFIRMED)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('é literalmente a mesma função exportada que PAYMENT_CONFIRMED', () => {
    // Garante que qualquer mudança futura em um não divergir silenciosamente do outro.
    expect(PAYMENT_RECEIVED).toBe(PAYMENT_CONFIRMED);
  });

  it('PaymentRecord pending → paid, Subscription → active, Tenant cache=active', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'active',
      tenantId: 't1',
    });

    await PAYMENT_RECEIVED({
      tx,
      payload: {
        event: 'PAYMENT_RECEIVED',
        payment: { ...samplePayment, status: 'RECEIVED' } as any,
      },
      eventId: 'evt_r1',
    });

    // PaymentRecord paid
    const upsertArg = tx.paymentRecord.upsert.mock.calls[0][0];
    expect(upsertArg.where.asaasPaymentId).toBe('pay_1');
    expect(upsertArg.create.status).toBe('paid');
    expect(upsertArg.update.status).toBe('paid');
    expect(upsertArg.create.paidAt).toBeInstanceOf(Date);

    // Subscription active
    const subArg = tx.subscription.update.mock.calls[0][0];
    expect(subArg.where.id).toBe('sub_local_1');
    expect(subArg.data.status).toBe('active');

    // Tenant cache
    const tenantArg = tx.tenant.update.mock.calls[0][0];
    expect(tenantArg.where.id).toBe('t1');
    expect(tenantArg.data.subscriptionStatus).toBe('active');
  });

  it('idempotente entre PAYMENT_CONFIRMED + PAYMENT_RECEIVED para o mesmo asaasPaymentId', async () => {
    // Simula o caso real: Asaas envia primeiro CONFIRMED e depois RECEIVED
    // para o mesmo pay_*. O estado final precisa ser estável (paid/active).
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'active',
      tenantId: 't1',
    });

    await PAYMENT_CONFIRMED({
      tx,
      payload: { event: 'PAYMENT_CONFIRMED', payment: samplePayment as any },
      eventId: 'evt_dup_1',
    });
    await PAYMENT_RECEIVED({
      tx,
      payload: { event: 'PAYMENT_RECEIVED', payment: samplePayment as any },
      eventId: 'evt_dup_2',
    });

    // Mesmo asaasPaymentId nas duas chamadas (upsert @unique garante 1 row no DB real).
    const ids = tx.paymentRecord.upsert.mock.calls.map((c: any[]) => c[0].where.asaasPaymentId);
    expect(ids).toEqual(['pay_1', 'pay_1']);
    // Sempre paid em ambas as chamadas (nunca regride).
    const statuses = tx.paymentRecord.upsert.mock.calls.map((c: any[]) => c[0].update.status);
    expect(statuses).toEqual(['paid', 'paid']);
  });

  it('PAYMENT_RECEIVED sem Subscription local → só PaymentRecord paid, não toca Tenant', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue(null);

    await PAYMENT_RECEIVED({
      tx,
      payload: {
        event: 'PAYMENT_RECEIVED',
        payment: { ...samplePayment, externalReference: undefined } as any,
      },
      eventId: 'evt_r_orphan',
    });

    expect(tx.paymentRecord.upsert).toHaveBeenCalledTimes(1);
    expect(tx.paymentRecord.upsert.mock.calls[0][0].create.status).toBe('paid');
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });
});

describe('PAYMENT_CONFIRMED — billingSource guard (C5.0)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('source=stripe → NÃO grava Tenant (guard bloqueia asaas)', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'active',
      tenantId: 't1',
    });
    tx.tenant.findUnique.mockResolvedValue({ billingSource: 'stripe' });

    const invalidateTenantIds = new Set<string>();
    await PAYMENT_CONFIRMED({
      tx,
      payload: { event: 'PAYMENT_CONFIRMED', payment: samplePayment as any },
      eventId: 'evt_guard_stripe',
      invalidateTenantIds,
    });

    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(invalidateTenantIds.size).toBe(0);
  });

  it('source=null → grava Tenant + PROMOVE para billingSource=asaas atomicamente', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'active',
      tenantId: 't1',
    });
    tx.tenant.findUnique.mockResolvedValue({ billingSource: null });

    const invalidateTenantIds = new Set<string>();
    await PAYMENT_CONFIRMED({
      tx,
      payload: { event: 'PAYMENT_CONFIRMED', payment: samplePayment as any },
      eventId: 'evt_guard_promote',
      invalidateTenantIds,
    });

    expect(tx.tenant.update).toHaveBeenCalledTimes(1);
    const arg = tx.tenant.update.mock.calls[0][0];
    expect(arg.data.subscriptionStatus).toBe('active');
    expect(arg.data.billingSource).toBe('asaas');
    expect(invalidateTenantIds.has('t1')).toBe(true);
  });

  it('source=asaas → grava Tenant SEM re-promover (billingSource ausente do update)', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'active',
      tenantId: 't1',
    });
    tx.tenant.findUnique.mockResolvedValue({ billingSource: 'asaas' });

    const invalidateTenantIds = new Set<string>();
    await PAYMENT_CONFIRMED({
      tx,
      payload: { event: 'PAYMENT_CONFIRMED', payment: samplePayment as any },
      eventId: 'evt_guard_asaas',
      invalidateTenantIds,
    });

    expect(tx.tenant.update).toHaveBeenCalledTimes(1);
    const arg = tx.tenant.update.mock.calls[0][0];
    expect(arg.data.subscriptionStatus).toBe('active');
    expect(arg.data.billingSource).toBeUndefined();
    expect(invalidateTenantIds.has('t1')).toBe(true);
  });

  it('source=trial → BLOQUEIA (só rota C3 promove trial→asaas)', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'active',
      tenantId: 't1',
    });
    tx.tenant.findUnique.mockResolvedValue({ billingSource: 'trial' });

    const invalidateTenantIds = new Set<string>();
    await PAYMENT_CONFIRMED({
      tx,
      payload: { event: 'PAYMENT_CONFIRMED', payment: samplePayment as any },
      eventId: 'evt_guard_trial',
      invalidateTenantIds,
    });

    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(invalidateTenantIds.size).toBe(0);
  });
});

// ============================================================================
// C5.1 — PAYMENT_OVERDUE / REFUNDED / CHARGEBACK_REQUESTED / DELETED
// ============================================================================

describe('PAYMENT_OVERDUE handler (C5.1)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cria PaymentRecord pending+overdueAt + Subscription past_due + cache legado active (C4.1 preservada)', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'past_due',
      tenantId: 't1',
    });

    const invalidateTenantIds = new Set<string>();
    await PAYMENT_OVERDUE({
      tx,
      payload: { event: 'PAYMENT_OVERDUE', payment: samplePayment as any },
      eventId: 'evt_ov1',
      invalidateTenantIds,
    });

    const upsertArg = tx.paymentRecord.upsert.mock.calls[0][0];
    expect(upsertArg.create.status).toBe('pending');
    expect(upsertArg.create.overdueAt).toBeInstanceOf(Date);
    expect(upsertArg.update.overdueAt).toBeInstanceOf(Date);

    expect(tx.subscription.update.mock.calls[0][0].data.status).toBe('past_due');
    expect(tx.subscription.update.mock.calls[0][0].data.lastAsaasEventAt).toBeInstanceOf(Date);

    // past_due → active no cache legado (política C4.1)
    expect(tx.tenant.update.mock.calls[0][0].data.subscriptionStatus).toBe('active');
    expect(invalidateTenantIds.has('t1')).toBe(true);
  });

  it('NÃO regride se PaymentRecord já está paid (out-of-order): só atualiza rawPayload', async () => {
    const tx = makeTx();
    tx.paymentRecord.findUnique.mockResolvedValue({ status: 'paid', overdueAt: null });
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });

    await PAYMENT_OVERDUE({
      tx,
      payload: { event: 'PAYMENT_OVERDUE', payment: samplePayment as any },
      eventId: 'evt_ov_ooo',
    });

    expect(tx.paymentRecord.upsert).not.toHaveBeenCalled();
    expect(tx.paymentRecord.update).toHaveBeenCalledTimes(1);
    expect(tx.paymentRecord.update.mock.calls[0][0].data.rawPayload).toBeDefined();
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('idempotência: 2ª chamada preserva overdueAt original (não sobrescreve)', async () => {
    const tx = makeTx();
    const originalOverdue = new Date('2026-04-01T00:00:00Z');
    tx.paymentRecord.findUnique.mockResolvedValue({ status: 'pending', overdueAt: originalOverdue });
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'past_due',
      tenantId: 't1',
    });

    await PAYMENT_OVERDUE({
      tx,
      payload: { event: 'PAYMENT_OVERDUE', payment: samplePayment as any },
      eventId: 'evt_ov_idem',
    });

    const upsertArg = tx.paymentRecord.upsert.mock.calls[0][0];
    // update path NÃO deve conter overdueAt (preserva original)
    expect(upsertArg.update.overdueAt).toBeUndefined();
  });

  it('payment sem Subscription local → só PaymentRecord (não toca Subscription/Tenant)', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue(null);

    await PAYMENT_OVERDUE({
      tx,
      payload: {
        event: 'PAYMENT_OVERDUE',
        payment: { ...samplePayment, externalReference: undefined } as any,
      },
      eventId: 'evt_ov_orphan',
    });

    expect(tx.paymentRecord.upsert).toHaveBeenCalledTimes(1);
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('NÃO regride Subscription se já cancelled (estado terminal)', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.findUnique.mockResolvedValue({ status: 'cancelled' });

    await PAYMENT_OVERDUE({
      tx,
      payload: { event: 'PAYMENT_OVERDUE', payment: samplePayment as any },
      eventId: 'evt_ov_term',
    });

    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('guard: source=stripe → Subscription é atualizada, Tenant NÃO', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'past_due',
      tenantId: 't1',
    });
    tx.tenant.findUnique.mockResolvedValue({ billingSource: 'stripe' });

    const invalidateTenantIds = new Set<string>();
    await PAYMENT_OVERDUE({
      tx,
      payload: { event: 'PAYMENT_OVERDUE', payment: samplePayment as any },
      eventId: 'evt_ov_guard',
      invalidateTenantIds,
    });

    expect(tx.subscription.update).toHaveBeenCalledTimes(1);
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(invalidateTenantIds.size).toBe(0);
  });
});

describe('PAYMENT_REFUNDED handler (C5.1)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('PaymentRecord→refunded + refundedAt + Subscription→suspended + cache suspended', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'suspended',
      tenantId: 't1',
    });

    const invalidateTenantIds = new Set<string>();
    await PAYMENT_REFUNDED({
      tx,
      payload: { event: 'PAYMENT_REFUNDED', payment: samplePayment as any },
      eventId: 'evt_ref1',
      invalidateTenantIds,
    });

    const upsertArg = tx.paymentRecord.upsert.mock.calls[0][0];
    expect(upsertArg.create.status).toBe('refunded');
    expect(upsertArg.create.refundedAt).toBeInstanceOf(Date);
    expect(upsertArg.update.status).toBe('refunded');

    expect(tx.subscription.update.mock.calls[0][0].data.status).toBe('suspended');
    expect(tx.tenant.update.mock.calls[0][0].data.subscriptionStatus).toBe('suspended');
    expect(invalidateTenantIds.has('t1')).toBe(true);
  });

  it('idempotência: 2ª chamada preserva refundedAt original', async () => {
    const tx = makeTx();
    const originalRefund = new Date('2026-04-10T00:00:00Z');
    tx.paymentRecord.findUnique.mockResolvedValue({ refundedAt: originalRefund });
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'suspended',
      tenantId: 't1',
    });

    await PAYMENT_REFUNDED({
      tx,
      payload: { event: 'PAYMENT_REFUNDED', payment: samplePayment as any },
      eventId: 'evt_ref_idem',
    });

    const upsertArg = tx.paymentRecord.upsert.mock.calls[0][0];
    expect(upsertArg.update.refundedAt).toBeUndefined();
    expect(upsertArg.update.status).toBe('refunded');
  });

  it('payment sem Subscription local → só PaymentRecord', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue(null);

    await PAYMENT_REFUNDED({
      tx,
      payload: {
        event: 'PAYMENT_REFUNDED',
        payment: { ...samplePayment, externalReference: undefined } as any,
      },
      eventId: 'evt_ref_orphan',
    });

    expect(tx.paymentRecord.upsert).toHaveBeenCalledTimes(1);
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('guard: source=trial → Subscription atualizada, Tenant bloqueado', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'suspended',
      tenantId: 't1',
    });
    tx.tenant.findUnique.mockResolvedValue({ billingSource: 'trial' });

    const invalidateTenantIds = new Set<string>();
    await PAYMENT_REFUNDED({
      tx,
      payload: { event: 'PAYMENT_REFUNDED', payment: samplePayment as any },
      eventId: 'evt_ref_guard',
      invalidateTenantIds,
    });

    expect(tx.subscription.update).toHaveBeenCalledTimes(1);
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(invalidateTenantIds.size).toBe(0);
  });

  it('NÃO regride Subscription se já cancelled', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.findUnique.mockResolvedValue({ status: 'cancelled' });

    await PAYMENT_REFUNDED({
      tx,
      payload: { event: 'PAYMENT_REFUNDED', payment: samplePayment as any },
      eventId: 'evt_ref_term',
    });

    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });
});

describe('PAYMENT_CHARGEBACK_REQUESTED handler (C5.1)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('PaymentRecord→chargeback + Subscription→suspended + cache suspended', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'suspended',
      tenantId: 't1',
    });

    const invalidateTenantIds = new Set<string>();
    await PAYMENT_CHARGEBACK_REQUESTED({
      tx,
      payload: { event: 'PAYMENT_CHARGEBACK_REQUESTED', payment: samplePayment as any },
      eventId: 'evt_cb1',
      invalidateTenantIds,
    });

    expect(tx.paymentRecord.upsert.mock.calls[0][0].create.status).toBe('chargeback');
    expect(tx.paymentRecord.upsert.mock.calls[0][0].update.status).toBe('chargeback');
    expect(tx.subscription.update.mock.calls[0][0].data.status).toBe('suspended');
    expect(tx.tenant.update.mock.calls[0][0].data.subscriptionStatus).toBe('suspended');
    expect(invalidateTenantIds.has('t1')).toBe(true);
  });

  it('payment sem Subscription local → só PaymentRecord', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue(null);

    await PAYMENT_CHARGEBACK_REQUESTED({
      tx,
      payload: {
        event: 'PAYMENT_CHARGEBACK_REQUESTED',
        payment: { ...samplePayment, externalReference: undefined } as any,
      },
      eventId: 'evt_cb_orphan',
    });

    expect(tx.paymentRecord.upsert).toHaveBeenCalledTimes(1);
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('guard: source=manual → Tenant bloqueado', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'suspended',
      tenantId: 't1',
    });
    tx.tenant.findUnique.mockResolvedValue({ billingSource: 'manual' });

    const invalidateTenantIds = new Set<string>();
    await PAYMENT_CHARGEBACK_REQUESTED({
      tx,
      payload: { event: 'PAYMENT_CHARGEBACK_REQUESTED', payment: samplePayment as any },
      eventId: 'evt_cb_guard',
      invalidateTenantIds,
    });

    expect(tx.subscription.update).toHaveBeenCalledTimes(1);
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(invalidateTenantIds.size).toBe(0);
  });

  it('NÃO regride Subscription se já cancelled', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });
    tx.subscription.findUnique.mockResolvedValue({ status: 'cancelled' });

    await PAYMENT_CHARGEBACK_REQUESTED({
      tx,
      payload: { event: 'PAYMENT_CHARGEBACK_REQUESTED', payment: samplePayment as any },
      eventId: 'evt_cb_term',
    });

    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });
});

describe('PAYMENT_DELETED handler (C5.1)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('PaymentRecord→failed+failedAt, Subscription INTOCADA, Tenant INTOCADO', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });

    const invalidateTenantIds = new Set<string>();
    await PAYMENT_DELETED({
      tx,
      payload: { event: 'PAYMENT_DELETED', payment: samplePayment as any },
      eventId: 'evt_del1',
      invalidateTenantIds,
    });

    const upsertArg = tx.paymentRecord.upsert.mock.calls[0][0];
    expect(upsertArg.create.status).toBe('failed');
    expect(upsertArg.create.failedAt).toBeInstanceOf(Date);
    expect(upsertArg.update.status).toBe('failed');

    // Crucial: Subscription e Tenant INTACTOS
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(invalidateTenantIds.size).toBe(0);
  });

  it('idempotência: 2ª chamada preserva failedAt original', async () => {
    const tx = makeTx();
    const originalFailed = new Date('2026-04-05T00:00:00Z');
    tx.paymentRecord.findUnique.mockResolvedValue({ failedAt: originalFailed });
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub_local_1', tenantId: 't1' });

    await PAYMENT_DELETED({
      tx,
      payload: { event: 'PAYMENT_DELETED', payment: samplePayment as any },
      eventId: 'evt_del_idem',
    });

    const upsertArg = tx.paymentRecord.upsert.mock.calls[0][0];
    expect(upsertArg.update.failedAt).toBeUndefined();
    expect(upsertArg.update.status).toBe('failed');
  });

  it('payment sem Subscription local → só PaymentRecord', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue(null);

    await PAYMENT_DELETED({
      tx,
      payload: {
        event: 'PAYMENT_DELETED',
        payment: { ...samplePayment, externalReference: undefined } as any,
      },
      eventId: 'evt_del_orphan',
    });

    expect(tx.paymentRecord.upsert).toHaveBeenCalledTimes(1);
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });
});

// ============================================================================
// C5.2 — SUBSCRIPTION_UPDATED / DELETED / INACTIVATED
// ============================================================================

const sampleAsaasSub = {
  id: 'asaas_sub_1',
  customer: 'cus_1',
  value: 79.9,
  nextDueDate: '2026-06-01',
  cycle: 'MONTHLY' as const,
  status: 'ACTIVE' as const,
  billingType: 'PIX' as const,
};

describe('ASAAS_SUB_STATUS_TO_LOCAL mapping (C5.2)', () => {
  it('ACTIVE → active', () => {
    expect(ASAAS_SUB_STATUS_TO_LOCAL.ACTIVE).toBe('active');
  });
  it('EXPIRED → past_due (cache legado cruza past_due→active por política C4.1)', () => {
    expect(ASAAS_SUB_STATUS_TO_LOCAL.EXPIRED).toBe('past_due');
    expect(SUBSCRIPTION_STATUS_TO_TENANT_CACHE.past_due).toBe('active');
  });
  it('INACTIVE → suspended', () => {
    expect(ASAAS_SUB_STATUS_TO_LOCAL.INACTIVE).toBe('suspended');
  });
});

describe('SUBSCRIPTION_UPDATED handler (C5.2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ACTIVE → Subscription active + cache active + promove billingSource null→asaas', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({
      id: 'sub_local_1',
      tenantId: 't1',
      status: 'past_due',
    });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'active',
      tenantId: 't1',
    });

    const invalidateTenantIds = new Set<string>();
    await SUBSCRIPTION_UPDATED({
      tx,
      payload: {
        event: 'SUBSCRIPTION_UPDATED',
        subscription: { ...sampleAsaasSub, status: 'ACTIVE' } as any,
      },
      eventId: 'evt_subu_a',
      invalidateTenantIds,
    });

    const upd = tx.subscription.update.mock.calls[0][0];
    expect(upd.data.status).toBe('active');
    expect(upd.data.amountCents).toBe(7990);
    expect(upd.data.currentPeriodEnd).toBeInstanceOf(Date);
    expect(upd.data.lastAsaasEventAt).toBeInstanceOf(Date);

    const tArg = tx.tenant.update.mock.calls[0][0];
    expect(tArg.data.subscriptionStatus).toBe('active');
    expect(tArg.data.billingSource).toBe('asaas'); // promoção null→asaas
    expect(invalidateTenantIds.has('t1')).toBe(true);
  });

  it('EXPIRED → Subscription past_due + cache legado active (política C4.1 PRESERVADA)', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({
      id: 'sub_local_1',
      tenantId: 't1',
      status: 'active',
    });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'past_due',
      tenantId: 't1',
    });

    await SUBSCRIPTION_UPDATED({
      tx,
      payload: {
        event: 'SUBSCRIPTION_UPDATED',
        subscription: { ...sampleAsaasSub, status: 'EXPIRED' } as any,
      },
      eventId: 'evt_subu_e',
    });

    expect(tx.subscription.update.mock.calls[0][0].data.status).toBe('past_due');
    // Política C4.1: past_due → 'active' no cache legado, sem bloqueio.
    expect(tx.tenant.update.mock.calls[0][0].data.subscriptionStatus).toBe('active');
  });

  it('INACTIVE → Subscription suspended + cache suspended', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({
      id: 'sub_local_1',
      tenantId: 't1',
      status: 'active',
    });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'suspended',
      tenantId: 't1',
    });

    await SUBSCRIPTION_UPDATED({
      tx,
      payload: {
        event: 'SUBSCRIPTION_UPDATED',
        subscription: { ...sampleAsaasSub, status: 'INACTIVE' } as any,
      },
      eventId: 'evt_subu_i',
    });

    expect(tx.subscription.update.mock.calls[0][0].data.status).toBe('suspended');
    expect(tx.tenant.update.mock.calls[0][0].data.subscriptionStatus).toBe('suspended');
  });

  it('Subscription local já cancelled → NÃO regride (só atualiza lastAsaasEventAt)', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({
      id: 'sub_local_1',
      tenantId: 't1',
      status: 'cancelled',
    });

    await SUBSCRIPTION_UPDATED({
      tx,
      payload: {
        event: 'SUBSCRIPTION_UPDATED',
        subscription: { ...sampleAsaasSub, status: 'ACTIVE' } as any,
      },
      eventId: 'evt_subu_term',
    });

    // update CHAMADO mas só com lastAsaasEventAt, sem status/amount/period
    expect(tx.subscription.update).toHaveBeenCalledTimes(1);
    const updData = tx.subscription.update.mock.calls[0][0].data;
    expect(updData.status).toBeUndefined();
    expect(updData.amountCents).toBeUndefined();
    expect(updData.lastAsaasEventAt).toBeInstanceOf(Date);
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('subscription local não encontrada → no-op com log WARN', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue(null);

    await SUBSCRIPTION_UPDATED({
      tx,
      payload: {
        event: 'SUBSCRIPTION_UPDATED',
        subscription: sampleAsaasSub as any,
      },
      eventId: 'evt_subu_404',
    });

    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });
});

describe('SUBSCRIPTION_DELETED handler (C5.2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('happy path: Subscription→cancelled + cancelledAt=now + cache cancelled', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({
      id: 'sub_local_1',
      tenantId: 't1',
      status: 'active',
    });
    tx.subscription.findUnique.mockResolvedValue({ cancelledAt: null });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'cancelled',
      tenantId: 't1',
    });

    const invalidateTenantIds = new Set<string>();
    await SUBSCRIPTION_DELETED({
      tx,
      payload: {
        event: 'SUBSCRIPTION_DELETED',
        subscription: sampleAsaasSub as any,
      },
      eventId: 'evt_subd_1',
      invalidateTenantIds,
    });

    const upd = tx.subscription.update.mock.calls[0][0];
    expect(upd.data.status).toBe('cancelled');
    expect(upd.data.cancelledAt).toBeInstanceOf(Date);
    expect(upd.data.lastAsaasEventAt).toBeInstanceOf(Date);

    expect(tx.tenant.update.mock.calls[0][0].data.subscriptionStatus).toBe('cancelled');
    expect(invalidateTenantIds.has('t1')).toBe(true);
  });

  it('idempotência: 2ª chamada preserva cancelledAt original', async () => {
    const tx = makeTx();
    const originalCancel = new Date('2026-04-01T00:00:00Z');
    tx.subscription.findFirst.mockResolvedValue({
      id: 'sub_local_1',
      tenantId: 't1',
      status: 'cancelled',
    });
    tx.subscription.findUnique.mockResolvedValue({ cancelledAt: originalCancel });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'cancelled',
      tenantId: 't1',
    });

    await SUBSCRIPTION_DELETED({
      tx,
      payload: {
        event: 'SUBSCRIPTION_DELETED',
        subscription: sampleAsaasSub as any,
      },
      eventId: 'evt_subd_idem',
    });

    const upd = tx.subscription.update.mock.calls[0][0];
    expect(upd.data.status).toBe('cancelled');
    expect(upd.data.cancelledAt).toBeUndefined(); // preservado
  });

  it('subscription local não encontrada → no-op', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue(null);

    await SUBSCRIPTION_DELETED({
      tx,
      payload: {
        event: 'SUBSCRIPTION_DELETED',
        subscription: sampleAsaasSub as any,
      },
      eventId: 'evt_subd_404',
    });

    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('guard: source=stripe → Subscription atualizada, Tenant NÃO', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({
      id: 'sub_local_1',
      tenantId: 't1',
      status: 'active',
    });
    tx.subscription.findUnique.mockResolvedValue({ cancelledAt: null });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'cancelled',
      tenantId: 't1',
    });
    tx.tenant.findUnique.mockResolvedValue({ billingSource: 'stripe' });

    const invalidateTenantIds = new Set<string>();
    await SUBSCRIPTION_DELETED({
      tx,
      payload: {
        event: 'SUBSCRIPTION_DELETED',
        subscription: sampleAsaasSub as any,
      },
      eventId: 'evt_subd_guard',
      invalidateTenantIds,
    });

    expect(tx.subscription.update).toHaveBeenCalledTimes(1);
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(invalidateTenantIds.size).toBe(0);
  });
});

describe('SUBSCRIPTION_INACTIVATED handler (C5.2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('active → suspended + cache suspended', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({
      id: 'sub_local_1',
      tenantId: 't1',
      status: 'active',
    });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'suspended',
      tenantId: 't1',
    });

    const invalidateTenantIds = new Set<string>();
    await SUBSCRIPTION_INACTIVATED({
      tx,
      payload: {
        event: 'SUBSCRIPTION_INACTIVATED',
        subscription: sampleAsaasSub as any,
      },
      eventId: 'evt_subi_1',
      invalidateTenantIds,
    });

    expect(tx.subscription.update.mock.calls[0][0].data.status).toBe('suspended');
    expect(tx.tenant.update.mock.calls[0][0].data.subscriptionStatus).toBe('suspended');
    expect(invalidateTenantIds.has('t1')).toBe(true);
  });

  it('NÃO regride se já cancelled (só lastAsaasEventAt)', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({
      id: 'sub_local_1',
      tenantId: 't1',
      status: 'cancelled',
    });

    await SUBSCRIPTION_INACTIVATED({
      tx,
      payload: {
        event: 'SUBSCRIPTION_INACTIVATED',
        subscription: sampleAsaasSub as any,
      },
      eventId: 'evt_subi_term',
    });

    const updData = tx.subscription.update.mock.calls[0][0].data;
    expect(updData.status).toBeUndefined();
    expect(updData.lastAsaasEventAt).toBeInstanceOf(Date);
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('subscription local não encontrada → no-op', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue(null);

    await SUBSCRIPTION_INACTIVATED({
      tx,
      payload: {
        event: 'SUBSCRIPTION_INACTIVATED',
        subscription: sampleAsaasSub as any,
      },
      eventId: 'evt_subi_404',
    });

    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('guard: source=manual bloqueia Tenant', async () => {
    const tx = makeTx();
    tx.subscription.findFirst.mockResolvedValue({
      id: 'sub_local_1',
      tenantId: 't1',
      status: 'active',
    });
    tx.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      status: 'suspended',
      tenantId: 't1',
    });
    tx.tenant.findUnique.mockResolvedValue({ billingSource: 'manual' });

    const invalidateTenantIds = new Set<string>();
    await SUBSCRIPTION_INACTIVATED({
      tx,
      payload: {
        event: 'SUBSCRIPTION_INACTIVATED',
        subscription: sampleAsaasSub as any,
      },
      eventId: 'evt_subi_guard',
      invalidateTenantIds,
    });

    expect(tx.subscription.update).toHaveBeenCalledTimes(1);
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(invalidateTenantIds.size).toBe(0);
  });
});

