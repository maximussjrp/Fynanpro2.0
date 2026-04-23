/**
 * webhook-processor.service unit tests — Fase A2A (C4)
 */

import { buildWebhookProcessor } from '../../services/asaas/webhook-processor.service';

function makeDb() {
  // mock $transaction: chama o callback com um tx mock que tem
  // asaasWebhookEvent.update e demais models necessários.
  const tx: any = {
    asaasWebhookEvent: { update: jest.fn() },
    paymentRecord: { upsert: jest.fn() },
    subscription: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    tenant: { update: jest.fn() },
  };
  return {
    asaasWebhookEvent: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    paymentRecord: { upsert: jest.fn() },
    subscription: { findFirst: jest.fn() },
    tenant: { update: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  } as any;
}

describe('buildWebhookProcessor — DI guards', () => {
  it('falha sem db', () => {
    expect(() => buildWebhookProcessor({ db: undefined as any })).toThrow(/db/);
  });
});

describe('buildWebhookProcessor — default handler registry (C4.1)', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['PAYMENT_CREATED'],
    ['PAYMENT_CONFIRMED'],
    ['PAYMENT_RECEIVED'],
  ])('%s é roteado (não cai em skipped)', async (eventType) => {
    const db = makeDb();
    // PaymentRecord + Subscription mocks ok no tx pra handler real não quebrar.
    db.__tx.subscription.findFirst.mockResolvedValue(null);
    db.__tx.paymentRecord.upsert.mockResolvedValue({});
    db.asaasWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt_reg',
      eventType,
      payload: { event: eventType, payment: { id: 'pay_reg' } },
      status: 'received',
    });

    const proc = buildWebhookProcessor({ db });
    const out = await proc.processOne('evt_reg');

    expect(out.outcome).toBe('processed');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['PAYMENT_OVERDUE'],
    ['PAYMENT_REFUNDED'],
    ['PAYMENT_CHARGEBACK_REQUESTED'],
    ['PAYMENT_DELETED'],
  ])('C5.1: %s é roteado pelo default registry', async (eventType) => {
    const db = makeDb();
    db.__tx.subscription.findFirst.mockResolvedValue(null);
    db.__tx.paymentRecord.upsert.mockResolvedValue({});
    db.__tx.paymentRecord.findUnique = jest.fn().mockResolvedValue(null);
    db.__tx.paymentRecord.update = jest.fn();
    db.asaasWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt_c51',
      eventType,
      payload: { event: eventType, payment: { id: 'pay_c51' } },
      status: 'received',
    });

    const proc = buildWebhookProcessor({ db });
    const out = await proc.processOne('evt_c51');

    expect(out.outcome).toBe('processed');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('eventType desconhecido continua caindo em skipped', async () => {
    const db = makeDb();
    db.asaasWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt_unk',
      eventType: 'RANDOM_UNREGISTERED',
      payload: { event: 'RANDOM_UNREGISTERED' },
      status: 'received',
    });
    const proc = buildWebhookProcessor({ db });
    const out = await proc.processOne('evt_unk');
    expect(out.outcome).toBe('skipped');
  });
});

describe('processOne', () => {
  beforeEach(() => jest.clearAllMocks());

  it('evento inexistente → outcome=failed (EVENT_NOT_FOUND)', async () => {
    const db = makeDb();
    db.asaasWebhookEvent.findUnique.mockResolvedValue(null);
    const proc = buildWebhookProcessor({ db });
    const out = await proc.processOne('missing');
    expect(out.outcome).toBe('failed');
    expect(out.error).toBe('EVENT_NOT_FOUND');
  });

  it('evento já em estado terminal (processed) → already_processed', async () => {
    const db = makeDb();
    db.asaasWebhookEvent.findUnique.mockResolvedValue({
      id: 'e1',
      eventType: 'PAYMENT_CREATED',
      payload: { event: 'PAYMENT_CREATED' },
      status: 'processed',
    });
    const proc = buildWebhookProcessor({ db });
    const out = await proc.processOne('e1');
    expect(out.outcome).toBe('already_processed');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('eventType desconhecido → outcome=skipped + status=skipped no DB', async () => {
    const db = makeDb();
    db.asaasWebhookEvent.findUnique.mockResolvedValue({
      id: 'e2',
      eventType: 'CUSTOM_X',
      payload: { event: 'CUSTOM_X' },
      status: 'received',
    });
    const proc = buildWebhookProcessor({ db });
    const out = await proc.processOne('e2');
    expect(out.outcome).toBe('skipped');
    const updArg = db.asaasWebhookEvent.update.mock.calls[0][0];
    expect(updArg.where.id).toBe('e2');
    expect(updArg.data.status).toBe('skipped');
  });

  it('evento sem payment.id → failed (NO_PAYMENT_ID), não joga', async () => {
    const db = makeDb();
    db.asaasWebhookEvent.findUnique.mockResolvedValue({
      id: 'e3',
      eventType: 'PAYMENT_CREATED',
      payload: { event: 'PAYMENT_CREATED', payment: { id: '' } },
      status: 'received',
    });
    const proc = buildWebhookProcessor({ db });
    const out = await proc.processOne('e3');
    expect(out.outcome).toBe('failed');
    expect(out.error).toBe('NO_PAYMENT_ID');
    const updArg = db.asaasWebhookEvent.update.mock.calls[0][0];
    expect(updArg.data.status).toBe('failed');
    expect(updArg.data.lastError).toContain('NO_PAYMENT_ID');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('evento sem payload.payment → failed (NO_PAYMENT_ID)', async () => {
    const db = makeDb();
    db.asaasWebhookEvent.findUnique.mockResolvedValue({
      id: 'e3b',
      eventType: 'PAYMENT_CONFIRMED',
      payload: { event: 'PAYMENT_CONFIRMED' },
      status: 'received',
    });
    const proc = buildWebhookProcessor({ db });
    const out = await proc.processOne('e3b');
    expect(out.outcome).toBe('failed');
    expect(out.error).toBe('NO_PAYMENT_ID');
  });

  it('caminho feliz: handler chamado dentro de $transaction + status=processed', async () => {
    const db = makeDb();
    const handler = jest.fn().mockResolvedValue(undefined);
    db.asaasWebhookEvent.findUnique.mockResolvedValue({
      id: 'e4',
      eventType: 'PAYMENT_CREATED',
      payload: { event: 'PAYMENT_CREATED', payment: { id: 'pay_1' } },
      status: 'received',
    });

    const proc = buildWebhookProcessor({
      db,
      handlers: { PAYMENT_CREATED: handler },
    });
    const out = await proc.processOne('e4');

    expect(out.outcome).toBe('processed');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);

    // Atualização do AsaasWebhookEvent foi feita DENTRO do tx.
    const tx = db.__tx;
    const txUpd = tx.asaasWebhookEvent.update.mock.calls[0][0];
    expect(txUpd.where.id).toBe('e4');
    expect(txUpd.data.status).toBe('processed');
    expect(txUpd.data.processedAt).toBeInstanceOf(Date);

    // Não chamou o update fora-da-transação para esse caminho.
    expect(db.asaasWebhookEvent.update).not.toHaveBeenCalled();
  });

  it('handler joga → marca failed (fora da tx) com lastError', async () => {
    const db = makeDb();
    const handler = jest.fn().mockRejectedValue(new Error('boom downstream'));
    db.asaasWebhookEvent.findUnique.mockResolvedValue({
      id: 'e5',
      eventType: 'PAYMENT_CONFIRMED',
      payload: { event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_x' } },
      status: 'received',
    });

    const proc = buildWebhookProcessor({
      db,
      handlers: { PAYMENT_CONFIRMED: handler },
    });
    const out = await proc.processOne('e5');

    expect(out.outcome).toBe('failed');
    expect(out.error).toBe('boom downstream');
    const updArg = db.asaasWebhookEvent.update.mock.calls[0][0];
    expect(updArg.data.status).toBe('failed');
    expect(updArg.data.lastError).toContain('boom');
  });

  it('idempotência: re-chamar com evento já processed retorna already_processed', async () => {
    const db = makeDb();
    db.asaasWebhookEvent.findUnique.mockResolvedValue({
      id: 'e6',
      eventType: 'PAYMENT_CONFIRMED',
      payload: { event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_x' } },
      status: 'processed',
    });
    const handler = jest.fn();
    const proc = buildWebhookProcessor({
      db,
      handlers: { PAYMENT_CONFIRMED: handler },
    });
    const out = await proc.processOne('e6');
    expect(out.outcome).toBe('already_processed');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('processBatch', () => {
  beforeEach(() => jest.clearAllMocks());

  it('processa N eventos pendentes e contabiliza outcomes', async () => {
    const db = makeDb();
    db.asaasWebhookEvent.findMany.mockResolvedValue([
      { id: 'a', eventType: 'PAYMENT_CREATED', payload: { event: 'PAYMENT_CREATED', payment: { id: 'p1' } }, status: 'received' },
      { id: 'b', eventType: 'CUSTOM_X', payload: { event: 'CUSTOM_X' }, status: 'received' },
      { id: 'c', eventType: 'PAYMENT_CREATED', payload: { event: 'PAYMENT_CREATED' }, status: 'received' },
    ]);

    const okHandler = jest.fn().mockResolvedValue(undefined);
    const proc = buildWebhookProcessor({
      db,
      handlers: { PAYMENT_CREATED: okHandler },
    });

    const result = await proc.processBatch();

    expect(result.total).toBe(3);
    expect(result.processed).toBe(1); // a
    expect(result.skipped).toBe(1); // b
    expect(result.failed).toBe(1); // c (NO_PAYMENT_ID)
    expect(okHandler).toHaveBeenCalledTimes(1);
  });

  it('batch vazio → contadores zerados, sem log barulhento', async () => {
    const db = makeDb();
    db.asaasWebhookEvent.findMany.mockResolvedValue([]);
    const proc = buildWebhookProcessor({ db });
    const result = await proc.processBatch();
    expect(result).toEqual({
      total: 0,
      processed: 0,
      skipped: 0,
      failed: 0,
      alreadyProcessed: 0,
    });
  });

  it('respeita batchSize na query', async () => {
    const db = makeDb();
    db.asaasWebhookEvent.findMany.mockResolvedValue([]);
    const proc = buildWebhookProcessor({ db, batchSize: 7 });
    await proc.processBatch();
    expect(db.asaasWebhookEvent.findMany.mock.calls[0][0].take).toBe(7);
    expect(db.asaasWebhookEvent.findMany.mock.calls[0][0].where).toEqual({
      status: 'received',
    });
  });
});

describe('buildWebhookProcessor — WebhookHandlerSpec (C5.0)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('handler com requiresPaymentId:false processa evento SEM payment.id', async () => {
    const db = makeDb();
    db.asaasWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt_sub',
      eventType: 'SUBSCRIPTION_UPDATED',
      payload: { event: 'SUBSCRIPTION_UPDATED', subscription: { id: 'sub_1' } },
      status: 'received',
    });

    const handler = jest.fn().mockResolvedValue(undefined);
    const proc = buildWebhookProcessor({
      db,
      handlers: {
        SUBSCRIPTION_UPDATED: { handler, requiresPaymentId: false },
      },
    });

    const out = await proc.processOne('evt_sub');

    expect(out.outcome).toBe('processed');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handler bare (sem spec) assume requiresPaymentId:true (back-compat C4)', async () => {
    const db = makeDb();
    db.asaasWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt_nop',
      eventType: 'LEGACY_X',
      payload: { event: 'LEGACY_X' }, // sem payment
      status: 'received',
    });

    const handler = jest.fn();
    const proc = buildWebhookProcessor({
      db,
      handlers: { LEGACY_X: handler },
    });

    const out = await proc.processOne('evt_nop');

    expect(out.outcome).toBe('failed');
    expect(out.error).toBe('NO_PAYMENT_ID');
    expect(handler).not.toHaveBeenCalled();
  });
});
