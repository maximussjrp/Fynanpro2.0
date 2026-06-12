'use client';

import { Search, Plus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import NotificationBell from './NotificationBell';

interface DashboardHeaderProps {
  onAddTransaction?: () => void;
  showAddButton?: boolean;
}

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Visão geral das suas finanças'
  },
  '/dashboard/transactions': {
    title: 'Transações',
    subtitle: 'Gerencie suas receitas e despesas'
  },
  '/dashboard/bank-accounts': {
    title: 'Contas Bancárias',
    subtitle: 'Gerencie suas contas e saldos'
  },
  '/dashboard/categories': {
    title: 'Categorias',
    subtitle: 'Organize suas transações por categoria'
  },
  '/dashboard/payment-methods': {
    title: 'Meios de Pagamento',
    subtitle: 'Cartões e formas de pagamento'
  },
  '/dashboard/recurring-bills': {
    title: 'Contas Recorrentes',
    subtitle: 'Despesas e receitas que se repetem'
  },
  '/dashboard/installments': {
    title: 'Parcelamentos',
    subtitle: 'Controle de compras parceladas'
  },
  '/dashboard/budgets': {
    title: 'Orçamentos',
    subtitle: 'Planeje e controle seus gastos'
  },
  '/dashboard/calendar': {
    title: 'Calendário Financeiro',
    subtitle: 'Visualize suas transações no tempo'
  },
  '/dashboard/reports': {
    title: 'Relatórios',
    subtitle: 'Análises e insights financeiros'
  },
};

export default function DashboardHeader({ onAddTransaction, showAddButton = true }: DashboardHeaderProps) {
  const pathname = usePathname();
  const pageInfo = pageTitles[pathname] || { title: 'Dashboard', subtitle: '' };

  return (
    <header
      className="sticky top-0 z-10"
      style={{
        background: 'var(--v2-bg-surface)',
        borderBottom: '1px solid var(--v2-border)',
      }}
    >
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Page Title */}
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--v2-text-primary)' }}
            >
              {pageInfo.title}
            </h1>
            {pageInfo.subtitle && (
              <p
                className="text-sm mt-0.5"
                style={{ fontFamily: 'Inter, sans-serif', color: 'var(--v2-text-muted)' }}
              >
                {pageInfo.subtitle}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative hidden md:block">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--v2-text-faint)' }}
              />
              <input
                type="text"
                placeholder="Buscar..."
                className="pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4FD8]"
                style={{
                  background: 'var(--v2-bg-surface-2)',
                  border: '1px solid var(--v2-border)',
                  color: 'var(--v2-text-primary)',
                  fontFamily: 'Inter, sans-serif',
                  width: 240,
                }}
              />
            </div>

            {/* Notifications */}
            <NotificationBell />

            {/* Add Transaction Button */}
            {showAddButton && onAddTransaction && (
              <button
                onClick={onAddTransaction}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium"
                style={{
                  background: '#1F4FD8',
                  color: '#FFFFFF',
                  border: '1px solid #1F4FD8',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nova Transação</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
