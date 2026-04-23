/**
 * C5.0 — Tabela-verdade do guard de billingSource.
 *
 * Regra central (imutável enquanto a fase C5 estiver ativa):
 *   - NULL         → permite QUALQUER provider (zona neutra, primeiro a escrever promove)
 *   - 'trial'      → BLOQUEIA (trial é gerido só pela rota C3, nunca por webhook)
 *   - 'manual'     → BLOQUEIA (estado administrativo, só humano muda)
 *   - 'asaas'      → permite só 'asaas'
 *   - 'stripe'     → permite só 'stripe'
 */

import {
  canProviderWriteTenant,
  shouldPromoteBillingSource,
  type BillingSource,
} from '../../services/asaas/billing-source.guard';

describe('canProviderWriteTenant — tabela-verdade', () => {
  const cases: Array<{
    source: BillingSource;
    provider: 'asaas' | 'stripe';
    expected: boolean;
  }> = [
    // NULL → todos permitidos
    { source: null, provider: 'asaas', expected: true },
    { source: null, provider: 'stripe', expected: true },
    // trial → todos bloqueados
    { source: 'trial', provider: 'asaas', expected: false },
    { source: 'trial', provider: 'stripe', expected: false },
    // manual → todos bloqueados
    { source: 'manual', provider: 'asaas', expected: false },
    { source: 'manual', provider: 'stripe', expected: false },
    // asaas → só asaas
    { source: 'asaas', provider: 'asaas', expected: true },
    { source: 'asaas', provider: 'stripe', expected: false },
    // stripe → só stripe
    { source: 'stripe', provider: 'asaas', expected: false },
    { source: 'stripe', provider: 'stripe', expected: true },
  ];

  for (const { source, provider, expected } of cases) {
    it(`source=${source ?? 'null'} provider=${provider} → ${expected}`, () => {
      expect(canProviderWriteTenant(provider, source)).toBe(expected);
    });
  }
});

describe('shouldPromoteBillingSource', () => {
  it('promove somente quando source é NULL', () => {
    expect(shouldPromoteBillingSource(null)).toBe(true);
    expect(shouldPromoteBillingSource('trial')).toBe(false);
    expect(shouldPromoteBillingSource('asaas')).toBe(false);
    expect(shouldPromoteBillingSource('stripe')).toBe(false);
    expect(shouldPromoteBillingSource('manual')).toBe(false);
  });
});
