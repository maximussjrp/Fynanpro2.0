/**
 * Helpers para manipulação segura de datas
 * Trata edge cases como dueDay = 31 em meses curtos
 */

/**
 * Retorna o último dia do mês para uma data específica
 */
export function getLastDayOfMonth(year: number, month: number): number {
  // Dia 0 do próximo mês = último dia do mês atual
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calcula a data de vencimento segura, considerando meses curtos
 * Se dueDay > dias do mês, usa o último dia do mês
 * 
 * @example
 * getSafeDueDate(2025, 1, 31) // Fevereiro com 28 dias → 28/02/2025
 * getSafeDueDate(2025, 3, 31) // Abril com 30 dias → 30/04/2025
 * getSafeDueDate(2025, 0, 31) // Janeiro com 31 dias → 31/01/2025
 */
export function getSafeDueDate(year: number, month: number, dueDay: number): Date {
  const lastDayOfMonth = getLastDayOfMonth(year, month);
  const safeDay = Math.min(dueDay, lastDayOfMonth);
  
  const date = new Date(year, month, safeDay);
  date.setHours(0, 0, 0, 0);
  
  return date;
}

/**
 * Calcula a próxima data de vencimento baseada na frequência
 * 
 * @param baseDate Data base para cálculo
 * @param frequency Frequência: 'monthly', 'weekly', 'biweekly', 'yearly'
 * @param dueDay Dia do vencimento (1-31), usado apenas para monthly/yearly
 * @param periodsAhead Quantos períodos à frente calcular (default: 1)
 */
export function getNextDueDate(
  baseDate: Date,
  frequency: string,
  dueDay: number,
  periodsAhead: number = 1
): Date {
  const base = new Date(baseDate);
  base.setHours(0, 0, 0, 0);

  switch (frequency) {
    case 'weekly':
      base.setDate(base.getDate() + (7 * periodsAhead));
      return base;

    case 'biweekly':
      base.setDate(base.getDate() + (14 * periodsAhead));
      return base;

    case 'monthly': {
      const targetMonth = base.getMonth() + periodsAhead;
      const targetYear = base.getFullYear() + Math.floor(targetMonth / 12);
      const normalizedMonth = targetMonth % 12;
      return getSafeDueDate(targetYear, normalizedMonth, dueDay);
    }

    case 'yearly': {
      const targetYear = base.getFullYear() + periodsAhead;
      return getSafeDueDate(targetYear, base.getMonth(), dueDay);
    }

    default:
      // Default: monthly
      const targetMonth = base.getMonth() + periodsAhead;
      const targetYear = base.getFullYear() + Math.floor(targetMonth / 12);
      const normalizedMonth = targetMonth % 12;
      return getSafeDueDate(targetYear, normalizedMonth, dueDay);
  }
}

/**
 * Gera uma lista de datas de vencimento para os próximos N períodos
 * 
 * @param startDate Data inicial
 * @param frequency Frequência da recorrência
 * @param dueDay Dia do vencimento
 * @param count Quantidade de datas a gerar
 */
export function generateDueDates(
  startDate: Date,
  frequency: string,
  dueDay: number,
  count: number
): Date[] {
  const dates: Date[] = [];
  
  for (let i = 0; i < count; i++) {
    const dueDate = getNextDueDate(startDate, frequency, dueDay, i);
    dates.push(dueDate);
  }
  
  return dates;
}

/**
 * Verifica se duas datas são do mesmo dia (ignora hora)
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Retorna o início do dia (00:00:00.000)
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Retorna o fim do dia (23:59:59.999)
 */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Calcula a diferença em dias entre duas datas
 * Positivo = date1 > date2 (atrasado)
 * Negativo = date1 < date2 (antecipado)
 */
export function diffInDays(date1: Date, date2: Date): number {
  const d1 = startOfDay(date1);
  const d2 = startOfDay(date2);
  const diffTime = d1.getTime() - d2.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}
