/**
 * Consultant routes — Fase 2A (CONSULTANT / CLIENT BASE)
 *
 * Todas as rotas aqui:
 *   - estão atrás do feature flag `consultant.enabled` (default OFF)
 *   - exigem autenticação JWT (authMiddleware)
 *   - NÃO alteram nenhuma rota legada
 *   - NÃO concedem acesso ao tenant financeiro do cliente (Fase 2A)
 *
 * Montado em /api/v1/consultant.
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-flag';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';
import {
  ApplyConsultantSchema,
  UpdateConsultantSchema,
  ListClientsQuerySchema,
} from '../dtos/consultant.dto';
import {
  consultantService,
  ConsultantNotFoundError,
  ConsultantAlreadyExistsError,
  ConsultantSlugTakenError,
  ConsultantNotActiveError,
} from '../services/consultant.service';

const router = Router();

// Gate global: flag + auth.
router.use(requireFeature('consultant.enabled'));
router.use(authMiddleware);

/**
 * GET /consultant/me — perfil próprio do consultor.
 */
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const profile = await consultantService.getMyProfile(req.userId!);
    return successResponse(res, profile);
  } catch (err) {
    if (err instanceof ConsultantNotFoundError) {
      return errorResponse(res, err.code, err.message, 404);
    }
    log.error('GET /consultant/me failed', { err });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro interno', 500);
  }
});

/**
 * PATCH /consultant/me — atualização de campos básicos (displayName, bio, publicSlug).
 */
router.patch('/me', async (req: AuthRequest, res: Response) => {
  const parsed = UpdateConsultantSchema.safeParse(req.body);
  if (!parsed.success) {
    return errorResponse(res, 'VALIDATION_ERROR', 'Dados inválidos', 400, parsed.error.issues);
  }
  try {
    const updated = await consultantService.updateMyProfile(req.userId!, parsed.data);
    return successResponse(res, updated);
  } catch (err) {
    if (err instanceof ConsultantNotFoundError) {
      return errorResponse(res, err.code, err.message, 404);
    }
    if (err instanceof ConsultantSlugTakenError) {
      return errorResponse(res, err.code, err.message, 409);
    }
    log.error('PATCH /consultant/me failed', { err });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro interno', 500);
  }
});

/**
 * POST /consultant/apply — credenciamento: cria perfil em status PENDING.
 */
router.post('/apply', async (req: AuthRequest, res: Response) => {
  const parsed = ApplyConsultantSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return errorResponse(res, 'VALIDATION_ERROR', 'Dados inválidos', 400, parsed.error.issues);
  }
  try {
    const created = await consultantService.apply(req.userId!, parsed.data);
    return successResponse(res, created, 201);
  } catch (err) {
    if (err instanceof ConsultantAlreadyExistsError) {
      return errorResponse(res, err.code, err.message, 409);
    }
    if (err instanceof ConsultantSlugTakenError) {
      return errorResponse(res, err.code, err.message, 409);
    }
    log.error('POST /consultant/apply failed', { err });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro interno', 500);
  }
});

/**
 * GET /consultant/clients — lista vínculos do consultor autenticado.
 * Exige status ACTIVE (consultor pendente não vê lista).
 */
router.get('/clients', async (req: AuthRequest, res: Response) => {
  const parsedQuery = ListClientsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return errorResponse(res, 'VALIDATION_ERROR', 'Query inválida', 400, parsedQuery.error.issues);
  }
  try {
    const result = await consultantService.listMyClients(req.userId!, parsedQuery.data);
    return successResponse(res, result);
  } catch (err) {
    if (err instanceof ConsultantNotFoundError) {
      return errorResponse(res, err.code, err.message, 404);
    }
    if (err instanceof ConsultantNotActiveError) {
      return errorResponse(res, err.code, err.message, 403, { status: err.status });
    }
    log.error('GET /consultant/clients failed', { err });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro interno', 500);
  }
});

export default router;
