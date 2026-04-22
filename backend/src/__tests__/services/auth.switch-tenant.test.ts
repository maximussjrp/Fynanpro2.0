/**
 * AuthService.switchTenant Tests - Phase 1B
 *
 * Validates that switch-tenant:
 *  - checks ownership / TenantUser on the server (JWT not sufficient)
 *  - issues a new access token with activeTenantId claim
 *  - revokes previous refresh tokens
 *  - refuses when user has no access to target tenant
 */

import { AuthService } from '../../services/auth.service';
import { prisma } from '../../utils/prisma-client';
import jwt from 'jsonwebtoken';

describe('AuthService.switchTenant', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  const userId = 'user-42';
  const targetTenantId = '11111111-1111-1111-1111-111111111111';

  const mockActiveUser = {
    id: userId,
    email: 'u@example.com',
    role: 'owner',
    isActive: true,
  };

  const mockTenant = {
    id: targetTenantId,
    name: 'Acme',
    slug: 'acme',
  };

  it('troca para tenant quando o usuário é OWNER', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockActiveUser);
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(mockTenant);
    (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.refreshToken.create as jest.Mock).mockResolvedValue({ id: 'rt-1' });

    const result = await authService.switchTenant(userId, targetTenantId);

    expect(result.tenant).toEqual(mockTenant);
    expect(result.role).toBe('owner');
    expect(result.tokens.accessToken).toBeTruthy();

    // JWT carrega activeTenantId
    const decoded = jwt.decode(result.tokens.accessToken) as any;
    expect(decoded.activeTenantId).toBe(targetTenantId);
    expect(decoded.tenantId).toBe(targetTenantId); // legado preservado
    expect(decoded.userId).toBe(userId);

    // Revoga tokens antigos
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId, isRevoked: false }),
        data: expect.objectContaining({ revokedReason: 'switch_tenant' }),
      })
    );
  });

  it('troca para tenant quando o usuário é MEMBER via TenantUser', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockActiveUser, role: 'member' });
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(null); // não é owner
    (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue({
      role: 'admin',
      tenant: { ...mockTenant, deletedAt: null },
    });
    (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.refreshToken.create as jest.Mock).mockResolvedValue({ id: 'rt-2' });

    const result = await authService.switchTenant(userId, targetTenantId);

    expect(result.role).toBe('admin');
    const decoded = jwt.decode(result.tokens.accessToken) as any;
    expect(decoded.activeTenantId).toBe(targetTenantId);
    expect(decoded.role).toBe('admin');
  });

  it('falha com TENANT_ACCESS_DENIED quando não há ownership nem TenantUser', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockActiveUser);
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      authService.switchTenant(userId, targetTenantId)
    ).rejects.toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
  });

  it('falha quando o tenant do TenantUser está soft-deleted', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockActiveUser);
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue({
      role: 'member',
      tenant: { ...mockTenant, deletedAt: new Date() },
    });

    await expect(
      authService.switchTenant(userId, targetTenantId)
    ).rejects.toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
  });

  it('rejeita usuário inativo mesmo com acesso ao tenant', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockActiveUser, isActive: false });
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(mockTenant);
    (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      authService.switchTenant(userId, targetTenantId)
    ).rejects.toThrow('Usuário inativo ou inexistente');
  });
});
