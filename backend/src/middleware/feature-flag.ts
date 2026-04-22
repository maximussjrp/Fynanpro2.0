/**
 * Feature flag gate middleware — Fase 2A
 *
 * Quando a flag estiver OFF, o endpoint responde 404 (como se não existisse),
 * evitando expor a superfície nova. Leitura é feita 1x por request no valor
 * já carregado em `featureFlags` (imutável após boot).
 */

import type { Request, Response, NextFunction } from 'express';
import { featureFlags, type FeatureFlagName } from '../config/feature-flags';

export function requireFeature(flag: FeatureFlagName) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (featureFlags[flag] === true) return next();
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Recurso indisponível' },
    });
  };
}
