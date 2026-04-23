/**
 * saas-subscription.service unit tests — Fase A2A (C3)
 *
 * Cobre:
 *   - validação de input
 *   - injeção explícita (falta de dep → erro)
 *   - idempotência por tenant (reutiliza sub viva)
 *   - caminho feliz (ensureCustomer + create local + create Asaas + update local)
 *   - rollback quando Asaas falha
 */

// Este arquivo NÃO importa `../setup` explicitamente — o jest carrega
// `__tests__/setup.ts` via setupFilesAfterEach, o que já mocka logger e
// prisma global. O service usa DI explícita, então passamos um db mock
// dedicado abaixo (não dependemos do mock global do prisma).

import {
  buildSaasSubscriptionService,
  SaasSubscriptionServiceError,
} from '../../services/saas-subscription.service';

function makeDbMock() {
  return {
    subscription: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as any;
}

function makeCustomerSvcMock(
  impl: Partial<{
    ensureCustomer: jest.Mock;
  }> = {},
) {
  return {
    ensureCustomer:
      impl.ensureCustomer ??
      jest.fn().mockResolvedValue({
        billingCustomerId: 'bc_1',
        asaasCustomerId: 'cus_1',
        created: true,
      }),
  } as any;
}

function makeSubSvcMock(
  impl: Partial<{
    create: jest.Mock;
  }> = {},
) {
  return {
    create:
      impl.create ??
      jest.fn().mockResolvedValue({
        id: 'asaas_sub_1',
        customer: 'cus_1',
        value: 29.9,
        nextDueDate: '2026-05-01',
        cycle: 'MONTHLY',
        status: 'ACTIVE',
        billingType: 'PIX',
      }),
  } as any;
}

const baseInput = {
  tenantId: 't1',
  plan: 'monthly',
  amountCents: 2990,
  cycle: 'MONTHLY' as const,
  customerData: { name: 'Tenant One', email: 't@x.com' },
  nextDueDate: '2026-05-01',
};

describe('saas-subscription.service — DI guards', () => {
  it('falha sem db', () => {
    expect(() =>
      buildSaasSubscriptionService({
        db: undefined as any,
        asaasCustomerService: makeCustomerSvcMock(),
        asaasSubscriptionService: makeSubSvcMock(),
      }),
    ).toThrow(/db/);
  });

  it('falha sem asaasCustomerService', () => {
    expect(() =>
      buildSaasSubscriptionService({
        db: makeDbMock(),
        asaasCustomerService: undefined as any,
        asaasSubscriptionService: makeSubSvcMock(),
      }),
    ).toThrow(/asaasCustomerService/);
  });

  it('falha sem asaasSubscriptionService', () => {
    expect(() =>
      buildSaasSubscriptionService({
        db: makeDbMock(),
        asaasCustomerService: makeCustomerSvcMock(),
        asaasSubscriptionService: undefined as any,
      }),
    ).toThrow(/asaasSubscriptionService/);
  });
});

describe('saas-subscription.service / createForTenant — validações', () => {
  const build = () =>
    buildSaasSubscriptionService({
      db: makeDbMock(),
      asaasCustomerService: makeCustomerSvcMock(),
      asaasSubscriptionService: makeSubSvcMock(),
    });

  it('rejeita tenantId vazio', async () => {
    await expect(
      build().createForTenant({ ...baseInput, tenantId: '' }),
    ).rejects.toThrow(SaasSubscriptionServiceError);
  });

  it('rejeita plan vazio', async () => {
    await expect(
      build().createForTenant({ ...baseInput, plan: '' }),
    ).rejects.toThrow(/plan/);
  });

  it('rejeita amountCents <= 0', async () => {
    await expect(
      build().createForTenant({ ...baseInput, amountCents: 0 }),
    ).rejects.toThrow(/amountCents/);
  });

  it('rejeita amountCents não-inteiro', async () => {
    await expect(
      build().createForTenant({ ...baseInput, amountCents: 10.5 as any }),
    ).rejects.toThrow(/amountCents/);
  });

  it('rejeita cycle != MONTHLY', async () => {
    await expect(
      build().createForTenant({ ...baseInput, cycle: 'YEARLY' as any }),
    ).rejects.toThrow(/MONTHLY/);
  });

  it('rejeita customerData.name vazio', async () => {
    await expect(
      build().createForTenant({
        ...baseInput,
        customerData: { name: '' },
      }),
    ).rejects.toThrow(/name/);
  });

  it('rejeita nextDueDate em formato inválido', async () => {
    await expect(
      build().createForTenant({ ...baseInput, nextDueDate: '01/05/2026' }),
    ).rejects.toThrow(/YYYY-MM-DD/);
  });
});

describe('saas-subscription.service / createForTenant — fluxo', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna sub existente quando há uma viva (idempotente, sem chamar Asaas)', async () => {
    const db = makeDbMock();
    db.subscription.findFirst.mockResolvedValue({
      id: 'sub_live',
      tenantId: 't1',
      status: 'active',
      asaasSubscriptionId: 'asaas_live',
      amountCents: 2990,
      plan: 'monthly',
    });
    const customerSvc = makeCustomerSvcMock();
    const subSvc = makeSubSvcMock();

    const svc = buildSaasSubscriptionService({
      db,
      asaasCustomerService: customerSvc,
      asaasSubscriptionService: subSvc,
    });

    const out = await svc.createForTenant(baseInput);

    expect(out.created).toBe(false);
    expect(out.subscription.id).toBe('sub_live');
    expect(customerSvc.ensureCustomer).not.toHaveBeenCalled();
    expect(subSvc.create).not.toHaveBeenCalled();
    expect(db.subscription.create).not.toHaveBeenCalled();
  });

  it('caminho feliz: ensureCustomer → create local → create Asaas → update local', async () => {
    const db = makeDbMock();
    db.subscription.findFirst.mockResolvedValue(null);
    db.subscription.create.mockResolvedValue({
      id: 'sub_local_1',
      tenantId: 't1',
      status: 'pending',
      amountCents: 2990,
      plan: 'monthly',
      asaasSubscriptionId: null,
    });
    db.subscription.update.mockResolvedValue({
      id: 'sub_local_1',
      tenantId: 't1',
      status: 'pending',
      asaasSubscriptionId: 'asaas_sub_1',
      amountCents: 2990,
      plan: 'monthly',
    });

    const customerSvc = makeCustomerSvcMock();
    const subSvc = makeSubSvcMock();

    const svc = buildSaasSubscriptionService({
      db,
      asaasCustomerService: customerSvc,
      asaasSubscriptionService: subSvc,
    });

    const out = await svc.createForTenant(baseInput);

    expect(out.created).toBe(true);
    expect(out.subscription.id).toBe('sub_local_1');
    expect(out.subscription.asaasSubscriptionId).toBe('asaas_sub_1');

    expect(customerSvc.ensureCustomer).toHaveBeenCalledWith({
      tenantId: 't1',
      customerData: baseInput.customerData,
    });

    // local create foi chamado com dados corretos
    const createArg = db.subscription.create.mock.calls[0][0];
    expect(createArg.data.tenantId).toBe('t1');
    expect(createArg.data.provider).toBe('asaas');
    expect(createArg.data.plan).toBe('monthly');
    expect(createArg.data.status).toBe('pending');
    expect(createArg.data.cycle).toBe('MONTHLY');
    expect(createArg.data.amountCents).toBe(2990);

    // Asaas create recebeu externalReference = id local
    const asaasArg = subSvc.create.mock.calls[0][0];
    expect(asaasArg.externalReference).toBe('sub_local_1');
    expect(asaasArg.asaasCustomerId).toBe('cus_1');
    expect(asaasArg.amountCents).toBe(2990);
    expect(asaasArg.cycle).toBe('MONTHLY');
    expect(asaasArg.nextDueDate).toBe('2026-05-01');

    // update local foi chamado com asaasSubscriptionId
    const updateArg = db.subscription.update.mock.calls[0][0];
    expect(updateArg.where.id).toBe('sub_local_1');
    expect(updateArg.data.asaasSubscriptionId).toBe('asaas_sub_1');
  });

  it('default nextDueDate é gerado quando não informado (YYYY-MM-DD)', async () => {
    const db = makeDbMock();
    db.subscription.findFirst.mockResolvedValue(null);
    db.subscription.create.mockResolvedValue({
      id: 'sub_x',
      tenantId: 't1',
      status: 'pending',
      amountCents: 2990,
      plan: 'monthly',
      asaasSubscriptionId: null,
    });
    db.subscription.update.mockResolvedValue({
      id: 'sub_x',
      tenantId: 't1',
      status: 'pending',
      asaasSubscriptionId: 'asaas_x',
      amountCents: 2990,
      plan: 'monthly',
    });

    const customerSvc = makeCustomerSvcMock();
    const subSvc = makeSubSvcMock({
      create: jest.fn().mockResolvedValue({ id: 'asaas_x' }),
    });

    const svc = buildSaasSubscriptionService({
      db,
      asaasCustomerService: customerSvc,
      asaasSubscriptionService: subSvc,
    });

    const { nextDueDate: _omit, ...inputNoDate } = baseInput;
    await svc.createForTenant(inputNoDate);

    const nextDue = subSvc.create.mock.calls[0][0].nextDueDate;
    expect(nextDue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rollback soft quando Asaas falha: marca local como cancelled e propaga erro', async () => {
    const db = makeDbMock();
    db.subscription.findFirst.mockResolvedValue(null);
    db.subscription.create.mockResolvedValue({
      id: 'sub_local_2',
      tenantId: 't1',
      status: 'pending',
      amountCents: 2990,
      plan: 'monthly',
      asaasSubscriptionId: null,
    });
    db.subscription.update.mockResolvedValue({ id: 'sub_local_2' });

    const customerSvc = makeCustomerSvcMock();
    const subSvc = makeSubSvcMock({
      create: jest.fn().mockRejectedValue(new Error('asaas 502')),
    });

    const svc = buildSaasSubscriptionService({
      db,
      asaasCustomerService: customerSvc,
      asaasSubscriptionService: subSvc,
    });

    await expect(svc.createForTenant(baseInput)).rejects.toThrow(
      SaasSubscriptionServiceError,
    );

    // update chamado para rollback com status cancelled
    expect(db.subscription.update).toHaveBeenCalledTimes(1);
    const rollbackArg = db.subscription.update.mock.calls[0][0];
    expect(rollbackArg.where.id).toBe('sub_local_2');
    expect(rollbackArg.data.status).toBe('cancelled');
    expect(rollbackArg.data.cancelledAt).toBeInstanceOf(Date);
    expect(rollbackArg.data.metadata.rollbackReason).toBe('asaas_create_failed');
  });

  it('se rollback também falhar, erro principal ainda é propagado', async () => {
    const db = makeDbMock();
    db.subscription.findFirst.mockResolvedValue(null);
    db.subscription.create.mockResolvedValue({
      id: 'sub_local_3',
      tenantId: 't1',
      status: 'pending',
      amountCents: 2990,
      plan: 'monthly',
      asaasSubscriptionId: null,
    });
    db.subscription.update.mockRejectedValue(new Error('db down'));

    const customerSvc = makeCustomerSvcMock();
    const subSvc = makeSubSvcMock({
      create: jest.fn().mockRejectedValue(new Error('asaas 500')),
    });

    const svc = buildSaasSubscriptionService({
      db,
      asaasCustomerService: customerSvc,
      asaasSubscriptionService: subSvc,
    });

    await expect(svc.createForTenant(baseInput)).rejects.toMatchObject({
      code: 'ASAAS_CREATE_FAILED',
    });
  });

  it('billingType default = PIX quando não informado', async () => {
    const db = makeDbMock();
    db.subscription.findFirst.mockResolvedValue(null);
    db.subscription.create.mockResolvedValue({
      id: 'sub_pix',
      tenantId: 't1',
      status: 'pending',
      amountCents: 2990,
      plan: 'monthly',
      asaasSubscriptionId: null,
    });
    db.subscription.update.mockResolvedValue({
      id: 'sub_pix',
      tenantId: 't1',
      status: 'pending',
      asaasSubscriptionId: 'a1',
      amountCents: 2990,
      plan: 'monthly',
    });

    const customerSvc = makeCustomerSvcMock();
    const subSvc = makeSubSvcMock();

    const svc = buildSaasSubscriptionService({
      db,
      asaasCustomerService: customerSvc,
      asaasSubscriptionService: subSvc,
    });

    await svc.createForTenant(baseInput);

    expect(subSvc.create.mock.calls[0][0].billingType).toBe('PIX');
    const createArg = db.subscription.create.mock.calls[0][0];
    expect(createArg.data.metadata.billingType).toBe('PIX');
  });
});
