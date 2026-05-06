/**
 * ToolRegistry — testes de contrato do registry.
 */

import { z } from 'zod';
import '../setup';
import { ToolRegistry } from '../../agent/tools/registry';
import type { ToolContext, ToolDefinition } from '../../agent/tools/types';

function ctx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    tenantId: 't-1',
    userId: 'u-1',
    source: 'test',
    ...overrides,
  };
}

const echoTool: ToolDefinition<z.ZodObject<{ name: z.ZodString }>, { hello: string }> = {
  name: 'echo',
  description: 'echo',
  kind: 'read',
  input: z.object({ name: z.string().min(1) }),
  confirmation: 'none',
  async execute(input) {
    return { ok: true, data: { hello: input.name } };
  },
};

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('register/list/get', () => {
    registry.register(echoTool);
    expect(registry.get('echo')).toBe(echoTool);
    expect(registry.list()).toEqual([
      { name: 'echo', description: 'echo', kind: 'read' },
    ]);
  });

  it('impede registro duplicado', () => {
    registry.register(echoTool);
    expect(() => registry.register(echoTool)).toThrow(/já registrada/);
  });

  it('invoke: tool inexistente retorna NOT_FOUND', async () => {
    const r = await registry.invoke('nope', {}, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('NOT_FOUND');
      expect(r.code).toBe('TOOL_NOT_FOUND');
    }
  });

  it('invoke: contexto sem tenantId/userId retorna UNAUTHORIZED', async () => {
    registry.register(echoTool);
    const r = await registry.invoke('echo', { name: 'x' }, { tenantId: '', userId: 'u', source: 'test' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('UNAUTHORIZED');
  });

  it('invoke: input inválido retorna VALIDATION_ERROR com issues', async () => {
    registry.register(echoTool);
    const r = await registry.invoke('echo', { name: '' }, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('VALIDATION_ERROR');
      expect(r.code).toBe('INPUT_VALIDATION_FAILED');
      expect(Array.isArray(r.details)).toBe(true);
    }
  });

  it('invoke: executor lançando exceção vira INTERNAL_ERROR', async () => {
    registry.register({
      ...echoTool,
      name: 'boom',
      execute: async () => {
        throw new Error('kaboom');
      },
    } as any);
    const r = await registry.invoke('boom', { name: 'x' }, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('INTERNAL_ERROR');
      expect(r.message).toBe('kaboom');
    }
  });

  it('invoke: sucesso retorna data', async () => {
    registry.register(echoTool);
    const r = await registry.invoke<{ hello: string }>('echo', { name: 'world' }, ctx());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.hello).toBe('world');
  });
});
