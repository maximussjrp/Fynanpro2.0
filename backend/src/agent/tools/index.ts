/**
 * Agent Tool Layer — index
 *
 * Registro default das tools do Sprint 2.
 */

import { toolRegistry, ToolRegistry } from './registry';
import { createTransactionTool } from './create-transaction.tool';
import { listCategoriesTool } from './list-categories.tool';
import { listAccountsTool } from './list-accounts.tool';
import { getAccountBalanceTool } from './get-account-balance.tool';

export * from './types';
export { ToolRegistry, toolRegistry } from './registry';
export { createTransactionTool } from './create-transaction.tool';
export { listCategoriesTool } from './list-categories.tool';
export { listAccountsTool } from './list-accounts.tool';
export { getAccountBalanceTool } from './get-account-balance.tool';

let registered = false;

/**
 * Registra as tools do Sprint 2 no registry default. Idempotente.
 * Útil para main.ts e para setups de teste que queiram reutilizar o registry
 * global.
 */
export function registerDefaultTools(registry: ToolRegistry = toolRegistry): ToolRegistry {
  if (registry === toolRegistry && registered) return registry;
  registry.register(createTransactionTool);
  registry.register(listCategoriesTool);
  registry.register(listAccountsTool);
  registry.register(getAccountBalanceTool);
  if (registry === toolRegistry) registered = true;
  return registry;
}
