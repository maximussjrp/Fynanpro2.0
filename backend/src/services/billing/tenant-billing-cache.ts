/**
 * Tenant Billing Cache — módulo isolado (C5.0)
 *
 * Extraído de `middleware/subscription.ts` para permitir que handlers do
 * webhook Asaas invalidem o cache sem criar dependência circular
 * (middleware → handlers → middleware).
 *
 * Contrato:
 *   - cache em memória, chaveado por tenantId
 *   - TTL 60s
 *   - thread-safe no contexto single-process Node (não distribuído)
 *
 * Consumidores:
 *   - `middleware/subscription.ts` lê/escreve durante o request cycle
 *   - handlers Asaas chamam `invalidateTenantBillingCache(tenantId)` após
 *     mutar `Tenant.subscriptionStatus`
 */

export interface CachedSubscriptionState {
  status: string;
  expiresAt: number;
}

const subscriptionCache = new Map<string, CachedSubscriptionState>();
const CACHE_TTL_MS = 60 * 1000;

export function getCachedSubscription(
  tenantId: string,
): CachedSubscriptionState | undefined {
  const entry = subscriptionCache.get(tenantId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    subscriptionCache.delete(tenantId);
    return undefined;
  }
  return entry;
}

export function setCachedSubscription(tenantId: string, status: string): void {
  subscriptionCache.set(tenantId, {
    status,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/** API canônica C5.0. Nome descritivo do escopo (não confundir com cache
 *  de outros subsistemas). */
export function invalidateTenantBillingCache(tenantId: string): void {
  subscriptionCache.delete(tenantId);
}

/** Alias legado exportado no `middleware/subscription.ts`. Mantido para
 *  evitar quebrar importadores existentes. */
export const clearSubscriptionCache = invalidateTenantBillingCache;

/** Uso em testes apenas. */
export function __resetCacheForTests(): void {
  subscriptionCache.clear();
}
