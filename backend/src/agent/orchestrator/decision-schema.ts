/**
 * Agent Orchestrator — decision schema (Sprint 3).
 *
 * Schema Zod canônico da decisão estruturada emitida pelo LLM.
 *
 * Diretrizes:
 *   - **strict JSON**: qualquer campo extra deve ser ignorado com segurança
 *     via `.passthrough()` NÃO é usado; escolhemos `.strip()` (default do Zod)
 *     para descartar chaves inesperadas sem quebrar.
 *   - **confidence obrigatório**: 0..1. Se o LLM não souber, que envie 0.
 *   - **action fechado**: enum curto, sem ambiguidade. Qualquer intenção fora
 *     desse conjunto mapeia em fallback.
 *   - **toolName e toolInput são opcionais**, mas exigidos quando
 *     `action === 'invoke_tool'` (validado via `.superRefine`).
 *   - **fallbackReason só é preenchido pelo orquestrador**, nunca pelo LLM.
 *     Se o LLM mandar `fallback` sem motivo, o próprio orquestrador carimba
 *     com 'LOW_CONFIDENCE' ou o motivo que se aplicar.
 */

import { z } from 'zod';

export const ORCHESTRATOR_ACTIONS = [
  'respond',
  'clarify',
  'invoke_tool',
  'fallback',
] as const;

export type OrchestratorAction = (typeof ORCHESTRATOR_ACTIONS)[number];

/**
 * Subset de fallback reasons que o LLM pode sugerir.
 * A lista completa (incluindo PROVIDER_*, SCHEMA_VALIDATION etc.) é usada
 * pelo orquestrador para carimbar fallbacks originados por ele mesmo.
 */
const LLM_FALLBACK_REASONS = [
  'ONBOARDING_ACTIVE',
  'LOW_CONFIDENCE',
  'UNKNOWN_TOOL',
  'WRITE_TOOL_DISABLED',
  'EMPTY_MESSAGE',
] as const;

export const OrchestratorDecisionSchema = z
  .object({
    intent: z.string().trim().min(1).max(120),
    confidence: z.number().min(0).max(1),
    action: z.enum(ORCHESTRATOR_ACTIONS),
    /** Texto pronto para o usuário (respond/clarify). Max 1200 chars. */
    message: z.string().trim().min(1).max(1200).optional(),
    /** Nome da tool a invocar (snake_case). */
    toolName: z.string().trim().min(1).max(80).optional(),
    /** Input bruto para a tool; o registry re-valida com Zod da tool. */
    toolInput: z.record(z.string(), z.unknown()).optional(),
    /** Pedido explícito de confirmação (para writes). */
    needsConfirmation: z.boolean().optional(),
    /**
     * Motivo de fallback. Aceita qualquer string no parse do LLM (texto livre
     * pode vir), mas o orquestrador sobrescreve com o enum fechado antes de
     * logar/persistir.
     */
    fallbackReason: z.string().max(120).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.action === 'invoke_tool') {
      if (!val.toolName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['toolName'],
          message: 'toolName é obrigatório quando action=invoke_tool',
        });
      }
      if (!val.toolInput) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['toolInput'],
          message: 'toolInput é obrigatório quando action=invoke_tool',
        });
      }
    }
    if ((val.action === 'respond' || val.action === 'clarify') && !val.message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['message'],
        message: 'message é obrigatório quando action=respond/clarify',
      });
    }
  });

export type OrchestratorDecision = z.infer<typeof OrchestratorDecisionSchema>;

/**
 * Extrai um bloco JSON de uma resposta possivelmente envolta em texto
 * (markdown fence, prosa antes/depois, code block). Robusto contra os
 * padrões comuns; retorna null se nada coerente for encontrado.
 */
export function extractJsonBlock(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // 1) Tenta parse direto (já é JSON puro).
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    /* continua */
  }

  // 2) Remove fences markdown.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    const inner = fenceMatch[1].trim();
    try {
      JSON.parse(inner);
      return inner;
    } catch {
      /* continua */
    }
  }

  // 3) Fallback: pega primeiro `{` até o último `}` casado.
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      /* pula */
    }
  }

  return null;
}

export interface ParsedDecision {
  ok: true;
  decision: OrchestratorDecision;
}

export interface ParseFailure {
  ok: false;
  reason: 'INVALID_JSON' | 'SCHEMA_VALIDATION';
  raw: string;
  issues?: unknown;
}

/**
 * Parseia e valida uma resposta bruta do LLM em uma `OrchestratorDecision`.
 * Nunca lança — sempre retorna um resultado discriminado.
 */
export function parseDecision(raw: string): ParsedDecision | ParseFailure {
  const block = extractJsonBlock(raw);
  if (!block) {
    return { ok: false, reason: 'INVALID_JSON', raw };
  }
  let obj: unknown;
  try {
    obj = JSON.parse(block);
  } catch {
    return { ok: false, reason: 'INVALID_JSON', raw };
  }
  const result = OrchestratorDecisionSchema.safeParse(obj);
  if (!result.success) {
    return {
      ok: false,
      reason: 'SCHEMA_VALIDATION',
      raw,
      issues: result.error.issues,
    };
  }
  return { ok: true, decision: result.data };
}
