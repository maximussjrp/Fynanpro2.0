'use client';

import React, { useEffect, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  type AppNotification,
  formatNotificationDate,
  getNotificationPriorityColor,
  getNotificationTypeIcon,
  NOTIFICATIONS_FALLBACK_ROUTE,
  resolveNotificationTarget,
} from '@/lib/notifications';

export default function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUnreadCount();

    const interval = setInterval(loadUnreadCount, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(response.data.data.count);
    } catch (error) {
      console.error('Erro ao carregar contagem de notificações:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications', {
        params: { limit: 10 },
      });
      setNotifications(response.data.data.notifications);
      setUnreadCount(response.data.data.unreadCount);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      toast.error('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  };

  const markAsReadLocally = (id: string) => {
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
  };

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      markAsReadLocally(id);
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications(prev => prev.map(notification => ({ ...notification, isRead: true })));
      setUnreadCount(0);
      toast.success('Todas as notificações foram marcadas como lidas');
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      toast.error('Erro ao marcar notificações como lidas');
    }
  };

  const deleteNotification = async (id: string) => {
    const removed = notifications.find(notification => notification.id === id);

    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(notification => notification.id !== id));

      if (removed && !removed.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        loadUnreadCount();
      }

      toast.success('Notificação removida');
    } catch (error) {
      console.error('Erro ao remover notificação:', error);
      toast.error('Erro ao remover notificação');
    }
  };

  const openAllNotifications = () => {
    setIsOpen(false);
    router.push(NOTIFICATIONS_FALLBACK_ROUTE);
  };

  const openNotificationDetails = async (notification: AppNotification) => {
    const target = resolveNotificationTarget(notification);

    if (!notification.isRead) {
      markAsReadLocally(notification.id);

      try {
        await api.patch(`/notifications/${notification.id}/read`);
      } catch (error) {
        console.error('Erro ao marcar notificação como lida antes de navegar:', error);
        toast.error('Não foi possível marcar a notificação como lida agora');
      }
    }

    setIsOpen(false);
    router.push(target);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg transition-all utop-icon-btn"
        title="Notificações"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />

        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full min-w-[20px]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[600px] flex flex-col max-sm:right-[-0.5rem] max-sm:w-[calc(100vw-2rem)]">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Notificações</h3>
                {unreadCount > 0 && (
                  <p className="text-sm text-gray-500">{unreadCount} não lida(s)</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-[#1F4FD8] hover:text-[#1A44BF] font-medium"
                  >
                    Marcar todas como lidas
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Fechar notificações"
                  aria-label="Fechar notificações"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1F4FD8] mx-auto" />
                  <p className="mt-2 text-sm text-gray-500">Carregando...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhuma notificação</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map(notification => {
                    const TypeIcon = getNotificationTypeIcon(notification.type);

                    return (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 transition-colors ${
                          !notification.isRead ? 'bg-[#EFF6FF]' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className={`flex-shrink-0 p-2 rounded-full ${getNotificationPriorityColor(notification.priority)}`}>
                            <TypeIcon className="w-5 h-5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-gray-900 truncate">
                                {notification.title}
                              </h4>

                              {!notification.isRead && (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className="flex-shrink-0 text-[#1F4FD8] hover:text-[#1A44BF]"
                                  title="Marcar como lida"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            <p className="text-sm text-gray-600 mb-2">
                              {notification.message}
                            </p>

                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400">
                                {formatNotificationDate(notification.createdAt)}
                              </span>

                              <button
                                onClick={() => deleteNotification(notification.id)}
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                Remover
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => void openNotificationDetails(notification)}
                              className="inline-block mt-2 text-xs text-[#1F4FD8] hover:text-[#1A44BF] font-medium"
                            >
                              Ver detalhes
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={openAllNotifications}
                  className="block w-full text-center text-sm text-[#1F4FD8] hover:text-[#1A44BF] font-medium"
                >
                  Ver todas as notificações
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
