import { Bell, AlertCircle, Clock, DollarSign, CreditCard, type LucideIcon } from 'lucide-react';

export const NOTIFICATIONS_FALLBACK_ROUTE = '/dashboard/notifications';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  priority: NotificationPriority;
  createdAt: string;
  actionUrl?: string | null;
  relatedId?: string | null;
  relatedType?: string | null;
  transactionId?: string | null;
  metadata?: unknown;
}

const allowedDashboardRoutes = [
  '/dashboard',
  '/dashboard/bank-accounts',
  '/dashboard/budgets',
  '/dashboard/calendar',
  '/dashboard/categories',
  '/dashboard/categories/migrate',
  '/dashboard/imports',
  '/dashboard/imports/review',
  '/dashboard/installments',
  '/dashboard/notifications',
  '/dashboard/planning',
  '/dashboard/plans',
  '/dashboard/plans/checkout',
  '/dashboard/recurring-bills',
  '/dashboard/reports',
  '/dashboard/reports/energy',
  '/dashboard/settings',
  '/dashboard/settings/billing',
  '/dashboard/settings/profiles',
  '/dashboard/transactions',
  '/dashboard/v2',
];

const routeAliases: Record<string, string> = {
  '/transactions': '/dashboard/transactions',
  '/bank-accounts': '/dashboard/bank-accounts',
  '/budgets': '/dashboard/budgets',
  '/recurring-bills': '/dashboard/recurring-bills',
  '/settings/billing': '/dashboard/settings/billing',
  '/plans': '/dashboard/plans',
  '/notifications': NOTIFICATIONS_FALLBACK_ROUTE,
};

function normalizeKnownLegacyRoute(pathname: string, search: string): string {
  const transactionMatch = pathname.match(/^\/transactions\/([^/]+)$/);
  if (transactionMatch) {
    return `/dashboard/transactions?focus=${encodeURIComponent(transactionMatch[1])}`;
  }

  return `${routeAliases[pathname] ?? pathname}${search}`;
}

function isAllowedDashboardRoute(target: string): boolean {
  const pathname = target.split('?')[0].split('#')[0];
  return allowedDashboardRoutes.some((route) => pathname === route);
}

function sanitizeInternalPath(rawPath: string): string | null {
  const trimmed = rawPath.trim();

  if (!trimmed || trimmed.startsWith('//')) return null;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower === '/login' ||
    lower.startsWith('/login?') ||
    lower === '/'
  ) {
    return null;
  }

  if (!trimmed.startsWith('/')) return null;

  const url = new URL(trimmed, 'https://utopsistema.local');
  const normalized = normalizeKnownLegacyRoute(url.pathname, url.search);

  return isAllowedDashboardRoute(normalized) ? normalized : null;
}

function inferRouteFromNotification(notification: AppNotification): string {
  if (notification.transactionId) {
    return `/dashboard/transactions?focus=${encodeURIComponent(notification.transactionId)}`;
  }

  switch (notification.type) {
    case 'payment_due':
    case 'overdue':
      return '/dashboard/recurring-bills';
    case 'budget_alert':
      return '/dashboard/budgets';
    case 'low_balance':
      return '/dashboard/bank-accounts';
    case 'trial_warning_d7':
    case 'trial_warning_d3':
    case 'trial_warning_d1':
    case 'subscription':
    case 'subscription_alert':
      return '/dashboard/settings/billing';
    case 'transaction':
    case 'transaction_created':
    case 'transaction_updated':
      return '/dashboard/transactions';
    default:
      return NOTIFICATIONS_FALLBACK_ROUTE;
  }
}

export function resolveNotificationTarget(notification: AppNotification): string {
  if (notification.actionUrl) {
    const sanitized = sanitizeInternalPath(notification.actionUrl);
    if (sanitized) return sanitized;
    return NOTIFICATIONS_FALLBACK_ROUTE;
  }

  const inferred = inferRouteFromNotification(notification);
  return isAllowedDashboardRoute(inferred) ? inferred : NOTIFICATIONS_FALLBACK_ROUTE;
}

export function formatNotificationDate(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getNotificationPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'text-red-600 bg-red-50';
    case 'high': return 'text-orange-600 bg-orange-50';
    case 'normal': return 'text-[#1F4FD8] bg-[#EFF6FF]';
    case 'low': return 'text-gray-600 bg-gray-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}

export function getNotificationTypeIcon(type: string): LucideIcon {
  switch (type) {
    case 'payment_due': return Clock;
    case 'overdue': return AlertCircle;
    case 'budget_alert': return DollarSign;
    case 'low_balance': return DollarSign;
    case 'trial_warning_d7':
    case 'trial_warning_d3':
    case 'trial_warning_d1':
    case 'subscription':
    case 'subscription_alert':
      return CreditCard;
    default: return Bell;
  }
}
