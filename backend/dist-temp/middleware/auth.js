"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = exports.superMasterMiddleware = exports.authMiddleware = void 0;
var jsonwebtoken_1 = require("jsonwebtoken");
var env_1 = require("../config/env");
var authMiddleware = function (req, res, next) {
    var _a;
    try {
        var token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Token não fornecido'
                }
            });
        }
        var decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.tenantId = decoded.tenantId;
        req.userRole = decoded.role;
        return next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_TOKEN',
                message: 'Token inválido ou expirado'
            }
        });
    }
};
exports.authMiddleware = authMiddleware;
var superMasterMiddleware = function (req, res, next) {
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
exports.superMasterMiddleware = superMasterMiddleware;
// Alias para compatibilidade
exports.authenticateToken = exports.authMiddleware;
