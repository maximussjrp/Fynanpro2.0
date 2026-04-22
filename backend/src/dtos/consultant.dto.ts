/**
 * DTOs para o módulo Consultor (Fase 2A)
 *
 * Schemas Zod para credenciamento e atualização de perfil.
 */

import { z } from 'zod';

// Apenas letras minúsculas, números e hífens; 3–40 chars.
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const ApplyConsultantSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(3, 'displayName deve ter no mínimo 3 caracteres')
    .max(80, 'displayName muito longo')
    .optional(),
  bio: z.string().trim().max(500, 'bio muito longa').optional(),
  publicSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'publicSlug deve ter no mínimo 3 caracteres')
    .max(40, 'publicSlug muito longo')
    .regex(slugRegex, 'publicSlug deve conter apenas letras minúsculas, números e hífens')
    .optional(),
});

export type ApplyConsultantDTO = z.infer<typeof ApplyConsultantSchema>;

export const UpdateConsultantSchema = ApplyConsultantSchema.refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Informe ao menos um campo para atualizar' },
);

export type UpdateConsultantDTO = z.infer<typeof UpdateConsultantSchema>;

export const ListClientsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'CHURNED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListClientsQueryDTO = z.infer<typeof ListClientsQuerySchema>;

export const ListConsultantsQuerySchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListConsultantsQueryDTO = z.infer<typeof ListConsultantsQuerySchema>;
