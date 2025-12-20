/**
 * DTOs (Data Transfer Objects) para Transactions
 * Define estrutura e validação de dados de entrada
 */

import { z } from 'zod';

// ==================== CREATE TRANSACTION DTO ====================
export const CreateTransactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().positive('Valor deve ser maior que zero'),
  description: z.string().min(1, 'Descrição é obrigatória').max(500, 'Descrição muito longa'),
  transactionDate: z.string().min(1, 'Data é obrigatória').or(z.date()),
  categoryId: z.string().uuid('ID de categoria inválido').optional(),
  bankAccountId: z.string().uuid('ID de conta bancária inválido').optional(),
  paymentMethodId: z.string().uuid('ID de método de pagamento inválido').optional(),
  destinationAccountId: z.string().uuid('ID de conta destino inválido').optional(),
  recurringBillId: z.string().uuid('ID de recorrência inválido').optional(),
  installmentId: z.string().uuid('ID de parcelamento inválido').optional(),
  status: z.enum(['completed', 'pending', 'overdue']).optional(),
  notes: z.string().max(1000, 'Notas muito longas').optional(),
  tags: z.string().optional(),
  dueDate: z.string().or(z.date()).optional(),
  isFixed: z.boolean().optional(),
}).refine(
  (data) => {
    // Transfer não pode ter categoria
    if (data.type === 'transfer' && data.categoryId) {
      return false;
    }
    return true;
  },
  {
    message: 'Transferências não podem ter categoria',
    path: ['categoryId'],
  }
).refine(
  (data) => {
    // Income e Expense devem ter categoria
    if ((data.type === 'income' || data.type === 'expense') && !data.categoryId) {
      return false;
    }
    return true;
  },
  {
    message: 'Categoria é obrigatória para receitas e despesas',
    path: ['categoryId'],
  }
).refine(
  (data) => {
    // Transfer deve ter conta de origem
    if (data.type === 'transfer' && !data.bankAccountId) {
      return false;
    }
    return true;
  },
  {
    message: 'Transferência requer conta bancária de origem',
    path: ['bankAccountId'],
  }
);

export type CreateTransactionDTO = z.infer<typeof CreateTransactionSchema>;

// ==================== UPDATE TRANSACTION DTO ====================
export const UpdateTransactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  amount: z.number().positive().optional(),
  description: z.string().min(1).max(500).optional(),
  transactionDate: z.string().min(1).or(z.date()).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  bankAccountId: z.string().uuid().nullable().optional(),
  paymentMethodId: z.string().uuid().nullable().optional(),
  destinationAccountId: z.string().uuid().nullable().optional(),
  status: z.enum(['completed', 'pending', 'overdue']).optional(),
  notes: z.string().max(1000).nullable().optional(),
  tags: z.string().nullable().optional(),
});

export type UpdateTransactionDTO = z.infer<typeof UpdateTransactionSchema>;

// ==================== QUERY FILTERS DTO ====================
export const TransactionFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  categoryId: z.string().uuid().optional(),
  bankAccountId: z.string().uuid().optional(),
  paymentMethodId: z.string().uuid().optional(),
  status: z.enum(['completed', 'pending', 'overdue']).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1' as any),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50' as any),
});

export type TransactionFiltersDTO = z.infer<typeof TransactionFiltersSchema>;
