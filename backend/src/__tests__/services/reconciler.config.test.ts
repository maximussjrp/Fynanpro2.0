/**
 * C5.4 — reconciler.config tests
 */

import {
  readReconcilerConfigFromEnv,
  assertAutofixAllowed,
  ReconcilerAutofixGuardError,
} from '../../services/asaas/reconciler.config';

describe('readReconcilerConfigFromEnv', () => {
  it('defaults seguros: tudo OFF em shadow mode', () => {
    const cfg = readReconcilerConfigFromEnv({});
    expect(cfg.enabled).toBe(false);
    expect(cfg.autofixAllowed).toBe(false);
    expect(cfg.mode).toBe('shadow');
    expect(cfg.intervalMin).toBe(15);
    expect(cfg.batchSize).toBe(50);
    expect(cfg.tenantAllowlist).toEqual([]);
    expect(cfg.inSyncSampling).toBeCloseTo(0.01);
    expect(cfg.concurrency).toBe(5);
  });

  it('parse mode=dryrun', () => {
    const cfg = readReconcilerConfigFromEnv({ FF_ASAAS_RECONCILER_MODE: 'dryrun' });
    expect(cfg.mode).toBe('dryrun');
  });

  it('mode inválido cai para shadow (fail-safe)', () => {
    const cfg = readReconcilerConfigFromEnv({ FF_ASAAS_RECONCILER_MODE: 'nuke' });
    expect(cfg.mode).toBe('shadow');
  });

  it('inSyncSampling configurável via env (exigência 1)', () => {
    const cfg = readReconcilerConfigFromEnv({
      FF_ASAAS_RECONCILER_IN_SYNC_SAMPLING: '0.25',
    });
    expect(cfg.inSyncSampling).toBeCloseTo(0.25);
  });

  it('inSyncSampling clampa em [0,1]', () => {
    expect(readReconcilerConfigFromEnv({ FF_ASAAS_RECONCILER_IN_SYNC_SAMPLING: '-1' }).inSyncSampling).toBe(0);
    expect(readReconcilerConfigFromEnv({ FF_ASAAS_RECONCILER_IN_SYNC_SAMPLING: '5' }).inSyncSampling).toBe(1);
  });

  it('tenantAllowlist CSV trim', () => {
    const cfg = readReconcilerConfigFromEnv({
      FF_ASAAS_RECONCILER_TENANT_ALLOWLIST: ' t1 , t2,,t3 ',
    });
    expect(cfg.tenantAllowlist).toEqual(['t1', 't2', 't3']);
  });

  it('batchSize clampa em [1,500]', () => {
    expect(readReconcilerConfigFromEnv({ FF_ASAAS_RECONCILER_BATCH_SIZE: '0' }).batchSize).toBe(1);
    expect(readReconcilerConfigFromEnv({ FF_ASAAS_RECONCILER_BATCH_SIZE: '10000' }).batchSize).toBe(500);
  });
});

describe('assertAutofixAllowed — startup guard (exigência 2)', () => {
  it('shadow sem autofix OK', () => {
    expect(() =>
      assertAutofixAllowed(
        readReconcilerConfigFromEnv({ FF_ASAAS_RECONCILER_MODE: 'shadow' }),
      ),
    ).not.toThrow();
  });

  it('dryrun sem autofix OK', () => {
    expect(() =>
      assertAutofixAllowed(
        readReconcilerConfigFromEnv({ FF_ASAAS_RECONCILER_MODE: 'dryrun' }),
      ),
    ).not.toThrow();
  });

  it('autofix + autofixAllowed=true OK', () => {
    expect(() =>
      assertAutofixAllowed(
        readReconcilerConfigFromEnv({
          FF_ASAAS_RECONCILER_MODE: 'autofix',
          FF_ASAAS_RECONCILER_AUTOFIX: 'true',
        }),
      ),
    ).not.toThrow();
  });

  it('autofix sem FF_ASAAS_RECONCILER_AUTOFIX ⇒ LANÇA ReconcilerAutofixGuardError', () => {
    const cfg = readReconcilerConfigFromEnv({
      FF_ASAAS_RECONCILER_MODE: 'autofix',
      // autofix explicitamente NÃO ligado
    });
    expect(() => assertAutofixAllowed(cfg)).toThrow(ReconcilerAutofixGuardError);
    expect(() => assertAutofixAllowed(cfg)).toThrow(/autofix/i);
  });

  it('autofix=false (string) também bloqueia', () => {
    const cfg = readReconcilerConfigFromEnv({
      FF_ASAAS_RECONCILER_MODE: 'autofix',
      FF_ASAAS_RECONCILER_AUTOFIX: 'false',
    });
    expect(() => assertAutofixAllowed(cfg)).toThrow(ReconcilerAutofixGuardError);
  });
});
