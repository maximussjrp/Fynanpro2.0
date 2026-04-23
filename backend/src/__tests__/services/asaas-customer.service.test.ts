/**
 * asaas-customer.service unit tests — Fase A2A (C2)
 */

import { mockPrisma } from '../setup';
import {
  buildAsaasCustomerService,
  AsaasCustomerServiceError,
} from '../../services/asaas/asaas-customer.service';

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

describe('asaas-customer.service / ensureCustomer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejeita tenantId vazio', async () => {
    const svc = buildAsaasCustomerService({ client: makeClientMock(), db: mockPrisma as any });
    await expect(
      svc.ensureCustomer({ tenantId: '', customerData: { name: 'X' } }),
    ).rejects.toThrow(AsaasCustomerServiceError);
  });

  it('rejeita customerData.name vazio', async () => {
    const svc = buildAsaasCustomerService({ client: makeClientMock(), db: mockPrisma as any });
    await expect(
      svc.ensureCustomer({ tenantId: 't1', customerData: { name: '' } }),
    ).rejects.toThrow(AsaasCustomerServiceError);
  });

  it('reutiliza BillingCustomer existente (idempotente)', async () => {
    mockPrisma.billingCustomer.findFirst.mockResolvedValue({
      id: 'bc_1',
      asaasCustomerId: 'cus_existing',
    });
    const client = makeClientMock();
    const svc = buildAsaasCustomerService({ client, db: mockPrisma as any });

    const out = await svc.ensureCustomer({
      tenantId: 't1',
      customerData: { name: 'Tenant One' },
    });

    expect(out).toEqual({
      billingCustomerId: 'bc_1',
      asaasCustomerId: 'cus_existing',
      created: false,
    });
    expect(client.createCustomer).not.toHaveBeenCalled();
    expect(mockPrisma.billingCustomer.create).not.toHaveBeenCalled();
  });

  it('cria no Asaas e persiste quando não existe', async () => {
    mockPrisma.billingCustomer.findFirst.mockResolvedValue(null);
    const client = makeClientMock({
      createCustomer: jest.fn().mockResolvedValue({
        id: 'cus_new',
        name: 'Tenant One',
        email: 'x@y.com',
      }),
    });
    mockPrisma.billingCustomer.create.mockResolvedValue({
      id: 'bc_new',
      asaasCustomerId: 'cus_new',
    });

    const svc = buildAsaasCustomerService({ client, db: mockPrisma as any });

    const out = await svc.ensureCustomer({
      tenantId: 't1',
      customerData: { name: 'Tenant One', email: 'x@y.com' },
    });

    expect(out).toEqual({
      billingCustomerId: 'bc_new',
      asaasCustomerId: 'cus_new',
      created: true,
    });
    expect(client.createCustomer).toHaveBeenCalledTimes(1);
    // externalReference default = tenantId
    expect(client.createCustomer.mock.calls[0][0].externalReference).toBe('t1');
    expect(mockPrisma.billingCustomer.create).toHaveBeenCalledTimes(1);
    const createArg = mockPrisma.billingCustomer.create.mock.calls[0][0];
    expect(createArg.data.tenantId).toBe('t1');
    expect(createArg.data.provider).toBe('asaas');
    expect(createArg.data.asaasCustomerId).toBe('cus_new');
    expect(createArg.data.isActive).toBe(true);
  });

  it('preserva externalReference informado pelo chamador', async () => {
    mockPrisma.billingCustomer.findFirst.mockResolvedValue(null);
    const client = makeClientMock({
      createCustomer: jest.fn().mockResolvedValue({ id: 'cus_ok', name: 'n' }),
    });
    mockPrisma.billingCustomer.create.mockResolvedValue({
      id: 'bc_ok',
      asaasCustomerId: 'cus_ok',
    });
    const svc = buildAsaasCustomerService({ client, db: mockPrisma as any });

    await svc.ensureCustomer({
      tenantId: 't1',
      customerData: { name: 'n', externalReference: 'custom-ref' },
    });

    expect(client.createCustomer.mock.calls[0][0].externalReference).toBe('custom-ref');
  });

  it('propaga erro do Asaas como AsaasCustomerServiceError', async () => {
    mockPrisma.billingCustomer.findFirst.mockResolvedValue(null);
    const client = makeClientMock({
      createCustomer: jest.fn().mockRejectedValue(new Error('asaas 400')),
    });
    const svc = buildAsaasCustomerService({ client, db: mockPrisma as any });

    await expect(
      svc.ensureCustomer({ tenantId: 't1', customerData: { name: 'n' } }),
    ).rejects.toThrow(AsaasCustomerServiceError);
    expect(mockPrisma.billingCustomer.create).not.toHaveBeenCalled();
  });

  it('rejeita quando Asaas responde sem id', async () => {
    mockPrisma.billingCustomer.findFirst.mockResolvedValue(null);
    const client = makeClientMock({
      createCustomer: jest.fn().mockResolvedValue({ id: '', name: 'n' }),
    });
    const svc = buildAsaasCustomerService({ client, db: mockPrisma as any });

    await expect(
      svc.ensureCustomer({ tenantId: 't1', customerData: { name: 'n' } }),
    ).rejects.toThrow(/sem id/i);
  });
});
