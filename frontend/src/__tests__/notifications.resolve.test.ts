import { resolveNotificationTarget, type AppNotification } from '@/lib/notifications';

function notification(overrides: Partial<AppNotification>): AppNotification {
  return {
    id: 'not-1',
    type: 'unknown',
    title: 'Titulo',
    message: 'Mensagem',
    isRead: false,
    priority: 'normal',
    createdAt: '2026-06-11T12:00:00.000Z',
    ...overrides,
  };
}

describe('resolveNotificationTarget', () => {
  it('aceita apenas rotas internas conhecidas', () => {
    expect(resolveNotificationTarget(notification({ actionUrl: '/dashboard/bank-accounts' }))).toBe('/dashboard/bank-accounts');
  });

  it('rejeita URL externa, dominio da API, javascript, data e login', () => {
    expect(resolveNotificationTarget(notification({ actionUrl: 'https://api.utopsistema.com.br/notifications' }))).toBe('/dashboard/notifications');
    expect(resolveNotificationTarget(notification({ actionUrl: 'javascript:alert(1)' }))).toBe('/dashboard/notifications');
    expect(resolveNotificationTarget(notification({ actionUrl: 'data:text/html,ok' }))).toBe('/dashboard/notifications');
    expect(resolveNotificationTarget(notification({ actionUrl: '/login' }))).toBe('/dashboard/notifications');
  });

  it('normaliza rota antiga quando ha mapeamento seguro', () => {
    expect(resolveNotificationTarget(notification({ actionUrl: '/transactions/tx-123' }))).toBe('/dashboard/transactions?focus=tx-123');
    expect(resolveNotificationTarget(notification({ actionUrl: '/recurring-bills' }))).toBe('/dashboard/recurring-bills');
  });

  it('infere destino por tipo quando actionUrl esta ausente', () => {
    expect(resolveNotificationTarget(notification({ type: 'low_balance' }))).toBe('/dashboard/bank-accounts');
    expect(resolveNotificationTarget(notification({ type: 'budget_alert' }))).toBe('/dashboard/budgets');
    expect(resolveNotificationTarget(notification({ type: 'payment_due' }))).toBe('/dashboard/recurring-bills');
    expect(resolveNotificationTarget(notification({ type: 'trial_warning_d7' }))).toBe('/dashboard/settings/billing');
  });
});
