/**
 * Agent Orchestrator — service (Sprint 3).
 *
 * Orquestrador LLM mínimo. Responsabilidades:
 *   1. decidir se vale chamar o LLM (flag, provider, onboarding, input)
 *   2. montar o prompt e chamar o provider
 *   3. parsear a saída via schema Zod
 *   4. validar a decisão contra o Tool Registry
 *   5. executar read-tools diretamente; write-tools retornam preparadas
 *      para confirmação (hook para o chatbot determinístico)
 *   6. logar tudo: provider usado, motivo de fallback, tool escolhida,
 *      sucesso/erro, latência
 *
 * Regras imutáveis:
 *   - onboarding ativo → fallback imediato
 *   - provider indisponível → fallback
 *   - confiança < OrchestratorService.MIN_CONFIDENCE → fallback
 *   - tool inexistente → fallback
 *   - write-tool executar direto NESTE sprint: só acontece se
 *     `allowDirectWrites` vier true. Default: false (mais seguro).
 *     O chatbot passa false e reaproveita o fluxo CONFIRMING existente.
 */

import { log } from '../../utils/logger';
import type { ToolContext, ToolResult } from '../tools/types';
import { toolRegistry as defaultRegistry, ToolRegistry } from '../tools/registry';
import { registerDefaultTools } from '../tools';
import {
  parseDecision,
  OrchestratorDecisionSchema,
  type OrchestratorDecision,
} from './decision-schema';
import type {
  FallbackReason,
  OrchestratorInput,
  OrchestratorResult,
} from './types';
import { buildSystemPrompt } from './system-prompt';
import {
  selectProvider,
  type SelectProviderResult,
} from './providers/factory';
import type { LLMProvider, LLMToolDescriptor } from './providers/types';
import { sanitizeForPrompt, type SanitizeOptions } from './prompt-hygiene';
import {
  resolveCreateTransactionRefs,
  type CategoryLoader,
  type BankAccountLoader,
  type EntityResolution,
} from '../entity-resolver';
import {
  clarificationKey,
  defaultClarificationStore,
  MAX_CLARIFICATION_ATTEMPTS,
  type ClarificationStore,
  type PendingClarification,
} from './clarification-store';
import { resolveClarification } from './clarification-resolver';

// Garante tools default registradas no registry global. Idempotente.
registerDefaultTools();

export interface OrchestratorServiceOptions {
  registry?: ToolRegistry;
  /** Override do provider (testes). Se vier, vence env. */
  provider?: LLMProvider;
  /**
   * Se true, write-tools são executadas diretamente via registry.
   * Default false: o consumidor (chatbot) prepara confirmação.
   *
   * ⚠️ Sprint 3.1: manter false em produção. O hook de confirmação é a única
   * fronteira autorizada para execução de writes pelo agent. Qualquer uso
   * de `allowDirectWrites=true` FORA de testes deve ser tratado como bug.
   */
  allowDirectWrites?: boolean;
  /** Mínimo de confiança para NÃO cair em fallback. */
  minConfidence?: number;
  /** Overrides para a sanitização do prompt (histórico/user). */
  sanitizeOptions?: SanitizeOptions;
  /**
   * Loaders customizáveis da camada de entity resolution (Sprint 4).
   * Permitem testes sem Prisma. Default: PrismaCategoryLoader /
   * PrismaBankAccountLoader.
   */
  categoryLoader?: CategoryLoader;
  bankAccountLoader?: BankAccountLoader;
  /**
   * Store de clarificações pendentes multi-turn (Sprint 5). Default:
   * in-memory por processo. Em prod, um adapter Redis pode plugar aqui.
   */
  clarificationStore?: ClarificationStore;
}

/**
 * Execução de uma única mensagem através do orquestrador.
 * Nunca lança — todo erro vira fallback com motivo nomeado.
 */
export async function runOrchestrator(
  input: OrchestratorInput,
  opts: OrchestratorServiceOptions = {},
): Promise<OrchestratorResult> {
  const startedAt = Date.now();
  const registry = opts.registry ?? defaultRegistry;
  const minConfidence = opts.minConfidence ?? 0.7;
  const runId = input.runId ?? null;

  // ---- 0. Guarda rápida: mensagem vazia ------------------------------------
  const message = (input.message ?? '').trim();
  if (!message) {
    return finalizeFallback({
      reason: 'EMPTY_MESSAGE',
      intent: 'empty_message',
      provider: 'null',
      startedAt,
      runId,
    });
  }

  // ---- 1. Onboarding: sempre determinístico --------------------------------
  if (input.onboardingActive) {
    return finalizeFallback({
      reason: 'ONBOARDING_ACTIVE',
      intent: 'onboarding_active',
      provider: 'null',
      startedAt,
      runId,
    });
  }

  const clarificationStore = opts.clarificationStore ?? defaultClarificationStore;
  const clarifyKey = clarificationKey(input.tenantId, input.sessionId, input.userId);

  // ---- 1.5. Sprint 5 — retomada de clarificação multi-turn -----------------
  // Se há um pedido de clarificação aberto nesta sessão, a mensagem do
  // usuário é interpretada PRIMEIRO como resposta (escolha) e só depois
  // como um turno novo. Isso fecha o loop "qual Itaú? a primeira".
  const pending = await clarificationStore.get(clarifyKey);
  if (pending) {
    const resumed = await handlePendingClarification({
      message,
      pending,
      clarifyKey,
      store: clarificationStore,
      input,
      opts,
      registry,
      startedAt,
      runId,
    });
    if (resumed) return resumed;
    // `null` → desistimos (atingiu max attempts) e caímos no fluxo normal.
  }

  // ---- 2. Resolver provider -------------------------------------------------
  let providerSel: SelectProviderResult;
  let provider: LLMProvider;
  if (opts.provider) {
    provider = opts.provider;
    providerSel = { provider };
  } else {
    providerSel = selectProvider();
    provider = providerSel.provider;
  }

  if (!provider.isAvailable()) {
    const reason: FallbackReason =
      providerSel.reason === 'FLAG_OFF' ? 'PROVIDER_DISABLED' : 'PROVIDER_UNAVAILABLE';
    return finalizeFallback({
      reason,
      intent: 'provider_unavailable',
      provider: provider.name,
      startedAt,
      runId,
      extra: { selectReason: providerSel.reason ?? null },
    });
  }

  // ---- 3. Montar catálogo e prompt ------------------------------------------
  const catalog: LLMToolDescriptor[] = registry.list();
  const system = buildSystemPrompt(catalog);

  // Sprint 3.1 — sanitização/truncamento do que vai ao provider.
  const hygiene = sanitizeForPrompt(message, input.recentHistory, opts.sanitizeOptions);
  log.info('orchestrator.prompt.hygiene', {
    provider: provider.name,
    tenantId: input.tenantId,
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    runId,
    ...hygiene.report,
  });

  // ---- 4. Chamar provider ---------------------------------------------------
  let raw: string;
  let providerLatencyMs = 0;
  let providerAttempts = 1;
  try {
    const resp = await provider.complete({
      system,
      user: hygiene.user,
      history: hygiene.history,
      tools: catalog,
      runId,
    });
    raw = resp.raw;
    providerLatencyMs = resp.latencyMs;
    providerAttempts = resp.attempts ?? 1;
  } catch (err: any) {
    log.warn('orchestrator.provider.error', {
      provider: provider.name,
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      runId,
      error: err?.message || String(err),
    });
    return finalizeFallback({
      reason: 'PROVIDER_ERROR',
      intent: 'provider_error',
      provider: provider.name,
      startedAt,
      runId,
    });
  }

  // ---- 5. Parse + validação estrutural -------------------------------------
  const parsed = parseDecision(raw);
  if (parsed.ok !== true) {
    const fail = parsed as Exclude<typeof parsed, { ok: true }>;
    log.warn('orchestrator.parse.failed', {
      provider: provider.name,
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      runId,
      reason: fail.reason,
      rawPreview: fail.raw.slice(0, 300),
    });
    return finalizeFallback({
      reason: fail.reason,
      intent: 'parse_failed',
      provider: provider.name,
      startedAt,
      runId,
    });
  }

  const decision = parsed.decision;

  // ---- 6. Guarda de confiança ----------------------------------------------
  if (
    decision.action !== 'fallback' &&
    typeof decision.confidence === 'number' &&
    decision.confidence < minConfidence
  ) {
    const stamped = stampFallback(decision, 'LOW_CONFIDENCE');
    return finalize({
      decision: stamped,
      provider: provider.name,
      startedAt,
      runId,
      fallbackReason: 'LOW_CONFIDENCE',
      providerLatencyMs,
      providerAttempts,
    });
  }

  // ---- 7. Decisões que não chamam tool -------------------------------------
  if (decision.action === 'fallback') {
    const reason = toFallbackReason(decision.fallbackReason) ?? 'LOW_CONFIDENCE';
    const stamped = stampFallback(decision, reason);
    return finalize({
      decision: stamped,
      provider: provider.name,
      startedAt,
      runId,
      fallbackReason: reason,
      providerLatencyMs,
      providerAttempts,
    });
  }

  if (decision.action === 'respond' || decision.action === 'clarify') {
    return finalize({
      decision,
      provider: provider.name,
      startedAt,
      runId,
      responseText: decision.message,
      providerLatencyMs,
      providerAttempts,
    });
  }

  // ---- 8. Ação: invoke_tool -------------------------------------------------
  if (decision.action === 'invoke_tool') {
    return runInvokeToolDecision({
      decision,
      input,
      opts,
      registry,
      providerName: provider.name,
      startedAt,
      runId,
      providerLatencyMs,
      providerAttempts,
      clarificationStore,
      clarifyKey,
    });
  }

  // ---- 9. Caminho impossível (action fora do enum já é barrado pelo schema)
  /* istanbul ignore next */
  return finalizeFallback({
    reason: 'INTERNAL_ERROR',
    intent: 'impossible_branch',
    provider: provider.name,
    startedAt,
    runId,
  });
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function toFallbackReason(x: string | undefined): FallbackReason | undefined {
  if (!x) return undefined;
  const allowed: FallbackReason[] = [
    'PROVIDER_DISABLED',
    'PROVIDER_UNAVAILABLE',
    'PROVIDER_ERROR',
    'ONBOARDING_ACTIVE',
    'INVALID_JSON',
    'SCHEMA_VALIDATION',
    'UNKNOWN_TOOL',
    'LOW_CONFIDENCE',
    'WRITE_TOOL_DISABLED',
    'EMPTY_MESSAGE',
    'INTERNAL_ERROR',
  ];
  return (allowed as string[]).includes(x) ? (x as FallbackReason) : undefined;
}

function stampFallback(
  decision: OrchestratorDecision,
  reason: FallbackReason,
): OrchestratorDecision {
  return {
    ...decision,
    action: 'fallback',
    fallbackReason: reason,
  };
}

function finalize(params: {
  decision: OrchestratorDecision;
  provider: string;
  startedAt: number;
  runId: string | null;
  responseText?: string;
  quickReplies?: string[];
  toolInvoked?: OrchestratorResult['toolInvoked'];
  fallbackReason?: FallbackReason;
  providerLatencyMs?: number;
  providerAttempts?: number;
  clarification?: OrchestratorResult['clarification'];
}): OrchestratorResult {
  const latencyMs = Date.now() - params.startedAt;
  const result: OrchestratorResult = {
    decision: params.decision,
    provider: params.provider,
    latencyMs,
    runId: params.runId ?? '',
    responseText: params.responseText,
    quickReplies: params.quickReplies,
    toolInvoked: params.toolInvoked,
    fallbackReason: params.fallbackReason,
    providerLatencyMs: params.providerLatencyMs,
    providerAttempts: params.providerAttempts,
    clarification: params.clarification,
  };
  log.info('orchestrator.decision', {
    provider: params.provider,
    action: params.decision.action,
    intent: params.decision.intent,
    confidence: params.decision.confidence,
    toolName: params.decision.toolName ?? null,
    toolKind: params.toolInvoked ? 'invoked' : params.decision.needsConfirmation ? 'prepared_confirmation' : null,
    needsConfirmation: params.decision.needsConfirmation ?? false,
    fallbackReason: params.fallbackReason ?? null,
    latencyMs,
    providerLatencyMs: params.providerLatencyMs ?? null,
    providerAttempts: params.providerAttempts ?? null,
    runId: params.runId ?? null,
    toolOk: params.toolInvoked?.ok ?? null,
    toolDurationMs: params.toolInvoked?.durationMs ?? null,
  });
  return result;
}

function finalizeFallback(params: {
  reason: FallbackReason;
  intent: string;
  provider: string;
  startedAt: number;
  runId: string | null;
  extra?: Record<string, unknown>;
}): OrchestratorResult {
  // Construímos uma decisão mínima válida segundo o schema, puramente
  // para atender o contrato; confidence=0 para refletir "não fomos nós".
  const decision: OrchestratorDecision = OrchestratorDecisionSchema.parse({
    intent: params.intent,
    confidence: 0,
    action: 'fallback',
    fallbackReason: params.reason,
  });
  return finalize({
    decision,
    provider: params.provider,
    startedAt: params.startedAt,
    runId: params.runId,
    fallbackReason: params.reason,
  });
}

// ---------------------------------------------------------------------------
// Sprint 4 — helper: invoke_tool + entity resolution + write-guard.
// Extraído para que o fluxo de retomada de clarificação (Sprint 5) reuse
// exatamente os mesmos passos sem duplicar código.
// ---------------------------------------------------------------------------

interface InvokeParams {
  decision: OrchestratorDecision;
  input: OrchestratorInput;
  opts: OrchestratorServiceOptions;
  registry: ToolRegistry;
  providerName: string;
  startedAt: number;
  runId: string | null;
  providerLatencyMs: number;
  providerAttempts: number;
  clarificationStore: ClarificationStore;
  clarifyKey: string;
}

async function runInvokeToolDecision(p: InvokeParams): Promise<OrchestratorResult> {
  const { decision, input, opts, registry, providerName, startedAt, runId } = p;

  const tool = registry.get(decision.toolName!);
  if (!tool) {
    log.warn('orchestrator.unknown_tool', {
      provider: providerName,
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      runId,
      toolName: decision.toolName,
    });
    const stamped = stampFallback(decision, 'UNKNOWN_TOOL');
    return finalize({
      decision: stamped,
      provider: providerName,
      startedAt,
      runId,
      fallbackReason: 'UNKNOWN_TOOL',
      providerLatencyMs: p.providerLatencyMs,
      providerAttempts: p.providerAttempts,
    });
  }

  // ---- 8a. Sprint 4 — resolver nomes humanos em IDs -----------------------
  const mutableToolInput: Record<string, unknown> = {
    ...(decision.toolInput ?? {}),
  };
  if (decision.toolName === 'create_transaction') {
    const resolution: EntityResolution = await resolveCreateTransactionRefs(
      mutableToolInput,
      { tenantId: input.tenantId },
      {
        categoryLoader: opts.categoryLoader,
        bankAccountLoader: opts.bankAccountLoader,
      },
    );

    if (resolution.needsClarification) {
      log.info('orchestrator.entity.clarification', {
        provider: providerName,
        tenantId: input.tenantId,
        userId: input.userId,
        sessionId: input.sessionId ?? null,
        runId,
        clarificationType: resolution.clarificationType,
        query: resolution.query,
        candidateCount: resolution.candidates.length,
      });

      // Sprint 5 — persiste o estado pendente para retomada no próximo turno.
      const fieldToFill: 'categoryId' | 'bankAccountId' =
        resolution.clarificationType.startsWith('category')
          ? 'categoryId'
          : 'bankAccountId';
      try {
        await p.clarificationStore.set(p.clarifyKey, {
          type: resolution.clarificationType,
          query: resolution.query,
          candidates: resolution.candidates,
          originalDecision: decision,
          fieldToFill,
          attempts: 1,
          createdAt: Date.now(),
        });
      } catch (err: any) {
        // Falha no store não deve derrubar a resposta; só loga.
        log.warn('orchestrator.clarification.store_set_failed', {
          runId,
          error: err?.message || String(err),
        });
      }

      const clarifyDecision: OrchestratorDecision = {
        ...decision,
        action: 'clarify',
        message: resolution.clarificationMessage,
        toolName: undefined,
        toolInput: undefined,
        needsConfirmation: false,
      };
      return finalize({
        decision: clarifyDecision,
        provider: providerName,
        startedAt,
        runId,
        responseText: resolution.clarificationMessage,
        clarification: {
          type: resolution.clarificationType,
          query: resolution.query,
          candidates: resolution.candidates,
        },
        providerLatencyMs: p.providerLatencyMs,
        providerAttempts: p.providerAttempts,
      });
    }

    const resolved = resolution as Extract<EntityResolution, { needsClarification: false }>;
    if (resolved.categoryId) mutableToolInput.categoryId = resolved.categoryId;
    if (resolved.bankAccountId) mutableToolInput.bankAccountId = resolved.bankAccountId;
    delete mutableToolInput.categoryName;
    delete mutableToolInput.bankAccountName;
  }

  const effectiveDecision: OrchestratorDecision = {
    ...decision,
    toolInput: mutableToolInput,
  };

  const canDirectWrite =
    !!opts.allowDirectWrites &&
    (input.source === 'test' || input.source === 'system');

  if (tool.kind === 'write' && !canDirectWrite) {
    if (opts.allowDirectWrites && !canDirectWrite) {
      log.warn('orchestrator.write.direct_blocked', {
        provider: providerName,
        tenantId: input.tenantId,
        userId: input.userId,
        sessionId: input.sessionId ?? null,
        runId,
        source: input.source,
        toolName: decision.toolName,
      });
    }
    const withConfirm: OrchestratorDecision = {
      ...effectiveDecision,
      needsConfirmation: true,
    };
    log.info('orchestrator.write.confirmation_prepared', {
      provider: providerName,
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      runId,
      toolName: decision.toolName,
      confidence: decision.confidence,
    });
    return finalize({
      decision: withConfirm,
      provider: providerName,
      startedAt,
      runId,
      providerLatencyMs: p.providerLatencyMs,
      providerAttempts: p.providerAttempts,
    });
  }

  const toolCtx: ToolContext = {
    tenantId: input.tenantId,
    userId: input.userId,
    source: input.source,
    sessionId: input.sessionId ?? null,
    messageId: input.messageId ?? null,
    runId: input.runId ?? null,
  };

  const toolStart = Date.now();
  const toolResult: ToolResult<unknown> = await registry.invoke(
    decision.toolName!,
    mutableToolInput,
    toolCtx,
  );
  const toolMs = Date.now() - toolStart;

  log.info('orchestrator.tool.invoked', {
    provider: providerName,
    tenantId: input.tenantId,
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    runId,
    toolName: decision.toolName,
    ok: toolResult.ok,
    kind: tool.kind,
    durationMs: toolMs,
  });

  return finalize({
    decision: effectiveDecision,
    provider: providerName,
    startedAt,
    runId,
    toolInvoked: {
      name: decision.toolName!,
      ok: toolResult.ok,
      durationMs: toolMs,
      errorCode:
        toolResult.ok === true
          ? undefined
          : (toolResult as Exclude<typeof toolResult, { ok: true }>).code,
    },
    responseText: decision.message,
    providerLatencyMs: p.providerLatencyMs,
    providerAttempts: p.providerAttempts,
  });
}

// ---------------------------------------------------------------------------
// Sprint 5 — helper: retomada de clarificação multi-turn.
// ---------------------------------------------------------------------------

interface HandlePendingParams {
  message: string;
  pending: PendingClarification;
  clarifyKey: string;
  store: ClarificationStore;
  input: OrchestratorInput;
  opts: OrchestratorServiceOptions;
  registry: ToolRegistry;
  startedAt: number;
  runId: string | null;
}

/**
 * Retorna:
 *   - OrchestratorResult  → turno foi totalmente tratado (picked/canceled/reask)
 *   - null                → desistimos depois de N tentativas; deixa fluxo
 *                           normal rodar (talvez o usuário mudou de assunto)
 */
async function handlePendingClarification(
  p: HandlePendingParams,
): Promise<OrchestratorResult | null> {
  const { message, pending, clarifyKey, store, input, opts, registry, startedAt, runId } = p;

  const resolution = resolveClarification({
    userMessage: message,
    candidates: pending.candidates,
  });

  // ---- usuário desistiu -----------------------------------------------------
  if (resolution.kind === 'canceled') {
    await store.delete(clarifyKey);
    log.info('orchestrator.clarification.canceled', {
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      runId,
      type: pending.type,
      query: pending.query,
    });
    const cancelMsg = 'Ok, deixei pra lá. É só me chamar quando quiser tentar de novo.';
    const cancelDecision: OrchestratorDecision = OrchestratorDecisionSchema.parse({
      intent: 'clarification_canceled',
      confidence: 1,
      action: 'respond',
      message: cancelMsg,
    });
    return finalize({
      decision: cancelDecision,
      provider: 'null',
      startedAt,
      runId,
      responseText: cancelMsg,
    });
  }

  // ---- usuário escolheu um candidato ---------------------------------------
  if (resolution.kind === 'picked') {
    await store.delete(clarifyKey);
    log.info('orchestrator.clarification.resumed', {
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      runId,
      type: pending.type,
      query: pending.query,
      pickedId: resolution.candidate.id,
      attempts: pending.attempts,
    });

    // Injeta o ID escolhido no toolInput original e remove o *Name que gerou
    // a dúvida. O helper `runInvokeToolDecision` ainda vai rodar
    // `resolveCreateTransactionRefs`, o que permite resolver o OUTRO campo
    // (ex.: conta) se ainda estiver por nome.
    const nextToolInput = {
      ...(pending.originalDecision.toolInput ?? {}),
    };
    nextToolInput[pending.fieldToFill] = resolution.candidate.id;
    if (pending.fieldToFill === 'categoryId') delete nextToolInput.categoryName;
    if (pending.fieldToFill === 'bankAccountId') delete nextToolInput.bankAccountName;

    const resumedDecision: OrchestratorDecision = {
      ...pending.originalDecision,
      action: 'invoke_tool',
      toolInput: nextToolInput,
    };

    return runInvokeToolDecision({
      decision: resumedDecision,
      input,
      opts,
      registry,
      providerName: 'null',
      startedAt,
      runId,
      providerLatencyMs: 0,
      providerAttempts: 0,
      clarificationStore: store,
      clarifyKey,
    });
  }

  // ---- resposta não entendida ----------------------------------------------
  const nextAttempts = pending.attempts + 1;
  if (nextAttempts > MAX_CLARIFICATION_ATTEMPTS) {
    await store.delete(clarifyKey);
    log.info('orchestrator.clarification.gave_up', {
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      runId,
      type: pending.type,
      query: pending.query,
      attempts: pending.attempts,
    });
    return null; // cai no fluxo LLM normal
  }

  // Re-pergunta de forma mais explícita com opções numeradas.
  const reaskMsg = buildReaskMessage(pending);
  await store.set(clarifyKey, { ...pending, attempts: nextAttempts });
  log.info('orchestrator.clarification.reasked', {
    tenantId: input.tenantId,
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    runId,
    type: pending.type,
    query: pending.query,
    attempts: nextAttempts,
    reason: resolution.reason,
  });
  const reaskDecision: OrchestratorDecision = OrchestratorDecisionSchema.parse({
    intent: 'clarification_reask',
    confidence: 1,
    action: 'clarify',
    message: reaskMsg,
  });
  return finalize({
    decision: reaskDecision,
    provider: 'null',
    startedAt,
    runId,
    responseText: reaskMsg,
    clarification: {
      type: pending.type,
      query: pending.query,
      candidates: pending.candidates,
    },
  });
}

function buildReaskMessage(p: PendingClarification): string {
  const label =
    p.type.startsWith('category')
      ? 'categoria'
      : 'conta';
  const list = p.candidates
    .slice(0, 5)
    .map((c, i) => `${i + 1}) ${c.name}`)
    .join('\n');
  return (
    `Não entendi qual ${label} você escolheu. Responde com o número ou o nome:\n` +
    list +
    `\nOu diga "cancela" para deixar pra lá.`
  );
}

