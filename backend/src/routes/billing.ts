/**
 * Billing — Fase A1 + A2A (C3)
 *
 * Superfície:
 *   - GET  /billing/health              (flag asaas.enabled)
 *   - POST /billing/subscriptions       (flag asaas.enabled + asaas.subscription.enabled)
 *
 *   - /health: não consulta o Asaas remotamente por padrão (evita custo em liveness).
 *     Query param `?ping=1` força chamada real ao Asaas (/myAccount).
 *   - /subscriptions: rota INTERNA gated. Em produção as duas flags estão OFF,
 *     portanto o endpoint responde 404. Sem consumer de webhook ainda.
 */

import { Router, Request, Response } from 'express';
import { requireFeature } from '../middleware/feature-flag';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';
import {
  AsaasApiError,
  AsaasNetworkError,
  buildAsaasClientFromEnv,
} from '../services/asaas/asaas-client';
import { buildAsaasCustomerService } from '../services/asaas/asaas-customer.service';
import { buildAsaasSubscriptionService } from '../services/asaas/asaas-subscription.service';
import {
  buildSaasSubscriptionService,
  SaasSubscriptionServiceError,
} from '../services/saas-subscription.service';
import { prisma } from '../utils/prisma-client';

const router = Router();

// Gate por flag principal de integração.
router.use(requireFeature('asaas.enabled'));

router.get('/health', async (req: Request, res: Response) => {
  const client = buildAsaasClientFromEnv();
  const hasApiKey = !!process.env.ASAAS_API_KEY;
  const hasWebhookToken = !!process.env.ASAAS_WEBHOOK_TOKEN;
  const sandbox = (process.env.ASAAS_SANDBOX ?? 'true').toLowerCase() !== 'false';

  const base = {
    asaasConfigured: !!client,
    sandbox,
    hasApiKey,
    hasWebhookToken,
  };

  // Só faz round-trip ao Asaas se explicitamente pedido
  if (req.query.ping !== '1') {
    return successResponse(res, { ...base, probed: false });
  }

  if (!client) {
    return errorResponse(
      res,
      'ASAAS_NOT_CONFIGURED',
      'ASAAS_API_KEY ausente',
      503,
    );
  }

  try {
    await client.ping();
    return successResponse(res, { ...base, probed: true, probeOk: true });
  } catch (err) {
    log.warn('Asaas ping falhou', {
      err: (err as Error).message,
      status: err instanceof AsaasApiError ? err.status : undefined,
    });
    const status = err instanceof AsaasApiError ? 502 : 504;
    const code =
      err instanceof AsaasNetworkError
        ? 'ASAAS_NETWORK_ERROR'
        : 'ASAAS_UPSTREAM_ERROR';
    return errorResponse(res, code, 'Falha ao contactar Asaas', status);
  }
});

/**
 * POST /billing/subscriptions — Fase A2A (C3)
 *
 * Rota INTERNA gated por `asaas.subscription.enabled` (default OFF → 404).
 *
 * Body esperado (JSON):
 *   {
 *     tenantId:      string,
 *     plan:          string,                    // "monthly" em A2A
 *     amountCents:   number (int > 0),
 *     cycle:         "MONTHLY",
 *     customerData:  { name, email?, cpfCnpj?, mobilePhone?, externalReference? },
 *     billingType?:  "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED",
 *     nextDueDate?:  "YYYY-MM-DD",
 *     description?:  string
 *   }
 *
 * Comportamento:
 *   - flag OFF          → 404 NOT_FOUND
 *   - Asaas não configurado → 503 ASAAS_NOT_CONFIGURED
 *   - input inválido    → 400 INVALID_INPUT
 *   - já há sub ativa   → 200 { created:false, subscription }
 *   - sucesso           → 201 { created:true,  subscription }
 */
router.post(
  '/subscriptions',
  requireFeature('asaas.subscription.enabled'),
  async (req: Request, res: Response) => {
    const client = buildAsaasClientFromEnv();
    if (!client) {
      return errorResponse(
        res,
        'ASAAS_NOT_CONFIGURED',
        'ASAAS_API_KEY ausente',
        503,
      );
    }

    const body = (req.body ?? {}) as Record<string, any>;
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId : '';
    const plan = typeof body.plan === 'string' ? body.plan : '';
    const amountCents = Number.isInteger(body.amountCents) ? body.amountCents : NaN;
    const cycle = body.cycle;
    const customerData = (body.customerData ?? {}) as Record<string, any>;

    if (!tenantId || !plan || !Number.isFinite(amountCents) || cycle !== 'MONTHLY') {
      return errorResponse(
        res,
        'INVALID_INPUT',
        'tenantId, plan, amountCents(int) e cycle=MONTHLY são obrigatórios',
        400,
      );
    }
    if (!customerData.name || typeof customerData.name !== 'string') {
      return errorResponse(
        res,
        'INVALID_INPUT',
        'customerData.name é obrigatório',
        400,
      );
    }

    // DI explícita: passamos prisma real no call-site. Service não tem fallback.
    const asaasCustomerService = buildAsaasCustomerService({ client, db: prisma });
    const asaasSubscriptionService = buildAsaasSubscriptionService({ client });
    const saas = buildSaasSubscriptionService({
      db: prisma,
      asaasCustomerService,
      asaasSubscriptionService,
    });

    try {
      const out = await saas.createForTenant({
        tenantId,
        plan,
        amountCents,
        cycle: 'MONTHLY',
        customerData: {
          name: customerData.name,
          email: customerData.email,
          cpfCnpj: customerData.cpfCnpj,
          mobilePhone: customerData.mobilePhone,
          externalReference: customerData.externalReference,
          notificationDisabled: customerData.notificationDisabled,
        },
        billingType: body.billingType,
        nextDueDate: body.nextDueDate,
        description: body.description,
      });

      return successResponse(res, out, out.created ? 201 : 200);
    } catch (err) {
      if (err instanceof SaasSubscriptionServiceError) {
        const status = err.code === 'INVALID_INPUT' ? 400 : 502;
        log.warn('SaaS subscription create falhou', {
          code: err.code,
          tenantId,
          err: err.message,
        });
        return errorResponse(res, err.code, err.message, status);
      }
      log.error('Erro inesperado criando SaaS subscription', {
        tenantId,
        err: (err as Error).message,
      });
      return errorResponse(
        res,
        'INTERNAL_ERROR',
        'Erro interno ao criar assinatura',
        500,
      );
    }
  },
);

export default router;
