/**
 * Agent — category resolver (Sprint 4).
 *
 * Resolve uma referência textual (ex.: "aluguel", "mercado") em uma
 * categoria do tenant. Tenant-scoped, read-only.
 *
 * Integração Prisma é abstraída por `CategoryLoader` para permitir testes
 * sem banco. Por default usa `prisma.category.findMany`.
 */

import { prisma as defaultPrisma } from '../../utils/prisma-client';
import { rank, classify, DEFAULT_THRESHOLDS, type MatchThresholds } from './matcher';
import type {
  CategoryMatchable,
  ResolveContext,
  ResolveResult,
} from './types';

export interface CategoryLoader {
  load(ctx: ResolveContext): Promise<CategoryMatchable[]>;
}

/** Default loader — Prisma-backed. */
export class PrismaCategoryLoader implements CategoryLoader {
  constructor(private db = defaultPrisma) {}
  async load(ctx: ResolveContext): Promise<CategoryMatchable[]> {
    const where: any = {
      tenantId: ctx.tenantId,
      deletedAt: null,
      isActive: true,
    };
    if (ctx.categoryType) where.type = ctx.categoryType;

    const rows = await this.db.category.findMany({
      where,
      select: { id: true, name: true, type: true, parentId: true, level: true },
    });
    return buildCategoryMatchables(rows);
  }
}

type CategoryRow = {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  level?: number | null;
};

function buildCategoryPath(row: CategoryRow, byId: Map<string, CategoryRow>): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let current: CategoryRow | undefined = row;

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return names.join(' > ');
}

export function buildCategoryMatchables(rows: CategoryRow[]): CategoryMatchable[] {
  const byId = new Map(rows.map(r => [r.id, r]));

  return rows.map(r => {
    const path = buildCategoryPath(r, byId);
    const aliases = new Set<string>([r.name]);
    if (path && path !== r.name) {
      aliases.add(path);
      aliases.add(path.replace(/\s*>\s*/g, ' '));
    }

    return {
      id: r.id,
      name: path || r.name,
      type: r.type,
      parentId: r.parentId ?? null,
      level: r.level ?? undefined,
      path: path || r.name,
      aliases: Array.from(aliases),
    };
  });
}

export interface CategoryResolverOptions {
  loader?: CategoryLoader;
  thresholds?: MatchThresholds;
}

/**
 * Resolve uma query textual em uma categoria. Nunca lança; em falha
 * de banco, retorna status='none' (e o chamador decide se é fallback).
 */
export async function resolveCategory(
  query: string,
  ctx: ResolveContext,
  opts: CategoryResolverOptions = {},
): Promise<ResolveResult<CategoryMatchable>> {
  const loader = opts.loader ?? new PrismaCategoryLoader();
  const thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS;

  let pool: CategoryMatchable[] = [];
  try {
    pool = await loader.load(ctx);
  } catch {
    return { status: 'none', candidates: [] };
  }

  const ranked = rank<CategoryMatchable>(query, pool);
  const res = classify(ranked, thresholds);

  if (res.classification === 'unique' && res.top) {
    return {
      status: 'unique',
      entity: res.top.entity,
      score: res.top.score,
      reason: res.top.reason,
      candidates: res.candidates,
    };
  }
  if (res.classification === 'ambiguous' && res.top) {
    return {
      status: 'ambiguous',
      top: res.top.entity,
      candidates: res.candidates,
    };
  }
  return { status: 'none', candidates: res.candidates };
}
