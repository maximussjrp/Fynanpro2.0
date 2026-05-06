/**
 * Agent Orchestrator — barrel.
 */

export * from './types';
export {
  OrchestratorDecisionSchema,
  parseDecision,
  extractJsonBlock,
  ORCHESTRATOR_ACTIONS,
} from './decision-schema';
export type {
  OrchestratorDecision,
  OrchestratorAction,
  ParsedDecision,
  ParseFailure,
} from './decision-schema';
export { runOrchestrator } from './orchestrator.service';
export type { OrchestratorServiceOptions } from './orchestrator.service';
export { buildSystemPrompt } from './system-prompt';
export { sanitizeForPrompt } from './prompt-hygiene';
export type {
  HistoryItem,
  SanitizeOptions,
  SanitizeReport,
  SanitizeResult,
} from './prompt-hygiene';
export {
  selectProvider,
  logProviderBootOnce,
  __resetProviderBootForTests,
} from './providers/factory';
export type {
  LLMProvider,
  LLMProviderRequest,
  LLMProviderResponse,
  LLMToolDescriptor,
} from './providers/types';
export { NullLLMProvider } from './providers/null.provider';
export { GeminiLLMProvider } from './providers/gemini.provider';
