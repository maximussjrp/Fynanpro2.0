/**
 * Tool: get_account_balance
 *
 * Retorna saldo consolidado de uma conta bancária específica do tenant.
 * Usa o `currentBalance` já materializado em BankAccount (mesma fonte usada
 * pelos fluxos de criação/atualização de transações).
 */

import { z } from 'zod';
import { prisma } from '../../utils/prisma-client';
import type { ToolDefinition } from './types';

const inputSchema = z.object({
  bankAccountId: z.string().uuid('bankAccountId inválido'),
});

export interface AccountBalance {
  bankAccountId: string;
  name: string;
  currentBalance: number;
  initialBalance: number;
  isActive: boolean;
}

export const getAccountBalanceTool: ToolDefinition<typeof inputSchema, AccountBalance> = {
  name: 'get_account_balance',
  description: 'Retorna o saldo atual de uma conta bancária do tenant autenticado.',
  kind: 'read',
  input: inputSchema,
  confirmation: 'none',
  async execute(input, ctx) {
    const acct = await prisma.bankAccount.findFirst({
      where: {
        id: input.bankAccountId,
        tenantId: ctx.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        currentBalance: true,
        initialBalance: true,
        isActive: true,
      },
    });

    if (!acct) {
      return {
        ok: false,
        kind: 'NOT_FOUND',
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Conta bancária não encontrada no tenant autenticado',
      };
    }

    return {
      ok: true,
      data: {
        bankAccountId: acct.id,
        name: acct.name,
        currentBalance: Number(acct.currentBalance),
        initialBalance: Number(acct.initialBalance),
        isActive: acct.isActive,
      },
    };
  },
};
