/**
 * slug-generator unit tests — Fase 0.2 Partners
 */

import {
  SLUG_ALPHABET,
  SLUG_LENGTH,
  generateSlug,
  generateUniqueSlug,
} from '../../services/partners/slug-generator';
import { ReferralSlugCollisionError } from '../../services/partners/types';

describe('partners/slug-generator', () => {
  describe('generateSlug', () => {
    it('respeita o comprimento padrão', () => {
      expect(generateSlug()).toHaveLength(SLUG_LENGTH);
    });

    it('respeita comprimento customizado', () => {
      expect(generateSlug(12)).toHaveLength(12);
    });

    it('rejeita comprimento <= 0', () => {
      expect(() => generateSlug(0)).toThrow();
      expect(() => generateSlug(-1)).toThrow();
    });

    it('usa apenas alfabeto seguro (sem 0/O/1/I/l)', () => {
      for (let i = 0; i < 200; i++) {
        const s = generateSlug(16);
        for (const ch of s) {
          expect(SLUG_ALPHABET).toContain(ch);
        }
        expect(s).not.toMatch(/[0O1Il]/);
      }
    });

    it('gera 10k slugs sem colisão local', () => {
      const set = new Set<string>();
      for (let i = 0; i < 10_000; i++) set.add(generateSlug());
      // 32^8 = ~1e12 → colisão em 10k é estatisticamente nula.
      expect(set.size).toBe(10_000);
    });
  });

  describe('generateUniqueSlug', () => {
    it('retorna no primeiro try quando não há colisão', async () => {
      const check = jest.fn().mockResolvedValue(false);
      const slug = await generateUniqueSlug(check);
      expect(slug).toHaveLength(SLUG_LENGTH);
      expect(check).toHaveBeenCalledTimes(1);
    });

    it('retry até achar slug livre', async () => {
      let calls = 0;
      const check = jest.fn().mockImplementation(async () => {
        calls++;
        return calls < 3; // colide nas 2 primeiras
      });
      const slug = await generateUniqueSlug(check);
      expect(slug).toHaveLength(SLUG_LENGTH);
      expect(check).toHaveBeenCalledTimes(3);
    });

    it('lança ReferralSlugCollisionError após maxAttempts', async () => {
      const check = jest.fn().mockResolvedValue(true);
      await expect(
        generateUniqueSlug(check, { maxAttempts: 3 }),
      ).rejects.toBeInstanceOf(ReferralSlugCollisionError);
      expect(check).toHaveBeenCalledTimes(3);
    });
  });
});
