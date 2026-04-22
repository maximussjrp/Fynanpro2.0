/**
 * Consultant Routes — feature flag gate test
 *
 * Valida que com a flag OFF (default), as rotas respondem 404 sem chegar
 * a tocar em auth/service.
 */

import request from 'supertest';
import express, { Express } from 'express';

// Import depois de qualquer jest.mock necessário (mockPrisma é importado pelo setup).
import consultantRoutes from '../../routes/consultant';
import adminConsultantsRoutes from '../../routes/admin-consultants';
import { featureFlags } from '../../config/feature-flags';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/consultant', consultantRoutes);
  app.use('/api/v1/admin/consultants', adminConsultantsRoutes);
  return app;
}

describe('Consultant routes — feature flag gate', () => {
  const originalFlag = featureFlags['consultant.enabled'];

  afterEach(() => {
    (featureFlags as any)['consultant.enabled'] = originalFlag;
  });

  it('default: flag OFF → GET /consultant/me retorna 404', async () => {
    (featureFlags as any)['consultant.enabled'] = false;
    const app = buildApp();
    const res = await request(app).get('/api/v1/consultant/me');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('default: flag OFF → POST /consultant/apply retorna 404', async () => {
    (featureFlags as any)['consultant.enabled'] = false;
    const app = buildApp();
    const res = await request(app).post('/api/v1/consultant/apply').send({});
    expect(res.status).toBe(404);
  });

  it('default: flag OFF → GET /admin/consultants retorna 404', async () => {
    (featureFlags as any)['consultant.enabled'] = false;
    const app = buildApp();
    const res = await request(app).get('/api/v1/admin/consultants');
    expect(res.status).toBe(404);
  });

  it('flag ON + sem token → GET /consultant/me retorna 401 (não 404)', async () => {
    (featureFlags as any)['consultant.enabled'] = true;
    const app = buildApp();
    const res = await request(app).get('/api/v1/consultant/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('flag ON + sem token → GET /admin/consultants retorna 401', async () => {
    (featureFlags as any)['consultant.enabled'] = true;
    const app = buildApp();
    const res = await request(app).get('/api/v1/admin/consultants');
    expect(res.status).toBe(401);
  });
});
