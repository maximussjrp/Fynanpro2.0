/**
 * Asaas routes — feature flag gate + token test
 *
 * Valida:
 *   - /billing/health responde 404 quando flag OFF
 *   - /webhooks/asaas responde 404 quando flag OFF
 *   - Com flag ON:
 *     - /billing/health sem ping retorna shape esperado
 *     - /webhooks/asaas sem token → 401
 *     - /webhooks/asaas com token válido → 200 e persiste evento
 */

import request from 'supertest';
import express, { Express } from 'express';

import billingRoutes from '../../routes/billing';
import webhooksRoutes from '../../routes/webhooks';
import { featureFlags } from '../../config/feature-flags';
import { mockPrisma } from '../setup';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/billing', billingRoutes);
  app.use('/api/v1/webhooks', webhooksRoutes);
  return app;
}

describe('Asaas routes — feature flag gate (OFF por default)', () => {
  const originalBilling = featureFlags['asaas.enabled'];
  const originalWebhook = featureFlags['asaas.webhook.enabled'];

  afterEach(() => {
    (featureFlags as any)['asaas.enabled'] = originalBilling;
    (featureFlags as any)['asaas.webhook.enabled'] = originalWebhook;
  });

  it('GET /billing/health → 404 com flag OFF', async () => {
    (featureFlags as any)['asaas.enabled'] = false;
    const app = buildApp();
    const res = await request(app).get('/api/v1/billing/health');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /webhooks/asaas → 404 com flag OFF', async () => {
    (featureFlags as any)['asaas.webhook.enabled'] = false;
    const app = buildApp();
    const res = await request(app).post('/api/v1/webhooks/asaas').send({ event: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('Asaas routes — com flags ON', () => {
  const originalBilling = featureFlags['asaas.enabled'];
  const originalWebhook = featureFlags['asaas.webhook.enabled'];
  const originalApiKey = process.env.ASAAS_API_KEY;
  const originalWebhookToken = process.env.ASAAS_WEBHOOK_TOKEN;

  beforeEach(() => {
    (featureFlags as any)['asaas.enabled'] = true;
    (featureFlags as any)['asaas.webhook.enabled'] = true;
    jest.clearAllMocks();
  });

  afterEach(() => {
    (featureFlags as any)['asaas.enabled'] = originalBilling;
    (featureFlags as any)['asaas.webhook.enabled'] = originalWebhook;
    process.env.ASAAS_API_KEY = originalApiKey;
    process.env.ASAAS_WEBHOOK_TOKEN = originalWebhookToken;
  });

  it('GET /billing/health (sem ping) retorna config mascarada', async () => {
    process.env.ASAAS_API_KEY = 'k';
    process.env.ASAAS_WEBHOOK_TOKEN = 't';
    process.env.ASAAS_SANDBOX = 'true';
    const app = buildApp();
    const res = await request(app).get('/api/v1/billing/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      asaasConfigured: true,
      sandbox: true,
      hasApiKey: true,
      hasWebhookToken: true,
      probed: false,
    });
  });

  it('GET /billing/health sem ASAAS_API_KEY → asaasConfigured=false', async () => {
    delete process.env.ASAAS_API_KEY;
    const app = buildApp();
    const res = await request(app).get('/api/v1/billing/health');
    expect(res.status).toBe(200);
    expect(res.body.data.asaasConfigured).toBe(false);
    expect(res.body.data.hasApiKey).toBe(false);
  });

  it('POST /webhooks/asaas sem token → 401', async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'secret';
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/webhooks/asaas')
      .send({ id: 'e1', event: 'PAYMENT_CREATED' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('POST /webhooks/asaas com token válido → 200 e persiste', async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'secret';
    (mockPrisma.asaasWebhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.asaasWebhookEvent.create as jest.Mock).mockResolvedValue({
      id: 'whe_1',
      eventType: 'PAYMENT_CREATED',
    });
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/webhooks/asaas')
      .set('asaas-access-token', 'secret')
      .send({ id: 'e1', event: 'PAYMENT_CREATED' });
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('whe_1');
    expect(res.body.data.duplicated).toBe(false);
    expect(mockPrisma.asaasWebhookEvent.create).toHaveBeenCalled();
  });

  it('POST /webhooks/asaas token via body → 200', async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'secret';
    (mockPrisma.asaasWebhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.asaasWebhookEvent.create as jest.Mock).mockResolvedValue({
      id: 'whe_2',
      eventType: 'PAYMENT_CREATED',
    });
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/webhooks/asaas')
      .send({ id: 'e2', event: 'PAYMENT_CREATED', accessToken: 'secret' });
    expect(res.status).toBe(200);
  });

  it('POST /webhooks/asaas payload sem event → 400', async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'secret';
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/webhooks/asaas')
      .set('asaas-access-token', 'secret')
      .send({ id: 'e3' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PAYLOAD');
  });

  it('POST /webhooks/asaas evento duplicado → 200 idempotent', async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'secret';
    (mockPrisma.asaasWebhookEvent.findUnique as jest.Mock).mockResolvedValue({
      id: 'whe_existing',
      eventType: 'PAYMENT_CREATED',
    });
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/webhooks/asaas')
      .set('asaas-access-token', 'secret')
      .send({ id: 'e_dup', event: 'PAYMENT_CREATED' });
    expect(res.status).toBe(200);
    expect(res.body.data.duplicated).toBe(true);
    expect(res.body.data.id).toBe('whe_existing');
    expect(mockPrisma.asaasWebhookEvent.create).not.toHaveBeenCalled();
  });
});

// ============================================================
// POST /billing/subscriptions — Fase A2A (C3)
// ============================================================

// Mock dos services Asaas para não exigir credenciais reais nos testes de rota.
jest.mock('../../services/asaas/asaas-client', () => {
  const actual = jest.requireActual('../../services/asaas/asaas-client');
  return {
    ...actual,
    // Respeita ASAAS_API_KEY (comportamento real) mas evita chamar o fetch real.
    buildAsaasClientFromEnv: jest.fn(() => {
      if (!process.env.ASAAS_API_KEY) return null;
      return {
        createCustomer: jest.fn(),
        createSubscription: jest.fn(),
        ping: jest.fn().mockResolvedValue({ ok: true, account: {} }),
      };
    }),
  };
});

jest.mock('../../services/asaas/asaas-customer.service', () => ({
  buildAsaasCustomerService: jest.fn(() => ({
    ensureCustomer: jest.fn().mockResolvedValue({
      billingCustomerId: 'bc_1',
      asaasCustomerId: 'cus_1',
      created: true,
    }),
  })),
}));

jest.mock('../../services/asaas/asaas-subscription.service', () => ({
  buildAsaasSubscriptionService: jest.fn(() => ({
    create: jest.fn().mockResolvedValue({
      id: 'asaas_sub_route_1',
      customer: 'cus_1',
      value: 29.9,
      nextDueDate: '2026-05-01',
      cycle: 'MONTHLY',
      status: 'ACTIVE',
      billingType: 'PIX',
    }),
  })),
  AsaasSubscriptionServiceError: class extends Error {},
}));

describe('POST /billing/subscriptions — flag gating', () => {
  const originalBilling = featureFlags['asaas.enabled'];
  const originalSub = featureFlags['asaas.subscription.enabled'];

  afterEach(() => {
    (featureFlags as any)['asaas.enabled'] = originalBilling;
    (featureFlags as any)['asaas.subscription.enabled'] = originalSub;
  });

  it('→ 404 quando asaas.enabled OFF', async () => {
    (featureFlags as any)['asaas.enabled'] = false;
    (featureFlags as any)['asaas.subscription.enabled'] = true;
    const app = buildApp();
    const res = await request(app).post('/api/v1/billing/subscriptions').send({});
    expect(res.status).toBe(404);
  });

  it('→ 404 quando asaas.subscription.enabled OFF (mas asaas.enabled ON)', async () => {
    (featureFlags as any)['asaas.enabled'] = true;
    (featureFlags as any)['asaas.subscription.enabled'] = false;
    const app = buildApp();
    const res = await request(app).post('/api/v1/billing/subscriptions').send({});
    expect(res.status).toBe(404);
  });
});

describe('POST /billing/subscriptions — flags ON', () => {
  const originalBilling = featureFlags['asaas.enabled'];
  const originalSub = featureFlags['asaas.subscription.enabled'];
  const originalApiKey = process.env.ASAAS_API_KEY;

  beforeEach(() => {
    (featureFlags as any)['asaas.enabled'] = true;
    (featureFlags as any)['asaas.subscription.enabled'] = true;
    process.env.ASAAS_API_KEY = 'k_test';
    jest.clearAllMocks();
  });

  afterEach(() => {
    (featureFlags as any)['asaas.enabled'] = originalBilling;
    (featureFlags as any)['asaas.subscription.enabled'] = originalSub;
    process.env.ASAAS_API_KEY = originalApiKey;
  });

  it('400 quando body é inválido (sem tenantId)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/billing/subscriptions')
      .send({ plan: 'monthly', amountCents: 2990, cycle: 'MONTHLY' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });

  it('400 quando customerData.name ausente', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/billing/subscriptions')
      .send({
        tenantId: 't1',
        plan: 'monthly',
        amountCents: 2990,
        cycle: 'MONTHLY',
        customerData: {},
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });

  it('400 quando cycle != MONTHLY', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/billing/subscriptions')
      .send({
        tenantId: 't1',
        plan: 'monthly',
        amountCents: 2990,
        cycle: 'YEARLY',
        customerData: { name: 'n' },
      });
    expect(res.status).toBe(400);
  });

  it('503 quando ASAAS_API_KEY ausente', async () => {
    delete process.env.ASAAS_API_KEY;
    // O mock default de buildAsaasClientFromEnv retorna client — forçamos null aqui.
    const { buildAsaasClientFromEnv } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../services/asaas/asaas-client');
    (buildAsaasClientFromEnv as jest.Mock).mockReturnValueOnce(null);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/billing/subscriptions')
      .send({
        tenantId: 't1',
        plan: 'monthly',
        amountCents: 2990,
        cycle: 'MONTHLY',
        customerData: { name: 'n' },
      });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('ASAAS_NOT_CONFIGURED');
  });

  it('201 no caminho feliz', async () => {
    // Prisma mock: nenhuma sub viva, create + update retornam linhas.
    (mockPrisma.subscription.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.subscription.create as jest.Mock).mockResolvedValue({
      id: 'sub_new_1',
      tenantId: 't1',
      status: 'pending',
      amountCents: 2990,
      plan: 'monthly',
      asaasSubscriptionId: null,
    });
    (mockPrisma.subscription.update as jest.Mock).mockResolvedValue({
      id: 'sub_new_1',
      tenantId: 't1',
      status: 'pending',
      asaasSubscriptionId: 'asaas_sub_route_1',
      amountCents: 2990,
      plan: 'monthly',
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/billing/subscriptions')
      .send({
        tenantId: 't1',
        plan: 'monthly',
        amountCents: 2990,
        cycle: 'MONTHLY',
        customerData: { name: 'Tenant One', email: 't@x.com' },
        nextDueDate: '2026-05-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toBe(true);
    expect(res.body.data.subscription.id).toBe('sub_new_1');
    expect(res.body.data.subscription.asaasSubscriptionId).toBe('asaas_sub_route_1');
  });

  it('200 quando já há sub viva (idempotente, created:false)', async () => {
    (mockPrisma.subscription.findFirst as jest.Mock).mockResolvedValue({
      id: 'sub_live',
      tenantId: 't1',
      status: 'active',
      asaasSubscriptionId: 'asaas_live',
      amountCents: 2990,
      plan: 'monthly',
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/billing/subscriptions')
      .send({
        tenantId: 't1',
        plan: 'monthly',
        amountCents: 2990,
        cycle: 'MONTHLY',
        customerData: { name: 'n' },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(false);
    expect(res.body.data.subscription.id).toBe('sub_live');
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
  });
});
