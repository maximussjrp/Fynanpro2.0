/**
 * Billing — Fase A1
 *
 * Superfície mínima: GET /billing/health (apenas quando asaas.enabled = ON).
 *   - Não consulta o Asaas remotamente por padrão (evita custo em liveness).
 *   - Informa se credenciais estão configuradas.
 *   - Query param `?ping=1` força chamada real ao Asaas (/myAccount).
 *
 * Endpoints de negócio (criar customer, subscription, checkout) virão nas Fases A2/A3.
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

export default router;
