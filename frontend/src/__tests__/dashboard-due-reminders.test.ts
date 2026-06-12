import {
  buildReminderMessage,
  filterDueItems,
  getDismissKey,
  getDuePeriod,
  getDueStatus,
} from '@/lib/dashboard-due-reminders';

describe('dashboard-due-reminders', () => {
  const now = new Date(2026, 5, 11, 10, 0, 0);
  const items = [
    { id: 'yesterday', description: 'Vencido', dueDate: '2026-06-10', amount: 10, status: 'pending' },
    { id: 'today', description: 'Hoje', dueDate: '2026-06-11', amount: 20, status: 'pending' },
    { id: 'week', description: 'Semana', dueDate: '2026-06-18', amount: 30, status: 'pending' },
    { id: 'month', description: 'Mes', dueDate: '2026-06-25', amount: 40, status: 'pending' },
    { id: 'next-month', description: 'Outro mes', dueDate: '2026-07-01', amount: 50, status: 'pending' },
    { id: 'completed', description: 'Pago', dueDate: '2026-06-11', amount: 60, status: 'completed' },
    { id: 'cancelled', description: 'Cancelado', dueDate: '2026-06-11', amount: 70, status: 'cancelled' },
  ];

  it('calcula periodos: hoje, proximos 7 dias e mes calendario atual', () => {
    expect(getDuePeriod('today', now)).toEqual({
      startDate: '2026-06-11',
      endDate: '2026-06-11',
      label: 'Hoje',
    });
    expect(getDuePeriod('week', now)).toEqual({
      startDate: '2026-06-11',
      endDate: '2026-06-18',
      label: 'Proximos 7 dias',
    });
    expect(getDuePeriod('month', now)).toEqual({
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      label: 'Mes calendario atual',
    });
  });

  it('filtra hoje, semana e mes sem exibir pagos ou cancelados', () => {
    expect(filterDueItems(items, 'today', now).map(item => item.id)).toEqual(['today']);
    expect(filterDueItems(items, 'week', now).map(item => item.id)).toEqual(['today', 'week']);
    expect(filterDueItems(items, 'month', now).map(item => item.id)).toEqual(['yesterday', 'today', 'week', 'month']);
  });

  it('classifica status visual por data de vencimento', () => {
    expect(getDueStatus('2026-06-10', now)).toBe('overdue');
    expect(getDueStatus('2026-06-11', now)).toBe('today');
    expect(getDueStatus('2026-06-12', now)).toBe('upcoming');
  });

  it('prioriza lembretes de vencido, hoje, semana e lancamento diario', () => {
    expect(buildReminderMessage({ items, now })?.id).toBe('overdue');
    expect(buildReminderMessage({ items: items.filter(item => item.id !== 'yesterday'), now })?.id).toBe('due-today');
    expect(buildReminderMessage({ items: [{ id: 'week', description: 'Semana', dueDate: '2026-06-12', amount: 10 }], now })?.id).toBe('due-week');
    expect(buildReminderMessage({ items: [], now })?.id).toBe('daily-entry');
    expect(buildReminderMessage({ items: [], hasTransactionCreatedToday: true, now })).toBeNull();
  });

  it('gera chave de fechamento por dia', () => {
    expect(getDismissKey(now)).toBe('utop-dashboard-reminder-dismissed-2026-06-11');
  });
});
