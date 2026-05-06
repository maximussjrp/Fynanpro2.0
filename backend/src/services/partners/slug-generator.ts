/**
 * Slug generator para ReferralLink.
 *
 * Alfabeto seguro (sem 0/O/1/I/l) — reduz erro humano em digitação manual
 * e evita confusão visual em mídia impressa.
 *
 * Comprimento padrão = 8. Espaço amostral = 32^8 ≈ 1.1e12.
 *
 * Exposto:
 *   - generateSlug() → string                — single shot
 *   - generateUniqueSlug(check, options?)    — retry com checagem externa
 */

import { randomInt } from 'crypto';
import { ReferralSlugCollisionError } from './types';

/** 32 caracteres: removidos 0, 1, i, l, o (ambíguos visualmente). */
export const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const SLUG_LENGTH = 8;
export const SLUG_MAX_ATTEMPTS = 5;

export function generateSlug(length: number = SLUG_LENGTH): string {
  if (length <= 0) {
    throw new Error('slug length must be > 0');
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
  }
  return out;
}

export interface GenerateUniqueSlugOptions {
  length?: number;
  maxAttempts?: number;
}

/**
 * Gera um slug e verifica unicidade chamando `check(slug)`.
 * `check` deve retornar true quando o slug JÁ EXISTE (colisão).
 *
 * Em caso de N colisões consecutivas, lança ReferralSlugCollisionError.
 */
export async function generateUniqueSlug(
  check: (slug: string) => Promise<boolean>,
  options: GenerateUniqueSlugOptions = {},
): Promise<string> {
  const length = options.length ?? SLUG_LENGTH;
  const maxAttempts = options.maxAttempts ?? SLUG_MAX_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateSlug(length);
    const taken = await check(candidate);
    if (!taken) return candidate;
  }
  throw new ReferralSlugCollisionError(maxAttempts);
}
