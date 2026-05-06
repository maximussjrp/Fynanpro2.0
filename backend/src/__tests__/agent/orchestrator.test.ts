/**
 * Orchestrator — service (Sprint 3)
 *
 * Testes end-to-end do runOrchestrator com provider mock e registry isolado.
 * Cobre todos os caminhos de fallback enumerados em FallbackReason.
 */

import { z } from 'zod';
import '../setup';
import { runOrchestrator } from '../../agent/orchestrator';
import { ToolRegistry } from '../../agent/tools/registry';
import type {
  ToolContext,
  ToolDefinition,
  ToolResult,
} from '../../agent/tools/types';
import type {
  LLMProvider,
  LLMProviderRequest,
  LLMProviderResponse,
} from '../../agent/orchestrator/providers/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

class ScriptedProvider implements LLMProvider {
  readonly name = 'mock';
  private scripted: string | Error = '';
  private _available = true;
  setReply(raw: string | Error) {
    this.scripted = raw;
  }
  setAvailable(b: boolean) {
    this._available = b;
  }
  isAvailable(): boolean {
    return this._available;
  }
  async complete(_req: LLMProviderRequest): Promise<LLMProviderResponse> {
    if (this.scripted instanceof Error) throw this.scripted;
    return { raw: this.scripted, provider: this.name, latencyMs: 1 };
  }
}

const readTool: ToolDefinition<z.ZodObject<{ q: z.ZodOptional<z.ZodString> }>, { items: string[] }> = {
  name: 'list_things',
  description: 'lista coisas',
  kind: 'read',
  input: z.object({ q: z.string().optional() }),
  confirmation: 'none',
  async execute(): Promise<ToolResult<{ items: string[] }>> {
    return { ok: true, data: { items: ['a', 'b'] } };
  },
};

const writeTool: ToolDefinition<z.ZodObject<{ x: z.ZodNumber }>, { id: string }> = {
  name: 'create_thing',
  description: 'cria coisa',
  kind: 'write',
  input: z.object({ x: z.number() }),
  confirmation: 'soft',
  async execute(): Promise<ToolResult<{ id: string }>> {
    return { ok: true, data: { id: 'new-id' } };
  },
};

function makeRegistry(): ToolRegistry {
  const r = new ToolRegistry();
  r.register(readTool);
  r.register(writeTool);
  return r;
}

const baseInput = {
  tenantId: 't-1',
  userId: 'u-1',
  source: 'test' as const,
  message: 'oi tudo bem?',
  sessionId: 's-1',
  messageId: 'm-1',
  runId: 'r-1',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runOrchestrator — guardas de entrada', () => {
  it('EMPTY_MESSAGE quando message vazia', async () => {
    const r = await runOrchestrator(
      { ...baseInput, message: '   ' },
      { registry: makeRegistry(), provider: new ScriptedProvider() },
    );
    expect(r.decision.action).toBe('fallback');
    expect(r.fallbackReason).toBe('EMPTY_MESSAGE');
  });

  it('ONBOARDING_ACTIVE curto-circuita antes de chamar provider', async () => {
    const provider = new ScriptedProvider();
    provider.setReply(new Error('should-not-be-called'));
    const r = await runOrchestrator(
      { ...baseInput, onboardingActive: true },
      { registry: makeRegistry(), provider },
    );
    expect(r.decision.action).toBe('fallback');
    expect(r.fallbackReason).toBe('ONBOARDING_ACTIVE');
  });

  it('PROVIDER_UNAVAILABLE quando isAvailable=false', async () => {
    const provider = new ScriptedProvider();
    provider.setAvailable(false);
    const r = await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
    });
    expect(r.decision.action).toBe('fallback');
    expect(['PROVIDER_UNAVAILABLE', 'PROVIDER_DISABLED']).toContain(r.fallbackReason);
  });

  it('PROVIDER_ERROR quando complete() lança', async () => {
    const provider = new ScriptedProvider();
    provider.setReply(new Error('boom'));
    const r = await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
    });
    expect(r.decision.action).toBe('fallback');
    expect(r.fallbackReason).toBe('PROVIDER_ERROR');
  });
});

describe('runOrchestrator — parsing e validação', () => {
  it('INVALID_JSON quando provider devolve prosa', async () => {
    const provider = new ScriptedProvider();
    provider.setReply('apenas um texto qualquer sem JSON');
    const r = await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
    });
    expect(r.decision.action).toBe('fallback');
    expect(r.fallbackReason).toBe('INVALID_JSON');
  });

  it('SCHEMA_VALIDATION quando JSON não casa com schema', async () => {
    const provider = new ScriptedProvider();
    provider.setReply('{"foo":"bar"}');
    const r = await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
    });
    expect(r.decision.action).toBe('fallback');
    expect(r.fallbackReason).toBe('SCHEMA_VALIDATION');
  });

  it('LOW_CONFIDENCE força fallback', async () => {
    const provider = new ScriptedProvider();
    provider.setReply(
      JSON.stringify({
        intent: 'x',
        confidence: 0.3,
        action: 'respond',
        message: 'oi',
      }),
    );
    const r = await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
      minConfidence: 0.7,
    });
    expect(r.decision.action).toBe('fallback');
    expect(r.fallbackReason).toBe('LOW_CONFIDENCE');
  });
});

describe('runOrchestrator — decisões aceitas', () => {
  it('respond retorna texto', async () => {
    const provider = new ScriptedProvider();
    provider.setReply(
      JSON.stringify({
        intent: 'saudacao',
        confidence: 0.95,
        action: 'respond',
        message: 'Olá, Max!',
      }),
    );
    const r = await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
    });
    expect(r.decision.action).toBe('respond');
    expect(r.responseText).toBe('Olá, Max!');
    expect(r.fallbackReason).toBeUndefined();
  });

  it('clarify retorna texto', async () => {
    const provider = new ScriptedProvider();
    provider.setReply(
      JSON.stringify({
        intent: 'info_faltando',
        confidence: 0.9,
        action: 'clarify',
        message: 'Qual conta?',
      }),
    );
    const r = await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
    });
    expect(r.decision.action).toBe('clarify');
    expect(r.responseText).toBe('Qual conta?');
  });

  it('invoke_tool (read) executa e reporta toolInvoked', async () => {
    const provider = new ScriptedProvider();
    provider.setReply(
      JSON.stringify({
        intent: 'listar',
        confidence: 0.95,
        action: 'invoke_tool',
        toolName: 'list_things',
        toolInput: {},
      }),
    );
    const r = await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
    });
    expect(r.decision.action).toBe('invoke_tool');
    expect(r.toolInvoked?.name).toBe('list_things');
    expect(r.toolInvoked?.ok).toBe(true);
  });

  it('invoke_tool com toolName inexistente → UNKNOWN_TOOL', async () => {
    const provider = new ScriptedProvider();
    provider.setReply(
      JSON.stringify({
        intent: 'x',
        confidence: 0.95,
        action: 'invoke_tool',
        toolName: 'tool_que_nao_existe',
        toolInput: {},
      }),
    );
    const r = await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
    });
    expect(r.decision.action).toBe('fallback');
    expect(r.fallbackReason).toBe('UNKNOWN_TOOL');
  });

  it('write tool NÃO é executada direto por default (hook de confirmação)', async () => {
    const provider = new ScriptedProvider();
    provider.setReply(
      JSON.stringify({
        intent: 'criar',
        confidence: 0.95,
        action: 'invoke_tool',
        toolName: 'create_thing',
        toolInput: { x: 1 },
      }),
    );
    const executeSpy = jest.spyOn(writeTool, 'execute');
    const r = await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
    });
    expect(r.decision.action).toBe('invoke_tool');
    expect(r.decision.needsConfirmation).toBe(true);
    expect(r.toolInvoked).toBeUndefined();
    expect(executeSpy).not.toHaveBeenCalled();
    executeSpy.mockRestore();
  });

  it('write tool executa quando allowDirectWrites=true', async () => {
    const provider = new ScriptedProvider();
    provider.setReply(
      JSON.stringify({
        intent: 'criar',
        confidence: 0.95,
        action: 'invoke_tool',
        toolName: 'create_thing',
        toolInput: { x: 1 },
      }),
    );
    const r = await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
      allowDirectWrites: true,
    });
    expect(r.decision.action).toBe('invoke_tool');
    expect(r.toolInvoked?.name).toBe('create_thing');
    expect(r.toolInvoked?.ok).toBe(true);
  });

  it('fallback vindo do LLM é preservado com motivo normalizado', async () => {
    const provider = new ScriptedProvider();
    provider.setReply(
      JSON.stringify({
        intent: 'ambiguo',
        confidence: 0.95,
        action: 'fallback',
        fallbackReason: 'ONBOARDING_ACTIVE',
      }),
    );
    const r = await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
    });
    expect(r.decision.action).toBe('fallback');
    expect(r.fallbackReason).toBe('ONBOARDING_ACTIVE');
  });
});

describe('runOrchestrator — metadados de saída', () => {
  it('preserva runId e reporta provider+latency', async () => {
    const provider = new ScriptedProvider();
    provider.setReply(
      JSON.stringify({
        intent: 'x',
        confidence: 0.9,
        action: 'respond',
        message: 'oi',
      }),
    );
    const r = await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
    });
    expect(r.runId).toBe('r-1');
    expect(r.provider).toBe('mock');
    expect(typeof r.latencyMs).toBe('number');
  });

  it('ToolContext da tool herda tenantId/userId/source do input', async () => {
    const provider = new ScriptedProvider();
    provider.setReply(
      JSON.stringify({
        intent: 'listar',
        confidence: 0.95,
        action: 'invoke_tool',
        toolName: 'list_things',
        toolInput: {},
      }),
    );
    const execSpy = jest.spyOn(readTool, 'execute');
    await runOrchestrator(baseInput, {
      registry: makeRegistry(),
      provider,
    });
    expect(execSpy).toHaveBeenCalled();
    const ctx = execSpy.mock.calls[0][1] as ToolContext;
    expect(ctx.tenantId).toBe('t-1');
    expect(ctx.userId).toBe('u-1');
    expect(ctx.source).toBe('test');
    expect(ctx.runId).toBe('r-1');
    execSpy.mockRestore();
  });
});
