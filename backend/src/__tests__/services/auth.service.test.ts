/**
 * AuthService Tests
 * Testa autenticação, registro, refresh tokens e segurança
 */

import { AuthService } from '../../services/auth.service';
import { prisma } from '../../utils/prisma-client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('register()', () => {
    it('deve registrar novo usuário com tenant', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'owner',
      };

      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        slug: 'test-company',
      };

      // Mock do existingUser check
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock do $transaction
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          tenant: {
            create: jest.fn().mockResolvedValue(mockTenant),
          },
          tenantUser: {
            create: jest.fn().mockResolvedValue({ id: 'tu-123' }),
          },
          category: {
            createMany: jest.fn().mockResolvedValue({ count: 10 }),
          },
        };
        return fn(mockTx);
      });

      // Mock da verificação de slug único
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: 'refresh-token-id',
        token: 'refresh-token',
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await authService.register({
        email: 'test@example.com',
        password: 'SecurePass123!',
        fullName: 'Test User',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tenant');
      expect(result).toHaveProperty('tokens');
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('deve rejeitar email duplicado', async () => {
      const mockExistingUser = {
        id: 'existing-user',
        email: 'existing@example.com',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockExistingUser);

      await expect(
        authService.register({
          email: 'existing@example.com',
          password: 'SecurePass123!',
          fullName: 'Test User',
        })
      ).rejects.toThrow('Email já cadastrado');
    });

    it('deve criar slug único quando houver conflito', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockTenant = {
        id: 'tenant-123',
        slug: 'test-company-1',
      };

      // Mock: user não existe
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Primeiro slug ocupado, segundo livre
      (prisma.tenant.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'other-tenant' })
        .mockResolvedValueOnce(null);

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          user: { create: jest.fn().mockResolvedValue(mockUser) },
          tenant: { create: jest.fn().mockResolvedValue(mockTenant) },
          tenantUser: { create: jest.fn().mockResolvedValue({ id: 'tu-123' }) },
          category: { createMany: jest.fn().mockResolvedValue({ count: 10 }) },
        };
        return fn(mockTx);
      });

      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await authService.register({
        email: 'test@example.com',
        password: 'SecurePass123!',
        fullName: 'Test User',
      });

      expect(result.tenant).toBeDefined();
    });

    it('deve fazer hash da senha antes de salvar', async () => {
      const mockUser = { id: 'user-123' };
      const mockTenant = { id: 'tenant-123' };

      let hashedPassword: string | undefined;

      // Mock: user não existe
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          user: {
            create: jest.fn((data) => {
              hashedPassword = data.data.passwordHash;
              return Promise.resolve(mockUser);
            }),
          },
          tenant: {
            create: jest.fn().mockResolvedValue(mockTenant),
          },
          tenantUser: {
            create: jest.fn().mockResolvedValue({ id: 'tu-123' }),
          },
          category: {
            createMany: jest.fn().mockResolvedValue({ count: 10 }),
          },
        };
        return fn(mockTx);
      });

      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await authService.register({
        email: 'test@example.com',
        password: 'PlainPassword123!',
        fullName: 'Test User',
      });

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe('PlainPassword123!');
      expect(hashedPassword?.length).toBeGreaterThan(50); // Bcrypt hash length
    });
  });

  describe('login()', () => {
    it('deve autenticar usuário com credenciais válidas', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('CorrectPassword', 10),
        fullName: 'Test User',
        role: 'owner',
        isActive: true,
        ownedTenants: [
          {
            id: 'tenant-123',
            name: 'Test Company',
            slug: 'test-company',
            subscriptionStatus: 'active',
          },
        ],
        tenantUsers: [],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: 'refresh-token-id',
        token: 'refresh-token',
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'CorrectPassword',
      });

      expect(result).toHaveProperty('tokens');
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('test@example.com');
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('deve rejeitar credenciais inválidas', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('CorrectPassword', 10),
        isActive: true,
        ownedTenants: [],
        tenantUsers: [],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'WrongPassword',
        })
      ).rejects.toThrow('Credenciais inválidas');
    });

    it('deve rejeitar usuário inexistente', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'AnyPassword',
        })
      ).rejects.toThrow('Credenciais inválidas');
    });

    it('deve rejeitar usuário sem tenant ativo', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('CorrectPassword', 10),
        isActive: true,
        ownedTenants: [],
        tenantUsers: [],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'CorrectPassword',
        })
      ).rejects.toThrow('Usuário sem tenant vinculado');
    });

    it('deve rejeitar usuário inativo', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('CorrectPassword', 10),
        isActive: false,
        ownedTenants: [],
        tenantUsers: [],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'CorrectPassword',
        })
      ).rejects.toThrow('Usuário inativo');
    });
  });

  describe('refresh()', () => {
    it('deve renovar tokens com refresh token válido', async () => {
      const mockRefreshToken = {
        id: 'refresh-id',
        token: 'valid-refresh-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
        isRevoked: false,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          isActive: true,
          ownedTenants: [
            {
              id: 'tenant-123',
              name: 'Test Tenant',
              slug: 'test-tenant',
              subscriptionStatus: 'active',
            },
          ],
          tenantUsers: [],
        },
      };

      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockRefreshToken);
      (prisma.refreshToken.update as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await authService.refresh({
        refreshToken: 'valid-refresh-token',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prisma.refreshToken.update).toHaveBeenCalled(); // Revoga o antigo
      expect(prisma.refreshToken.create).toHaveBeenCalled(); // Cria novo
    });

    it('deve rejeitar refresh token revogado', async () => {
      const mockRefreshToken = {
        id: 'refresh-id',
        token: 'revoked-token',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { isActive: true },
      };

      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockRefreshToken);

      await expect(
        authService.refresh({
          refreshToken: 'revoked-token',
        })
      ).rejects.toThrow('Refresh token revogado');
    });

    it('deve rejeitar refresh token expirado', async () => {
      const mockRefreshToken = {
        id: 'refresh-id',
        token: 'expired-token',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000), // Expirado
        user: { isActive: true },
      };

      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockRefreshToken);

      await expect(
        authService.refresh({
          refreshToken: 'expired-token',
        })
      ).rejects.toThrow('Refresh token expirado');
    });

    it('deve rejeitar refresh token inexistente', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.refresh({
          refreshToken: 'nonexistent-token',
        })
      ).rejects.toThrow('Refresh token inválido');
    });
  });

  describe('changePassword()', () => {
    it('deve alterar senha e revogar todos os tokens', async () => {
      const mockUser = {
        id: 'user-123',
        passwordHash: await bcrypt.hash('OldPassword123!', 10),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          user: {
            update: jest.fn().mockResolvedValue({ id: 'user-123' }),
          },
          refreshToken: {
            updateMany: jest.fn().mockResolvedValue({ count: 3 }),
          },
        };
        return fn(mockTx);
      });

      await authService.changePassword('user-123', {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewSecurePassword123!',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('deve rejeitar senha atual incorreta', async () => {
      const mockUser = {
        id: 'user-123',
        passwordHash: await bcrypt.hash('OldPassword123!', 10),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        authService.changePassword('user-123', {
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!',
        })
      ).rejects.toThrow('Senha atual incorreta');
    });
  });

  describe('revokeToken()', () => {
    it('deve revogar refresh token específico', async () => {
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await authService.revokeToken('specific-token', 'logout');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            token: 'specific-token',
          }),
        })
      );
    });

    it('deve revogar todos os tokens do usuário', async () => {
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

      await authService.revokeAllTokens('user-123', 'security');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      );
    });
  });

  describe('Security', () => {
    it('deve gerar JWT com claims corretos', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'owner',
        passwordHash: await bcrypt.hash('Password123!', 10),
        isActive: true,
        ownedTenants: [
          {
            id: 'tenant-123',
            name: 'Test Tenant',
            slug: 'test-tenant',
            subscriptionStatus: 'active',
          },
        ],
        tenantUsers: [],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      const decoded = jwt.verify(result.tokens.accessToken, process.env.JWT_SECRET!) as any;

      expect(decoded).toHaveProperty('userId', 'user-123');
      expect(decoded).toHaveProperty('tenantId', 'tenant-123');
      expect(decoded).toHaveProperty('exp');
      expect(decoded).toHaveProperty('iat');
    });

    it('deve limpar tokens expirados', async () => {
      (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 10 });

      const result = await authService.cleanExpiredTokens();

      expect(result).toBe(10);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });
  });
});
