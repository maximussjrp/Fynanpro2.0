export type DueFilter = 'today' | 'week' | 'month';
export type DueStatus = 'today' | 'upcoming' | 'overdue';

export interface DueItem {
  id: string;
  description: string;
  dueDate: string;
  amount: number;
  account?: string;
  status?: string;
  type?: string;
  createdAt?: string;
}

export interface DuePeriod {
  startDate: string;
  endDate: string;
  label: string;
}

export interface ReminderInput {
  items: DueItem[];
  hasTransactionCreatedToday?: boolean;
  now?: Date;
}

export interface ReminderMessage {
  id: 'overdue' | 'due-today' | 'due-week' | 'daily-entry';
  message: string;
  tone: 'danger' | 'warning' | 'info';
}

const BLOCKED_STATUSES = new Set(['completed', 'paid', 'cancelled', 'canceled', 'deleted']);

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseLocalDate(value: string): Date {
  const [datePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function getDuePeriod(filter: DueFilter, now: Date = new Date()): DuePeriod {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (filter === 'today') {
    const value = formatLocalDate(today);
    return { startDate: value, endDate: value, label: 'Hoje' };
  }

  if (filter === 'week') {
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    return {
      startDate: formatLocalDate(today),
      endDate: formatLocalDate(end),
      label: 'Proximos 7 dias',
    };
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
    label: 'Mes calendario atual',
  };
}

export function getDueStatus(dueDate: string, now: Date = new Date()): DueStatus {
  const due = parseLocalDate(dueDate);
  const today = parseLocalDate(formatLocalDate(now));

  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}

export function isVisibleDueItem(item: Pick<DueItem, 'status' | 'dueDate'>): boolean {
  if (!item.dueDate) return false;
  const status = String(item.status || 'pending').toLowerCase();
  return !BLOCKED_STATUSES.has(status);
}

export function filterDueItems<T extends DueItem>(items: T[], filter: DueFilter, now: Date = new Date()): T[] {
  const period = getDuePeriod(filter, now);
  const start = parseLocalDate(period.startDate);
  const end = parseLocalDate(period.endDate);

  return items
    .filter(isVisibleDueItem)
    .filter((item) => {
      const due = parseLocalDate(item.dueDate);
      return due >= start && due <= end;
    })
    .sort((left, right) => parseLocalDate(left.dueDate).getTime() - parseLocalDate(right.dueDate).getTime());
}

export function getDismissKey(now: Date = new Date()): string {
  return `utop-dashboard-reminder-dismissed-${formatLocalDate(now)}`;
}

export function buildReminderMessage({
  items,
  hasTransactionCreatedToday = false,
  now = new Date(),
}: ReminderInput): ReminderMessage | null {
  const visibleItems = items.filter(isVisibleDueItem);
  const overdueCount = visibleItems.filter((item) => getDueStatus(item.dueDate, now) === 'overdue').length;
  if (overdueCount > 0) {
    return {
      id: 'overdue',
      tone: 'danger',
      message: `Voce tem ${overdueCount} vencimento(s) atrasado(s).`,
    };
  }

  const todayCount = visibleItems.filter((item) => getDueStatus(item.dueDate, now) === 'today').length;
  if (todayCount > 0) {
    return {
      id: 'due-today',
      tone: 'warning',
      message: `Voce tem ${todayCount} vencimento(s) para hoje.`,
    };
  }

  const weekCount = filterDueItems(visibleItems, 'week', now).filter((item) => getDueStatus(item.dueDate, now) === 'upcoming').length;
  if (weekCount > 0) {
    return {
      id: 'due-week',
      tone: 'info',
      message: `Voce tem ${weekCount} conta(s) vencendo nos proximos dias.`,
    };
  }

  if (!hasTransactionCreatedToday) {
    return {
      id: 'daily-entry',
      tone: 'info',
      message: 'Ja fez os lancamentos de gastos hoje?',
    };
  }

  return null;
}
