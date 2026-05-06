/**
 * Agent — entity resolver / barrel (Sprint 4).
 */

export { normalizeName, tokenize } from './normalizer';
export {
  rank,
  classify,
  DEFAULT_THRESHOLDS,
  type Candidate,
  type MatchReason,
  type MatchThresholds,
  type Matchable,
  type ClassifyResult,
  type MatchClassification,
} from './matcher';
export {
  resolveCategory,
  PrismaCategoryLoader,
  type CategoryLoader,
  type CategoryResolverOptions,
} from './category-resolver';
export {
  resolveBankAccount,
  PrismaBankAccountLoader,
  type BankAccountLoader,
  type BankAccountResolverOptions,
} from './bank-account-resolver';
export {
  resolveCreateTransactionRefs,
  isUuid,
  type EntityResolution,
  type ClarificationPayload,
  type ClarificationType,
  type ResolvedRefs,
  type CreateTransactionInputLike,
  type ResolveCreateTransactionOptions,
} from './resolver.service';
export type {
  CategoryMatchable,
  BankAccountMatchable,
  ResolveContext,
  ResolveResult,
} from './types';
