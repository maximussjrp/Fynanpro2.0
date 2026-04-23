/**
 * Billing Source Guard — C5.0
 *
 * Decide se um provider de billing (Asaas, Stripe) pode escrever em
 * `Tenant.subscriptionStatus` para um tenant cujo `billingSource` atual é o
 * informado. Fonte-de-verdade única do sistema para essa decisão.
 *
 * Tabela-verdade:
 *
 *   currentSource │ asaas pode escrever? │ stripe pode escrever?
 *   ──────────────┼──────────────────────┼─────────────────────
 *   null          │ sim (toma posse)     │ sim (toma posse)
 *   'asaas'       │ sim                  │ não (mismatch)
 *   'stripe'      │ não (mismatch)       │ sim
 *   'trial'       │ não (upgrade via C3) │ não
 *   'manual'      │ não (override)       │ não
 *
 * Writes em Subscription e PaymentRecord NÃO passam pelo guard — essas
 * tabelas são namespaced por `provider`. O guard protege APENAS o cache
 * legado em `Tenant.subscriptionStatus`.
 */

export type BillingSource = 'trial' | 'asaas' | 'stripe' | 'manual' | null;
export type BillingProvider = 'asaas' | 'stripe';

export function canProviderWriteTenant(
  provider: BillingProvider,
  currentSource: BillingSource,
): boolean {
  if (currentSource === null) return true;
  if (currentSource === 'manual') return false;
  if (currentSource === 'trial') return false;
  return currentSource === provider;
}

/** Quando o provider deve promover NULL → provider atômicamente (primeira
 *  escrita legítima). Retorna `true` somente para `null`. */
export function shouldPromoteBillingSource(
  currentSource: BillingSource,
): boolean {
  return currentSource === null;
}
