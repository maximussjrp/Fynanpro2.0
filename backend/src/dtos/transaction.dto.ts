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
  status: z.enum(['scheduled', 'pending', 'overdue', 'completed', 'cancelled', 'skipped']).optional(),
  notes: z.string().max(1000, 'Notas muito longas').optional(),
  tags: z.string().optional(),
  dueDate: z.string().or(z.date()).optional(),
  isFixed: z.boolean().optional(),
  
  // ==================== NOVOS CAMPOS UNIFICAÇÃO ====================
  transactionType: z.enum(['single', 'recurring', 'installment']).optional(),
  
  // Campos para RECORRENTES
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly', 'custom']).optional(),
  frequencyInterval: z.number().int().min(1).max(12).optional(),
  totalOccurrences: z.number().int().min(1).max(999).optional(),
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional(),
  alertDaysBefore: z.number().int().min(0).max(30).optional(),
  autoGenerateNext: z.boolean().optional(),
  
  // Campos para PARCELADAS
  totalInstallments: z.number().int().min(2).max(72).optional(),
  hasDownPayment: z.boolean().optional(),
  downPaymentAmount: z.number().positive().optional(),
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
).refine(
  (data) => {
    // Recorrentes devem ter frequência
    if (data.transactionType === 'recurring' && !data.frequency) {
      return false;
    }
    return true;
  },
  {
    message: 'Transações recorrentes devem ter frequência definida',
    path: ['frequency'],
  }
).refine(
  (data) => {
    // Parceladas devem ter número de parcelas
    if (data.transactionType === 'installment' && !data.totalInstallments) {
      return false;
    }
    return true;
  },
  {
    message: 'Transações parceladas devem ter número de parcelas definido',
    path: ['totalInstallments'],
  }
).refine(
  (data) => {
    // Entrada deve ter valor se ativada
    if (data.hasDownPayment && !data.downPaymentAmount) {
      return false;
    }
    return true;
  },
  {
    message: 'Se tem entrada, deve informar o valor da entrada',
    path: ['downPaymentAmount'],
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
  status: z.enum(['scheduled', 'pending', 'overdue', 'completed', 'cancelled', 'skipped']).optional(),
  notes: z.string().max(1000).nullable().optional(),
  tags: z.string().nullable().optional(),
  dueDate: z.string().or(z.date()).nullable().optional(),
  paidDate: z.string().or(z.date()).nullable().optional(),
  isFixed: z.boolean().optional(),
  
  // Campos para recorrentes
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly', 'custom']).optional(),
  frequencyInterval: z.number().int().min(1).max(12).optional(),
  alertDaysBefore: z.number().int().min(0).max(30).optional(),
  autoGenerateNext: z.boolean().optional(),
  
  // Campos para parceladas
  totalInstallments: z.number().int().min(1).max(72).optional(),
});

export type UpdateTransactionDTO = z.infer<typeof UpdateTransactionSchema>;

// ==================== QUERY FILTERS DTO ====================
export const TransactionFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  transactionType: z.enum(['single', 'recurring', 'installment']).optional(),
  categoryId: z.string().uuid().optional(),
  bankAccountId: z.string().uuid().optional(),
  paymentMethodId: z.string().uuid().optional(),
  status: z.enum(['scheduled', 'pending', 'overdue', 'completed', 'cancelled', 'skipped']).optional(),
  parentId: z.string().uuid().optional(), // Para filtrar ocorrências de uma transação pai
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1' as any),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50' as any),
});

export type TransactionFiltersDTO = z.infer<typeof TransactionFiltersSchema>;
