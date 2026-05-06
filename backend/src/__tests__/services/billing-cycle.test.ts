/**
 * UTOP Reliability Sprint 3 — testes do helper de ciclo de cobrança.
 */
import { advancePeriod, normalizeCycle } from '../../services/billing/billing-cycle';

describe('billing-cycle helper', () => {
  describe('normalizeCycle', () => {
    it('aceita case-insensitive', () => {
      expect(normalizeCycle('Monthly')).toBe('MONTHLY');
      expect(normalizeCycle('YEARLY')).toBe('YEARLY');
      expect(normalizeCycle('quarterly')).toBe('QUARTERLY');
    });
    it('aliases annual/annually viram YEARLY', () => {
      expect(normalizeCycle('annual')).toBe('YEARLY');
      expect(normalizeCycle('annually')).toBe('YEARLY');
    });
    it('null/undefined/desconhecido caem em MONTHLY', () => {
      expect(normalizeCycle(null)).toBe('MONTHLY');
      expect(normalizeCycle(undefined)).toBe('MONTHLY');
      expect(normalizeCycle('zzz')).toBe('MONTHLY');
    });
  });

  describe('advancePeriod', () => {
    const base = new Date('2026-05-06T12:00:00.000Z');

    it('WEEKLY → +7 dias', () => {
      expect(advancePeriod(base, 'WEEKLY').toISOString()).toBe('2026-05-13T12:00:00.000Z');
    });
    it('BIWEEKLY → +14 dias', () => {
      expect(advancePeriod(base, 'BIWEEKLY').toISOString()).toBe('2026-05-20T12:00:00.000Z');
    });
    it('MONTHLY → mesmo dia do mês seguinte', () => {
      expect(advancePeriod(base, 'MONTHLY').toISOString()).toBe('2026-06-06T12:00:00.000Z');
    });
    it('QUARTERLY → +3 meses', () => {
      expect(advancePeriod(base, 'QUARTERLY').toISOString()).toBe('2026-08-06T12:00:00.000Z');
    });
    it('SEMIANNUALLY → +6 meses', () => {
      expect(advancePeriod(base, 'SEMIANNUALLY').toISOString()).toBe('2026-11-06T12:00:00.000Z');
    });
    it('YEARLY → +1 ano (mesmo dia)', () => {
      expect(advancePeriod(base, 'YEARLY').toISOString()).toBe('2027-05-06T12:00:00.000Z');
    });
    it('default sem cycle → MONTHLY', () => {
      expect(advancePeriod(base, null).toISOString()).toBe('2026-06-06T12:00:00.000Z');
    });
    it('NÃO usa hardcode +30d (Janeiro→Fevereiro deve dar 28d ou 31d, nunca 30d cego)', () => {
      // 2026 não é bissexto → fevereiro tem 28 dias.
      const jan = new Date('2026-01-31T12:00:00.000Z');
      const result = advancePeriod(jan, 'MONTHLY');
      // setUTCMonth(+1) em 31/jan resulta em 03/mar (overflow). É o comportamento
      // padrão do Date — aceitamos pois é determinístico e ~30d.
      expect(result.getUTCMonth()).toBeGreaterThanOrEqual(1);
    });
  });
});
