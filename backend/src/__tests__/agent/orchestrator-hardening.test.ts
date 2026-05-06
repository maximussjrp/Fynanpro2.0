/**
 * Sprint 3.1 — write safety + enriched telemetry.
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
import { log } from '../../utils/logger';

class ScriptedProvider implements LLMProvider {
  readonly name = 'mock';
  constructor(
    private raw: string,
    private resp: Partial<LLMProviderResponse> = {},
  ) {}
  isAvailable() {
    return true;
  }
  async complete(_req: LLMProviderRequest): Promise<LLMProviderResponse> {
    return {
      raw: this.raw,
      provider: this.name,
      latencyMs: 42,
      attempts: 1,
      ...this.resp,
    };
  }
}

const writeExecute = jest.fn(async (): Promise<ToolResult<{ id: string }>> => ({
  ok: true,
  data: { id: 'new-id' },
}));

const writeTool: ToolDefinition<z.ZodObject<{ x: z.ZodNumber }>, { id: string }> = {
  name: 'create_thing',
  description: 'cria coisa',
  kind: 'write',
  input: z.object({ x: z.number() }),
  confirmation: 'soft',
  execute: writeExecute,
};

function makeRegistry(): ToolRegistry {
  const r = new ToolRegistry();
  r.register(writeTool);
  return r;
}

const base = {
  tenantId: 't-1',
  userId: 'u-1',
  source: 'chatbot' as const, // fonte real, não 'test'
  message: 'cria aí',
  sessionId: 's-1',
  messageId: 'm-1',
  runId: 'r-1',
};

const decisionRaw = JSON.stringify({
  intent: 'criar',
  confidence: 0.9,
  action: 'invoke_tool',
  toolName: 'create_thing',
  toolInput: { x: 1 },
});

describe('runOrchestrator — write safety (Sprint 3.1)', () => {
  beforeEach(() => {
    writeExecute.mockClear();
  });

  it('write tool NÃO é executada mesmo quando LLM pede (default)', async () => {
    const r = await runOrchestrator(base, {
      registry: makeRegistry(),
      provider: new ScriptedProvider(decisionRaw),
    });
    expect(writeExecute).not.toHaveBeenCalled();
    expect(r.decision.needsConfirmation).toBe(true);
    expect(r.toolInvoked).toBeUndefined();
  });

  it('emite log orchestrator.write.confirmation_prepared', async () => {
    const spy = jest.spyOn(log, 'info').mockImplementation((() => log) as any);
    try {
      await runOrchestrator(base, {
        registry: makeRegistry(),
        provider: new ScriptedProvider(decisionRaw),
      });
      const calls = spy.mock.calls.map(c => c[0]);
      expect(calls).toContain('orchestrator.write.confirmation_prepared');
    } finally {
      spy.mockRestore();
    }
  });

  it('allowDirectWrites=true é ignorado quando source=chatbot (bloqueia + warn)', async () => {
    const warnSpy = jest.spyOn(log, 'warn').mockImplementation((() => log) as any);
    try {
      const r = await runOrchestrator(base, {
        registry: makeRegistry(),
        provider: new ScriptedProvider(decisionRaw),
        allowDirectWrites: true,
      });
      expect(writeExecute).not.toHaveBeenCalled();
      expect(r.decision.needsConfirmation).toBe(true);
      const calls = warnSpy.mock.calls.map(c => c[0]);
      expect(calls).toContain('orchestrator.write.direct_blocked');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('allowDirectWrites=true + source=test executa direto (canal de testes)', async () => {
    const r = await runOrchestrator(
      { ...base, source: 'test' },
      {
        registry: makeRegistry(),
        provider: new ScriptedProvider(decisionRaw),
        allowDirectWrites: true,
      },
    );
    expect(writeExecute).toHaveBeenCalledTimes(1);
    expect(r.toolInvoked?.ok).toBe(true);
  });
});

describe('runOrchestrator — telemetria enriquecida (Sprint 3.1)', () => {
  it('propaga providerLatencyMs e providerAttempts no resultado', async () => {
    const provider = new ScriptedProvider(
      JSON.stringify({
        intent: 'saudacao',
        confidence: 0.9,
        action: 'respond',
        message: 'olá',
      }),
      { latencyMs: 123, attempts: 2 },
    );
    const r = await runOrchestrator(base, {
      registry: makeRegistry(),
      provider,
    });
    expect(r.providerLatencyMs).toBe(123);
    expect(r.providerAttempts).toBe(2);
  });

  it('emite log orchestrator.prompt.hygiene com report', async () => {
    const spy = jest.spyOn(log, 'info').mockImplementation((() => log) as any);
    try {
      await runOrchestrator(base, {
        registry: makeRegistry(),
        provider: new ScriptedProvider(
          JSON.stringify({
            intent: 'x',
            confidence: 0.9,
            action: 'respond',
            message: 'ok',
          }),
        ),
      });
      const hygieneCall = spy.mock.calls.find(
        c => c[0] === 'orchestrator.prompt.hygiene',
      );
      expect(hygieneCall).toBeDefined();
      const meta = hygieneCall![1] as any;
      expect(meta).toHaveProperty('finalCount');
      expect(meta).toHaveProperty('finalTotalChars');
    } finally {
      spy.mockRestore();
    }
  });
});
