/**
 * Asaas webhook handlers — unit tests (C4)
 */

import {
  PAYMENT_CREATED,
  PAYMENT_CONFIRMED,
  PAYMENT_RECEIVED,
  SUBSCRIPTION_STATUS_TO_TENANT_CACHE,
} from '../../services/asaas/handlers';

function makeTx() {
  return {
    paymentRecord: { upsert: jest.fn() },
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
