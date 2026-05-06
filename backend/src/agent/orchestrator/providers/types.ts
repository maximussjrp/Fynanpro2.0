/**
 * Agent Orchestrator — providers (Sprint 3).
 *
 * Abstração mínima de provider LLM. O orquestrador só conhece esta interface;
 * nenhuma dependência direta de SDK vendor deve vazar para `orchestrator.service.ts`.
 *
 * Um provider é responsável por:
 *   1. receber um prompt estruturado (`system`, `user`, `tools`)
 *   2. devolver **texto bruto** que deve conter um JSON compatível com
 *      `OrchestratorDecisionSchema`
 *   3. sinalizar indisponibilidade via `isAvailable()` (sem lançar) — o
 *      orquestrador precisa decidir antes de chamar `complete()`
 *
 * Falhas em `complete()` devem ser lançadas como exceção normal; o
 * orquestrador captura e carimba fallback com `PROVIDER_ERROR`.
 */

export interface LLMToolDescriptor {
  name: string;
  description: string;
  kind: 'read' | 'write';
}

export interface LLMProviderRequest {
  system: string;
  user: string;
  /** Histórico curto (opcional). */
  history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  /** Catálogo de tools disponíveis (apenas metadados, não schemas). */
  tools: LLMToolDescriptor[];
  /** Correlação para logs do provider. */
  runId?: string | null;
}

export interface LLMProviderResponse {
  /** Texto bruto. Pode conter fences markdown. */
  raw: string;
  /** Nome do provider ('gemini', 'null', 'mock'...). */
  provider: string;
  /** Latência da chamada em ms (puramente do provider, última tentativa). */
  latencyMs: number;
  /**
   * Número de tentativas realizadas (1 = sem retry). Opcional para manter
   * compatibilidade com providers simples. Usado em telemetria.
   */
  attempts?: number;
  /**
   * Status HTTP da última resposta, quando aplicável. Opcional.
   */
  httpStatus?: number;
}

export interface LLMProvider {
  /** Identificador estável ('gemini', 'null', 'mock'...). Usado em logs. */
  readonly name: string;
  /**
   * Indica se o provider está configurado e pronto. Deve ser síncrono,
   * barato e SEM efeitos colaterais de rede. Usado para short-circuit.
   */
  isAvailable(): boolean;
  /**
   * Executa a chamada LLM. Só é invocado quando `isAvailable()` retorna true.
   * Pode lançar — o orquestrador captura.
   */
  complete(req: LLMProviderRequest): Promise<LLMProviderResponse>;
}
