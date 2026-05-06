/**
 * Sprint 4 — integração entity resolution no orquestrador.
 * Caso feliz "gastei 50 no aluguel pelo itaú" + ambiguidade + not-found.
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
import { defaultClarificationStore } from '../../agent/orchestrator/clarification-store';

class ScriptedProvider implements LLMProvider {
  readonly name = 'mock';
  constructor(private raw: string) {}
  isAvailable() {
    return true;
  }
  async complete(_req: LLMProviderRequest): Promise<LLMProviderResponse> {
    return { raw: this.raw, provider: this.name, latencyMs: 1, attempts: 1 };
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

const CAT_ALUGUEL = '11111111-1111-4111-8111-111111111111';
const CAT_MERCADO = '22222222-2222-4222-8222-222222222222';
const CAT_MERCADO_M = '33333333-3333-4333-8333-333333333333';
const ACC_ITAU = '44444444-4444-4444-8444-444444444444';
const ACC_NUBANK = '55555555-5555-4555-8555-555555555555';

function cats(): CategoryLoader {
  return {
    load: async () => [
      { id: CAT_ALUGUEL, name: 'Aluguel', type: 'expense' },
      { id: CAT_MERCADO, name: 'Mercado Central', type: 'expense' },
      { id: CAT_MERCADO_M, name: 'Mercado Municipal', type: 'expense' },
    ],
  };
}
function accs(): BankAccountLoader {
  return {
    load: async () => [
      { id: ACC_ITAU, name: 'Itaú Conta Corrente', institution: 'Itaú', aliases: ['Itaú'] },
      { id: ACC_NUBANK, name: 'Nubank', institution: 'Nubank', aliases: ['Nubank'] },
    ],
  };
}

const base = {
  tenantId: 't-1',
  userId: 'u-1',
  source: 'chatbot' as const,
  message: 'placeholder',
  sessionId: 's-1',
  messageId: 'm-1',
  runId: 'r-1',
};

// ---------------------------------------------------------------------------

describe('Sprint 4 — fluxo de criação com nomes humanos', () => {
  beforeEach(() => {
    createTxExecute.mockClear();
    defaultClarificationStore.clear();
  });

  it('caso feliz: "gastei 50 no aluguel pelo itaú" → confirmação com IDs resolvidos', async () => {
    const llmDecision = JSON.stringify({
      intent: 'registrar_despesa',
      confidence: 0.92,
      action: 'invoke_tool',
      toolName: 'create_transaction',
      toolInput: {
        type: 'expense',
        amount: 50,
        description: 'aluguel',
        categoryName: 'aluguel',
        bankAccountName: 'itau',
      },
      needsConfirmation: true,
    });

    const r = await runOrchestrator(
      { ...base, message: 'gastei 50 no aluguel pelo itau' },
      {
        registry: makeRegistry(),
        provider: new ScriptedProvider(llmDecision),
        categoryLoader: cats(),
        bankAccountLoader: accs(),
      },
    );

    expect(createTxExecute).not.toHaveBeenCalled(); // write safety mantida
    expect(r.decision.action).toBe('invoke_tool');
    expect(r.decision.needsConfirmation).toBe(true);

    const ti = r.decision.toolInput as Record<string, unknown>;
    expect(ti.categoryId).toBe(CAT_ALUGUEL);
    expect(ti.bankAccountId).toBe(ACC_ITAU);
    expect(ti.categoryName).toBeUndefined();
    expect(ti.bankAccountName).toBeUndefined();
    expect(ti.amount).toBe(50);

    // Nenhum payload de clarificação.
    expect(r.clarification).toBeUndefined();
  });

  it('ambiguidade em categoria → devolve clarify estruturado', async () => {
    const llmDecision = JSON.stringify({
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

    const r = await runOrchestrator(
      { ...base, message: 'gastei 30 no mercado pelo nubank' },
      {
        registry: makeRegistry(),
        provider: new ScriptedProvider(llmDecision),
        categoryLoader: cats(),
        bankAccountLoader: accs(),
      },
    );

    expect(createTxExecute).not.toHaveBeenCalled();
    expect(r.decision.action).toBe('clarify');
    expect(r.clarification?.type).toBe('category_ambiguous');
    expect(r.clarification?.query).toBe('mercado');
    expect(r.clarification?.candidates.length).toBeGreaterThanOrEqual(2);
    expect(r.responseText).toMatch(/mercado/i);
  });

  it('conta não encontrada → devolve clarify "account_not_found"', async () => {
    const llmDecision = JSON.stringify({
      intent: 'registrar_despesa',
      confidence: 0.9,
      action: 'invoke_tool',
      toolName: 'create_transaction',
      toolInput: {
        type: 'expense',
        amount: 10,
        description: 'x',
        categoryName: 'aluguel',
        bankAccountName: 'bradesco',
      },
      needsConfirmation: true,
    });

    const r = await runOrchestrator(
      { ...base, message: 'gastei 10 no aluguel pelo bradesco' },
      {
        registry: makeRegistry(),
        provider: new ScriptedProvider(llmDecision),
        categoryLoader: cats(),
        bankAccountLoader: accs(),
      },
    );

    expect(r.decision.action).toBe('clarify');
    expect(r.clarification?.type).toBe('account_not_found');
    expect(r.clarification?.query).toBe('bradesco');
    expect(r.responseText).toMatch(/bradesco/i);
  });

  it('tenantId do input é passado ao loader (multi-tenant safe)', async () => {
    const capturedTenants: string[] = [];
    const spyLoader: CategoryLoader = {
      load: async ctx => {
        capturedTenants.push(ctx.tenantId);
        return [{ id: CAT_ALUGUEL, name: 'Aluguel', type: 'expense' }];
      },
    };
    const llmDecision = JSON.stringify({
      intent: 'x',
      confidence: 0.9,
      action: 'invoke_tool',
      toolName: 'create_transaction',
      toolInput: {
        type: 'expense',
        amount: 1,
        description: 'x',
        categoryName: 'aluguel',
        bankAccountName: 'itau',
      },
      needsConfirmation: true,
    });

    await runOrchestrator(
      { ...base, tenantId: 'tenant-abc' },
      {
        registry: makeRegistry(),
        provider: new ScriptedProvider(llmDecision),
        categoryLoader: spyLoader,
        bankAccountLoader: accs(),
      },
    );

    expect(capturedTenants).toEqual(['tenant-abc']);
  });

  it('IDs já UUID não disparam resolução', async () => {
    const catLoaderSpy = jest.fn(async () => []);
    const llmDecision = JSON.stringify({
      intent: 'x',
      confidence: 0.9,
      action: 'invoke_tool',
      toolName: 'create_transaction',
      toolInput: {
        type: 'expense',
        amount: 1,
        description: 'x',
        categoryId: CAT_ALUGUEL,
        bankAccountId: ACC_ITAU,
      },
      needsConfirmation: true,
    });

    const r = await runOrchestrator(
      { ...base },
      {
        registry: makeRegistry(),
        provider: new ScriptedProvider(llmDecision),
        categoryLoader: { load: catLoaderSpy },
        bankAccountLoader: accs(),
      },
    );
    expect(catLoaderSpy).not.toHaveBeenCalled();
    expect(r.decision.action).toBe('invoke_tool');
    expect(r.decision.needsConfirmation).toBe(true);
  });

  it('fallback da resolução não executa write mesmo com allowDirectWrites + source=test', async () => {
    // Mesmo com canal de teste, se categoria é ambígua, sistema clarifica.
    const llmDecision = JSON.stringify({
      intent: 'x',
      confidence: 0.9,
      action: 'invoke_tool',
      toolName: 'create_transaction',
      toolInput: {
        type: 'expense',
        amount: 1,
        description: 'x',
        categoryName: 'mercado',
        bankAccountName: 'nubank',
      },
      needsConfirmation: true,
    });

    const r = await runOrchestrator(
      { ...base, source: 'test' },
      {
        registry: makeRegistry(),
        provider: new ScriptedProvider(llmDecision),
        categoryLoader: cats(),
        bankAccountLoader: accs(),
        allowDirectWrites: true,
      },
    );
    expect(createTxExecute).not.toHaveBeenCalled();
    expect(r.decision.action).toBe('clarify');
  });
});
