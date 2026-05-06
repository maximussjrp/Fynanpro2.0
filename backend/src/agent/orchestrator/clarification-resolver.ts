/**
 * Agent Orchestrator — clarification resolver (Sprint 5).
 *
 * Puro, sem I/O. Dado o texto da resposta do usuário no turno seguinte e
 * a lista de candidatos oferecida, tenta descobrir qual foi a escolha.
 *
 * Ordem de tentativas:
 *   1. cancelamento ("deixa pra lá", "cancela", "esquece")
 *   2. UUID literal
 *   3. ordinal ("a primeira", "segundo", "1", "o de baixo", "último")
 *   4. match por nome via matcher.rank() restrito aos candidatos
 *      (HIGH=0.80 e gap ≥ MARGIN como no Sprint 4)
 *
 * Se nada bate com confiança, retorna `unresolved` e o orquestrador
 * decide se re-pergunta ou desiste (ver MAX_CLARIFICATION_ATTEMPTS).
 */

import {
  rank,
  classify,
  type Matchable,
} from '../entity-resolver/matcher';
import { normalizeName } from '../entity-resolver/normalizer';

export type ClarificationResolution =
  | { kind: 'picked'; candidate: { id: string; name: string } }
  | { kind: 'canceled' }
  | { kind: 'unresolved'; reason: 'no_match' | 'ambiguous' | 'empty' };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Observação: `\b` do JS só casa em borda ASCII. Como PT-BR usa vogais
// acentuadas no FIM de várias palavras ("lá", "última", "não"), preferimos
// ancorar por início/fim de string ou whitespace/pontuação em vez de `\b`
// depois de caractere acentuado.
const CANCEL_PATTERNS: RegExp[] = [
  /\bcancel\w*/i,
  /\bdeixa\s+pra\s+l[aá](?:$|\s|[.,!?])/i,
  /\besque[cç]\w*/i,
  /\bnenhum[ao]?\b/i,
  /\bn[aã]o\s+quero(?:$|\s|[.,!?])/i,
  /\bn[aã]o\s+(?:[eé]|era)\s+(?:nada\s+)?diss\w*/i,
];

/** Palavras/numerais que indicam escolha ordinal. */
const ORDINAL_TABLE: Array<{ patterns: RegExp[]; index: number }> = [
  {
    patterns: [
      /\bprimeir[ao]\b/i,
      /\ba?\s*1[ªº]?\b/i,
      /\bum\b/i,
      /\bop(?:[çc][aã]o)?\s*1\b/i,
    ],
    index: 0,
  },
  {
    patterns: [
      /\bsegund[ao]\b/i,
      /\b2[ªº]?\b/i,
      /\bdois|duas\b/i,
      /\bop(?:[çc][aã]o)?\s*2\b/i,
    ],
    index: 1,
  },
  {
    patterns: [/\bterceir[ao]\b/i, /\b3[ªº]?\b/i, /\btr[eê]s\b/i],
    index: 2,
  },
  {
    patterns: [/\bquart[ao]\b/i, /\b4[ªº]?\b/i, /\bquatro\b/i],
    index: 3,
  },
  {
    patterns: [/\bquint[ao]\b/i, /\b5[ªº]?\b/i, /\bcinco\b/i],
    index: 4,
  },
];

/** "a última / de baixo" → len-1. "a primeira / de cima" → 0. */
const FIRST_HINTS = [/\bde\s+cima\b/i, /\bo\s+topo\b/i];
const LAST_HINTS = [/(?:^|\s)[uú]ltim[ao](?:$|\s|[.,!?])/i, /\bde\s+baixo\b/i];

export interface ResolveClarificationInput {
  userMessage: string;
  candidates: Array<{ id: string; name: string; score?: number }>;
}

export function resolveClarification(
  input: ResolveClarificationInput,
): ClarificationResolution {
  const raw = (input.userMessage ?? '').trim();
  if (!raw) return { kind: 'unresolved', reason: 'empty' };
  const candidates = input.candidates ?? [];
  if (candidates.length === 0)
    return { kind: 'unresolved', reason: 'empty' };

  // 1. cancelamento
  if (CANCEL_PATTERNS.some(p => p.test(raw))) {
    return { kind: 'canceled' };
  }

  // 2. UUID literal
  const uuidHit = raw.match(UUID_RE)?.[0];
  if (uuidHit) {
    const found = candidates.find(c => c.id.toLowerCase() === uuidHit.toLowerCase());
    if (found) return { kind: 'picked', candidate: { id: found.id, name: found.name } };
  }

  // 3. ordinal (inclui first/last hints)
  const ordinalIdx = detectOrdinal(raw, candidates.length);
  if (ordinalIdx !== null) {
    const c = candidates[ordinalIdx];
    return { kind: 'picked', candidate: { id: c.id, name: c.name } };
  }

  // 4. match por nome restrito aos candidatos.
  // Usamos thresholds mais generosos que os do Sprint 4 porque o pool aqui
  // é fechado (só os candidatos mostrados ao usuário): um score médio
  // isolado já é suficiente para desambiguar.
  const pool: Matchable[] = candidates.map(c => ({ id: c.id, name: c.name }));
  const ranked = rank(raw, pool);
  const outcome = classify(ranked, { high: 0.6, medium: 0.4, margin: 0.15 });
  if (outcome.classification === 'unique' && outcome.top) {
    const hit = outcome.top.entity;
    return { kind: 'picked', candidate: { id: hit.id, name: hit.name } };
  }
  if (outcome.classification === 'ambiguous') {
    // Deixa o fallback de substring literal (step 5) tentar resolver.
    // Só devolvemos `ambiguous` definitivo se o passo 5 também falhar.
  }

  // 5. último recurso: substring literal sobre nome normalizado
  const nq = normalizeName(raw);
  if (nq.length >= 3) {
    const subs = candidates.filter(c => normalizeName(c.name).includes(nq));
    if (subs.length === 1) {
      return { kind: 'picked', candidate: { id: subs[0].id, name: subs[0].name } };
    }
    if (subs.length > 1) {
      return { kind: 'unresolved', reason: 'ambiguous' };
    }
  }

  if (outcome.classification === 'ambiguous') {
    return { kind: 'unresolved', reason: 'ambiguous' };
  }

  return { kind: 'unresolved', reason: 'no_match' };
}

function detectOrdinal(raw: string, len: number): number | null {
  for (const hint of LAST_HINTS) {
    if (hint.test(raw)) return len - 1;
  }
  for (const hint of FIRST_HINTS) {
    if (hint.test(raw)) return 0;
  }
  for (const group of ORDINAL_TABLE) {
    if (group.index >= len) continue;
    if (group.patterns.some(p => p.test(raw))) return group.index;
  }
  // Número nu ("2", "1.") — só aceita se for mensagem curta, evita pegar
  // "50" de "gastei 50".
  const trimmed = raw.replace(/[.!?,]/g, '').trim();
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    if (Number.isInteger(n) && n >= 1 && n <= len) return n - 1;
  }
  return null;
}
