/**
 * C5.0 — tenant-billing-cache isolado.
 */

import {
  getCachedSubscription,
  setCachedSubscription,
  invalidateTenantBillingCache,
  __resetCacheForTests,
} from '../../services/billing/tenant-billing-cache';

describe('tenant-billing-cache', () => {
  beforeEach(() => __resetCacheForTests());

  it('set/get retorna o valor gravado', () => {
    setCachedSubscription('t1', 'active');
    const entry = getCachedSubscription('t1');
    expect(entry?.status).toBe('active');
  });

  it('expira após TTL (60s)', () => {
    const realNow = Date.now;
    try {
      setCachedSubscription('t1', 'active');
      // avança 61s
      const base = realNow();
      (Date as any).now = () => base + 61_000;
      expect(getCachedSubscription('t1')).toBeUndefined();
    } finally {
      (Date as any).now = realNow;
    }
  });

  it('invalidateTenantBillingCache remove entrada', () => {
    setCachedSubscription('t1', 'active');
    invalidateTenantBillingCache('t1');
    expect(getCachedSubscription('t1')).toBeUndefined();
  });

  it('invalidate isola tenants (t2 não afetado por invalidar t1)', () => {
    setCachedSubscription('t1', 'active');
    setCachedSubscription('t2', 'suspended');
    invalidateTenantBillingCache('t1');
    expect(getCachedSubscription('t1')).toBeUndefined();
    expect(getCachedSubscription('t2')?.status).toBe('suspended');
  });
});
