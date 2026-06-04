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
  search: z.string().trim().min(1).max(80).optional(),
});

export interface ListCategoriesItem {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  level: number;
  path: string;
  icon: string | null;
  color: string | null;
}

export const listCategoriesTool: ToolDefinition<typeof inputSchema, {
  count: number;
  categories: ListCategoriesItem[];
}> = {
  name: 'list_categories',
  description: 'Lista categorias ativas do tenant autenticado com parentId, level e path completo (ex.: Moradia > Manutenção > Pintura). Pode filtrar por tipo e busca textual.',
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
        level: true,
        icon: true,
        color: true,
      },
    });
    const byId = new Map(rows.map(r => [r.id, r]));
    const pathFor = (row: typeof rows[number]) => {
      const names: string[] = [];
      const seen = new Set<string>();
      let current: typeof row | undefined = row;
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        names.unshift(current.name);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      return names.join(' > ');
    };
    let categories = rows.map(r => ({
      ...r,
      path: pathFor(r),
    }));

    if (input.search) {
      const q = normalizeForSearch(input.search);
      categories = categories.filter(c =>
        normalizeForSearch(`${c.name} ${c.path}`).includes(q),
      );
    }

    return {
      ok: true,
      data: {
        count: categories.length,
        categories: categories as ListCategoriesItem[],
      },
    };
  },
};

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
