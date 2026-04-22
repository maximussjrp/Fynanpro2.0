/**
 * Jest Env Bootstrap
 * Roda ANTES do carregamento dos módulos (setupFiles).
 * Necessário porque config/env.ts executa validateEnv() no import.
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-secret-key-with-at-least-32-characters-length';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-distinct-with-32+chars-minimum';
process.env.JWT_EXPIRATION = '15m';
process.env.JWT_REFRESH_EXPIRATION = '7d';
process.env.FRONTEND_URL = 'http://localhost:3001';
process.env.REDIS_URL = 'redis://localhost:6379';
