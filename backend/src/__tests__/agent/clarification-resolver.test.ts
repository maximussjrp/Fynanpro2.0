/**
 * Sprint 5 — clarification-resolver (puro).
 */

import '../setup';
import { resolveClarification } from '../../agent/orchestrator/clarification-resolver';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

function base() {
  return [
    { id: UUID_A, name: 'Itaú Conta Corrente' },
    { id: UUID_B, name: 'Itaú Poupança' },
  ];
}

describe('resolveClarification — cancelamento', () => {
  it('reconhece "cancela"', () => {
    const r = resolveClarification({ userMessage: 'cancela por favor', candidates: base() });
    expect(r.kind).toBe('canceled');
  });
  it('reconhece "deixa pra lá"', () => {
    const r = resolveClarification({ userMessage: 'deixa pra lá', candidates: base() });
    expect(r.kind).toBe('canceled');
  });
  it('reconhece "esquece"', () => {
    const r = resolveClarification({ userMessage: 'esquece', candidates: base() });
    expect(r.kind).toBe('canceled');
  });
  it('reconhece "nenhuma"', () => {
    const r = resolveClarification({ userMessage: 'nenhuma', candidates: base() });
    expect(r.kind).toBe('canceled');
  });
});

describe('resolveClarification — ordinal', () => {
  it('"a primeira" → index 0', () => {
    const r = resolveClarification({ userMessage: 'a primeira', candidates: base() });
    expect(r.kind).toBe('picked');
    if (r.kind === 'picked') expect(r.candidate.id).toBe(UUID_A);
  });
  it('"segunda" → index 1', () => {
    const r = resolveClarification({ userMessage: 'segunda', candidates: base() });
    expect(r.kind).toBe('picked');
    if (r.kind === 'picked') expect(r.candidate.id).toBe(UUID_B);
  });
  it('"última" → último index', () => {
    const r = resolveClarification({ userMessage: 'a última', candidates: base() });
    expect(r.kind).toBe('picked');
    if (r.kind === 'picked') expect(r.candidate.id).toBe(UUID_B);
  });
  it('"2" sozinho → index 1', () => {
    const r = resolveClarification({ userMessage: '2', candidates: base() });
    expect(r.kind).toBe('picked');
    if (r.kind === 'picked') expect(r.candidate.id).toBe(UUID_B);
  });
  it('número maior que len → ignorado (cai em no_match)', () => {
    const r = resolveClarification({ userMessage: '99', candidates: base() });
    expect(r.kind).toBe('unresolved');
  });
  it('"gastei 50" não é tratado como ordinal', () => {
    const r = resolveClarification({ userMessage: 'gastei 50', candidates: base() });
    expect(r.kind).toBe('unresolved');
  });
});

describe('resolveClarification — nome', () => {
  it('nome único casa diretamente', () => {
    const r = resolveClarification({
      userMessage: 'itaú poupança',
      candidates: base(),
    });
    expect(r.kind).toBe('picked');
    if (r.kind === 'picked') expect(r.candidate.id).toBe(UUID_B);
  });
  it('substring única ("poupança") casa', () => {
    const r = resolveClarification({
      userMessage: 'poupança',
      candidates: base(),
    });
    expect(r.kind).toBe('picked');
    if (r.kind === 'picked') expect(r.candidate.id).toBe(UUID_B);
  });
  it('substring ambígua → unresolved (ambiguous)', () => {
    const r = resolveClarification({
      userMessage: 'itaú',
      candidates: base(),
    });
    expect(r.kind).toBe('unresolved');
    if (r.kind === 'unresolved') expect(r.reason).toBe('ambiguous');
  });
  it('nada que casa → unresolved (no_match)', () => {
    const r = resolveClarification({
      userMessage: 'bradesco',
      candidates: base(),
    });
    expect(r.kind).toBe('unresolved');
    if (r.kind === 'unresolved') expect(r.reason).toBe('no_match');
  });
});

describe('resolveClarification — UUID literal', () => {
  it('UUID que bate é aceito direto', () => {
    const r = resolveClarification({ userMessage: UUID_A, candidates: base() });
    expect(r.kind).toBe('picked');
    if (r.kind === 'picked') expect(r.candidate.id).toBe(UUID_A);
  });
});

describe('resolveClarification — guardas', () => {
  it('mensagem vazia → unresolved empty', () => {
    const r = resolveClarification({ userMessage: '', candidates: base() });
    expect(r.kind).toBe('unresolved');
    if (r.kind === 'unresolved') expect(r.reason).toBe('empty');
  });
  it('lista vazia → unresolved empty', () => {
    const r = resolveClarification({ userMessage: 'a primeira', candidates: [] });
    expect(r.kind).toBe('unresolved');
  });
});
