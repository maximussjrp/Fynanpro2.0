/**
 * Agent — bank account resolver (Sprint 4).
 *
 * Resolve uma referência textual (ex.: "nubank", "itaú", "cofrinho")
 * em uma conta bancária do tenant. Tenant-scoped, read-only.
 *
 * Estratégia de alias: `institution` entra como alias do candidato, então
 * "nubank" casa uma conta chamada "Conta Principal" com institution="Nubank".
 * Não hardcodamos tabela de bancos — os dados já carregam o contexto.
 */

import { prisma as defaultPrisma } from '../../utils/prisma-client';
import { rank, classify, DEFAULT_THRESHOLDS, type MatchThresholds } from './matcher';
import type {
  BankAccountMatchable,
  ResolveContext,
  ResolveResult,
} from './types';

export interface BankAccountLoader {
  load(ctx: ResolveContext): Promise<BankAccountMatchable[]>;
}

export class PrismaBankAccountLoader implements BankAccountLoader {
  constructor(private db = defaultPrisma) {}
  async load(ctx: ResolveContext): Promise<BankAccountMatchable[]> {
    const rows = await this.db.bankAccount.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, name: true, institution: true },
    });
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      institution: r.institution ?? null,
      // institution entra como alias — permite match por "nubank" mesmo
      // quando a conta se chama "Principal".
      aliases: r.institution ? [r.institution] : [],
    }));
  }
}

export interface BankAccountResolverOptions {
  loader?: BankAccountLoader;
  thresholds?: MatchThresholds;
}

export async function resolveBankAccount(
  query: string,
  ctx: ResolveContext,
  opts: BankAccountResolverOptions = {},
): Promise<ResolveResult<BankAccountMatchable>> {
  const loader = opts.loader ?? new PrismaBankAccountLoader();
  const thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS;

  let pool: BankAccountMatchable[] = [];
  try {
    pool = await loader.load(ctx);
  } catch {
    return { status: 'none', candidates: [] };
  }

  const ranked = rank<BankAccountMatchable>(query, pool);
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
