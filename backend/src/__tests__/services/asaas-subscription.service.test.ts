/**
 * asaas-subscription.service unit tests — Fase A2A (C2)
 */

import {
  buildAsaasSubscriptionService,
  AsaasSubscriptionServiceError,
} from '../../services/asaas/asaas-subscription.service';

function makeClientMock(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    createCustomer: jest.fn(),
    getCustomer: jest.fn(),
    createSubscription: jest.fn(),
    getSubscription: jest.fn(),
    ping: jest.fn(),
    request: jest.fn(),
    baseUrl: 'https://sandbox.asaas.com/api/v3',
    ...overrides,
  } as any;
}

describe('asaas-subscription.service / create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejeita asaasCustomerId vazio', async () => {
    const svc = buildAsaasSubscriptionService({ client: makeClientMock() });
    await expect(
      svc.create({
        asaasCustomerId: '',
        amountCents: 1000,
        nextDueDate: '2026-05-01',
        cycle: 'MONTHLY',
      }),
    ).rejects.toThrow(AsaasSubscriptionServiceError);
  });

  it('rejeita amountCents <= 0', async () => {
    const svc = buildAsaasSubscriptionService({ client: makeClientMock() });
    await expect(
      svc.create({
        asaasCustomerId: 'cus_1',
        amountCents: 0,
        nextDueDate: '2026-05-01',
        cycle: 'MONTHLY',
      }),
    ).rejects.toThrow(/amountCents/);
  });

  it('rejeita amountCents não-inteiro', async () => {
    const svc = buildAsaasSubscriptionService({ client: makeClientMock() });
    await expect(
      svc.create({
        asaasCustomerId: 'cus_1',
        amountCents: 99.5 as any,
        nextDueDate: '2026-05-01',
        cycle: 'MONTHLY',
      }),
    ).rejects.toThrow(/amountCents/);
  });

  it('rejeita nextDueDate em formato inválido', async () => {
    const svc = buildAsaasSubscriptionService({ client: makeClientMock() });
    await expect(
      svc.create({
        asaasCustomerId: 'cus_1',
        amountCents: 1000,
        nextDueDate: '05/01/2026',
        cycle: 'MONTHLY',
      }),
    ).rejects.toThrow(/YYYY-MM-DD/);
  });

  it('rejeita ciclo não suportado (A2A só aceita MONTHLY)', async () => {
    const svc = buildAsaasSubscriptionService({ client: makeClientMock() });
    await expect(
      svc.create({
        asaasCustomerId: 'cus_1',
        amountCents: 1000,
        nextDueDate: '2026-05-01',
        cycle: 'YEARLY' as any,
      }),
    ).rejects.toThrow(/MONTHLY/);
  });

  it('chama client.createSubscription com payload correto (PIX default)', async () => {
    const client = makeClientMock({
      createSubscription: jest.fn().mockResolvedValue({
        id: 'sub_1',
        customer: 'cus_1',
        value: 29.9,
        nextDueDate: '2026-05-01',
        cycle: 'MONTHLY',
        status: 'ACTIVE',
        billingType: 'PIX',
      }),
    });
    const svc = buildAsaasSubscriptionService({ client });

    const resp = await svc.create({
      asaasCustomerId: 'cus_1',
      amountCents: 2990,
      nextDueDate: '2026-05-01',
      cycle: 'MONTHLY',
      description: 'UTOP plano mensal',
      externalReference: 'sub-local-abc',
    });

    expect(resp.id).toBe('sub_1');
    expect(client.createSubscription).toHaveBeenCalledTimes(1);
    const arg = client.createSubscription.mock.calls[0][0];
    expect(arg).toEqual({
      customer: 'cus_1',
      billingType: 'PIX',
      value: 29.9,
      nextDueDate: '2026-05-01',
      cycle: 'MONTHLY',
      description: 'UTOP plano mensal',
      externalReference: 'sub-local-abc',
    });
  });

  it('converte centavos para decimal com 2 casas', async () => {
    const client = makeClientMock({
      createSubscription: jest.fn().mockResolvedValue({
        id: 'sub_2',
        customer: 'cus_2',
        value: 1,
        nextDueDate: '2026-05-01',
        cycle: 'MONTHLY',
        status: 'ACTIVE',
        billingType: 'PIX',
      }),
    });
    const svc = buildAsaasSubscriptionService({ client });

    await svc.create({
      asaasCustomerId: 'cus_2',
      amountCents: 100,
      nextDueDate: '2026-05-01',
      cycle: 'MONTHLY',
    });
    expect(client.createSubscription.mock.calls[0][0].value).toBe(1);
  });

  it('respeita billingType custom', async () => {
    const client = makeClientMock({
      createSubscription: jest.fn().mockResolvedValue({
        id: 'sub_3',
        customer: 'cus_1',
        value: 10,
        nextDueDate: '2026-05-01',
        cycle: 'MONTHLY',
        status: 'ACTIVE',
        billingType: 'BOLETO',
      }),
    });
    const svc = buildAsaasSubscriptionService({ client });

    await svc.create({
      asaasCustomerId: 'cus_1',
      amountCents: 1000,
      nextDueDate: '2026-05-01',
      cycle: 'MONTHLY',
      billingType: 'BOLETO',
    });
    expect(client.createSubscription.mock.calls[0][0].billingType).toBe('BOLETO');
  });

  it('lança erro se Asaas responde sem id', async () => {
    const client = makeClientMock({
      createSubscription: jest.fn().mockResolvedValue({ id: '' }),
    });
    const svc = buildAsaasSubscriptionService({ client });

    await expect(
      svc.create({
        asaasCustomerId: 'cus_1',
        amountCents: 1000,
        nextDueDate: '2026-05-01',
        cycle: 'MONTHLY',
      }),
    ).rejects.toThrow(/sem id/i);
  });

  it('propaga erro de rede como AsaasSubscriptionServiceError', async () => {
    const client = makeClientMock({
      createSubscription: jest.fn().mockRejectedValue(new Error('boom')),
    });
    const svc = buildAsaasSubscriptionService({ client });

    await expect(
      svc.create({
        asaasCustomerId: 'cus_1',
        amountCents: 1000,
        nextDueDate: '2026-05-01',
        cycle: 'MONTHLY',
      }),
    ).rejects.toThrow(AsaasSubscriptionServiceError);
  });
});
