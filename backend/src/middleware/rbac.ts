/**
 * RBAC middlewares - Phase 1B
 *
 * NEW middlewares that MUST NOT be applied to any legacy route in Phase 1B.
 * They exist so Phase 2+ handlers can opt in. Designed to be composed with
 * the existing `authMiddleware` (which populates req.userId etc.).
 *
 * Usage (example, NOT wired anywhere in Phase 1B):
 *
 *   router.get(
 *     '/consultant/clients',
 *     authMiddleware,
 *     requireActiveTenant(),
 *     requireRole('owner', 'consultant'),
 *     handler
 *   );
 */

import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth';
import {
  tenantResolver,
  TenantSelectionRequiredError,
} from '../services/tenant-resolver.service';

/**
 * Ensures the request has a resolved active tenant.
 *
 * Resolution follows `TenantResolverService.resolve()` strict order:
 *   1. activeTenantId from JWT
 *   2. user.homeTenantId
 *   3. legacy tenantId from JWT
 *   4. error TENANT_SELECTION_REQUIRED (no silent fallback)
 *
 * On success, sets req.activeTenantId. Also verifies TenantUser/ownership
 * on the server — JWT alone is never sufficient.
 */
export function requireActiveTenant() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Não autenticado' },
      });
    }

    try {
      const resolved = await tenantResolver.resolve({
        userId: req.userId,
        activeTenantIdFromToken: req.activeTenantId ?? null,
        legacyTenantIdFromToken: req.tenantId ?? null,
      });
      req.activeTenantId = resolved.tenantId;
      return next();
    } catch (err) {
      if (err instanceof TenantSelectionRequiredError) {
        return res.status(409).json({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
      }
      return res.status(500).json({
        success: false,
        error: {
          code: 'TENANT_RESOLUTION_ERROR',
          message: 'Erro ao resolver tenant ativo',
        },
      });
    }
  };
}

/**
 * Enforces that the user's role (from the JWT) is one of the allowed values.
 *
 * This is a COARSE check. Fine-grained authorization (per-tenant role,
 * per-resource ownership) must be done in the handler or with a separate
 * policy layer — a JWT claim is NEVER sufficient for authorization.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.userRole;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Acesso negado para este papel',
        },
      });
    }
    return next();
  };
}

/**
 * Enforces that the authenticated user has an ACTIVE link to the given
 * tenantId (via ownership or TenantUser). Re-checks on every request.
 *
 * Prefer this over trusting JWT claims when the tenant comes from the URL
 * (e.g. /tenants/:tenantId/...).
 */
export function requireTenantAccess(tenantIdParam = 'tenantId') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Não autenticado' },
      });
    }
    const tenantId = req.params[tenantIdParam];
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TENANT_ID_REQUIRED',
          message: `Parâmetro ${tenantIdParam} é obrigatório`,
        },
      });
    }
    try {
      const role = await tenantResolver.userHasAccess(req.userId, tenantId);
      if (!role) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'TENANT_ACCESS_DENIED',
            message: 'Usuário não tem acesso a este tenant',
          },
        });
      }
      req.activeTenantId = tenantId;
      req.userRole = role;
      return next();
    } catch {
      return res.status(500).json({
        success: false,
        error: {
          code: 'TENANT_ACCESS_CHECK_ERROR',
          message: 'Erro ao validar acesso ao tenant',
        },
      });
    }
  };
}
