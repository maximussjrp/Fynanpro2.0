/**
 * billing-summary.service unit tests — Sprint B
 *
 * Cobre:
 *   - tenant em trial com X dias restantes → severity correta
 *   - tenant ativo com subscription → headline "Assinatura ativa"
 *   - tenant suspended → severity red + cta retry
 *   - tenant cancelled → severity red + cta upgrade
 *   - tenant não encontrado → throw
 *   - integração com lastPayment (paymentStatus failed → red retry)
 */

import { buildBillingSummaryService } from '../../../services/billing/billing-summary.service';

function makeDbMock(overrides: Partial<{ tenant: any; subscription: any; lastPayment: any }> = {}) {
  return {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(overrides.tenant ?? null),
    },
    subscription: {
      findFirst: jest.fn().mockResolvedValue(overrides.subscription ?? null),
    },
    paymentRecord: {
      findFirst: jest.fn().mockResolvedValue(overrides.lastPayment ?? null),
    },
  } as any;
}

describe('buildBillingSummaryService', () => {
  describe('trial', () => {
    it('retorna severity amber para trial com >7 dias', async () => {
      const future = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      const db = makeDbMock({
        tenant: {
          id: 't1',
          subscriptionPlan: 'trial',
          subscriptionStatus: 'active',
          billingSource: null,
          trialEndsAt: future,
        },
      });
      const svc = buildBillingSummaryService({ db });
      const out = await svc.getSummary('t1');

      expect(out.isTrial).toBe(true);
      expect(out.trialDaysRemaining).toBeGreaterThanOrEqual(14);
      expect(out.ui.severity).toBe('amber');
      expect(out.ui.cta).toBe('upgrade');
      expect(out.subscription).toBeNull();
      expect(out.lastPayment).toBeNull();
    });

    it('retorna severity orange para trial entre 4-7 dias', async () => {
      const future = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
      const db = makeDbMock({
        tenant: {
          id: 't2',
          subscriptionPlan: 'trial',
          subscriptionStatus: 'active',
          billingSource: null,
          trialEndsAt: future,
        },
      });
      const out = await buildBillingSummaryService({ db }).getSummary('t2');
      expect(out.ui.severity).toBe('orange');
      expect(out.ui.cta).toBe('upgrade');
    });

    it('retorna severity red para trial em ≤3 dias', async () => {
      const future = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
      const db = makeDbMock({
        tenant: {
          id: 't3',
          subscriptionPlan: 'trial',
          subscriptionStatus: 'active',
          billingSource: null,
          trialEndsAt: future,
        },
      });
      const out = await buildBillingSummaryService({ db }).getSummary('t3');
      expect(out.ui.severity).toBe('red');
      expect(out.ui.cta).toBe('upgrade');
      expect(out.ui.headline).toMatch(/termina/i);
    });

    it('retorna 0 dias e severity red quando trial já expirou', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000);
      const db = makeDbMock({
        tenant: {
          id: 't4',
          subscriptionPlan: 'trial',
          subscriptionStatus: 'active',
          billingSource: null,
          trialEndsAt: past,
        },
      });
      const out = await buildBillingSummaryService({ db }).getSummary('t4');
      expect(out.trialDaysRemaining).toBe(0);
      expect(out.ui.severity).toBe('red');
    });
  });

  describe('plano pago', () => {
    it('retorna severity green para subscription active', async () => {
      const db = makeDbMock({
        tenant: {
          id: 't5',
          subscriptionPlan: 'plus',
          subscriptionStatus: 'active',
          billingSource: 'asaas',
          trialEndsAt: null,
        },
        subscription: {
          id: 'sub_1',
          provider: 'asaas',
          status: 'active',
          cycle: 'MONTHLY',
          amountCents: 1990,
          currency: 'BRL',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelledAt: null,
        },
      });
      const out = await buildBillingSummaryService({ db }).getSummary('t5');
      expect(out.isTrial).toBe(false);
      expect(out.ui.severity).toBe('green');
      expect(out.ui.cta).toBe('manage');
      expect(out.subscription).not.toBeNull();
      expect(out.subscription!.amountCents).toBe(1990);
    });

    it('retorna severity red + cta retry quando subscription past_due', async () => {
      const db = makeDbMock({
        tenant: {
          id: 't6',
          subscriptionPlan: 'plus',
          subscriptionStatus: 'past_due',
          billingSource: 'asaas',
          trialEndsAt: null,
        },
      });
      const out = await buildBillingSummaryService({ db }).getSummary('t6');
      expect(out.ui.severity).toBe('red');
      expect(out.ui.cta).toBe('retry');
    });

    it('retorna severity red + cta upgrade quando cancelled', async () => {
      const db = makeDbMock({
        tenant: {
          id: 't7',
          subscriptionPlan: 'plus',
          subscriptionStatus: 'cancelled',
          billingSource: 'asaas',
          trialEndsAt: null,
        },
      });
      const out = await buildBillingSummaryService({ db }).getSummary('t7');
      expect(out.ui.severity).toBe('red');
      expect(out.ui.cta).toBe('upgrade');
    });

    it('retorna severity red quando lastPayment.status=failed mesmo com tenant active', async () => {
      const db = makeDbMock({
        tenant: {
          id: 't8',
          subscriptionPlan: 'plus',
          subscriptionStatus: 'active',
          billingSource: 'asaas',
          trialEndsAt: null,
        },
        lastPayment: {
          id: 'pay_1',
          status: 'failed',
          amountCents: 1990,
          currency: 'BRL',
          paymentMethod: 'PIX',
          dueDate: new Date(),
          paidAt: null,
          failedAt: new Date(),
        },
      });
      const out = await buildBillingSummaryService({ db }).getSummary('t8');
      expect(out.ui.severity).toBe('red');
      expect(out.ui.cta).toBe('retry');
      expect(out.lastPayment).not.toBeNull();
    });
  });

  it('lança erro quando tenant não existe', async () => {
    const db = makeDbMock();
    await expect(
      buildBillingSummaryService({ db }).getSummary('inexistente'),
    ).rejects.toThrow(/não encontrado/);
  });
});
