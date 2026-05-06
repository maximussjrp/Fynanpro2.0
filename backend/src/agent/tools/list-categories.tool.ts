/**
 * Tool: list_categories
 *
 * Lista categorias do tenant. Estritamente read-only, tenant-scoped.
 */

import { z } from 'zod';
import { prisma } from '../../utils/prisma-client';
import type { ToolDefinition } from './types';

const inputSchema = z.object({
  type: z.enum(['income', 'expense', 'all']).optional().default('all'),
  includeSubcategories: z.boolean().optional().default(true),
});

export interface ListCategoriesItem {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  icon: string | null;
  color: string | null;
}

export const listCategoriesTool: ToolDefinition<typeof inputSchema, {
  count: number;
  categories: ListCategoriesItem[];
}> = {
  name: 'list_categories',
  description: 'Lista categorias ativas do tenant autenticado, opcionalmente filtradas por tipo (income/expense/all).',
  kind: 'read',
  input: inputSchema,
  confirmation: 'none',
  async execute(input, ctx) {
    const where: any = {
      tenantId: ctx.tenantId,
      deletedAt: null,
    };
    if (input.type !== 'all') {
      where.type = input.type;
    }
    if (!input.includeSubcategories) {
      where.parentId = null;
    }

    const rows = await prisma.category.findMany({
      where,
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        icon: true,
        color: true,
      },
    });

    return {
      ok: true,
      data: {
        count: rows.length,
        categories: rows as ListCategoriesItem[],
      },
    };
  },
};
