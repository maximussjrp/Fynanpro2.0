/**
 * UTOP Reliability Sprint 2 — semântica única de "atrasado".
 *
 * Regra de ouro (única em todo o backend):
 *   atrasado = registro tem dueDate/transactionDate < hoje (BRT)
 *              E status ∈ {'pending', 'overdue'} E não está deletado.
 *
 * Job diário (transaction-generator + recurring-bill.service) flipa
 * o status persistido de 'pending' → 'overdue'. Mas leitores (dashboard,
 * reports, notifications) NUNCA devem assumir que o job rodou: precisam
 * usar `isOverdue()` ou `overdueWhere()` para considerar a data também.
 *
 * Antes do Sprint 2 esta lógica estava espalhada em 6 lugares com
 * variações sutis (uns só checavam status, outros só data). Agora há
 * uma função única.
 */

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

/**
 * Retorna o início do dia atual no fuso de Brasília (UTC-3) em UTC absoluto.
 * Usado como "hoje" canônico para todas as comparações de atraso.
 */
export function todayBRT(now: Date = new Date()): Date {
  // Converte instante atual para BRT, zera hora, e devolve em UTC.
  const brtMs = now.getTime() + BRT_OFFSET_MS;
  const brt = new Date(brtMs);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() - BRT_OFFSET_MS);
}

/**
 * Critério único de "atrasado".
 *
 * @param status        valor persistido em `Transaction.status` ou `RecurringBillOccurrence.status`
 * @param referenceDate `transactionDate` (Transaction) ou `dueDate` (Occurrence)
 * @param now           override opcional (testes)
 */
export function isOverdue(
  status: string | null | undefined,
  referenceDate: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!referenceDate) return false;
  if (status === 'completed' || status === 'paid' || status === 'cancelled') return false;
  if (status === 'overdue') return true;
  if (status !== 'pending') return false;
  const ref = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;
  return ref.getTime() < todayBRT(now).getTime();
}

/**
 * Predicate Prisma equivalente a `isOverdue()`.
 * Use em `where: { ...overdueWhere('transactionDate') }` ou `where: { ...overdueWhere('dueDate') }`.
 *
 * Resultado: registros com status='overdue' OU (status='pending' E data < hoje BRT).
 */
export function overdueWhere(dateField: 'transactionDate' | 'dueDate', now: Date = new Date()) {
  const today = todayBRT(now);
  return {
    OR: [
      { status: 'overdue' as const },
      {
        status: 'pending' as const,
        [dateField]: { lt: today },
      },
    ],
  };
}
