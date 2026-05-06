/**
 * Tool: list_accounts
 *
 * Lista contas bancárias ativas do tenant, com saldo atual.
 */

import { z } from 'zod';
import { prisma } from '../../utils/prisma-client';
import type { ToolDefinition } from './types';

const inputSchema = z.object({
  includeInactive: z.boolean().optional().default(false),
});

export interface ListAccountsItem {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  currentBalance: number;
  initialBalance: number;
  isActive: boolean;
}

export const listAccountsTool: ToolDefinition<typeof inputSchema, {
  count: number;
  accounts: ListAccountsItem[];
}> = {
  name: 'list_accounts',
  description: 'Lista contas bancárias do tenant autenticado com saldo atual. Soft-deleted contas são sempre excluídas.',
  kind: 'read',
  input: inputSchema,
  confirmation: 'none',
  async execute(input, ctx) {
    const where: any = {
      tenantId: ctx.tenantId,
      deletedAt: null,
    };
    if (!input.includeInactive) {
      where.isActive = true;
    }

    const rows = await prisma.bankAccount.findMany({
      where,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        type: true,
        institution: true,
        currentBalance: true,
        initialBalance: true,
        isActive: true,
      },
    });

    const accounts: ListAccountsItem[] = rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      institution: r.institution,
      currentBalance: Number(r.currentBalance),
      initialBalance: Number(r.initialBalance),
      isActive: r.isActive,
    }));

    return {
      ok: true,
      data: { count: accounts.length, accounts },
    };
  },
};
