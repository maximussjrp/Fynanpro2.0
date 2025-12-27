'use client';

import { Bell, Search, Plus } from 'lucide-react';
import { usePathname } from 'next/navigation';

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
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Page Title */}
          <div>
            <h1 
              className="text-2xl font-bold text-gray-900" 
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {pageInfo.title}
            </h1>
            {pageInfo.subtitle && (
              <p 
                className="text-sm text-gray-500 mt-0.5" 
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {pageInfo.subtitle}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A962] focus:border-transparent"
                style={{ fontFamily: 'Inter, sans-serif' }}
              />
            </div>

            {/* Notifications */}
            <button 
              className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              title="Notificações"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#E11D48] rounded-full"></span>
            </button>

            {/* Add Transaction Button */}
            {showAddButton && onAddTransaction && (
              <button
                onClick={onAddTransaction}
                className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-[#C9A962] border border-[#C9A962] rounded-lg hover:bg-[#2A2A2A] transition-all font-medium"
                style={{ fontFamily: 'Inter, sans-serif' }}
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
