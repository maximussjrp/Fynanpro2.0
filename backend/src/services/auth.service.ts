/**
 * AuthService - Serviço de Autenticação com Refresh Tokens
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma-client';
import { env } from '../config/env';
import { log } from '../utils/logger';
import { RegisterDTO, LoginDTO, RefreshTokenDTO, ChangePasswordDTO } from '../dtos/auth.dto';
import crypto from 'crypto';

// Interfaces
interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  tokens: TokenPair;
}

export class AuthService {
  private readonly ACCESS_TOKEN_EXPIRATION = env.JWT_EXPIRATION || '15m';
  private readonly REFRESH_TOKEN_EXPIRATION = '7d'; // 7 dias
  private readonly SALT_ROUNDS = 12;

  /**
   * Gera um par de tokens (access + refresh)
   */
  private async generateTokenPair(userId: string, email: string, tenantId: string, role: string = 'owner'): Promise<TokenPair> {
    // Access Token (curta duração)
    const accessToken = jwt.sign(
      { userId, email, tenantId, role },
      env.JWT_SECRET,
      { expiresIn: this.ACCESS_TOKEN_EXPIRATION } as jwt.SignOptions
    );

    // Refresh Token (longa duração)
    const refreshTokenValue = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    // Salva refresh token no banco
    await prisma.refreshToken.create({
      data: {
        userId,
        token: refreshTokenValue,
        expiresAt,
        ipAddress: null, // Será preenchido no middleware
        userAgent: null, // Será preenchido no middleware
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
    };
  }

  /**
   * Registra um novo usuário
   */
  async register(data: RegisterDTO, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    try {
      log.info('AuthService.register', { email: data.email });

      // Verifica se email já existe
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new Error('Email já cadastrado');
      }

      // Hash da senha
      const passwordHash = await bcrypt.hash(data.password, this.SALT_ROUNDS);

      // Gera slug único para o tenant
      const baseSlug = data.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      let slug = baseSlug;
      let counter = 1;

      while (await prisma.tenant.findUnique({ where: { slug } })) {
        slug = `${baseSlug}${counter}`;
        counter++;
      }

      // Cria usuário + tenant + categorias em transação atômica
      const result = await prisma.$transaction(async (tx: any) => {
        // Cria usuário
        const user = await tx.user.create({
          data: {
            email: data.email,
            passwordHash,
            fullName: data.fullName,
            role: 'owner',
            lastLoginAt: new Date(),
          },
        });

        // Cria tenant
        const tenant = await tx.tenant.create({
          data: {
            ownerId: user.id,
            name: `Workspace de ${data.fullName}`,
            slug,
            subscriptionPlan: 'trial',
            subscriptionStatus: 'active',
            trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
          },
        });

        // Vincula usuário ao tenant
        await tx.tenantUser.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            role: 'owner',
          },
        });

        return { user, tenant };
      });

      // Cria categorias padrão FORA da transação (usa prisma principal)
      const { createDefaultCategories } = await import('../utils/default-categories');
      await createDefaultCategories(result.tenant.id);

      // Gera tokens
      const tokens = await this.generateTokenPair(result.user.id, result.user.email, result.tenant.id, result.user.role);

      // Registra IP e UserAgent no refresh token
      if (ipAddress || userAgent) {
        await prisma.refreshToken.updateMany({
          where: { token: tokens.refreshToken },
          data: { ipAddress, userAgent },
        });
      }

      log.info('AuthService.register success', { userId: result.user.id, tenantId: result.tenant.id });

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
        },
        tokens,
      };
    } catch (error) {
      log.error('AuthService.register error', { error, email: data.email });
      throw error;
    }
  }

  /**
   * Realiza login
   */
  async login(data: LoginDTO, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    try {
      log.info('AuthService.login', { email: data.email });

      // Busca usuário
      const user = await prisma.user.findUnique({
        where: { email: data.email },
        include: {
          ownedTenants: {
            where: { deletedAt: null },
            take: 1,
          },
          tenantUsers: {
            where: { tenant: { deletedAt: null } },
            include: { tenant: true },
            take: 1,
          },
        },
      });

      if (!user) {
        throw new Error('Credenciais inválidas');
      }

      // Verifica se usuário está ativo
      if (!user.isActive) {
        throw new Error('Usuário inativo');
      }

      // Verifica senha
      const passwordValid = await bcrypt.compare(data.password, user.passwordHash);
      if (!passwordValid) {
        throw new Error('Credenciais inválidas');
      }

      // Identifica tenant (prioriza owned, depois tenantUser)
      const tenant = user.ownedTenants[0] || user.tenantUsers[0]?.tenant;
      if (!tenant) {
        throw new Error('Usuário sem tenant vinculado');
      }

      // Atualiza lastLoginAt
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Gera tokens
      const tokens = await this.generateTokenPair(user.id, user.email, tenant.id, user.role);

      // Registra IP e UserAgent no refresh token
      if (ipAddress || userAgent) {
        await prisma.refreshToken.updateMany({
          where: { token: tokens.refreshToken },
          data: { ipAddress, userAgent },
        });
      }

      log.info('AuthService.login success', { userId: user.id, tenantId: tenant.id });

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
        tokens,
      };
    } catch (error) {
      log.error('AuthService.login error', { error, email: data.email });
      throw error;
    }
  }

  /**
   * Renova o access token usando refresh token
   */
  async refresh(data: RefreshTokenDTO, ipAddress?: string, userAgent?: string): Promise<TokenPair> {
    try {
      log.info('AuthService.refresh');

      // Busca refresh token no banco
      const refreshToken = await prisma.refreshToken.findUnique({
        where: { token: data.refreshToken },
        include: {
          user: {
            include: {
              ownedTenants: {
                where: { deletedAt: null },
                take: 1,
              },
              tenantUsers: {
                where: { tenant: { deletedAt: null } },
                include: { tenant: true },
                take: 1,
              },
            },
          },
        },
      });

      if (!refreshToken) {
        throw new Error('Refresh token inválido');
      }

      // Verifica se está revogado
      if (refreshToken.isRevoked) {
        log.warn('AuthService.refresh - token revoked', { userId: refreshToken.userId, reason: refreshToken.revokedReason });
        throw new Error('Refresh token revogado');
      }

      // Verifica se expirou
      if (refreshToken.expiresAt < new Date()) {
        log.warn('AuthService.refresh - token expired', { userId: refreshToken.userId });
        throw new Error('Refresh token expirado');
      }

      // Verifica se usuário está ativo
      if (!refreshToken.user.isActive) {
        throw new Error('Usuário inativo');
      }

      // Identifica tenant
      const tenant = refreshToken.user.ownedTenants[0] || refreshToken.user.tenantUsers[0]?.tenant;
      if (!tenant) {
        throw new Error('Usuário sem tenant vinculado');
      }

      // Revoga o refresh token antigo (token rotation)
      await prisma.refreshToken.update({
        where: { id: refreshToken.id },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: 'token_rotation',
        },
      });

      // Gera novo par de tokens
      const tokens = await this.generateTokenPair(
        refreshToken.user.id,
        refreshToken.user.email,
        tenant.id,
        refreshToken.user.role
      );

      // Registra IP e UserAgent no novo refresh token
      if (ipAddress || userAgent) {
        await prisma.refreshToken.updateMany({
          where: { token: tokens.refreshToken },
          data: { ipAddress, userAgent },
        });
      }

      log.info('AuthService.refresh success', { userId: refreshToken.user.id });

      return tokens;
    } catch (error) {
      log.error('AuthService.refresh error', { error });
      throw error;
    }
  }

  /**
   * Revoga todos os refresh tokens de um usuário (logout em todos os dispositivos)
   */
  async revokeAllTokens(userId: string, reason: string = 'logout_all'): Promise<void> {
    try {
      log.info('AuthService.revokeAllTokens', { userId, reason });

      await prisma.refreshToken.updateMany({
        where: {
          userId,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: reason,
        },
      });

      log.info('AuthService.revokeAllTokens success', { userId });
    } catch (error) {
      log.error('AuthService.revokeAllTokens error', { error, userId });
      throw error;
    }
  }

  /**
   * Revoga um refresh token específico (logout de um dispositivo)
   */
  async revokeToken(token: string, reason: string = 'logout'): Promise<void> {
    try {
      log.info('AuthService.revokeToken', { reason });

      await prisma.refreshToken.updateMany({
        where: { token },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: reason,
        },
      });

      log.info('AuthService.revokeToken success');
    } catch (error) {
      log.error('AuthService.revokeToken error', { error });
      throw error;
    }
  }

  /**
   * Altera a senha do usuário
   */
  async changePassword(userId: string, data: ChangePasswordDTO): Promise<void> {
    try {
      log.info('AuthService.changePassword', { userId });

      // Busca usuário
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Verifica senha atual
      const passwordValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!passwordValid) {
        throw new Error('Senha atual incorreta');
      }

      // Hash da nova senha
      const passwordHash = await bcrypt.hash(data.newPassword, this.SALT_ROUNDS);

      // Atualiza senha e revoga todos os refresh tokens
      await prisma.$transaction(async (tx: any) => {
        await tx.user.update({
          where: { id: userId },
          data: { passwordHash },
        });

        await tx.refreshToken.updateMany({
          where: { userId, isRevoked: false },
          data: {
            isRevoked: true,
            revokedAt: new Date(),
            revokedReason: 'password_change',
          },
        });
      });

      log.info('AuthService.changePassword success', { userId });
    } catch (error) {
      log.error('AuthService.changePassword error', { error, userId });
      throw error;
    }
  }

  /**
   * Limpa refresh tokens expirados (job de limpeza)
   */
  async cleanExpiredTokens(): Promise<number> {
    try {
      log.info('AuthService.cleanExpiredTokens');

      const result = await prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            {
              isRevoked: true,
              revokedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 dias atrás
            },
          ],
        },
      });

      log.info('AuthService.cleanExpiredTokens success', { deletedCount: result.count });
      return result.count;
    } catch (error) {
      log.error('AuthService.cleanExpiredTokens error', { error });
      throw error;
    }
  }
}

// Export singleton
export const authService = new AuthService();
