'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  type AppNotification,
  formatNotificationDate,
  getNotificationPriorityColor,
  getNotificationTypeIcon,
  resolveNotificationTarget,
} from '@/lib/notifications';

interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const PAGE_SIZE = 50;

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadNotifications(page);
  }, [page]);

  async function loadNotifications(nextPage: number) {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/notifications', {
        params: { limit: PAGE_SIZE, page: nextPage },
      });
      const data = response.data.data as NotificationsResponse;

      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (loadError) {
      console.error('Erro ao carregar notificações:', loadError);
      setError('Não foi possível carregar suas notificações.');
    } finally {
      setLoading(false);
    }
  }

  function markAsReadLocally(id: string) {
    const wasUnread = notifications.some(notification => notification.id === id && !notification.isRead);

    setNotifications(prev =>
      prev.map(notification => {
        if (notification.id === id) {
          return { ...notification, isRead: true };
        }

        return notification;
      })
    );

    if (wasUnread) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }

  async function markAsRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      markAsReadLocally(id);
    } catch (markError) {
      console.error('Erro ao marcar notificação como lida:', markError);
      toast.error('Não foi possível marcar a notificação como lida');
    }
  }

  async function markAllAsRead() {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications(prev => prev.map(notification => ({ ...notification, isRead: true })));
      setUnreadCount(0);
      toast.success('Todas as notificações foram marcadas como lidas');
    } catch (markError) {
      console.error('Erro ao marcar todas as notificações como lidas:', markError);
      toast.error('Não foi possível marcar todas como lidas');
    }
  }

  async function deleteNotification(id: string) {
    const removed = notifications.find(notification => notification.id === id);

    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(notification => notification.id !== id));

      if (removed && !removed.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      toast.success('Notificação removida');
    } catch (deleteError) {
      console.error('Erro ao remover notificação:', deleteError);
      toast.error('Não foi possível remover a notificação');
    }
  }

  async function openDetails(notification: AppNotification) {
    const target = resolveNotificationTarget(notification);

    if (!notification.isRead) {
      markAsReadLocally(notification.id);

      try {
        await api.patch(`/notifications/${notification.id}/read`);
      } catch (markError) {
        console.error('Erro ao marcar notificação como lida antes de navegar:', markError);
        toast.error('Não foi possível marcar a notificação como lida agora');
      }
    }

    router.push(target);
  }

  return (
    <div className="min-h-full bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Notificações</h2>
            <p className="mt-1 text-sm text-gray-500">
              {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Todas as notificações estão lidas'}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1F4FD8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1A44BF]"
            >
              <Check className="h-4 w-4" />
              Marcar todas como lidas
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#1F4FD8]" />
              <p className="mt-3 text-sm text-gray-500">Carregando notificações...</p>
            </div>
          ) : error ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
              <Bell className="h-12 w-12 text-red-300" />
              <p className="mt-3 text-sm font-medium text-gray-900">{error}</p>
              <button
                type="button"
                onClick={() => void loadNotifications(page)}
                className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Tentar novamente
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
              <Bell className="h-12 w-12 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-900">Nenhuma notificação</p>
              <p className="mt-1 text-sm text-gray-500">Quando houver alertas, eles aparecerão aqui.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map(notification => {
                const TypeIcon = getNotificationTypeIcon(notification.type);

                return (
                  <div
                    key={notification.id}
                    className={`p-4 transition-colors sm:p-5 ${notification.isRead ? 'bg-white' : 'bg-[#EFF6FF]'}`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className={`w-fit flex-shrink-0 rounded-full p-2 ${getNotificationPriorityColor(notification.priority)}`}>
                        <TypeIcon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">{notification.title}</h3>
                            <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                          </div>
                          {!notification.isRead && (
                            <span className="w-fit rounded-full bg-[#1F4FD8] px-2 py-1 text-xs font-medium text-white">
                              Não lida
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-xs text-gray-400">{formatNotificationDate(notification.createdAt)}</span>

                          <div className="flex flex-wrap gap-2">
                            {!notification.isRead && (
                              <button
                                type="button"
                                onClick={() => void markAsRead(notification.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Marcar como lida
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => void openDetails(notification)}
                              className="rounded-md border border-[#1F4FD8] px-3 py-1.5 text-xs font-medium text-[#1F4FD8] transition-colors hover:bg-[#EFF6FF]"
                            >
                              Ver detalhes
                            </button>

                            <button
                              type="button"
                              onClick={() => void deleteNotification(notification.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remover
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!loading && !error && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>

            <span className="text-sm text-gray-500">
              Página {page} de {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
