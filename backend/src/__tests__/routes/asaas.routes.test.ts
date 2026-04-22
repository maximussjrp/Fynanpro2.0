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
