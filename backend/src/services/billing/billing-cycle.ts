/**
 * UTOP Reliability Sprint 3 — helper de ciclo de cobrança.
 *
 * Mapeia o `cycle` do Asaas (e do nosso campo `Subscription.cycle`) para um
 * incremento de data. Usado pelo handler PAYMENT_CONFIRMED para calcular
 * `currentPeriodEnd` sem hardcode de "+30d".
 *
 * Ciclos suportados: WEEKLY | BIWEEKLY | MONTHLY | QUARTERLY | SEMIANNUALLY |
 * YEARLY. Aceita case-insensitive e variações 'monthly'/'yearly' por compat
 * com plans antigos do `payment.service.ts`.
 */

export type BillingCycle =
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUALLY'
  | 'YEARLY';

const NORMALIZE: Record<string, BillingCycle> = {
  weekly: 'WEEKLY',
  biweekly: 'BIWEEKLY',
  monthly: 'MONTHLY',
  quarterly: 'QUARTERLY',
  semiannually: 'SEMIANNUALLY',
  yearly: 'YEARLY',
  annual: 'YEARLY',
  annually: 'YEARLY',
};

export function normalizeCycle(cycle: string | null | undefined): BillingCycle {
  if (!cycle) return 'MONTHLY';
  const key = cycle.toLowerCase();
  return NORMALIZE[key] ?? 'MONTHLY';
}

/**
 * Avança uma data por 1 ciclo. Preserva dia do mês quando possível
 * (mesma semântica usada pelo Asaas — assina dia 5, próximo vencimento dia 5).
 */
export function advancePeriod(from: Date, cycle: string | null | undefined): Date {
  const c = normalizeCycle(cycle);
  const d = new Date(from.getTime());
  switch (c) {
    case 'WEEKLY':
      d.setUTCDate(d.getUTCDate() + 7);
      return d;
    case 'BIWEEKLY':
      d.setUTCDate(d.getUTCDate() + 14);
      return d;
    case 'MONTHLY':
      d.setUTCMonth(d.getUTCMonth() + 1);
      return d;
    case 'QUARTERLY':
      d.setUTCMonth(d.getUTCMonth() + 3);
      return d;
    case 'SEMIANNUALLY':
      d.setUTCMonth(d.getUTCMonth() + 6);
      return d;
    case 'YEARLY':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d;
  }
}
