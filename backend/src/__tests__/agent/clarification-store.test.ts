/**
 * Sprint 5 — InMemoryClarificationStore.
 */

import '../setup';
import {
  InMemoryClarificationStore,
  clarificationKey,
  type PendingClarification,
} from '../../agent/orchestrator/clarification-store';
import type { OrchestratorDecision } from '../../agent/orchestrator/decision-schema';

function makePending(over: Partial<PendingClarification> = {}): PendingClarification {
  const decision: OrchestratorDecision = {
    intent: 'test',
    confidence: 0.9,
    action: 'invoke_tool',
    toolName: 'create_transaction',
    toolInput: { categoryName: 'mercado' },
  };
  return {
    type: 'category_ambiguous',
    query: 'mercado',
    candidates: [
      { id: 'c1', name: 'Mercado Central', score: 0.85 },
      { id: 'c2', name: 'Mercado Municipal', score: 0.83 },
    ],
    originalDecision: decision,
    fieldToFill: 'categoryId',
    attempts: 1,
    createdAt: Date.now(),
    ...over,
  };
}

describe('clarificationKey', () => {
  it('usa sessionId quando presente', () => {
    expect(clarificationKey('t1', 's1', 'u1')).toBe('t1:s1');
  });
  it('cai em userId quando sessionId é null/undefined', () => {
    expect(clarificationKey('t1', null, 'u1')).toBe('t1:u1');
    expect(clarificationKey('t1', undefined, 'u1')).toBe('t1:u1');
  });
  it('isola tenants na chave', () => {
    expect(clarificationKey('A', 's1', 'u1')).not.toBe(clarificationKey('B', 's1', 'u1'));
  });
});

describe('InMemoryClarificationStore', () => {
  it('set/get round-trip', async () => {
    const store = new InMemoryClarificationStore();
    const p = makePending();
    await store.set('k', p);
    expect(await store.get('k')).toEqual(p);
  });

  it('delete remove entrada', async () => {
    const store = new InMemoryClarificationStore();
    await store.set('k', makePending());
    await store.delete('k');
    expect(await store.get('k')).toBeNull();
  });

  it('entrada expirada retorna null e é purgada', async () => {
    const store = new InMemoryClarificationStore({ ttlMs: 10 });
    await store.set('k', makePending({ createdAt: Date.now() - 1000 }));
    expect(await store.get('k')).toBeNull();
  });

  it('get de chave inexistente → null', async () => {
    const store = new InMemoryClarificationStore();
    expect(await store.get('nope')).toBeNull();
  });

  it('limite de entradas sobrescreve a mais antiga', async () => {
    const store = new InMemoryClarificationStore({ maxEntries: 2 });
    await store.set('a', makePending());
    await store.set('b', makePending());
    await store.set('c', makePending());
    expect(await store.get('a')).toBeNull(); // oldest evicted
    expect(await store.get('b')).not.toBeNull();
    expect(await store.get('c')).not.toBeNull();
  });

  it('clear apaga tudo (helper de teste)', async () => {
    const store = new InMemoryClarificationStore();
    await store.set('a', makePending());
    store.clear();
    expect(await store.get('a')).toBeNull();
  });
});
