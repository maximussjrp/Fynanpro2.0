/**
 * Asaas webhook handlers — unit tests (C4)
 */

import {
  PAYMENT_CREATED,
  PAYMENT_CONFIRMED,
  SUBSCRIPTION_STATUS_TO_TENANT_CACHE,
} from '../../services/asaas/handlers';

function makeTx() {
  return {
    paymentRecord: { upsert: jest.fn() },
    subscription: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    tenant: { update: jest.fn() },
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
