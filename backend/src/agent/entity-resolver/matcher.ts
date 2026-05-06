/**
 * Agent — entity resolver / matcher (Sprint 4).
 *
 * Scoring híbrido simples, explicável e barato. Não usa embedding,
 * não usa vector search, não depende de I/O.
 *
 * Componentes do score (0..1), do mais forte para o mais fraco:
 *
 *   - exact match (query normalizada === haystack normalizado) ..... 1.00
 *   - alias exato (query === qualquer alias do candidato) ........... 0.95
 *   - prefixo forte (haystack startsWith query, com query ≥ 3 chars)  0.85
 *   - prefixo fraco (query startsWith haystack) .................... 0.80
 *   - contains (haystack contém query como substring) ............... 0.70
 *   - overlap de tokens: |∩| / |query_tokens| .................... até 0.60
 *
 * O score final é o MÁXIMO entre as componentes acima. A razão escolhida
 * é reportada em `reason` para logging/explicação.
 *
 * Regras de confiança (em `classify`):
 *
 *   - "unique"     → top1 ≥ HIGH e (top1 − top2) ≥ MARGIN
 *                    (também é "unique" se houver exatamente 1 candidato
 *                     com score ≥ HIGH)
 *   - "ambiguous"  → top1 ≥ MEDIUM e houver candidato à distância menor
 *                    que MARGIN do top1
 *   - "none"       → nenhum candidato com score ≥ MEDIUM
 *
 * Valores default:
 *   HIGH   = 0.80
 *   MEDIUM = 0.50
 *   MARGIN = 0.12
 */

import { normalizeName, tokenize } from './normalizer';

export type MatchReason =
  | 'exact'
  | 'alias_exact'
  | 'prefix_strong'
  | 'prefix_weak'
  | 'contains'
  | 'token_overlap'
  | 'no_match';

export interface Matchable {
  /** Identificador de domínio. */
  id: string;
  /** Nome canônico para exibição. */
  name: string;
  /** Campos adicionais que também devem ser comparados (ex.: institution). */
  aliases?: string[];
}

export interface Candidate<T extends Matchable = Matchable> {
  entity: T;
  score: number;
  reason: MatchReason;
  /** True se `normalizeName(query) === normalizeName(entity.name)`. */
  exactMatch: boolean;
  normalizedName: string;
}

export interface MatchThresholds {
  /** Score mínimo para considerar match "confiável" em isolamento. */
  high: number;
  /** Score mínimo para um candidato entrar na lista de "ambiguous". */
  medium: number;
  /** Margem mínima entre top1 e top2 para classificar como "unique". */
  margin: number;
}

export const DEFAULT_THRESHOLDS: MatchThresholds = {
  high: 0.8,
  medium: 0.5,
  margin: 0.12,
};

export type MatchClassification = 'unique' | 'ambiguous' | 'none';

export interface ClassifyResult<T extends Matchable = Matchable> {
  classification: MatchClassification;
  top: Candidate<T> | null;
  /** Candidatos relevantes (score ≥ MEDIUM), ordenados desc. Max 5. */
  candidates: Candidate<T>[];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreOne(
  queryNorm: string,
  queryTokens: string[],
  haystackRaw: string,
  aliasesRaw: string[] | undefined,
): { score: number; reason: MatchReason } {
  if (!queryNorm) return { score: 0, reason: 'no_match' };
  const hay = normalizeName(haystackRaw);
  if (!hay) return { score: 0, reason: 'no_match' };

  // 1) exact
  if (hay === queryNorm) return { score: 1.0, reason: 'exact' };

  // 2) alias exact
  if (aliasesRaw && aliasesRaw.length > 0) {
    for (const a of aliasesRaw) {
      const an = normalizeName(a);
      if (an && an === queryNorm) return { score: 0.95, reason: 'alias_exact' };
    }
  }

  let best: { score: number; reason: MatchReason } = { score: 0, reason: 'no_match' };

  // 3) prefixo forte: haystack começa com query (query ≥ 3 chars)
  if (queryNorm.length >= 3 && hay.startsWith(queryNorm)) {
    if (0.85 > best.score) best = { score: 0.85, reason: 'prefix_strong' };
  }

  // 4) prefixo fraco: query começa com haystack inteiro
  if (hay.length >= 3 && queryNorm.startsWith(hay)) {
    if (0.8 > best.score) best = { score: 0.8, reason: 'prefix_weak' };
  }

  // 5) contains: substring de qualquer lado
  if (
    queryNorm.length >= 3 &&
    (hay.includes(queryNorm) || queryNorm.includes(hay))
  ) {
    if (0.7 > best.score) best = { score: 0.7, reason: 'contains' };
  }

  // 6) token overlap — também considera aliases
  const hayTokens = new Set(tokenize(haystackRaw));
  if (aliasesRaw) {
    for (const a of aliasesRaw) {
      for (const t of tokenize(a)) hayTokens.add(t);
    }
  }
  if (queryTokens.length > 0 && hayTokens.size > 0) {
    let hits = 0;
    for (const t of queryTokens) if (hayTokens.has(t)) hits += 1;
    if (hits > 0) {
      const ratio = hits / queryTokens.length;
      // cap em 0.6 — token overlap nunca deve bater prefix/contains.
      const s = Math.min(0.6, 0.35 + 0.25 * ratio);
      if (s > best.score) best = { score: s, reason: 'token_overlap' };
    }
  }

  return best;
}

/**
 * Pontua cada candidato e devolve ordenado desc. Inclui apenas score > 0.
 */
export function rank<T extends Matchable>(
  query: string,
  pool: T[],
): Candidate<T>[] {
  const queryNorm = normalizeName(query);
  const queryTokens = tokenize(query);
  const out: Candidate<T>[] = [];
  for (const entity of pool) {
    const { score, reason } = scoreOne(queryNorm, queryTokens, entity.name, entity.aliases);
    if (score <= 0) continue;
    out.push({
      entity,
      score,
      reason,
      exactMatch: score === 1.0,
      normalizedName: normalizeName(entity.name),
    });
  }
  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreak estável: nome mais curto primeiro (costuma ser o canônico).
    return a.entity.name.length - b.entity.name.length;
  });
  return out;
}

/**
 * Classifica um ranking em unique/ambiguous/none segundo os thresholds.
 */
export function classify<T extends Matchable>(
  ranked: Candidate<T>[],
  thresholds: MatchThresholds = DEFAULT_THRESHOLDS,
): ClassifyResult<T> {
  const relevant = ranked.filter(c => c.score >= thresholds.medium).slice(0, 5);
  if (relevant.length === 0) {
    return { classification: 'none', top: null, candidates: [] };
  }

  const [top, next] = relevant;
  // Caso especial: múltiplos "exact". Se houver mais de um exactMatch, é
  // ambiguidade real (ex.: duas categorias chamadas "Mercado").
  const exactCount = relevant.filter(c => c.exactMatch).length;
  if (exactCount >= 2) {
    return { classification: 'ambiguous', top, candidates: relevant };
  }

  if (top.score >= thresholds.high) {
    const gap = next ? top.score - next.score : Infinity;
    if (gap >= thresholds.margin) {
      return { classification: 'unique', top, candidates: relevant };
    }
    return { classification: 'ambiguous', top, candidates: relevant };
  }

  // top1 < high mas ≥ medium → sempre ambíguo (não temos confiança suficiente
  // para decidir sozinhos, mesmo se top2 estiver distante).
  return { classification: 'ambiguous', top, candidates: relevant };
}
