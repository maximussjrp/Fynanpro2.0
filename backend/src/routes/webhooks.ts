/**
 * Webhooks — Fase A1
 *
 * Rota única: POST /webhooks/asaas
 * Gate: feature flag `asaas.webhook.enabled` (default OFF → 404)
 *
 * O Asaas pode enviar o token de três formas:
 *   - header `asaas-access-token`
 *   - header `asaas-access_token`
 *   - body.accessToken (nos payloads antigos)
 *
 * Aceitamos qualquer uma para compatibilidade.
 */

import { Router, Request, Response } from 'express';
import { requireFeature } from '../middleware/feature-flag';
import { errorResponse, successResponse } from '../utils/response';
import { log } from '../utils/logger';
import {
  asaasWebhookReceiver,
  InvalidWebhookPayloadError,
  InvalidWebhookTokenError,
} from '../services/asaas/webhook-receiver.service';

const router = Router();

// Gate por flag: sem ela, rota responde 404 (surface oculta).
router.use(requireFeature('asaas.webhook.enabled'));

function extractToken(req: Request): string | undefined {
  const h1 = req.header('asaas-access-token');
  const h2 = req.header('asaas-access_token');
  const bodyToken =
    req.body && typeof req.body === 'object'
      ? (req.body as any).accessToken
      : undefined;
  return h1 || h2 || (typeof bodyToken === 'string' ? bodyToken : undefined);
}

router.post('/asaas', async (req: Request, res: Response) => {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN || '';
  const providedToken = extractToken(req);

  try {
    const result = await asaasWebhookReceiver.receive({
      expectedToken,
      providedToken,
      payload: req.body,
    });
    return successResponse(res, result, 200);
  } catch (err) {
    if (err instanceof InvalidWebhookTokenError) {
      log.warn('Asaas webhook: token inválido');
      return errorResponse(res, err.code, err.message, 401);
    }
    if (err instanceof InvalidWebhookPayloadError) {
      log.warn('Asaas webhook: payload inválido', { message: err.message });
      return errorResponse(res, err.code, err.message, 400);
    }
    log.error('Asaas webhook: erro inesperado', { err: (err as Error).message });
    // Para tudo que não seja erro esperado, retornamos 500.
    // Asaas vai retentar — tudo bem, dedup por asaasEventId protege.
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao processar webhook', 500);
  }
});

export default router;
