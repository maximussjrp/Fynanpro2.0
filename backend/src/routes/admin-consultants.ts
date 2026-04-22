/**
 * Admin routes — revisão de credenciamento de consultores (Fase 2A).
 *
 * Só existem com `consultant.enabled` ON; exigem super_master.
 * Montado em /api/v1/admin/consultants.
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, superMasterMiddleware } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-flag';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';
import { ListConsultantsQuerySchema } from '../dtos/consultant.dto';
import {
  consultantService,
  ConsultantNotFoundError,
} from '../services/consultant.service';

const router = Router();

router.use(requireFeature('consultant.enabled'));
router.use(authMiddleware);
router.use(superMasterMiddleware);

/**
 * GET /admin/consultants — lista consultores (filtro opcional por status).
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  const parsed = ListConsultantsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return errorResponse(res, 'VALIDATION_ERROR', 'Query inválida', 400, parsed.error.issues);
  }
  try {
    const result = await consultantService.adminList(parsed.data);
    return successResponse(res, result);
  } catch (err) {
    log.error('GET /admin/consultants failed', { err });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro interno', 500);
  }
});

/**
 * POST /admin/consultants/:id/approve — aprova credenciamento (status=ACTIVE).
 */
router.post('/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const updated = await consultantService.adminApprove(req.params.id);
    log.info('Consultant approved', { consultantId: updated.id, by: req.userId });
    return successResponse(res, updated);
  } catch (err) {
    if (err instanceof ConsultantNotFoundError) {
      return errorResponse(res, err.code, err.message, 404);
    }
    log.error('POST /admin/consultants/:id/approve failed', { err });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro interno', 500);
  }
});

/**
 * POST /admin/consultants/:id/suspend — suspende (status=SUSPENDED).
 */
router.post('/:id/suspend', async (req: AuthRequest, res: Response) => {
  try {
    const updated = await consultantService.adminSuspend(req.params.id);
    log.info('Consultant suspended', { consultantId: updated.id, by: req.userId });
    return successResponse(res, updated);
  } catch (err) {
    if (err instanceof ConsultantNotFoundError) {
      return errorResponse(res, err.code, err.message, 404);
    }
    log.error('POST /admin/consultants/:id/suspend failed', { err });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro interno', 500);
  }
});

/**
 * POST /admin/consultants/:id/reject — rejeita/desativa (status=INACTIVE).
 */
router.post('/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    const updated = await consultantService.adminReject(req.params.id);
    log.info('Consultant rejected', { consultantId: updated.id, by: req.userId });
    return successResponse(res, updated);
  } catch (err) {
    if (err instanceof ConsultantNotFoundError) {
      return errorResponse(res, err.code, err.message, 404);
    }
    log.error('POST /admin/consultants/:id/reject failed', { err });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro interno', 500);
  }
});

export default router;
