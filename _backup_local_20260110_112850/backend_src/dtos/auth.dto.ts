/**
 * DTOs para Autenticação
 */

import { z } from 'zod';

// ==================== REGISTER DTO ====================
export const RegisterSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
    .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos um caractere especial'),
  fullName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100, 'Nome muito longo'),
});

export type RegisterDTO = z.infer<typeof RegisterSchema>;

// ==================== LOGIN DTO ====================
export const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export type LoginDTO = z.infer<typeof LoginSchema>;

// ==================== REFRESH TOKEN DTO ====================
export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
});

export type RefreshTokenDTO = z.infer<typeof RefreshTokenSchema>;

// ==================== CHANGE PASSWORD DTO ====================
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z
    .string()
    .min(8, 'Nova senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Nova senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Nova senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Nova senha deve conter pelo menos um número')
    .regex(/[^A-Za-z0-9]/, 'Nova senha deve conter pelo menos um caractere especial'),
});

export type ChangePasswordDTO = z.infer<typeof ChangePasswordSchema>;
