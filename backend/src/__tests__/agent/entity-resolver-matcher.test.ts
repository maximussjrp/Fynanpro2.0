/**
 * Sprint 4 — matcher/normalizer (pure).
 */

import '../setup';
import { normalizeName, tokenize } from '../../agent/entity-resolver/normalizer';
import {
  rank,
  classify,
  DEFAULT_THRESHOLDS,
} from '../../agent/entity-resolver/matcher';

describe('normalizeName', () => {
  it('lowercase + remove diacritics', () => {
    expect(normalizeName('Itaú')).toBe('itau');
    expect(normalizeName('Salário Mensal')).toBe('salario mensal');
    expect(normalizeName('AÇÚCAR')).toBe('acucar');
  });
  it('colapsa whitespace e trim', () => {
    expect(normalizeName('   banco   do   brasil  ')).toBe('banco do brasil');
  });
  it('retorna vazio para nulos', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName('')).toBe('');
  });
});

describe('tokenize', () => {
  it('remove tokens de 1 caractere e duplicados', () => {
    expect(tokenize('a conta do nubank')).toEqual(['conta', 'do', 'nubank']);
    expect(tokenize('nubank nubank nubank')).toEqual(['nubank']);
  });
});

describe('rank', () => {
  const pool = [
    { id: 'c1', name: 'Aluguel' },
    { id: 'c2', name: 'Alimentação' },
    { id: 'c3', name: 'Mercado' },
    { id: 'c4', name: 'Internet' },
  ];

  it('match exato pontua 1.0', () => {
    const r = rank('aluguel', pool);
    expect(r[0].entity.id).toBe('c1');
    expect(r[0].score).toBe(1.0);
    expect(r[0].reason).toBe('exact');
    expect(r[0].exactMatch).toBe(true);
  });

  it('match exato é insensível a acentos', () => {
    const r = rank('alimentacao', pool);
    expect(r[0].entity.id).toBe('c2');
    expect(r[0].reason).toBe('exact');
  });

  it('prefix strong vence contains', () => {
    const r = rank('aluguel', [{ id: 'x', name: 'Aluguel Principal' }, { id: 'y', name: 'Conta de Aluguel' }]);
    expect(r[0].entity.id).toBe('x');
    expect(r[0].reason).toBe('prefix_strong');
  });

  it('ordena decrescente e ignora score 0', () => {
    const r = rank('mercado', pool);
    expect(r.map(c => c.entity.id)).toEqual(['c3']);
  });
});

describe('classify', () => {
  it('unique quando top1 ≥ HIGH e gap ≥ MARGIN', () => {
    const r = rank('aluguel', [
      { id: 'a', name: 'Aluguel' },
      { id: 'b', name: 'Outra coisa' },
    ]);
    const c = classify(r);
    expect(c.classification).toBe('unique');
    expect(c.top?.entity.id).toBe('a');
  });

  it('ambiguous quando gap menor que MARGIN', () => {
    const r = rank('mercado', [
      { id: 'a', name: 'Mercado' },
      { id: 'b', name: 'Mercado' }, // dois exatos → ambíguo
    ]);
    const c = classify(r);
    expect(c.classification).toBe('ambiguous');
    expect(c.candidates.length).toBe(2);
  });

  it('ambiguous quando top1 ≥ MEDIUM mas < HIGH', () => {
    // "ita" casa contains em "Itaú" e "Itaucard"
    const r = rank('ita', [
      { id: 'a', name: 'Itaú Conta Corrente' },
      { id: 'b', name: 'Itaucard Visa' },
    ]);
    const c = classify(r, DEFAULT_THRESHOLDS);
    expect(c.classification).toBe('ambiguous');
  });

  it('none quando nada ultrapassa MEDIUM', () => {
    const r = rank('banana', [
      { id: 'a', name: 'Aluguel' },
      { id: 'b', name: 'Internet' },
    ]);
    const c = classify(r);
    expect(c.classification).toBe('none');
  });

  it('alias contribui para token overlap', () => {
    const r = rank('nubank', [
      { id: 'a', name: 'Conta Principal', aliases: ['Nubank'] },
      { id: 'b', name: 'Itaú CC', aliases: ['Itaú'] },
    ]);
    expect(r[0].entity.id).toBe('a');
    // alias_exact por igualdade normalizada
    expect(['alias_exact', 'token_overlap']).toContain(r[0].reason);
  });
});
