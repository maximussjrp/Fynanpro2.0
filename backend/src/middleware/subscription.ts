/**
 * Middleware de Verificação de Assinatura
 * Bloqueia acesso quando trial expirou ou assinatura está suspensa/cancelada
 */

import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth';
import { log } from '../utils/logger';

const prisma = new PrismaClient();

// Cache simples para evitar consultas repetidas ao banco
const subscriptionCache = new Map<string, { status: string; expiresAt: number }>();
const CACHE_TTL = 60 * 1000; // 1 minuto

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
    const cached = subscriptionCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
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
        subscriptionCache.set(tenantId, {
          status: 'suspended',
          expiresAt: Date.now() + CACHE_TTL
        });

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
      subscriptionCache.set(tenantId, {
        status: tenant.subscriptionStatus,
        expiresAt: Date.now() + CACHE_TTL
      });

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
    subscriptionCache.set(tenantId, {
      status: 'active',
      expiresAt: Date.now() + CACHE_TTL
    });

    return next();
  } catch (error) {
    log.error('Erro no middleware de assinatura', { error, tenantId: req.tenantId });
    // Em caso de erro, deixa passar para não bloquear indevidamente
    return next();
  }
};

/**
 * Limpa o cache de um tenant específico (usar após pagamento confirmado)
 */
export const clearSubscriptionCache = (tenantId: string) => {
  subscriptionCache.delete(tenantId);
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
