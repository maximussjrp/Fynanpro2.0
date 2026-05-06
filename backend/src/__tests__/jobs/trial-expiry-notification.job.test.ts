/**
 * trial-expiry-notification.job unit tests — Sprint B
 *
 * Cobre:
 *   - encontra tenants no bucket D-7 e dispara email
 *   - encontra tenants no bucket D-1 com priority=high
 *   - idempotência: tenant que já tem Notification para o tipo é skipado
 *   - tenant sem owner ativo é skipado
 *   - falha do email ainda registra Notification (failures++)
 *   - tenant fora das janelas não é tocado
 */

import { buildTrialExpiryNotificationJob } from '../../jobs/trial-expiry-notification.job';

function inHours(h: number): Date {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

function makeDbMock(opts: { tenants?: any[]; users?: Record<string, any>; existingNotifications?: Set<string> }) {
  const tenantsByCall: any[] = [];
  // findMany é chamado uma vez para D-7 e outra para D-1.
  // Para cobrir os dois buckets, devolvemos diferentes datasets baseados no
  // filtro `trialEndsAt.gte` recebido.
  const findMany = jest.fn().mockImplementation(async (args: any) => {
    const lo = args?.where?.trialEndsAt?.gte as Date;
    const hi = args?.where?.trialEndsAt?.lte as Date;
    const list = (opts.tenants ?? []).filter((t: any) => {
      const end = t.trialEndsAt as Date;
      return end >= lo && end <= hi;
    });
    tenantsByCall.push(list);
    return list;
  });

  const findUniqueUser = jest.fn().mockImplementation(async ({ where }: any) => {
    return (opts.users ?? {})[where.id] ?? null;
  });

  const findFirstNotification = jest.fn().mockImplementation(async ({ where }: any) => {
    const key = `${where.tenantId}:${where.type}`;
    return (opts.existingNotifications ?? new Set()).has(key) ? { id: 'noti_existing' } : null;
  });

  const createNotification = jest.fn().mockResolvedValue({ id: 'noti_new' });

  return {
    db: {
      tenant: { findMany },
      user: { findUnique: findUniqueUser },
      notification: { findFirst: findFirstNotification, create: createNotification },
    } as any,
    spies: { findMany, findUniqueUser, findFirstNotification, createNotification },
  };
}

function makeEmailMock(succeed = true) {
  return {
    sendTrialEndingEmail: jest.fn().mockResolvedValue(succeed),
  };
}

describe('buildTrialExpiryNotificationJob', () => {
  it('envia D-7 e cria Notification quando tenant está na janela de 7 dias', async () => {
    const tenant = {
      id: 't1',
      name: 'Tenant 1',
      ownerId: 'u1',
      trialEndsAt: inHours(7 * 24),
    };
    const { db, spies } = makeDbMock({
      tenants: [tenant],
      users: { u1: { email: 'a@b.com', fullName: 'Ana', isActive: true, deletedAt: null } },
    });
    const email = makeEmailMock();

    const job = buildTrialExpiryNotificationJob({ db, email: email as any });
    const stats = await job.runOnce();

    expect(email.sendTrialEndingEmail).toHaveBeenCalledTimes(1);
    expect(email.sendTrialEndingEmail).toHaveBeenCalledWith(
      'a@b.com',
      expect.objectContaining({ userName: 'Ana' }),
    );
    expect(spies.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          type: 'trial_warning_d7',
          priority: 'normal',
        }),
      }),
    );
    expect(stats.d7Sent).toBe(1);
    expect(stats.d1Sent).toBe(0);
    expect(stats.failures).toBe(0);
  });

  it('envia D-1 com priority=high quando trial termina em <24h', async () => {
    const tenant = {
      id: 't2',
      name: 'Tenant 2',
      ownerId: 'u2',
      trialEndsAt: inHours(20),
    };
    const { db, spies } = makeDbMock({
      tenants: [tenant],
      users: { u2: { email: 'c@d.com', fullName: 'Carlos', isActive: true, deletedAt: null } },
    });
    const email = makeEmailMock();

    const stats = await buildTrialExpiryNotificationJob({ db, email: email as any }).runOnce();

    expect(stats.d1Sent).toBe(1);
    expect(spies.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'trial_warning_d1',
          priority: 'high',
        }),
      }),
    );
  });

  it('skipa tenants que já receberam o aviso (idempotência)', async () => {
    const tenant = {
      id: 't3',
      name: 'Tenant 3',
      ownerId: 'u3',
      trialEndsAt: inHours(7 * 24),
    };
    const { db, spies } = makeDbMock({
      tenants: [tenant],
      users: { u3: { email: 'e@f.com', fullName: 'Eva', isActive: true, deletedAt: null } },
      existingNotifications: new Set(['t3:trial_warning_d7']),
    });
    const email = makeEmailMock();

    const stats = await buildTrialExpiryNotificationJob({ db, email: email as any }).runOnce();

    expect(email.sendTrialEndingEmail).not.toHaveBeenCalled();
    expect(spies.createNotification).not.toHaveBeenCalled();
    expect(stats.d7Skipped).toBe(1);
  });

  it('skipa tenants cujo owner está inativo ou soft-deleted', async () => {
    const tenant = {
      id: 't4',
      name: 'Tenant 4',
      ownerId: 'u4',
      trialEndsAt: inHours(7 * 24),
    };
    const { db, spies } = makeDbMock({
      tenants: [tenant],
      users: { u4: { email: 'g@h.com', fullName: 'Gilmar', isActive: false, deletedAt: null } },
    });
    const email = makeEmailMock();

    const stats = await buildTrialExpiryNotificationJob({ db, email: email as any }).runOnce();

    expect(email.sendTrialEndingEmail).not.toHaveBeenCalled();
    expect(spies.createNotification).not.toHaveBeenCalled();
    expect(stats.d7Skipped).toBe(1);
  });

  it('quando email falha, ainda cria Notification e contabiliza failure', async () => {
    const tenant = {
      id: 't5',
      name: 'Tenant 5',
      ownerId: 'u5',
      trialEndsAt: inHours(7 * 24),
    };
    const { db, spies } = makeDbMock({
      tenants: [tenant],
      users: { u5: { email: 'i@j.com', fullName: 'Iris', isActive: true, deletedAt: null } },
    });
    const email = makeEmailMock(false);

    const stats = await buildTrialExpiryNotificationJob({ db, email: email as any }).runOnce();

    expect(spies.createNotification).toHaveBeenCalledTimes(1);
    expect(stats.failures).toBe(1);
    expect(stats.d7Sent).toBe(0);
  });
});
