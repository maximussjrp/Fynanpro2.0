/**
 * Null provider — sempre reporta indisponível.
 *
 * Usado quando `LLM_ORCHESTRATOR_ENABLED` é falsy ou quando nenhum provider
 * real foi configurado. O orquestrador NÃO deve chamar `complete()`; se
 * chamar, lançamos — é bug e merece stacktrace.
 */

import type {
  LLMProvider,
  LLMProviderRequest,
  LLMProviderResponse,
} from './types';

export class NullLLMProvider implements LLMProvider {
  readonly name = 'null';
  isAvailable(): boolean {
    return false;
  }
  async complete(_req: LLMProviderRequest): Promise<LLMProviderResponse> {
    throw new Error(
      'NullLLMProvider.complete() foi chamado — orquestrador deve ter short-circuited em isAvailable()',
    );
  }
}
