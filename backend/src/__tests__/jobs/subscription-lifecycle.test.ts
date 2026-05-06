/**
 * UTOP Reliability Sprint 3 — testes do subscription-lifecycle job.
 *
 * Valida as 3 transições fora do middleware:
 *   1. Trial expirado → tenant suspended
 *   2. past_due > grace → suspended
 *   3. Cancelamento agendado + period passou → cancelled
 *
 * Mock manual de PrismaClient (sem banco real).
 */

import { buildSubscriptionLifecycleJob } from '../../jobs/subscription-lifecycle.job';

function makeMockDb() {
  const state: any = {
    tenants: [] as any[],
    subscriptions: [] as any[],
  };

  const txProxy = {
    tenant: {
      findUnique: ({ where }: any) =>
        Promise.resolve(state.tenants.find((t: any) => t.id === where.id) ?? null),
      update: ({ where, data }: any) => {
        const t = state.tenants.find((x: any) => x.id === where.id);
        if (t) Object.assign(t, data);
        return Promise.resolve(t);
      },
    },
    subscription: {
      findUnique: ({ where }: any) =>
        Promise.resolve(state.subscriptions.find((s: any) => s.id === where.id) ?? null),
      update: ({ where, data }: any) => {
        const s = state.subscriptions.find((x: any) => x.id === where.id);
        if (s) Object.assign(s, data);
        return Promise.resolve(s);
      },
    },
  };

  const db: any = {
    tenant: {
      findMany: ({ where }: any) => {
        const t = where.trialEndsAt?.lt;
        return Promise.resolve(
          state.tenants.filter((x: any) => {
            if (where.deletedAt === null && x.deletedAt) return false;
            if (where.subscriptionPlan && x.subscriptionPlan !== where.subscriptionPlan) return false;
            if (where.subscriptionStatus && x.subscriptionStatus !== where.subscriptionStatus) return false;
            if (t && (!x.trialEndsAt || x.trialEndsAt >= t)) return false;
            return true;
          }),
        );
      },
    },
    subscription: {
      findMany: ({ where }: any) => {
        return Promise.resolve(
          state.subscriptions.filter((x: any) => {
            if (where.status && x.status !== where.status) return false;
            if (where.cancelledAt?.not === null && !x.cancelledAt) return false;
            if (where.currentPeriodEnd?.lt && (!x.currentPeriodEnd || x.currentPeriodEnd >= where.currentPeriodEnd.lt)) return false;
            if (where.OR) {
              const any = where.OR.some((cond: any) => {
                if (cond.lastAsaasEventAt?.lt && x.lastAsaasEventAt && x.lastAsaasEventAt < cond.lastAsaasEventAt.lt) return true;
                if (cond.lastAsaasEventAt === null && x.lastAsaasEventAt == null
                    && cond.updatedAt?.lt && x.updatedAt < cond.updatedAt.lt) return true;
                return false;
              });
              if (!any) return false;
            }
            return true;
          }),
        );
      },
    },
    $transaction: async (fn: any) => fn(txProxy),
  };

  return { db, state };
}

describe('subscription-lifecycle job', () => {
  describe('expireTrials', () => {
    it('flipa subscriptionStatus de active para suspended quando trial venceu', async () => {
      const { db, state } = makeMockDb();
      const now = new Date('2026-05-06T12:00:00Z');
      state.tenants.push({
        id: 't1',
        subscriptionPlan: 'trial',
        subscriptionStatus: 'active',
        trialEndsAt: new Date('2026-05-05T00:00:00Z'),
        deletedAt: null,
      });

      const job = buildSubscriptionLifecycleJob({ db, now: () => now, invalidateCache: () => {} });
      const r = await job.expireTrials();
      expect(r.expired).toBe(1);
      expect(state.tenants[0].subscriptionStatus).toBe('suspended');
    });

    it('NÃO flipa se trial ainda válido', async () => {
      const { db, state } = makeMockDb();
      const now = new Date('2026-05-06T12:00:00Z');
      state.tenants.push({
        id: 't2',
        subscriptionPlan: 'trial',
        subscriptionStatus: 'active',
        trialEndsAt: new Date('2026-05-10T00:00:00Z'),
        deletedAt: null,
      });
      const job = buildSubscriptionLifecycleJob({ db, now: () => now, invalidateCache: () => {} });
      const r = await job.expireTrials();
      expect(r.expired).toBe(0);
      expect(state.tenants[0].subscriptionStatus).toBe('active');
    });

    it('idempotente: 2ª execução não re-expira', async () => {
      const { db, state } = makeMockDb();
      const now = new Date('2026-05-06T12:00:00Z');
      state.tenants.push({
        id: 't3',
        subscriptionPlan: 'trial',
        subscriptionStatus: 'active',
        trialEndsAt: new Date('2026-05-05T00:00:00Z'),
        deletedAt: null,
      });
      const job = buildSubscriptionLifecycleJob({ db, now: () => now, invalidateCache: () => {} });
      await job.expireTrials();
      const r2 = await job.expireTrials();
      expect(r2.expired).toBe(0);
    });
  });

  describe('suspendPastDue', () => {
    it('flipa para suspended após grace de 3 dias', async () => {
      const { db, state } = makeMockDb();
      const now = new Date('2026-05-10T12:00:00Z');
      state.tenants.push({ id: 't4', subscriptionStatus: 'past_due' });
      state.subscriptions.push({
        id: 's4',
        tenantId: 't4',
        status: 'past_due',
        lastAsaasEventAt: new Date('2026-05-06T00:00:00Z'), // 4 dias atrás
        updatedAt: new Date('2026-05-06T00:00:00Z'),
      });
      const job = buildSubscriptionLifecycleJob({ db, now: () => now, invalidateCache: () => {} });
      const r = await job.suspendPastDue();
      expect(r.suspended).toBe(1);
      expect(state.subscriptions[0].status).toBe('suspended');
      expect(state.tenants[0].subscriptionStatus).toBe('suspended');
    });

    it('NÃO flipa dentro do grace', async () => {
      const { db, state } = makeMockDb();
      const now = new Date('2026-05-08T12:00:00Z'); // 2 dias atrás → dentro de 3
      state.tenants.push({ id: 't5', subscriptionStatus: 'past_due' });
      state.subscriptions.push({
        id: 's5',
        tenantId: 't5',
        status: 'past_due',
        lastAsaasEventAt: new Date('2026-05-06T00:00:00Z'),
        updatedAt: new Date('2026-05-06T00:00:00Z'),
      });
      const job = buildSubscriptionLifecycleJob({ db, now: () => now, invalidateCache: () => {} });
      const r = await job.suspendPastDue();
      expect(r.suspended).toBe(0);
      expect(state.subscriptions[0].status).toBe('past_due');
    });
  });

  describe('closeScheduledCancellations', () => {
    it('flipa para cancelled quando currentPeriodEnd venceu', async () => {
      const { db, state } = makeMockDb();
      const now = new Date('2026-06-15T12:00:00Z');
      state.tenants.push({ id: 't6', subscriptionStatus: 'active' });
      state.subscriptions.push({
        id: 's6',
        tenantId: 't6',
        status: 'active',
        cancelledAt: new Date('2026-05-20T00:00:00Z'),
        currentPeriodEnd: new Date('2026-06-10T00:00:00Z'), // já passou
      });
      const job = buildSubscriptionLifecycleJob({ db, now: () => now, invalidateCache: () => {} });
      const r = await job.closeScheduledCancellations();
      expect(r.closed).toBe(1);
      expect(state.subscriptions[0].status).toBe('cancelled');
      expect(state.tenants[0].subscriptionStatus).toBe('cancelled');
    });

    it('preserva acesso enquanto period está vigente', async () => {
      const { db, state } = makeMockDb();
      const now = new Date('2026-05-25T12:00:00Z');
      state.tenants.push({ id: 't7', subscriptionStatus: 'active' });
      state.subscriptions.push({
        id: 's7',
        tenantId: 't7',
        status: 'active',
        cancelledAt: new Date('2026-05-20T00:00:00Z'),
        currentPeriodEnd: new Date('2026-06-10T00:00:00Z'), // ainda no futuro
      });
      const job = buildSubscriptionLifecycleJob({ db, now: () => now, invalidateCache: () => {} });
      const r = await job.closeScheduledCancellations();
      expect(r.closed).toBe(0);
      expect(state.subscriptions[0].status).toBe('active');
      expect(state.tenants[0].subscriptionStatus).toBe('active');
    });
  });

  describe('runOnce', () => {
    it('agrega estatísticas das 3 transições', async () => {
      const { db } = makeMockDb();
      const now = new Date('2026-05-10T12:00:00Z');
      const job = buildSubscriptionLifecycleJob({ db, now: () => now, invalidateCache: () => {} });
      const stats = await job.runOnce();
      expect(stats).toEqual({
        trialsExpired: 0,
        pastDueSuspended: 0,
        cancellationsClosed: 0,
        failures: 0,
      });
    });
  });
});
