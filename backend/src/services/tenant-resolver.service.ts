/**
 * TenantResolver - Phase 1B
 *
 * Central policy for resolving the "active tenant" for a request, with a strict
 * priority order. MUST be used whenever a handler/middleware needs to know
 * which tenant to operate on in the new multi-tenant (consultant-driven) flow.
 *
 * Resolution order (NO fallback to "first TenantUser"):
 *   1. explicit activeTenantId from JWT (Phase 1B tokens)
 *   2. user.homeTenantId (Phase 1A optional column)
 *   3. legacy tenantId embedded in the JWT (Phase 1A tokens and older)
 *   4. FAIL with TenantSelectionRequiredError
 *
 * Every positive resolution (1, 2, 3) is ALSO validated against the
 * TenantUser table on the server — the JWT by itself is never sufficient
 * for authorization (see userHasAccess()).
 *
 * This module is intentionally dependency-light and framework-agnostic.
 */

import { prisma } from '../utils/prisma-client';

export type TenantResolutionSource = 'activeTenantId' | 'homeTenantId' | 'legacyTokenTenantId';

export interface ResolvedTenant {
  tenantId: string;
  source: TenantResolutionSource;
}

export interface ResolveTenantInput {
  userId: string;
  /** activeTenantId claim from the new JWT format (Phase 1B). */
  activeTenantIdFromToken?: string | null;
  /** tenantId claim from legacy JWTs (Phase 1A and older). */
  legacyTenantIdFromToken?: string | null;
}

export class TenantSelectionRequiredError extends Error {
  public readonly code = 'TENANT_SELECTION_REQUIRED';
  constructor(message = 'Usuário não possui tenant padrão. Selecione um tenant.') {
    super(message);
    this.name = 'TenantSelectionRequiredError';
  }
}

export class TenantAccessDeniedError extends Error {
  public readonly code = 'TENANT_ACCESS_DENIED';
  constructor(public readonly tenantId: string, message = 'Usuário não tem acesso a este tenant.') {
    super(message);
    this.name = 'TenantAccessDeniedError';
  }
}

export class TenantResolverService {
  /**
   * Verifies on the server that the user has an active (non-deleted) link to
   * the given tenant, either via ownership or via TenantUser.
   *
   * Returns the role the user has for that tenant (owner | <TenantUser.role>)
   * or `null` when access should be denied.
   */
  async userHasAccess(userId: string, tenantId: string): Promise<string | null> {
    const [ownedTenant, tenantUser] = await Promise.all([
      prisma.tenant.findFirst({
        where: { id: tenantId, ownerId: userId, deletedAt: null },
        select: { id: true },
      }),
      prisma.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
        select: { role: true, tenant: { select: { deletedAt: true } } },
      }),
    ]);

    if (ownedTenant) return 'owner';
    if (tenantUser && tenantUser.tenant && tenantUser.tenant.deletedAt === null) {
      return tenantUser.role;
    }
    return null;
  }

  /**
   * Resolves the active tenant for a request following the strict Phase 1B
   * priority order. Throws TenantSelectionRequiredError if none of the
   * sources yield a valid, accessible tenant.
   */
  async resolve(input: ResolveTenantInput): Promise<ResolvedTenant> {
    const candidates: Array<{ id: string; source: TenantResolutionSource }> = [];

    if (input.activeTenantIdFromToken) {
      candidates.push({ id: input.activeTenantIdFromToken, source: 'activeTenantId' });
    }

    // homeTenantId is persisted on the user; read it lazily only if needed
    let homeTenantLoaded = false;
    let homeTenantId: string | null = null;

    const readHome = async (): Promise<string | null> => {
      if (homeTenantLoaded) return homeTenantId;
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { homeTenantId: true },
      });
      homeTenantId = user?.homeTenantId ?? null;
      homeTenantLoaded = true;
      return homeTenantId;
    };

    const home = await readHome();
    if (home) {
      candidates.push({ id: home, source: 'homeTenantId' });
    }

    if (input.legacyTenantIdFromToken) {
      candidates.push({ id: input.legacyTenantIdFromToken, source: 'legacyTokenTenantId' });
    }

    for (const candidate of candidates) {
      const role = await this.userHasAccess(input.userId, candidate.id);
      if (role) {
        return { tenantId: candidate.id, source: candidate.source };
      }
    }

    throw new TenantSelectionRequiredError();
  }
}

export const tenantResolver = new TenantResolverService();
