"use strict";
/**
 * Validação de Variáveis de Ambiente Obrigatórias
 * Garante que todas as variáveis críticas estão configuradas antes da inicialização
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.validateEnv = validateEnv;
/**
 * Valida e carrega variáveis de ambiente obrigatórias
 * @throws Error se alguma variável crítica não estiver configurada
 */
function validateEnv() {
    var requiredVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'JWT_EXPIRATION',
    ];
    var missing = [];
    for (var _i = 0, requiredVars_1 = requiredVars; _i < requiredVars_1.length; _i++) {
        var varName = requiredVars_1[_i];
        if (!process.env[varName]) {
            missing.push(varName);
        }
    }
    if (missing.length > 0) {
        var errorMessage = "\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551  \u274C ERRO CR\u00CDTICO - VARI\u00C1VEIS DE AMBIENTE FALTANDO        \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n\nAs seguintes vari\u00E1veis obrigat\u00F3rias n\u00E3o est\u00E3o configuradas:\n".concat(missing.map(function (v) { return "  - ".concat(v); }).join('\n'), "\n\nPor favor, configure-as no arquivo .env antes de iniciar o servidor.\n\nExemplo de configura\u00E7\u00E3o m\u00EDnima (.env):\nDATABASE_URL=\"postgresql://user:password@localhost:5432/database\"\nJWT_SECRET=\"seu-secret-super-seguro-minimo-32-caracteres\"\nJWT_EXPIRATION=\"15m\"\n");
        console.error(errorMessage);
        throw new Error('Variáveis de ambiente obrigatórias não configuradas');
    }
    // Validar JWT_SECRET tem tamanho mínimo seguro
    var jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret.length < 32) {
        var errorMessage = "\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551  \u26A0\uFE0F  AVISO DE SEGURAN\u00C7A - JWT_SECRET INSEGURO            \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n\nJWT_SECRET deve ter no m\u00EDnimo 32 caracteres para ser seguro.\nTamanho atual: ".concat(jwtSecret.length, " caracteres\n\nGere um secret seguro com:\n  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n");
        console.error(errorMessage);
        throw new Error('JWT_SECRET muito curto - mínimo 32 caracteres');
    }
    // Validar formato de JWT_EXPIRATION
    var expirationRegex = /^\d+[smhd]$/;
    if (!expirationRegex.test(process.env.JWT_EXPIRATION)) {
        throw new Error('JWT_EXPIRATION deve estar no formato: 15m, 1h, 7d, etc');
    }
    return {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: parseInt(process.env.PORT || '3000'),
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: jwtSecret,
        JWT_EXPIRATION: process.env.JWT_EXPIRATION,
        FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3001',
        REDIS_URL: process.env.REDIS_URL,
        // Asaas Payment Gateway
        ASAAS_API_KEY: process.env.ASAAS_API_KEY,
        ASAAS_SANDBOX: process.env.ASAAS_SANDBOX || 'true',
        ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN,
    };
}
/**
 * Configuração validada e tipada de ambiente
 * Use esta constante ao invés de process.env
 */
exports.env = validateEnv();
// Log de inicialização bem-sucedida
console.log("\n\u2705 Vari\u00E1veis de ambiente validadas com sucesso\n   - Ambiente: ".concat(exports.env.NODE_ENV, "\n   - Porta: ").concat(exports.env.PORT, "\n   - JWT expira em: ").concat(exports.env.JWT_EXPIRATION, "\n   - Frontend URL: ").concat(exports.env.FRONTEND_URL, "\n"));
