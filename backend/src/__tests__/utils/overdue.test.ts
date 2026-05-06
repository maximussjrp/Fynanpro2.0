/**
 * Reliability Sprint 2 — testes do helper único de "atrasado".
 */
import { isOverdue, overdueWhere, todayBRT } from '../../utils/overdue';

describe('overdue helper', () => {
  const now = new Date('2026-05-06T15:00:00.000Z'); // 12:00 BRT
  const yesterdayBRT = new Date('2026-05-05T03:00:00.000Z'); // 00:00 BRT do dia 05
  const tomorrowBRT = new Date('2026-05-07T03:00:00.000Z');

  describe('isOverdue', () => {
    it('status=overdue → true', () => {
      expect(isOverdue('overdue', tomorrowBRT, now)).toBe(true);
    });
    it('status=completed → false (mesmo se data passada)', () => {
      expect(isOverdue('completed', yesterdayBRT, now)).toBe(false);
    });
    it('status=paid → false', () => {
      expect(isOverdue('paid', yesterdayBRT, now)).toBe(false);
    });
    it('status=cancelled → false', () => {
      expect(isOverdue('cancelled', yesterdayBRT, now)).toBe(false);
    });
    it('status=pending + data passada → true', () => {
      expect(isOverdue('pending', yesterdayBRT, now)).toBe(true);
    });
    it('status=pending + data futura → false', () => {
      expect(isOverdue('pending', tomorrowBRT, now)).toBe(false);
    });
    it('status=pending + data nula → false', () => {
      expect(isOverdue('pending', null, now)).toBe(false);
    });
    it('status indefinido → false', () => {
      expect(isOverdue(undefined, yesterdayBRT, now)).toBe(false);
    });
  });

  describe('overdueWhere', () => {
    it('gera predicate Prisma com OR contendo overdue + pending<hoje', () => {
      const w = overdueWhere('transactionDate', now);
      expect(w.OR).toHaveLength(2);
      expect(w.OR[0]).toEqual({ status: 'overdue' });
      expect(w.OR[1]).toMatchObject({ status: 'pending' });
      expect((w.OR[1] as any).transactionDate.lt).toEqual(todayBRT(now));
    });
    it('aceita dueDate como campo', () => {
      const w = overdueWhere('dueDate', now);
      expect((w.OR[1] as any).dueDate).toBeDefined();
    });
  });

  describe('todayBRT', () => {
    it('retorna 00:00 BRT do dia atual em UTC absoluto', () => {
      // 06/05 12:00 BRT → 06/05 00:00 BRT = 06/05 03:00 UTC
      expect(todayBRT(now).toISOString()).toBe('2026-05-06T03:00:00.000Z');
    });
  });
});
