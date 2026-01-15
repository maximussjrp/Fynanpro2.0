/**
 * Schemas de validação com Zod
 * 
 * Schemas reutilizáveis para validação de formulários em todo o frontend.
 * Usados em conjunto com React Hook Form para validação client-side.
 */

import { z } from 'zod';

/**
 * Schema para criação/edição de transações
 */
export const transactionSchema = z.object({
  type: z.enum(['income', 'expense'], {
    required_error: 'Tipo é obrigatório',
    invalid_type_error: 'Tipo deve ser receita ou despesa',
  }),
  amount: z
    .number({
      required_error: 'Valor é obrigatório',
      invalid_type_error: 'Valor deve ser um número',
    })
    .positive('Valor deve ser positivo')
    .max(999999999, 'Valor muito alto'),
  description: z
    .string({ required_error: 'Descrição é obrigatória' })
    .min(3, 'Descrição deve ter no mínimo 3 caracteres')
    .max(255, 'Descrição muito longa (máximo 255 caracteres)'),
  transactionDate: z
    .string({ required_error: 'Data é obrigatória' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (formato: YYYY-MM-DD)'),
  categoryId: z
    .string({ required_error: 'Categoria é obrigatória' })
    .uuid('Categoria inválida'),
  bankAccountId: z
    .string({ required_error: 'Conta bancária é obrigatória' })
    .uuid('Conta bancária inválida'),
  paymentMethodId: z
    .string()
    .uuid('Método de pagamento inválido')
    .optional()
    .nullable(),
  notes: z.string().max(1000, 'Notas muito longas').optional().nullable(),
  status: z.enum(['completed', 'pending', 'cancelled']).default('completed'),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

/**
 * Schema para criação/edição de categorias
 */
export const categorySchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo'),
  icon: z
    .string({ required_error: 'Ícone é obrigatório' })
    .min(1, 'Ícone é obrigatório')
    .max(10, 'Ícone muito longo'),
  type: z.enum(['income', 'expense'], {
    required_error: 'Tipo é obrigatório',
  }),
  parentId: z.string().uuid('Categoria pai inválida').optional().nullable(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

/**
 * Schema para criação/edição de contas bancárias
 */
export const bankAccountSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo'),
  type: z.enum(['bank', 'cash', 'investment', 'other'], {
    required_error: 'Tipo é obrigatório',
  }),
  institution: z.string().max(100, 'Nome da instituição muito longo').optional(),
  initialBalance: z
    .number({ invalid_type_error: 'Saldo inicial deve ser um número' })
    .default(0),
});

export type BankAccountFormData = z.infer<typeof bankAccountSchema>;

/**
 * Schema para criação/edição de métodos de pagamento
 */
export const paymentMethodSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo'),
  type: z.enum(['pix', 'credit_card', 'debit_card', 'bank_transfer', 'cash', 'other'], {
    required_error: 'Tipo é obrigatório',
  }),
  bankAccountId: z.string().uuid('Conta bancária inválida').optional().nullable(),
  lastFourDigits: z
    .string()
    .regex(/^\d{4}$/, 'Últimos 4 dígitos devem ser numéricos')
    .optional()
    .nullable(),
  cardNetwork: z
    .enum(['visa', 'mastercard', 'elo', 'amex', 'other'])
    .optional()
    .nullable(),
  expirationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
    .optional()
    .nullable(),
});

export type PaymentMethodFormData = z.infer<typeof paymentMethodSchema>;

/**
 * Schema para login
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email('Email inválido'),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Schema para registro
 */
export const registerSchema = z.object({
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email('Email inválido'),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Senha deve conter letras maiúsculas, minúsculas e números'
    ),
  fullName: z
    .string({ required_error: 'Nome completo é obrigatório' })
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(255, 'Nome muito longo'),
  tenantName: z
    .string({ required_error: 'Nome da empresa é obrigatório' })
    .min(2, 'Nome da empresa deve ter no mínimo 2 caracteres')
    .max(100, 'Nome da empresa muito longo'),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Schema para orçamento (budget)
 */
export const budgetSchema = z.object({
  categoryId: z
    .string({ required_error: 'Categoria é obrigatória' })
    .uuid('Categoria inválida'),
  month: z
    .string({ required_error: 'Mês é obrigatório' })
    .regex(/^\d{4}-\d{2}$/, 'Mês inválido (formato: YYYY-MM)'),
  amount: z
    .number({
      required_error: 'Valor é obrigatório',
      invalid_type_error: 'Valor deve ser um número',
    })
    .positive('Valor deve ser positivo'),
});

export type BudgetFormData = z.infer<typeof budgetSchema>;

/**
 * Schema para conta recorrente
 */
export const recurringBillSchema = z.object({
  description: z
    .string({ required_error: 'Descrição é obrigatória' })
    .min(3, 'Descrição deve ter no mínimo 3 caracteres')
    .max(255, 'Descrição muito longa'),
  type: z.enum(['income', 'expense'], {
    required_error: 'Tipo é obrigatório',
  }),
  amount: z
    .number({
      required_error: 'Valor é obrigatório',
      invalid_type_error: 'Valor deve ser um número',
    })
    .positive('Valor deve ser positivo'),
  categoryId: z
    .string({ required_error: 'Categoria é obrigatória' })
    .uuid('Categoria inválida'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly'], {
    required_error: 'Frequência é obrigatória',
  }),
  startDate: z
    .string({ required_error: 'Data inicial é obrigatória' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
    .optional()
    .nullable(),
  dayOfMonth: z
    .number()
    .int()
    .min(1, 'Dia deve ser entre 1 e 31')
    .max(31, 'Dia deve ser entre 1 e 31')
    .optional()
    .nullable(),
});

export type RecurringBillFormData = z.infer<typeof recurringBillSchema>;
