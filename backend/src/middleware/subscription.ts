/**
 * Middleware de Verificação de Assinatura
 * Bloqueia acesso quando trial expirou ou assinatura está suspensa/cancelada
 *
 * C5.0: cache extraído para `services/billing/tenant-billing-cache.ts`
 * (evita dependência circular com handlers do webhook Asaas).
 */

import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth';
import { log } from '../utils/logger';
import {
  getCachedSubscription,
  setCachedSubscription,
  invalidateTenantBillingCache,
} from '../services/billing/tenant-billing-cache';

// Re-export para manter compat com importadores existentes.
export { invalidateTenantBillingCache as clearSubscriptionCache };

const prisma = new PrismaClient();

/**
 * Middleware que verifica se a assinatura está ativa
 * Retorna 402 (Payment Required) se bloqueado
 */
export const subscriptionMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return next(); // Deixa o auth middleware tratar
    }

    // Verificar cache primeiro
    const cached = getCachedSubscription(tenantId);
    if (cached) {
      if (cached.status === 'suspended' || cached.status === 'cancelled') {
        return res.status(402).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_REQUIRED',
            message: 'Sua assinatura expirou ou foi suspensa. Por favor, atualize seu plano.',
            subscriptionStatus: cached.status
          }
        });
      }
      return next();
    }

    // Buscar tenant do banco
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true
      }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'Workspace não encontrado'
        }
      });
    }

    // Verificar se é trial e se expirou
    if (tenant.subscriptionPlan === 'trial' && tenant.trialEndsAt) {
      const now = new Date();
      const trialEnd = new Date(tenant.trialEndsAt);
      
      if (now > trialEnd) {
        // Trial expirou - atualizar status para suspended
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { subscriptionStatus: 'suspended' }
        });

        // Atualizar cache
        setCachedSubscription(tenantId, 'suspended');

        log.info('Trial expirado - acesso bloqueado', { tenantId });

        return res.status(402).json({
          success: false,
          error: {
            code: 'TRIAL_EXPIRED',
            message: 'Seu período de teste expirou. Assine um plano para continuar.',
            subscriptionStatus: 'suspended',
            trialExpired: true
          }
        });
      }
    }

    // Verificar status da assinatura
    if (tenant.subscriptionStatus === 'suspended' || tenant.subscriptionStatus === 'cancelled') {
      // Atualizar cache
      setCachedSubscription(tenantId, tenant.subscriptionStatus);

      return res.status(402).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_SUSPENDED',
          message: tenant.subscriptionStatus === 'cancelled' 
            ? 'Sua assinatura foi cancelada. Reative para continuar.'
            : 'Sua assinatura está suspensa. Regularize o pagamento para continuar.',
          subscriptionStatus: tenant.subscriptionStatus
        }
      });
    }

    // Assinatura ativa - atualizar cache
    setCachedSubscription(tenantId, 'active');

    return next();
  } catch (error) {
    log.error('Erro no middleware de assinatura', { error, tenantId: req.tenantId });
    // Em caso de erro, deixa passar para não bloquear indevidamente
    return next();
  }
};

/**
 * Rotas que NÃO devem ser bloqueadas mesmo com assinatura suspensa
 * (para permitir que o usuário veja planos e faça pagamento)
 */
export const SUBSCRIPTION_EXEMPT_ROUTES = [
  '/subscription',
  '/subscription/plans',
  '/subscription/current',
  '/subscription/checkout',
  '/subscription/webhook',
  '/auth/logout',
  '/auth/me',
  '/users/me',
];

/**
 * Middleware que ignora verificação de assinatura para rotas específicas
 */
export const subscriptionMiddlewareWithExemptions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Verificar se a rota é exempta
  const path = req.path;
  const isExempt = SUBSCRIPTION_EXEMPT_ROUTES.some(route => path.startsWith(route));
  
  if (isExempt) {
    return next();
  }

  return subscriptionMiddleware(req, res, next);
};
