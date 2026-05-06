/**
 * Testes do helper parsePeriod (Reliability Sprint 1).
 *
 * Cenário: filtros de período do dashboard/relatórios chegam como strings
 * `YYYY-MM-DD` no fuso de Brasília. Antes do helper, `new Date(s)` interpretava
 * a data como UTC, perdendo 3h no início do período e cortando o último dia.
 */
import { parsePeriod } from '../../utils/date-helpers';

describe('parsePeriod', () => {
  it('âncora YYYY-MM-DD em 00:00 BRT (start) e 23:59:59.999 BRT (end)', () => {
    const { start, end } = parsePeriod('2026-05-06', '2026-05-06');

    // 00:00 BRT (UTC-3) === 03:00 UTC
    expect(start.toISOString()).toBe('2026-05-06T03:00:00.000Z');
    // 23:59:59.999 BRT === 02:59:59.999 UTC do dia seguinte
    expect(end.toISOString()).toBe('2026-05-07T02:59:59.999Z');
  });

  it('cobre o dia inteiro: end - start ≈ 24h', () => {
    const { start, end } = parsePeriod('2026-05-06', '2026-05-06');
    const diffMs = end.getTime() - start.getTime();
    // 23h 59m 59.999s
    expect(diffMs).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('strings ISO completas passam direto (não força BRT)', () => {
    const { start, end } = parsePeriod(
      '2026-05-06T12:00:00.000Z',
      '2026-05-06T18:00:00.000Z',
    );
    expect(start.toISOString()).toBe('2026-05-06T12:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-06T18:00:00.000Z');
  });

  it('quando undefined, retorna sentinelas amplos (sem filtro)', () => {
    const { start, end } = parsePeriod(undefined, undefined);
    expect(start.getTime()).toBeLessThanOrEqual(0); // epoch
    expect(end.getFullYear()).toBeGreaterThanOrEqual(9999);
  });

  it('aceita arrays (express query) usando o primeiro elemento', () => {
    const { start, end } = parsePeriod(
      ['2026-01-01'] as unknown as string[],
      ['2026-01-31'] as unknown as string[],
    );
    expect(start.toISOString()).toBe('2026-01-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-02-01T02:59:59.999Z');
  });

  it('strings vazias caem no fallback de "sem filtro"', () => {
    const { start, end } = parsePeriod('', '');
    expect(start.getTime()).toBeLessThanOrEqual(0);
    expect(end.getFullYear()).toBeGreaterThanOrEqual(9999);
  });
});
