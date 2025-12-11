/**
 * Validação de Variáveis de Ambiente Obrigatórias
 * Garante que todas as variáveis críticas estão configuradas antes da inicialização
 */

interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRATION: string;
  FRONTEND_URL: string;
  REDIS_URL?: string;
}

/**
 * Valida e carrega variáveis de ambiente obrigatórias
 * @throws Error se alguma variável crítica não estiver configurada
 */
export function validateEnv(): EnvConfig {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_EXPIRATION',
  ];

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

  // Validar formato de JWT_EXPIRATION
  const expirationRegex = /^\d+[smhd]$/;
  if (!expirationRegex.test(process.env.JWT_EXPIRATION!)) {
    throw new Error('JWT_EXPIRATION deve estar no formato: 15m, 1h, 7d, etc');
  }

  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000'),
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRATION: process.env.JWT_EXPIRATION!,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3001',
    REDIS_URL: process.env.REDIS_URL,
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
