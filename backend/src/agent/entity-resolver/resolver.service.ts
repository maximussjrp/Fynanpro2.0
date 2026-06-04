/**
 * Agent — entity resolver façade (Sprint 4).
 *
 * Encapsula a política de resolução usada pelo orquestrador ao preparar
 * um `invoke_tool` de write que depende de IDs de domínio.
 *
 * Hoje cobre apenas `create_transaction`. Expandir aqui conforme novas
 * tools de write forem surgindo. O contrato de saída (`EntityResolution`)
 * já é genérico.
 *
 * Regras:
 *   - tenant-scoped (sempre)
 *   - não inventa IDs; não escolhe entre ambíguos
 *   - IDs já em formato UUID são passados adiante sem re-resolver
 *   - nomes humanos (categoryName / bankAccountName) disparam resolução
 *   - se `categoryId` vier mas NÃO for UUID, tratamos como nome-humano
 *     (o LLM eventualmente erra o shape)
 *   - nunca lança — qualquer erro vira status='none'
 */

import { log } from '../../utils/logger';
import type { Candidate } from './matcher';
import {
  resolveCategory,
  type CategoryLoader,
} from './category-resolver';
import {
  resolveBankAccount,
  type BankAccountLoader,
} from './bank-account-resolver';
import type {
  BankAccountMatchable,
  CategoryMatchable,
  ResolveContext,
  ResolveResult,
} from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(s: unknown): s is string {
  return typeof s === 'string' && UUID_RE.test(s);
}

export type ClarificationType =
  | 'category_ambiguous'
  | 'category_not_found'
  | 'account_ambiguous'
  | 'account_not_found';

export interface ClarificationPayload {
  needsClarification: true;
  clarificationType: ClarificationType;
  /** Query original do usuário que gerou a ambiguidade/falha. */
  query: string;
  /** Candidatos (se houver) com score e nome, para oferecer ao usuário. */
  candidates: Array<{ id: string; name: string; score: number }>;
  /** Mensagem pronta em pt-BR para enviar ao usuário. */
  clarificationMessage: string;
}

export interface ResolvedRefs {
  needsClarification: false;
  categoryId?: string;
  bankAccountId?: string;
  /** Quais campos foram resolvidos a partir de texto (auditoria/log). */
  resolvedFrom: {
    categoryFromName?: { query: string; score: number; reason: string };
    bankAccountFromName?: { query: string; score: number; reason: string };
  };
}

export type EntityResolution = ResolvedRefs | ClarificationPayload;

export interface CreateTransactionInputLike {
  categoryId?: unknown;
  bankAccountId?: unknown;
  categoryName?: unknown;
  bankAccountName?: unknown;
  type?: unknown;
}

export interface ResolveCreateTransactionOptions {
  categoryLoader?: CategoryLoader;
  bankAccountLoader?: BankAccountLoader;
}

/**
 * Resolve referências humanas de `create_transaction` em IDs.
 *
 * Saídas:
 *   - `{ needsClarification: false, categoryId?, bankAccountId?, resolvedFrom }`
 *     se todas as resoluções tentadas deram match único (ou se os IDs já
 *     vieram prontos como UUID).
 *   - `{ needsClarification: true, clarificationType, ... }` na PRIMEIRA
 *     ambiguidade/miss encontrada, seguindo ordem: categoria → conta.
 */
export async function resolveCreateTransactionRefs(
  input: CreateTransactionInputLike,
  ctx: ResolveContext,
  opts: ResolveCreateTransactionOptions = {},
): Promise<EntityResolution> {
  const categoryQuery = extractTextualRef(input.categoryId, input.categoryName);
  const bankQuery = extractTextualRef(input.bankAccountId, input.bankAccountName);

  const resolvedFrom: ResolvedRefs['resolvedFrom'] = {};
  let categoryId: string | undefined = isUuid(input.categoryId) ? input.categoryId : undefined;
  let bankAccountId: string | undefined = isUuid(input.bankAccountId) ? input.bankAccountId : undefined;

  // --- categoria ----------------------------------------------------------
  if (!categoryId && categoryQuery) {
    const catCtx: ResolveContext = {
      ...ctx,
      categoryType: input.type === 'income' ? 'income' : input.type === 'expense' ? 'expense' : undefined,
    };
    const res = await resolveCategory(categoryQuery, catCtx, {
      loader: opts.categoryLoader,
    });
    const clarif = toClarificationIfNeeded(res, categoryQuery, 'category');
    if (clarif) return clarif;
    if (res.status === 'unique') {
      categoryId = res.entity.id;
      resolvedFrom.categoryFromName = {
        query: categoryQuery,
        score: res.score,
        reason: res.reason,
      };
    }
  }

  // --- conta --------------------------------------------------------------
  if (!bankAccountId && bankQuery) {
    const res = await resolveBankAccount(bankQuery, ctx, {
      loader: opts.bankAccountLoader,
    });
    const clarif = toClarificationIfNeeded(res, bankQuery, 'account');
    if (clarif) return clarif;
    if (res.status === 'unique') {
      bankAccountId = res.entity.id;
      resolvedFrom.bankAccountFromName = {
        query: bankQuery,
        score: res.score,
        reason: res.reason,
      };
    }
  }

  log.info('orchestrator.entity.resolved', {
    tenantId: ctx.tenantId,
    categoryQuery: categoryQuery ?? null,
    bankQuery: bankQuery ?? null,
    categoryResolved: resolvedFrom.categoryFromName ?? null,
    bankAccountResolved: resolvedFrom.bankAccountFromName ?? null,
  });

  return {
    needsClarification: false,
    categoryId,
    bankAccountId,
    resolvedFrom,
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function extractTextualRef(
  idField: unknown,
  nameField: unknown,
): string | null {
  if (typeof nameField === 'string' && nameField.trim().length > 0) {
    return nameField.trim();
  }
  // idField presente mas NÃO é UUID → provavelmente nome humano em campo errado.
  if (typeof idField === 'string') {
    const trimmed = idField.trim();
    if (trimmed.length > 0 && !UUID_RE.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

function toClarificationIfNeeded(
  res: ResolveResult<CategoryMatchable | BankAccountMatchable>,
  query: string,
  kind: 'category' | 'account',
): ClarificationPayload | null {
  if (res.status === 'unique') return null;

  if (res.status === 'ambiguous') {
    return {
      needsClarification: true,
      clarificationType: kind === 'category' ? 'category_ambiguous' : 'account_ambiguous',
      query,
      candidates: topCandidates(res.candidates),
      clarificationMessage: buildAmbiguousMessage(kind, query, res.candidates),
    };
  }

  // none
  return {
    needsClarification: true,
    clarificationType: kind === 'category' ? 'category_not_found' : 'account_not_found',
    query,
    candidates: topCandidates(res.candidates),
    clarificationMessage: buildNotFoundMessage(kind, query),
  };
}

function topCandidates(cs: Candidate<any>[]): Array<{ id: string; name: string; score: number }> {
  return cs.slice(0, 3).map(c => ({
    id: c.entity.id,
    name: displayEntityName(c.entity),
    score: Math.round(c.score * 100) / 100,
  }));
}

function displayEntityName(entity: any): string {
  return entity?.path || entity?.name || '';
}

function buildAmbiguousMessage(
  kind: 'category' | 'account',
  query: string,
  cands: Candidate<any>[],
): string {
  const names = cands.slice(0, 3).map(c => displayEntityName(c.entity));
  const label = kind === 'category' ? 'categoria' : 'conta';
  if (names.length >= 2) {
    const last = names[names.length - 1];
    const head = names.slice(0, -1).join(', ');
    return `Encontrei mais de uma ${label} parecida com "${query}". Você quis dizer ${head} ou ${last}?`;
  }
  return `Encontrei mais de uma ${label} parecida com "${query}". Pode me dizer o nome exato?`;
}

function buildNotFoundMessage(kind: 'category' | 'account', query: string): string {
  if (kind === 'category') {
    return `Não achei uma categoria chamada "${query}". Pode me dizer o nome exato ou escolher outra?`;
  }
  return `Não achei uma conta chamada "${query}". Pode me dizer o nome exato da conta?`;
}
