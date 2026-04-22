/**
 * TenantResolver Tests - Phase 1B
 *
 * Validates strict resolution order (activeTenantId → homeTenantId → legacy
 * tenantId → error) with NO silent fallback to "first TenantUser".
 */

import {
  TenantResolverService,
  TenantSelectionRequiredError,
} from '../../services/tenant-resolver.service';
import { prisma } from '../../utils/prisma-client';

describe('TenantResolverService', () => {
  let svc: TenantResolverService;

  beforeEach(() => {
    svc = new TenantResolverService();
    jest.clearAllMocks();
  });

  const userId = 'user-1';

  describe('userHasAccess()', () => {
    it('retorna "owner" quando o usuário é dono do tenant', async () => {
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({ id: 't-1' });
      (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);
      const role = await svc.userHasAccess(userId, 't-1');
      expect(role).toBe('owner');
    });

    it('retorna o role do TenantUser quando não é dono mas tem link ativo', async () => {
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue({
        role: 'member',
        tenant: { deletedAt: null },
      });
      const role = await svc.userHasAccess(userId, 't-1');
      expect(role).toBe('member');
    });

    it('nega acesso se o tenant do TenantUser estiver soft-deleted', async () => {
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue({
        role: 'member',
        tenant: { deletedAt: new Date() },
      });
      const role = await svc.userHasAccess(userId, 't-1');
      expect(role).toBeNull();
    });

    it('retorna null quando não há ownership nem TenantUser', async () => {
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);
      const role = await svc.userHasAccess(userId, 't-1');
      expect(role).toBeNull();
    });
  });

  describe('resolve() - ordem de prioridade', () => {
    it('prioriza activeTenantId sobre homeTenantId e legacy', async () => {
      // active valid
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'active-t' });
      (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const out = await svc.resolve({
        userId,
        activeTenantIdFromToken: 'active-t',
        legacyTenantIdFromToken: 'legacy-t',
      });
      expect(out).toEqual({ tenantId: 'active-t', source: 'activeTenantId' });
      // não deveria precisar ler user.homeTenantId quando activeTenantId válido
      // (mas a implementação pode ler home de qualquer forma — isso é ok)
    });

    it('usa homeTenantId quando activeTenantId ausente', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ homeTenantId: 'home-t' });
      // home-t is valid via ownership
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({ id: 'home-t' });
      (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);

      const out = await svc.resolve({
        userId,
        legacyTenantIdFromToken: 'legacy-t',
      });
      expect(out).toEqual({ tenantId: 'home-t', source: 'homeTenantId' });
    });

    it('usa legacy tenantId quando activeTenantId e homeTenantId ausentes', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ homeTenantId: null });
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({ id: 'legacy-t' });
      (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);

      const out = await svc.resolve({
        userId,
        legacyTenantIdFromToken: 'legacy-t',
      });
      expect(out).toEqual({ tenantId: 'legacy-t', source: 'legacyTokenTenantId' });
    });

    it('falha com TenantSelectionRequiredError quando nenhuma fonte produz tenant válido', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ homeTenantId: null });
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        svc.resolve({ userId })
      ).rejects.toBeInstanceOf(TenantSelectionRequiredError);
    });

    it('falha sem fallback silencioso quando activeTenantId do token é inválido e não há outras fontes', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ homeTenantId: null });
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        svc.resolve({ userId, activeTenantIdFromToken: 'invalid-t' })
      ).rejects.toBeInstanceOf(TenantSelectionRequiredError);
    });

    it('cai para homeTenantId quando activeTenantId do token é inválido', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ homeTenantId: 'home-t' });
      // activeTenantIdFromToken inválido: first check retorna null em ambos
      // homeTenantId válido via ownership: segunda checagem passa
      (prisma.tenant.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)            // active invalid
        .mockResolvedValueOnce({ id: 'home-t' }); // home valid
      (prisma.tenantUser.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)  // active TenantUser check
        .mockResolvedValueOnce(null); // home TenantUser check

      const out = await svc.resolve({
        userId,
        activeTenantIdFromToken: 'invalid-t',
      });
      expect(out).toEqual({ tenantId: 'home-t', source: 'homeTenantId' });
    });
  });
});
