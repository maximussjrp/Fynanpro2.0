/**
 * Sprint 5 — clarificação multi-turn E2E.
 *
 * Ciclo: orquestrador emite clarify → usuário responde no próximo turno →
 * orquestrador retoma injetando o ID escolhido e volta pro write-guard.
 */

import { z } from 'zod';
import '../setup';
import { runOrchestrator } from '../../agent/orchestrator';
import { ToolRegistry } from '../../agent/tools/registry';
import type { ToolDefinition, ToolResult } from '../../agent/tools/types';
import type {
  LLMProvider,
  LLMProviderRequest,
  LLMProviderResponse,
} from '../../agent/orchestrator/providers/types';
import type {
  CategoryLoader,
  BankAccountLoader,
} from '../../agent/entity-resolver';
import { InMemoryClarificationStore } from '../../agent/orchestrator/clarification-store';

/** Provider que dispara respostas em sequência por turno. */
class QueueProvider implements LLMProvider {
  readonly name = 'mock';
  private queue: string[];
  public callCount = 0;
  constructor(queue: string[]) {
    this.queue = [...queue];
  }
  isAvailable() {
    return true;
  }
  async complete(_req: LLMProviderRequest): Promise<LLMProviderResponse> {
    this.callCount += 1;
    const raw = this.queue.shift();
    if (!raw) throw new Error('queue exhausted');
    return { raw, provider: this.name, latencyMs: 1, attempts: 1 };
  }
}

const createTxExecute = jest.fn(
  async (): Promise<ToolResult<{ id: string }>> => ({ ok: true, data: { id: 'tx-1' } }),
);

const createTxTool: ToolDefinition<any, { id: string }> = {
  name: 'create_transaction',
  description: 'cria transação',
  kind: 'write',
  input: z.object({
    type: z.enum(['income', 'expense']),
    amount: z.number(),
    description: z.string(),
    categoryId: z.string().uuid(),
    bankAccountId: z.string().uuid(),
  }),
  confirmation: 'soft',
  execute: createTxExecute,
};

function makeRegistry(): ToolRegistry {
  const r = new ToolRegistry();
  r.register(createTxTool);
  return r;
}

const CAT_CENTRAL = '11111111-1111-4111-8111-111111111111';
const CAT_MUNICIPAL = '22222222-2222-4222-8222-222222222222';
const ACC_ITAU_CC = '33333333-3333-4333-8333-333333333333';
const ACC_ITAU_POUP = '44444444-4444-4444-8444-444444444444';
const ACC_NUBANK = '55555555-5555-4555-8555-555555555555';

const cats: CategoryLoader = {
  load: async () => [
    { id: CAT_CENTRAL, name: 'Mercado Central', type: 'expense' },
    { id: CAT_MUNICIPAL, name: 'Mercado Municipal', type: 'expense' },
    { id: 'cat-3', name: 'Aluguel', type: 'expense' },
  ],
};

const accs: BankAccountLoader = {
  load: async () => [
    { id: ACC_ITAU_CC, name: 'Itaú Conta Corrente', institution: 'Itaú', aliases: ['Itaú'] },
    { id: ACC_ITAU_POUP, name: 'Itaú Poupança', institution: 'Itaú', aliases: ['Itaú'] },
    { id: ACC_NUBANK, name: 'Nubank', institution: 'Nubank', aliases: ['Nubank'] },
  ],
};

const baseInput = {
  tenantId: 't-mt',
  userId: 'u-mt',
  source: 'chatbot' as const,
  sessionId: 's-mt',
  messageId: 'm1',
  runId: 'r1',
};

const ambiguousMercadoDecision = JSON.stringify({
  intent: 'registrar_despesa',
  confidence: 0.9,
  action: 'invoke_tool',
  toolName: 'create_transaction',
  toolInput: {
    type: 'expense',
    amount: 30,
    description: 'compras',
    categoryName: 'mercado',
    bankAccountName: 'nubank',
  },
  needsConfirmation: true,
});

describe('Sprint 5 — retomada multi-turn', () => {
  beforeEach(() => {
    createTxExecute.mockClear();
  });

  it('turno 1 emite clarify e persiste pendência; turno 2 "a primeira" resume', async () => {
    const store = new InMemoryClarificationStore();
    const provider = new QueueProvider([ambiguousMercadoDecision]);

    const r1 = await runOrchestrator(
      { ...baseInput, message: 'gastei 30 no mercado pelo nubank' },
      {
        registry: makeRegistry(),
        provider,
        categoryLoader: cats,
        bankAccountLoader: accs,
        clarificationStore: store,
      },
    );
    expect(r1.decision.action).toBe('clarify');
    expect(r1.clarification?.type).toBe('category_ambiguous');

    // pendência foi salva
    const key = `${baseInput.tenantId}:${baseInput.sessionId}`;
    const pending = await store.get(key);
    expect(pending).not.toBeNull();
    expect(pending?.fieldToFill).toBe('categoryId');
    expect(pending?.candidates.length).toBeGreaterThanOrEqual(2);

    // turno 2 — usuário responde ordinal
    const r2 = await runOrchestrator(
      { ...baseInput, message: 'a primeira', messageId: 'm2' },
      {
        registry: makeRegistry(),
        provider, // não será chamado
        categoryLoader: cats,
        bankAccountLoader: accs,
        clarificationStore: store,
      },
    );

    expect(provider.callCount).toBe(1); // LLM não foi chamado no turno 2
    expect(r2.decision.action).toBe('invoke_tool');
    expect(r2.decision.needsConfirmation).toBe(true);
    const ti = r2.decision.toolInput as Record<string, unknown>;
    expect(ti.categoryId).toBe(CAT_CENTRAL);
    expect(ti.bankAccountId).toBe(ACC_NUBANK);
    expect(ti.categoryName).toBeUndefined();
    expect(createTxExecute).not.toHaveBeenCalled(); // write guard ativo

    // pendência foi limpa
    expect(await store.get(key)).toBeNull();
  });

  it('turno 2 com nome ("Mercado Municipal") resume corretamente', async () => {
    const store = new InMemoryClarificationStore();
    const provider = new QueueProvider([ambiguousMercadoDecision]);
    await runOrchestrator(
      { ...baseInput, message: 'gastei 30 no mercado pelo nubank' },
      {
        registry: makeRegistry(),
        provider,
        categoryLoader: cats,
        bankAccountLoader: accs,
        clarificationStore: store,
      },
    );
    const r2 = await runOrchestrator(
      { ...baseInput, message: 'Mercado Municipal' },
      {
        registry: makeRegistry(),
        provider,
        categoryLoader: cats,
        bankAccountLoader: accs,
        clarificationStore: store,
      },
    );
    expect(r2.decision.action).toBe('invoke_tool');
    const ti = r2.decision.toolInput as Record<string, unknown>;
    expect(ti.categoryId).toBe(CAT_MUNICIPAL);
  });

  it('cancelamento: "deixa pra lá" limpa pendência e responde reconhecendo', async () => {
    const store = new InMemoryClarificationStore();
    const provider = new QueueProvider([ambiguousMercadoDecision]);
    await runOrchestrator(
      { ...baseInput, message: 'gastei 30 no mercado pelo nubank' },
      {
        registry: makeRegistry(),
        provider,
        categoryLoader: cats,
        bankAccountLoader: accs,
        clarificationStore: store,
      },
    );

    const r2 = await runOrchestrator(
      { ...baseInput, message: 'deixa pra lá' },
      {
        registry: makeRegistry(),
        provider,
        categoryLoader: cats,
        bankAccountLoader: accs,
        clarificationStore: store,
      },
    );

    expect(provider.callCount).toBe(1);
    expect(r2.decision.action).toBe('respond');
    expect(r2.responseText).toMatch(/deixei pra l[aá]|cancel/i);
    const key = `${baseInput.tenantId}:${baseInput.sessionId}`;
    expect(await store.get(key)).toBeNull();
  });

  it('resposta não entendida (1ª vez) re-pergunta com lista numerada', async () => {
    const store = new InMemoryClarificationStore();
    const provider = new QueueProvider([ambiguousMercadoDecision]);
    await runOrchestrator(
      { ...baseInput, message: 'gastei 30 no mercado pelo nubank' },
      {
        registry: makeRegistry(),
        provider,
        categoryLoader: cats,
        bankAccountLoader: accs,
        clarificationStore: store,
      },
    );

    const r2 = await runOrchestrator(
      { ...baseInput, message: 'hmmmm não sei' },
      {
        registry: makeRegistry(),
        provider,
        categoryLoader: cats,
        bankAccountLoader: accs,
        clarificationStore: store,
      },
    );
    expect(provider.callCount).toBe(1);
    expect(r2.decision.action).toBe('clarify');
    expect(r2.decision.intent).toBe('clarification_reask');
    expect(r2.responseText).toMatch(/1\)/); // lista numerada
    expect(r2.clarification?.type).toBe('category_ambiguous');

    // pendência ainda existe com attempts incrementado
    const key = `${baseInput.tenantId}:${baseInput.sessionId}`;
    const p = await store.get(key);
    expect(p?.attempts).toBe(2);
  });

  it('após max attempts de não-entendimento, desiste e deixa fluxo normal rodar', async () => {
    const store = new InMemoryClarificationStore();
    const fallthroughDecision = JSON.stringify({
      intent: 'saudacao',
      confidence: 0.95,
      action: 'respond',
      message: 'oi!',
    });
    const provider = new QueueProvider([ambiguousMercadoDecision, fallthroughDecision]);

    // turno 1: clarify
    await runOrchestrator(
      { ...baseInput, message: 'gastei 30 no mercado pelo nubank' },
      {
        registry: makeRegistry(),
        provider,
        categoryLoader: cats,
        bankAccountLoader: accs,
        clarificationStore: store,
      },
    );

    // turno 2: não entendido → reask (attempts 1→2)
    await runOrchestrator(
      { ...baseInput, message: 'sei lá' },
      {
        registry: makeRegistry(),
        provider,
        categoryLoader: cats,
        bankAccountLoader: accs,
        clarificationStore: store,
      },
    );

    // turno 3: ainda não entendido → desiste e vai pro LLM.
    const r3 = await runOrchestrator(
      { ...baseInput, message: 'oi' },
      {
        registry: makeRegistry(),
        provider,
        categoryLoader: cats,
        bankAccountLoader: accs,
        clarificationStore: store,
      },
    );
    expect(provider.callCount).toBe(2); // LLM foi chamado no turno 3
    expect(r3.decision.action).toBe('respond');
    expect(r3.responseText).toBe('oi!');

    const key = `${baseInput.tenantId}:${baseInput.sessionId}`;
    expect(await store.get(key)).toBeNull();
  });

  it('pendência NÃO vaza entre tenants', async () => {
    const store = new InMemoryClarificationStore();
    const p1 = new QueueProvider([ambiguousMercadoDecision]);
    await runOrchestrator(
      { ...baseInput, tenantId: 'tenant-A', message: 'gastei 30 no mercado pelo nubank' },
      {
        registry: makeRegistry(),
        provider: p1,
        categoryLoader: cats,
        bankAccountLoader: accs,
        clarificationStore: store,
      },
    );

    // Outro tenant manda mensagem que pareceria um "ordinal" — não deve
    // retomar a clarificação do tenant A.
    const fallthroughDecision = JSON.stringify({
      intent: 'x',
      confidence: 0.9,
      action: 'respond',
      message: 'ok',
    });
    const p2 = new QueueProvider([fallthroughDecision]);
    const r2 = await runOrchestrator(
      { ...baseInput, tenantId: 'tenant-B', message: 'a primeira' },
      {
        registry: makeRegistry(),
        provider: p2,
        categoryLoader: cats,
        bankAccountLoader: accs,
        clarificationStore: store,
      },
    );
    expect(p2.callCount).toBe(1); // LLM rodou → não resumiu
    expect(r2.decision.action).toBe('respond');
  });
});
