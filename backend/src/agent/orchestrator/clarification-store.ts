/**
 * Agent Orchestrator — clarification store (Sprint 5).
 *
 * Guarda o "estado pendente" de uma clarificação entre turnos. Quando o
 * orquestrador emite `action: 'clarify'` por causa de ambiguidade ou
 * entidade não encontrada (Sprint 4), salvamos aqui tudo que é preciso
 * para retomar a conversa no próximo turno:
 *
 *   - a decisão original da LLM (intent, toolName, toolInput com *Name)
 *   - o tipo de clarificação e o que foi perguntado (query)
 *   - os candidatos oferecidos ao usuário
 *   - contagem de tentativas (para desistir depois de N rounds)
 *
 * Chave: `${tenantId}:${sessionId ?? userId}`. Isolamento multi-tenant.
 *
 * A implementação default é in-memory, com TTL (default 5 min). Em prod
 * um adapter Redis pode substituir sem tocar no orquestrador.
 */

import type { OrchestratorDecision } from './decision-schema';

export interface PendingClarification {
  /** Tipo emitido pelo entity-resolver. */
  type:
    | 'category_ambiguous'
    | 'category_not_found'
    | 'account_ambiguous'
    | 'account_not_found';
  /** Texto original que gerou a ambiguidade ("mercado", "itau"). */
  query: string;
  /** Quais candidatos foram apresentados ao usuário. */
  candidates: Array<{ id: string; name: string; score: number }>;
  /**
   * Decisão original da LLM. Preserva `toolName` + `toolInput` (com
   * categoryName/bankAccountName) para que o orquestrador re-execute o
   * fluxo depois que o usuário responder.
   */
  originalDecision: OrchestratorDecision;
  /** Qual campo vamos preencher quando o usuário escolher. */
  fieldToFill: 'categoryId' | 'bankAccountId';
  /** Quantas vezes já perguntamos a mesma coisa. Desiste depois de N. */
  attempts: number;
  /** Unix ms. Usado pelo TTL. */
  createdAt: number;
}

export interface ClarificationStore {
  get(key: string): Promise<PendingClarification | null>;
  set(key: string, value: PendingClarification): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Default TTL: 5 minutos. */
export const DEFAULT_CLARIFICATION_TTL_MS = 5 * 60 * 1000;
/** Máximo de rounds de pergunta antes de desistir. */
export const MAX_CLARIFICATION_ATTEMPTS = 2;

/**
 * Implementação in-memory. Safe para single-process. Evita growth ilimitado
 * filtrando entradas vencidas no `get`/`set`. Limite duro de 1000 entradas
 * (sobrescreve a mais antiga se estourar).
 */
export class InMemoryClarificationStore implements ClarificationStore {
  private readonly map = new Map<string, PendingClarification>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(opts: { ttlMs?: number; maxEntries?: number } = {}) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_CLARIFICATION_TTL_MS;
    this.maxEntries = opts.maxEntries ?? 1000;
  }

  async get(key: string): Promise<PendingClarification | null> {
    const v = this.map.get(key);
    if (!v) return null;
    if (this.isExpired(v)) {
      this.map.delete(key);
      return null;
    }
    return v;
  }

  async set(key: string, value: PendingClarification): Promise<void> {
    if (this.map.size >= this.maxEntries && !this.map.has(key)) {
      // Limpeza oportunista de expirados antes de descartar.
      this.purgeExpired();
      if (this.map.size >= this.maxEntries) {
        // Remove a primeira entrada (inserção mais antiga).
        const firstKey = this.map.keys().next().value;
        if (firstKey !== undefined) this.map.delete(firstKey);
      }
    }
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  /** Test helper — limpa tudo. NÃO usar em produção. */
  clear(): void {
    this.map.clear();
  }

  private isExpired(v: PendingClarification): boolean {
    return Date.now() - v.createdAt > this.ttlMs;
  }

  private purgeExpired(): void {
    for (const [k, v] of this.map) {
      if (this.isExpired(v)) this.map.delete(k);
    }
  }
}

/** Store padrão single-process. Usada quando nenhum override é passado. */
export const defaultClarificationStore = new InMemoryClarificationStore();

/** Compõe a chave da conversa. Fallback no userId quando não há sessão. */
export function clarificationKey(
  tenantId: string,
  sessionId: string | null | undefined,
  userId: string,
): string {
  return `${tenantId}:${sessionId ?? userId}`;
}
