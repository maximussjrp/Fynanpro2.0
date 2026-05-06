/**
 * Agent Tool Layer — registry
 *
 * Registry simples, in-memory, responsável por:
 *   1. manter o catálogo de `ToolDefinition`s
 *   2. validar o contexto de execução (tenantId/userId obrigatórios)
 *   3. validar o input via Zod e converter falhas em VALIDATION_ERROR
 *   4. capturar exceções do executor e converter em INTERNAL_ERROR
 *   5. emitir logs de observabilidade padronizados
 *
 * Não faz orquestração LLM, não mantém histórico, não faz retry.
 */

import { z } from 'zod';
import { log } from '../../utils/logger';
import type {
  ToolContext,
  ToolDefinition,
  ToolFailure,
  ToolResult,
} from './types';

function fail(
  kind: ToolFailure['kind'],
  code: string,
  message: string,
  details?: unknown,
): ToolFailure {
  return { ok: false, kind, code, message, details };
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<any, any>>();

  register<TInput extends z.ZodTypeAny, TOutput>(
    tool: ToolDefinition<TInput, TOutput>,
  ): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`ToolRegistry: tool já registrada: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition<any, any> | undefined {
    return this.tools.get(name);
  }

  list(): Array<{ name: string; description: string; kind: 'read' | 'write' }> {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      kind: t.kind,
    }));
  }

  /**
   * Executa uma tool registrada. Aplica validação de contexto e de input,
   * captura exceções, e retorna sempre um `ToolResult` bem formado.
   */
  async invoke<TOutput = unknown>(
    name: string,
    rawInput: unknown,
    ctx: ToolContext,
  ): Promise<ToolResult<TOutput>> {
    const tool = this.tools.get(name);
    if (!tool) {
      return fail('NOT_FOUND', 'TOOL_NOT_FOUND', `Tool não encontrada: ${name}`);
    }

    // Contexto mínimo multi-tenant: nunca confiar em inputs para isso.
    if (!ctx || !ctx.tenantId || !ctx.userId) {
      return fail(
        'UNAUTHORIZED',
        'MISSING_CONTEXT',
        'Contexto de execução inválido (tenantId/userId ausentes)',
      );
    }

    const parsed = tool.input.safeParse(rawInput);
    if (!parsed.success) {
      return fail(
        'VALIDATION_ERROR',
        'INPUT_VALIDATION_FAILED',
        'Input inválido',
        parsed.error.issues,
      );
    }

    const startedAt = Date.now();
    try {
      const result = (await tool.execute(parsed.data, ctx)) as ToolResult<TOutput>;
      log.info('tool.invoke', {
        tool: name,
        kind: tool.kind,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        source: ctx.source,
        runId: ctx.runId ?? null,
        dryRun: !!ctx.dryRun,
        ok: result.ok,
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch (err: any) {
      log.error('tool.invoke.exception', {
        tool: name,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        source: ctx.source,
        runId: ctx.runId ?? null,
        error: err?.message || String(err),
      });
      return fail(
        'INTERNAL_ERROR',
        'TOOL_EXCEPTION',
        err?.message || 'Erro interno ao executar tool',
      );
    }
  }
}

/** Instância default usada pelo projeto (substituível em testes). */
export const toolRegistry = new ToolRegistry();
