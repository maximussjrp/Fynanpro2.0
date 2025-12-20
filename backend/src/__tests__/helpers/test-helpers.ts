/**
 * Test Helpers
 * Funções auxiliares para testes de integração
 */

import { authService } from '../../services/auth.service';
import { mockPrisma } from '../setup';

/**
 * Cria um usuário de teste e retorna tokens
 */
export async function createTestUser(email = 'test@example.com', password = 'Test123!@#') {
  const userData = {
    email,
    password,
    name: 'Test User',
    tenantName: 'Test Tenant',
  };

  const result = await authService.register(userData);
  return result;
}

/**
 * Faz login e retorna tokens
 */
export async function loginTestUser(email = 'test@example.com', password = 'Test123!@#') {
  const result = await authService.login({ email, password });
  return result;
}

/**
 * Gera um token de acesso válido para testes
 */
export function generateAuthHeader(accessToken: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

/**
 * Limpa dados de teste do banco
 */
export async function cleanupTestData() {
  // Jest já limpa os mocks no afterEach via setup.ts
  // Esta função existe para compatibilidade futura
}

/**
 * Mock de tenant para testes
 */
export function mockTenant(id = 'tenant-123', slug = 'test-tenant') {
  return {
    id,
    slug,
    name: 'Test Tenant',
    plan: 'FREE' as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Mock de usuário para testes
 */
export function mockUser(id = 'user-123', tenantId = 'tenant-123') {
  return {
    id,
    email: 'test@example.com',
    name: 'Test User',
    password: '$2a$10$hashedpassword',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    tenants: [
      {
        tenantId,
        userId: id,
        role: 'ADMIN' as const,
        isActive: true,
        joinedAt: new Date(),
      },
    ],
  };
}

/**
 * Configura mocks comuns para testes de auth
 */
export function setupAuthMocks() {
  const tenant = mockTenant();
  const user = mockUser(undefined, tenant.id);

  // Mock tenant.findUnique para verificações de slug
  mockPrisma.tenant.findUnique.mockResolvedValue(null);

  // Mock tenant.create
  mockPrisma.tenant.create.mockResolvedValue(tenant);

  // Mock user.create
  mockPrisma.user.create.mockResolvedValue(user as any);

  // Mock user.findUnique para login
  mockPrisma.user.findUnique.mockResolvedValue(user as any);

  return { tenant, user };
}
