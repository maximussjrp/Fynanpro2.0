/**
 * Pricing — espelho frontend da fonte única de verdade dos preços.
 *
 * Backend: backend/src/config/pricing.ts
 * Mantenha os valores sincronizados.
 */

export const MONTHLY_PLAN_PRICE_REAIS = 79.90;
export const MONTHLY_PLAN_PRICE_CENTS = 7990;

export const QUARTERLY_PLAN_PRICE_REAIS = 197.00;
export const QUARTERLY_PLAN_PRICE_CENTS = 19700;
export const QUARTERLY_PLAN_PRICE_PER_MONTH_REAIS = 65.67;
export const QUARTERLY_PLAN_SAVINGS_REAIS = 42.70;

export const SEMIANNUAL_PLAN_PRICE_REAIS = 357.00;
export const SEMIANNUAL_PLAN_PRICE_CENTS = 35700;
export const SEMIANNUAL_PLAN_PRICE_PER_MONTH_REAIS = 59.50;
export const SEMIANNUAL_PLAN_SAVINGS_REAIS = 122.40;

export const YEARLY_PLAN_PRICE_REAIS = 597.00;
export const YEARLY_PLAN_PRICE_CENTS = 59700;
export const YEARLY_PLAN_PRICE_PER_MONTH_REAIS = 49.75;
export const YEARLY_PLAN_SAVINGS_REAIS = 361.80;

export function formatBRL(reais: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(reais);
}
