/**
 * C5.2 — Integration test: processor → handler → DB mock
 *
 * Valida o caminho completo de um evento SUBSCRIPTION_* ingerido:
 *   1. processor.processOne(eventId) chama $transaction
 *   2. handler executa Subscription.update + Tenant.update (cache legado)
 *   3. post-commit: invalidateTenantBillingCache(tenantId) é disparado
 *
 * Não usa DB real (FF_ASAAS_* = false em prod — ver RESULT §5).
 */

jest.mock('../../services/billing/tenant-billing-cache', () => ({
  invalidateTenantBillingCache: jest.fn(),
}));

import { buildWebhookProcessor } from '../../services/asaas/webhook-processor.service';
import { invalidateTenantBillingCache } from '../../services/billing/tenant-billing-cache';

const invalidateMock = invalidateTenantBillingCache as jest.Mock;

function makeIntegrationDb(ctx: {
  subscription: { id: string; tenantId: string; status: string };
  tenantBillingSource?: string | null;
}) {
  const tx: any = {
    asaasWebhookEvent: { update: jest.fn() },
    subscription: {
      findFirst: jest.fn().mockResolvedValue(ctx.subscription),
      findUnique: jest.fn().mockResolvedValue({ cancelledAt: null }),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: ctx.subscription.id,
        tenantId: ctx.subscription.tenantId,
        status: data.status ?? ctx.subscription.status,
      })),
    },
    tenant: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest
        .fn()
        .mockResolvedValue({ billingSource: ctx.tenantBillingSource ?? null }),
    },
  };
  return {
    asaasWebhookEvent: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  } as any;
}

describe('C5.2 — subscription webhook flow (processor → handler → cache)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('SUBSCRIPTION_UPDATED (INACTIVE) → Subscription suspended + Tenant cache suspended + invalidate pós-commit', async () => {
    const db = makeIntegrationDb({
      subscription: {
        id: 'sub_local_int_1',
        tenantId: 'tenant_int_1',
        status: 'active',
      },
      tenantBillingSource: 'asaas',
    });

    db.asaasWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt_int_1',
      eventType: 'SUBSCRIPTION_UPDATED',
      payload: {
        event: 'SUBSCRIPTION_UPDATED',
        subscription: {
          id: 'asaas_sub_int_1',
          customer: 'cus_int_1',
          value: 79.9,
          nextDueDate: '2026-07-01',
          cycle: 'MONTHLY',
          status: 'INACTIVE',
          billingType: 'PIX',
        },
      },
      status: 'received',
    });

    const proc = buildWebhookProcessor({ db });
    const out = await proc.processOne('evt_int_1');

    // (a) outcome + transação única
    expect(out.outcome).toBe('processed');
    expect(db.$transaction).toHaveBeenCalledTimes(1);

    // (b) Subscription.update → suspended
    expect(db.__tx.subscription.update).toHaveBeenCalledTimes(1);
    const subArgs = db.__tx.subscription.update.mock.calls[0][0];
    expect(subArgs.data.status).toBe('suspended');
    expect(subArgs.data.lastAsaasEventAt).toBeInstanceOf(Date);
    expect(subArgs.data.amountCents).toBe(7990);

    // (c) Tenant.update → cache 'suspended'
    expect(db.__tx.tenant.update).toHaveBeenCalledTimes(1);
    expect(db.__tx.tenant.update.mock.calls[0][0].data.subscriptionStatus).toBe(
      'suspended',
    );

    // (d) invalidateTenantBillingCache disparado pós-commit com o tenantId correto
    expect(invalidateMock).toHaveBeenCalledWith('tenant_int_1');
  });
});
