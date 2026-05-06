/**
 * Agent Orchestrator — types (Sprint 3).
 *
 * Tipos de infraestrutura do orquestrador LLM mínimo. A decisão estruturada
 * em si vive em `decision-schema.ts` (lá fica a definição Zod canônica,
 * exportada como tipo). Este módulo concentra contexto de entrada, motivos
 * de fallback e resultado final entregue ao chamador.
 *
 * Regras:
 *   - o orquestrador nunca aceita `tenantId`/`userId` vindos do input do
 *     usuário; quem chama (chatbot, rota HTTP) fornece o contexto
 *   - o resultado é sempre tipado; parsing frágil de string é responsabilidade
 *     interna do provider/schema, jamais do consumidor
 *   - toda saída carrega `fallbackReason` quando `action === 'fallback'`
 */

import type { OrchestratorDecision } from './decision-schema';

/**
 * Contexto de entrada. Mantido propositalmente pequeno e estável.
 * Tudo que o orquestrador precisa para decidir deve caber aqui.
 */
export interface OrchestratorInput {
  tenantId: string;
  userId: string;
  message: string;
  /** 'chatbot' quando chamado a partir do ChatbotService; 'api'/'test' para outros. */
  source: 'chatbot' | 'api' | 'test' | 'system';
  /** Correlação opcional com a sessão/mensagem que originou a chamada. */
  sessionId?: string | null;
  messageId?: string | null;
  /** runId herdado do chamador — mantido para agrupar side-effects. */
  runId?: string | null;
  /** Histórico curto (últimas N mensagens) para contexto do prompt. Opcional. */
  recentHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  /**
   * Pistas operacionais do ChatbotService. O orquestrador deve respeitar:
   *   - `onboardingActive=true` → sempre devolve fallback (não interfere)
   *   - `state` informa o estado corrente da máquina de estados
   */
  onboardingActive?: boolean;
  state?: string;
}

/**
 * Motivos possíveis de fallback. Fechado propositalmente para permitir
 * métricas/alertas sem parsing de string livre.
 */
export type FallbackReason =
  | 'PROVIDER_DISABLED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_ERROR'
  | 'ONBOARDING_ACTIVE'
  | 'INVALID_JSON'
  | 'SCHEMA_VALIDATION'
  | 'UNKNOWN_TOOL'
  | 'LOW_CONFIDENCE'
  | 'WRITE_TOOL_DISABLED'
  | 'EMPTY_MESSAGE'
  | 'INTERNAL_ERROR';

/**
 * Resultado final do orquestrador para o chamador. Mantém a decisão
 * estruturada (para log/auditoria) + metadados operacionais.
 */
export interface OrchestratorResult {
  decision: OrchestratorDecision;
  /** Se houve execução de tool, o retorno bruto do registry é repassado. */
  toolInvoked?: {
    name: string;
    ok: boolean;
    durationMs: number;
    errorCode?: string;
  };
  /** Texto sugerido para responder ao usuário (quando aplicável). */
  responseText?: string;
  /** Quick replies sugeridas (quando aplicável). */
  quickReplies?: string[];
  /**
   * Motivo do fallback quando `decision.action === 'fallback'`.
   * Idêntico a `decision.fallbackReason`, exposto no topo por conveniência
   * e para permitir leituras simples em logs.
   */
  fallbackReason?: FallbackReason;
  /** Provider efetivamente usado ('gemini' | 'null' | etc.). */
  provider: string;
  /** Latência total da decisão (inclui LLM + parse + possível invoke). */
  latencyMs: number;
  /**
   * Latência pura do provider (sem parse/tool). Sprint 3.1 — útil para
   * distinguir tempo de LLM vs. overhead do orquestrador.
   */
  providerLatencyMs?: number;
  /** Número de tentativas reportadas pelo provider (1 = sem retry). */
  providerAttempts?: number;
  /**
   * Sprint 4 — payload estruturado de clarificação quando a resolução de
   * entidades (categoria/conta por nome) não conseguiu fechar a decisão
   * do LLM. Campo presente apenas quando `action === 'clarify'` por causa
   * de ambiguidade ou entidade não encontrada. Sempre tenant-scoped.
   */
  clarification?: {
    type:
      | 'category_ambiguous'
      | 'category_not_found'
      | 'account_ambiguous'
      | 'account_not_found';
    query: string;
    candidates: Array<{ id: string; name: string; score: number }>;
  };
  /** runId propagado. */
  runId: string;
}
