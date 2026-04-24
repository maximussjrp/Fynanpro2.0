/**
 * C5.4 — reconciler.service tests (unit, sem DB real)
 *
 * Cobre:
 *   - classifyFinding: matriz completa local×remoto
 *   - filterForPersistence: amostragem IN_SYNC + modos
 *   - runReconcilerOnce: orquestração, contadores, persistência por modo,
 *     filtro billingSource (exigência 3), erros Asaas, run.status.
 */

import {
  classifyFinding,
  filterForPersistence,
  runReconcilerOnce,
  getLastSuccessfulRunAt,
} from '../../services/asaas/reconciler.service';
import type { ReconcilerConfig } from '../../services/asaas/reconciler.config';

const baseCfg: ReconcilerConfig = {
  enabled: true,
  autofixAllowed: false,
  mode: 'dryrun',
  intervalMin: 15,
  batchSize: 50,
  tenantAllowlist: [],
  inSyncSampling: 0.01,
  concurrency: 1,
  minIntervalMs: 0,
  rateLimitMaxRetries: 2,
  rateLimitBackoffBaseMs: 10,
};

const NOW = new Date('2026-05-01T12:00:00.000Z');

describe('classifyFinding (C5.4)', () => {
  const base = { now: NOW, lastAsaasEventAt: NOW };

  it('active + remote ACTIVE → IN_SYNC', () => {
    expect(
      classifyFinding({
        ...base,
        localStatus: 'active',
        remote: { status: 'ACTIVE' },
      }),
    ).toBe('IN_SYNC');
  });

  it('active + remote EXPIRED → LOCAL_ACTIVE_REMOTE_EXPIRED', () => {
    expect(
      classifyFinding({
        ...base,
        localStatus: 'active',
        remote: { status: 'EXPIRED' },
      }),
    ).toBe('LOCAL_ACTIVE_REMOTE_EXPIRED');
  });

  it('active + remote INACTIVE → LOCAL_ACTIVE_REMOTE_INACTIVE', () => {
    expect(
      classifyFinding({
        ...base,
        localStatus: 'active',
        remote: { status: 'INACTIVE' },
      }),
    ).toBe('LOCAL_ACTIVE_REMOTE_INACTIVE');
  });

  it('active + remote DELETED (not_found) → REMOTE_NOT_FOUND', () => {
    expect(
      classifyFinding({
        ...base,
        localStatus: 'active',
        remote: 'not_found',
      }),
    ).toBe('REMOTE_NOT_FOUND');
  });

  it('past_due + remote ACTIVE → LOCAL_PAST_DUE_REMOTE_ACTIVE (crítico C5.3)', () => {
    expect(
      classifyFinding({
        ...base,
        localStatus: 'past_due',
        remote: { status: 'ACTIVE' },
      }),
    ).toBe('LOCAL_PAST_DUE_REMOTE_ACTIVE');
  });

  it('past_due + remote EXPIRED → IN_SYNC', () => {
    expect(
      classifyFinding({
        ...base,
        localStatus: 'past_due',
        remote: { status: 'EXPIRED' },
      }),
    ).toBe('IN_SYNC');
  });

  it('suspended + remote ACTIVE → LOCAL_SUSPENDED_REMOTE_ACTIVE (crítico C5.3)', () => {
    expect(
      classifyFinding({
        ...base,
        localStatus: 'suspended',
        remote: { status: 'ACTIVE' },
      }),
    ).toBe('LOCAL_SUSPENDED_REMOTE_ACTIVE');
  });

  it('cancelled + remote ACTIVE → LOCAL_CANCELLED_REMOTE_ACTIVE', () => {
    expect(
      classifyFinding({
        ...base,
        localStatus: 'cancelled',
        remote: { status: 'ACTIVE' },
      }),
    ).toBe('LOCAL_CANCELLED_REMOTE_ACTIVE');
  });

  it('cancelled + remote not_found → IN_SYNC (terminal consistente)', () => {
    expect(
      classifyFinding({
        ...base,
        localStatus: 'cancelled',
        remote: 'not_found',
      }),
    ).toBe('IN_SYNC');
  });

  it('active + remote ACTIVE + pagamento recente remoto > lastAsaasEventAt → PAYMENT_LAG', () => {
    const oldLocal = new Date(NOW.getTime() - 48 * 3600 * 1000);
    const recentRemote = new Date(NOW.getTime() - 2 * 3600 * 1000);
    expect(
      classifyFinding({
        now: NOW,
        lastAsaasEventAt: oldLocal,
        localStatus: 'active',
        remote: {
          status: 'ACTIVE',
          lastPaymentStatus: 'RECEIVED',
          lastPaymentDate: recentRemote,
        },
      }),
    ).toBe('PAYMENT_LAG');
  });

  it('active + remote UNEXPECTED status → UNKNOWN_REMOTE_STATUS', () => {
    expect(
      classifyFinding({
        ...base,
        localStatus: 'active',
        remote: { status: 'FROZEN' },
      }),
    ).toBe('UNKNOWN_REMOTE_STATUS');
  });
});

describe('filterForPersistence (C5.4)', () => {
  const draft = (kind: string) =>
    ({
      tenantId: 't1',
      subscriptionId: 's1',
      asaasSubscriptionId: 'a1',
      kind: kind as any,
      localStatus: 'active',
      remoteStatus: 'ACTIVE',
      remoteLastPaymentStatus: null,
      remoteLastPaymentDate: null,
      detail: null,
    }) as any;

  it('shadow: descarta findings ≠ IN_SYNC, persiste IN_SYNC conforme amostragem', () => {
    const cfg = { ...baseCfg, mode: 'shadow' as const, inSyncSampling: 1.0 };
    const drafts = [
      draft('IN_SYNC'),
      draft('LOCAL_ACTIVE_REMOTE_EXPIRED'),
      draft('REMOTE_NOT_FOUND'),
    ];
    const out = filterForPersistence(drafts, cfg, () => 0);
    expect(out.map((d) => d.kind)).toEqual(['IN_SYNC']);
  });

  it('shadow + sampling=0 → nada persiste', () => {
    const cfg = { ...baseCfg, mode: 'shadow' as const, inSyncSampling: 0 };
    const out = filterForPersistence(
      [draft('IN_SYNC'), draft('IN_SYNC')],
      cfg,
      () => 0.001, // abaixo de 0.01 mas sampling=0 → Math.random() < 0 false
    );
    // sampling=0 ⇒ Math.random() < 0 nunca verdadeiro
    expect(out.length).toBe(0);
  });

  it('dryrun: persiste tudo, IN_SYNC amostrado', () => {
    const cfg = { ...baseCfg, mode: 'dryrun' as const, inSyncSampling: 0 };
    const drafts = [
      draft('IN_SYNC'), // será descartado
      draft('LOCAL_ACTIVE_REMOTE_EXPIRED'),
      draft('REMOTE_NOT_FOUND'),
    ];
    const out = filterForPersistence(drafts, cfg, () => 0.5);
    expect(out.map((d) => d.kind).sort()).toEqual(
      ['LOCAL_ACTIVE_REMOTE_EXPIRED', 'REMOTE_NOT_FOUND'].sort(),
    );
  });

  it('dryrun + sampling=1.0 → tudo persiste, incluindo IN_SYNC', () => {
    const cfg = { ...baseCfg, mode: 'dryrun' as const, inSyncSampling: 1.0 };
    const out = filterForPersistence(
      [draft('IN_SYNC'), draft('LOCAL_ACTIVE_REMOTE_EXPIRED')],
      cfg,
      () => 0,
    );
    expect(out.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// runReconcilerOnce — orquestração
// ---------------------------------------------------------------------------

function makeDb() {
  return {
    reconciliationRun: {
      create: jest.fn().mockResolvedValue({ id: 'run_1', startedAt: NOW }),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn(),
    },
    reconciliationFinding: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    subscription: {
      findMany: jest.fn(),
    },
  } as any;
}

function makeAsaas(overrides: Partial<Record<string, any>> = {}) {
  return {
    getSubscription: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
    request: jest.fn().mockResolvedValue({ data: [] }),
    ...overrides,
  } as any;
}

describe('runReconcilerOnce — orquestração e filtro billingSource', () => {
  beforeEach(() => jest.clearAllMocks());

  it('aplica filtro Tenant.billingSource="asaas" por padrão (exigência 3)', async () => {
    const db = makeDb();
    db.subscription.findMany.mockResolvedValue([]);
    const asaas = makeAsaas();

    await runReconcilerOnce({ db, asaas, config: baseCfg, now: () => NOW });

    const where = db.subscription.findMany.mock.calls[0][0].where;
    expect(where.provider).toBe('asaas');
    expect(where.tenant).toEqual({ billingSource: 'asaas' });
  });

  it('testBypassBillingSourceFilter=true remove filtro (reservado para testes)', async () => {
    const db = makeDb();
    db.subscription.findMany.mockResolvedValue([]);
    const asaas = makeAsaas();

    await runReconcilerOnce({
      db,
      asaas,
      config: baseCfg,
      now: () => NOW,
      testBypassBillingSourceFilter: true,
    });

    const where = db.subscription.findMany.mock.calls[0][0].where;
    expect(where.tenant).toBeUndefined();
  });

  it('aplica tenantAllowlist quando não vazio', async () => {
    const db = makeDb();
    db.subscription.findMany.mockResolvedValue([]);
    await runReconcilerOnce({
      db,
      asaas: makeAsaas(),
      config: { ...baseCfg, tenantAllowlist: ['t1', 't2'] },
      now: () => NOW,
    });
    const where = db.subscription.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toEqual({ in: ['t1', 't2'] });
  });

  it('happy path dryrun: persiste findings ≠ IN_SYNC e fecha run como success', async () => {
    const db = makeDb();
    db.subscription.findMany.mockResolvedValue([
      {
        id: 'sub_1',
        tenantId: 't1',
        status: 'active',
        asaasSubscriptionId: 'a1',
        lastAsaasEventAt: NOW,
        currentPeriodEnd: NOW,
      },
    ]);
    const asaas = makeAsaas({
      getSubscription: jest.fn().mockResolvedValue({ status: 'EXPIRED' }),
    });

    const result = await runReconcilerOnce({
      db,
      asaas,
      config: baseCfg,
      now: () => NOW,
      random: () => 0.99, // evita amostrar IN_SYNC acidentalmente
    });

    expect(result.status).toBe('success');
    expect(result.subscriptionsScanned).toBe(1);
    expect(result.findingsCount).toBe(1);
    expect(db.reconciliationFinding.createMany).toHaveBeenCalledTimes(1);
    const persisted = db.reconciliationFinding.createMany.mock.calls[0][0].data;
    expect(persisted[0].kind).toBe('LOCAL_ACTIVE_REMOTE_EXPIRED');
    // apiCalls: 1 getSubscription + 1 listPayments
    expect(result.asaasApiCalls).toBe(2);
    // run.update foi chamada com status=success, finishedAt preenchido
    expect(db.reconciliationRun.update).toHaveBeenCalledTimes(1);
    const upd = db.reconciliationRun.update.mock.calls[0][0];
    expect(upd.data.status).toBe('success');
    expect(upd.data.finishedAt).toBeInstanceOf(Date);
  });

  it('modo shadow: findings ≠ IN_SYNC NÃO são persistidos, mas contam no drafts', async () => {
    const db = makeDb();
    db.subscription.findMany.mockResolvedValue([
      {
        id: 'sub_1',
        tenantId: 't1',
        status: 'active',
        asaasSubscriptionId: 'a1',
        lastAsaasEventAt: NOW,
        currentPeriodEnd: NOW,
      },
    ]);
    const asaas = makeAsaas({
      getSubscription: jest.fn().mockResolvedValue({ status: 'EXPIRED' }),
    });

    const result = await runReconcilerOnce({
      db,
      asaas,
      config: { ...baseCfg, mode: 'shadow' },
      now: () => NOW,
      random: () => 0.99,
    });

    expect(result.status).toBe('success');
    expect(result.findingsCount).toBe(1); // contado no run.findingsCount
    expect(db.reconciliationFinding.createMany).not.toHaveBeenCalled();
  });

  it('erro 429 rate limit conta em asaasRateLimitHits e promove status=partial', async () => {
    const db = makeDb();
    db.subscription.findMany.mockResolvedValue([
      {
        id: 'sub_1',
        tenantId: 't1',
        status: 'active',
        asaasSubscriptionId: 'a1',
        lastAsaasEventAt: NOW,
        currentPeriodEnd: NOW,
      },
    ]);
    const err429 = Object.assign(new Error('429'), { status: 429 });
    const asaas = makeAsaas({
      getSubscription: jest.fn().mockRejectedValue(err429),
    });

    const result = await runReconcilerOnce({
      db,
      asaas,
      config: { ...baseCfg, rateLimitMaxRetries: 2, rateLimitBackoffBaseMs: 1 },
      now: () => NOW,
      random: () => 0.99,
    });

    expect(result.asaasRateLimitHits).toBeGreaterThanOrEqual(1);
    expect(result.status).toBe('partial');
  });

  it('404 Asaas → REMOTE_NOT_FOUND, run continua success', async () => {
    const db = makeDb();
    db.subscription.findMany.mockResolvedValue([
      {
        id: 'sub_1',
        tenantId: 't1',
        status: 'active',
        asaasSubscriptionId: 'a1',
        lastAsaasEventAt: NOW,
        currentPeriodEnd: NOW,
      },
    ]);
    const err404 = Object.assign(new Error('404'), { status: 404 });
    const asaas = makeAsaas({
      getSubscription: jest.fn().mockRejectedValue(err404),
    });

    const result = await runReconcilerOnce({
      db,
      asaas,
      config: baseCfg,
      now: () => NOW,
      random: () => 0.99,
    });

    expect(result.status).toBe('success');
    expect(db.reconciliationFinding.createMany).toHaveBeenCalledTimes(1);
    const persisted = db.reconciliationFinding.createMany.mock.calls[0][0].data;
    expect(persisted[0].kind).toBe('REMOTE_NOT_FOUND');
  });

  it('subscription local sem asaasSubscriptionId → LOCAL_NOT_FOUND', async () => {
    const db = makeDb();
    db.subscription.findMany.mockResolvedValue([
      {
        id: 'sub_1',
        tenantId: 't1',
        status: 'active',
        asaasSubscriptionId: null,
        lastAsaasEventAt: null,
        currentPeriodEnd: null,
      },
    ]);
    const asaas = makeAsaas();

    const result = await runReconcilerOnce({
      db,
      asaas,
      config: baseCfg,
      now: () => NOW,
      random: () => 0.99,
    });

    expect(result.status).toBe('success');
    expect(asaas.getSubscription).not.toHaveBeenCalled();
    const persisted = db.reconciliationFinding.createMany.mock.calls[0][0].data;
    expect(persisted[0].kind).toBe('LOCAL_NOT_FOUND');
  });
});

describe('getLastSuccessfulRunAt (sinal para gate C5.3)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna finishedAt mais recente de run success em modo dryrun/autofix', async () => {
    const db = makeDb();
    const when = new Date('2026-05-01T10:00:00Z');
    db.reconciliationRun.findFirst.mockResolvedValue({ finishedAt: when });

    const out = await getLastSuccessfulRunAt(db);
    expect(out).toEqual(when);

    const args = db.reconciliationRun.findFirst.mock.calls[0][0];
    expect(args.where.status).toBe('success');
    expect(args.where.mode).toEqual({ in: ['dryrun', 'autofix'] });
  });

  it('sem runs success → null', async () => {
    const db = makeDb();
    db.reconciliationRun.findFirst.mockResolvedValue(null);
    const out = await getLastSuccessfulRunAt(db);
    expect(out).toBeNull();
  });
});
