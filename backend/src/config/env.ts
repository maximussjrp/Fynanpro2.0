/**
 * Validação de Variáveis de Ambiente Obrigatórias
 * Garante que todas as variáveis críticas estão configuradas antes da inicialização
 */

interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_EXPIRATION: string;
  JWT_REFRESH_EXPIRATION: string;
  FRONTEND_URL: string;
  REDIS_URL?: string;
  // Asaas Payment Gateway
  ASAAS_API_KEY?: string;
  ASAAS_SANDBOX?: string;
  ASAAS_WEBHOOK_TOKEN?: string;
}

/**
 * Valida e carrega variáveis de ambiente obrigatórias
 * @throws Error se alguma variável crítica não estiver configurada
 */
export function validateEnv(): EnvConfig {
  const isProd = process.env.NODE_ENV === 'production';

  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_EXPIRATION',
    'JWT_REFRESH_EXPIRATION',
  ];

  // Em produção exigimos também FRONTEND_URL e REDIS_URL explicitamente
  if (isProd) {
    requiredVars.push('FRONTEND_URL', 'REDIS_URL');
  }

  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    const errorMessage = `
╔═══════════════════════════════════════════════════════════╗
║  ❌ ERRO CRÍTICO - VARIÁVEIS DE AMBIENTE FALTANDO        ║
╚═══════════════════════════════════════════════════════════╝

As seguintes variáveis obrigatórias não estão configuradas:
${missing.map(v => `  - ${v}`).join('\n')}

Por favor, configure-as no arquivo .env antes de iniciar o servidor.

Exemplo de configuração mínima (.env):
DATABASE_URL="postgresql://user:password@localhost:5432/database"
JWT_SECRET="seu-secret-super-seguro-minimo-32-caracteres"
JWT_EXPIRATION="15m"
`;
    console.error(errorMessage);
    throw new Error('Variáveis de ambiente obrigatórias não configuradas');
  }

  // Validar JWT_SECRET tem tamanho mínimo seguro
  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    const errorMessage = `
╔═══════════════════════════════════════════════════════════╗
║  ⚠️  AVISO DE SEGURANÇA - JWT_SECRET INSEGURO            ║
╚═══════════════════════════════════════════════════════════╝

JWT_SECRET deve ter no mínimo 32 caracteres para ser seguro.
Tamanho atual: ${jwtSecret.length} caracteres

Gere um secret seguro com:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
`;
    console.error(errorMessage);
    throw new Error('JWT_SECRET muito curto - mínimo 32 caracteres');
  }

  // Validar JWT_REFRESH_SECRET tamanho mínimo e distinção de JWT_SECRET
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;
  if (jwtRefreshSecret.length < 32) {
    console.error('❌ JWT_REFRESH_SECRET deve ter no mínimo 32 caracteres.');
    throw new Error('JWT_REFRESH_SECRET muito curto - mínimo 32 caracteres');
  }
  if (jwtRefreshSecret === jwtSecret) {
    console.error('❌ JWT_REFRESH_SECRET não pode ser igual a JWT_SECRET.');
    throw new Error('JWT_REFRESH_SECRET não pode ser igual a JWT_SECRET');
  }

  // Validar formato de JWT_EXPIRATION
  const expirationRegex = /^\d+[smhd]$/;
  if (!expirationRegex.test(process.env.JWT_EXPIRATION!)) {
    throw new Error('JWT_EXPIRATION deve estar no formato: 15m, 1h, 7d, etc');
  }
  if (!expirationRegex.test(process.env.JWT_REFRESH_EXPIRATION!)) {
    throw new Error('JWT_REFRESH_EXPIRATION deve estar no formato: 15m, 1h, 7d, etc');
  }

  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000'),
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: jwtSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    JWT_EXPIRATION: process.env.JWT_EXPIRATION!,
    JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION!,
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
export const env = validateEnv();

// Log de inicialização bem-sucedida
console.log(`
✅ Variáveis de ambiente validadas com sucesso
   - Ambiente: ${env.NODE_ENV}
   - Porta: ${env.PORT}
   - JWT expira em: ${env.JWT_EXPIRATION}
   - Frontend URL: ${env.FRONTEND_URL}
`);
