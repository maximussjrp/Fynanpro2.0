/**
 * Agent Orchestrator — provider factory (Sprint 3).
 *
 * Escolhe o provider com base em env vars. A escolha é **sempre conservadora**:
 *   - `LLM_ORCHESTRATOR_ENABLED` precisa ser 'true' (string literal). Qualquer
 *     outro valor → null provider. Feature flag dura por padrão.
 *   - `LLM_PROVIDER` decide o tipo. Default: 'null'. 'gemini' ativa o Gemini
 *     apenas se houver `GEMINI_API_KEY`.
 *   - Se o provider escolhido não estiver `isAvailable()`, caímos para
 *     `NullLLMProvider` e logamos o motivo uma única vez.
 *
 * O factory é idempotente no sentido de que chamar múltiplas vezes é barato
 * e não reexecuta efeitos colaterais — exceto logging no boot.
 */

import { log } from '../../../utils/logger';
import type { LLMProvider } from './types';
import { NullLLMProvider } from './null.provider';
import { GeminiLLMProvider } from './gemini.provider';

export type ProviderName = 'null' | 'gemini';

export interface ProviderFactoryEnv {
  LLM_ORCHESTRATOR_ENABLED?: string;
  LLM_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

export interface SelectProviderResult {
  provider: LLMProvider;
  /** Quando fallback silencioso ocorreu, guarda o motivo. */
  reason?:
    | 'FLAG_OFF'
    | 'UNKNOWN_PROVIDER_NAME'
    | 'GEMINI_KEY_MISSING'
    | 'PROVIDER_NOT_AVAILABLE';
}

function envOr(env: ProviderFactoryEnv | undefined, key: keyof ProviderFactoryEnv): string | undefined {
  if (env && env[key] !== undefined) return env[key];
  return process.env[key];
}

/**
 * Seleciona o provider ativo. Nunca lança: sempre retorna algo utilizável.
 */
export function selectProvider(env?: ProviderFactoryEnv): SelectProviderResult {
  const flag = envOr(env, 'LLM_ORCHESTRATOR_ENABLED');
  if (flag !== 'true') {
    return { provider: new NullLLMProvider(), reason: 'FLAG_OFF' };
  }

  const name = (envOr(env, 'LLM_PROVIDER') || 'null').toLowerCase();

  if (name === 'null') {
    return { provider: new NullLLMProvider(), reason: 'FLAG_OFF' };
  }

  if (name === 'gemini') {
    const apiKey = envOr(env, 'GEMINI_API_KEY');
    if (!apiKey) {
      return { provider: new NullLLMProvider(), reason: 'GEMINI_KEY_MISSING' };
    }
    const provider = new GeminiLLMProvider({
      apiKey,
      model: envOr(env, 'GEMINI_MODEL'),
    });
    if (!provider.isAvailable()) {
      return { provider: new NullLLMProvider(), reason: 'PROVIDER_NOT_AVAILABLE' };
    }
    return { provider };
  }

  return { provider: new NullLLMProvider(), reason: 'UNKNOWN_PROVIDER_NAME' };
}

let bootLogged = false;
/**
 * Log idempotente do status do provider no boot. Silencia chamadas
 * subsequentes para evitar spam. Não participa da lógica de seleção.
 */
export function logProviderBootOnce(env?: ProviderFactoryEnv): void {
  if (bootLogged) return;
  bootLogged = true;
  const sel = selectProvider(env);
  log.info('orchestrator.provider.boot', {
    provider: sel.provider.name,
    reason: sel.reason ?? null,
  });
}

/** Somente para testes: permite resetar o estado do log. */
export function __resetProviderBootForTests(): void {
  bootLogged = false;
}
