'use client';

import { useState } from 'react';
import { Bell, Search, Plus, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

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
  '/dashboard/planning': {
    title: 'Planejamento Anual',
    subtitle: 'Visualize e planeje suas finanças para o ano todo'
  },
  '/dashboard/calendar': {
    title: 'Calendário Financeiro',
    subtitle: 'Visualize suas transações no tempo'
  },
  '/dashboard/reports': {
    title: 'Relatórios',
    subtitle: 'Análises e insights financeiros'
  },
  '/dashboard/settings': {
    title: 'Configurações',
    subtitle: 'Gerencie suas preferências'
  },
};

export default function DashboardHeader({ onAddTransaction, showAddButton = true }: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pageInfo = pageTitles[pathname] || { title: 'Dashboard', subtitle: '' };
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Redireciona para transações com filtro de busca
      router.push(`/dashboard/transactions?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setShowSearch(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Page Title */}
          <div>
            <h1 
              className="text-2xl font-bold text-gray-900 font-sans"
            >
              {pageInfo.title}
            </h1>
            {pageInfo.subtitle && (
              <p 
                className="text-sm text-gray-500 mt-0.5 font-sans"
              >
                {pageInfo.subtitle}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <form onSubmit={handleSearch} className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar transações..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4FD8] focus:border-transparent w-64 font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  title="Limpar busca"
                  aria-label="Limpar busca"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>

            {/* Notifications */}
            <button 
              className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              title="Notificações"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* Add Transaction Button */}
            {showAddButton && onAddTransaction && (
              <button
                onClick={onAddTransaction}
                className="flex items-center gap-2 px-4 py-2 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] transition-all font-medium font-sans"
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
