import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  userId?: string;
  tenantId?: string;
  userRole?: string;
  /** Phase 1B: populated when the JWT carries an activeTenantId claim. */
  activeTenantId?: string;
}

interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  /** Phase 1B optional claim. Undefined for tokens issued before 1B. */
  activeTenantId?: string;
  iat: number;
  exp: number;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token não fornecido'
        }
      });
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
    if (decoded.activeTenantId) {
      req.activeTenantId = decoded.activeTenantId;
    }

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token inválido ou expirado'
      }
    });
  }
};

export const superMasterMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'super_master') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Acesso negado. Apenas Super Master.'
      }
    });
  }
  return next();
};

// Alias para compatibilidade
export const authenticateToken = authMiddleware;
