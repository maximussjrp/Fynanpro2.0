/**
 * Agent — entity resolver / normalizer (Sprint 4).
 *
 * Normalização de strings para matching. Puro, sem I/O, determinístico.
 *
 * Operações aplicadas em `normalizeName`:
 *   - lowercase
 *   - remoção de diacríticos (á→a, ç→c, ñ→n)
 *   - remoção de pontuação exceto hífen interno e apóstrofe
 *   - colapso de whitespace
 *   - trim
 *
 * `tokenize` entrega os tokens já normalizados, sem strings vazias.
 *
 * Essa camada é pequena de propósito: ranking ruim é sempre mais fácil de
 * debugar quando a entrada é previsível. Não tentamos stemming nem
 * lematização — pt-BR varia demais para regra simples ganhar, e errar
 * em silêncio aqui seria caro.
 */

const DIACRITIC_RE = /[\u0300-\u036f]/g;
const NONALPHANUM_RE = /[^a-z0-9\s-']/g;
const SPACES_RE = /\s+/g;

export function normalizeName(input: string | null | undefined): string {
  if (!input) return '';
  const lowered = String(input).toLowerCase();
  // NFD desmonta "á" em "a" + acento combinante; regex remove acentos.
  const stripped = lowered.normalize('NFD').replace(DIACRITIC_RE, '');
  const cleaned = stripped.replace(NONALPHANUM_RE, ' ');
  return cleaned.replace(SPACES_RE, ' ').trim();
}

/** Remove stopwords muito curtas (1 letra) e duplicatas, preservando ordem. */
export function tokenize(input: string | null | undefined): string[] {
  const norm = normalizeName(input);
  if (!norm) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of norm.split(' ')) {
    if (tok.length <= 1) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}
