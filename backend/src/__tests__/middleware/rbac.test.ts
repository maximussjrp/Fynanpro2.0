/**
 * RBAC Middleware Tests - Phase 1B
 *
 * Middlewares are isolated (not wired in any legacy route in Phase 1B).
 * These tests cover happy-path + error-path for requireActiveTenant,
 * requireRole, and requireTenantAccess.
 */

import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth';
import {
  requireActiveTenant,
  requireRole,
  requireTenantAccess,
} from '../../middleware/rbac';
import { prisma } from '../../utils/prisma-client';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('requireActiveTenant()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401 quando userId ausente', async () => {
    const req = {} as AuthRequest;
    const res = mockRes();
    const next = jest.fn();
    await requireActiveTenant()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('popula req.activeTenantId quando activeTenantId do JWT é válido', async () => {
    const req = {
      userId: 'u1',
      activeTenantId: 't1',
    } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({ id: 't1' });
    (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);

    await requireActiveTenant()(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.activeTenantId).toBe('t1');
  });

  it('409 TENANT_SELECTION_REQUIRED quando nenhuma fonte resolve', async () => {
    const req = { userId: 'u1' } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ homeTenantId: null });
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);

    await requireActiveTenant()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'TENANT_SELECTION_REQUIRED' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('cai para tenantId legado quando activeTenantId ausente e homeTenantId ausente', async () => {
    const req = { userId: 'u1', tenantId: 'legacy-t' } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ homeTenantId: null });
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({ id: 'legacy-t' });
    (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);

    await requireActiveTenant()(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.activeTenantId).toBe('legacy-t');
  });
});

describe('requireRole()', () => {
  it('next() quando role está na allowlist', () => {
    const req = { userRole: 'owner' } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();
    requireRole('owner', 'admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('403 quando role não está na allowlist', () => {
    const req = { userRole: 'member' } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();
    requireRole('owner', 'admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('403 quando userRole ausente', () => {
    const req = {} as AuthRequest;
    const res = mockRes();
    const next = jest.fn();
    requireRole('owner')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('requireTenantAccess()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401 quando userId ausente', async () => {
    const req = { params: { tenantId: 't1' } } as unknown as AuthRequest;
    const res = mockRes();
    const next = jest.fn();
    await requireTenantAccess()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('400 quando param ausente', async () => {
    const req = { userId: 'u1', params: {} } as unknown as AuthRequest;
    const res = mockRes();
    const next = jest.fn();
    await requireTenantAccess()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('next() quando usuário é dono do tenant', async () => {
    const req = { userId: 'u1', params: { tenantId: 't1' } } as unknown as AuthRequest;
    const res = mockRes();
    const next = jest.fn();
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({ id: 't1' });
    (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);

    await requireTenantAccess()(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.activeTenantId).toBe('t1');
    expect(req.userRole).toBe('owner');
  });

  it('403 quando usuário não tem acesso', async () => {
    const req = { userId: 'u1', params: { tenantId: 't1' } } as unknown as AuthRequest;
    const res = mockRes();
    const next = jest.fn();
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);

    await requireTenantAccess()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
