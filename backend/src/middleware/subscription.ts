/**
 * Middleware de Verificação de Assinatura
 * Bloqueia acesso quando trial expirou ou assinatura está suspensa/cancelada.
 *
 * SPRINT CORRETIVO 3 — middleware é READ-ONLY:
 *   - NÃO mais grava `subscriptionStatus='suspended'` quando detecta trial
 *     vencido. Essa transição agora é feita pelo job `subscription-lifecycle`
 *     (atômico, fora do request cycle, sem race com webhook).
 *   - past_due distinguido de active: passa, mas é exposto via header
 *     `X-Subscription-State` para o front exibir banner.
 *   - cancelamento agendado (cancelledAt setado + status='active' +
 *     currentPeriodEnd no futuro) MANTÉM acesso até o fim do período.
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

/** Estados em que o tenant CONTINUA tendo acesso. */
const ALLOWED_CACHE_STATES = new Set(['active', 'past_due']);

/** Estados em que o tenant é BLOQUEADO. */
const BLOCKED_CACHE_STATES = new Set(['suspended', 'cancelled']);

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
      if (BLOCKED_CACHE_STATES.has(cached.status)) {
        return res.status(402).json({
          success: false,
          error: {
            code: cached.status === 'cancelled'
              ? 'SUBSCRIPTION_CANCELLED'
              : 'SUBSCRIPTION_REQUIRED',
            message: 'Sua assinatura expirou ou foi suspensa. Por favor, atualize seu plano.',
            subscriptionStatus: cached.status,
          },
        });
      }
      // Sinaliza past_due para o front (sem bloquear).
      res.setHeader('X-Subscription-State', cached.status);
      return next();
    }

    // Buscar tenant do banco
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
      },
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

    // SPRINT 3: detectar trial vencido em LEITURA. Bloqueia acesso na
    // resposta deste request, MAS NÃO escreve no DB — o job
    // `subscription-lifecycle` é o único responsável por flipar o estado.
    // Evita race condition entre múltiplos requests concorrentes e webhook
    // de pagamento que poderia chegar entre o read e o write.
    const isTrialExpiredButNotYetFlipped =
      tenant.subscriptionPlan === 'trial' &&
      tenant.subscriptionStatus === 'active' &&
      tenant.trialEndsAt !== null &&
      tenant.trialEndsAt < new Date();

    if (isTrialExpiredButNotYetFlipped) {
      // NÃO escreve no DB e NÃO popula cache (deixa o job fazer).
      return res.status(402).json({
        success: false,
        error: {
          code: 'TRIAL_EXPIRED',
          message: 'Seu período de teste expirou. Assine um plano para continuar.',
          subscriptionStatus: 'suspended',
          trialExpired: true,
        },
      });
    }

    // Verificar status da assinatura
    if (BLOCKED_CACHE_STATES.has(tenant.subscriptionStatus)) {
      // Atualizar cache (read-through). Esta NÃO é uma escrita de domínio,
      // apenas reflete o que já está no DB.
      setCachedSubscription(tenantId, tenant.subscriptionStatus);

      return res.status(402).json({
        success: false,
        error: {
          code: tenant.subscriptionStatus === 'cancelled'
            ? 'SUBSCRIPTION_CANCELLED'
            : 'SUBSCRIPTION_SUSPENDED',
          message: tenant.subscriptionStatus === 'cancelled'
            ? 'Sua assinatura foi cancelada. Reative para continuar.'
            : 'Sua assinatura está suspensa. Regularize o pagamento para continuar.',
          subscriptionStatus: tenant.subscriptionStatus,
        },
      });
    }

    // Estado permitido (active OU past_due) — atualiza cache.
    const allowed = ALLOWED_CACHE_STATES.has(tenant.subscriptionStatus)
      ? tenant.subscriptionStatus
      : 'active';
    setCachedSubscription(tenantId, allowed);
    res.setHeader('X-Subscription-State', allowed);

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
