/**
 * Agent — entity resolver / types (Sprint 4).
 */

import type { Candidate, MatchClassification } from './matcher';

export type EntityKind = 'category' | 'bank_account';

export interface ResolveContext {
  tenantId: string;
  /** 'income' | 'expense' — aplica filtro ao resolver categoria. Opcional. */
  categoryType?: 'income' | 'expense';
}

export interface CategoryMatchable {
  id: string;
  name: string;
  type: 'income' | 'expense' | string;
  parentId?: string | null;
  level?: number;
  path?: string;
  aliases?: string[];
}

export interface BankAccountMatchable {
  id: string;
  name: string;
  institution: string | null;
  aliases?: string[];
}

export interface ResolveSuccess<T> {
  status: 'unique';
  entity: T;
  score: number;
  reason: string;
  /** Todos os candidatos relevantes considerados (para auditoria). */
  candidates: Candidate<any>[];
}

export interface ResolveAmbiguous<T> {
  status: 'ambiguous';
  top: T;
  candidates: Candidate<any>[];
}

export interface ResolveNone {
  status: 'none';
  candidates: Candidate<any>[];
}

export type ResolveResult<T> =
  | ResolveSuccess<T>
  | ResolveAmbiguous<T>
  | ResolveNone;

export type { MatchClassification };
