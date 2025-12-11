'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  LayoutDashboard,
  Receipt,
  Wallet,
  Tag,
  CreditCard,
  Repeat,
  PieChart,
  Calendar,
  FileText,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Settings,
  LogOut,
  Bell
} from 'lucide-react';
import Logo from './Logo';
import { logout } from '@/lib/api';
import { useUser, useTenant } from '@/stores/auth';

interface SidebarProps {
  className?: string;
}

interface MenuItem {
  icon: any;
  label: string;
  href: string;
  badge?: number;
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Receipt, label: 'Transações', href: '/dashboard/transactions' },
  { icon: Wallet, label: 'Contas Bancárias', href: '/dashboard/bank-accounts' },
  { icon: Tag, label: 'Categorias', href: '/dashboard/categories' },
  { icon: CreditCard, label: 'Meios de Pagamento', href: '/dashboard/payment-methods' },
  { icon: Repeat, label: 'Contas Recorrentes', href: '/dashboard/recurring-bills' },
  { icon: PieChart, label: 'Parcelamentos', href: '/dashboard/installments' },
  { icon: TrendingUp, label: 'Orçamentos', href: '/dashboard/budgets' },
  { icon: Calendar, label: 'Calendário', href: '/dashboard/calendar' },
  { icon: FileText, label: 'Relatórios', href: '/dashboard/reports' },
];

export default function Sidebar({ className = '' }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useUser();
  const tenant = useTenant();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    if (confirm('Tem certeza que deseja sair?')) {
      logout();
    }
  };

  return (
    <aside 
      className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      } ${className}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <Logo variant="horizontal-light" width={140} height={32} />
            </div>
          )}
          {isCollapsed && <Logo variant="icon-small" width={32} height={32} />}
        </div>
      </div>

      {/* User Info */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1C6DD0] to-[#1557A8] flex items-center justify-center text-white font-semibold">
              {user?.fullName?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate font-inter">
                {user?.fullName}
              </p>
              <p className="text-xs text-gray-500 truncate font-inter">
                {tenant?.name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-inter ${
                  isActive 
                    ? 'bg-[#E8F4FD] text-[#1C6DD0] font-medium' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={`flex-shrink-0 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
                {!isCollapsed && (
                  <span className="text-sm">{item.label}</span>
                )}
                {!isCollapsed && item.badge && (
                  <span className="ml-auto bg-[#E74C3C] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer Actions */}
      <div className="p-3 border-t border-gray-200 space-y-1">
        <button
          onClick={() => router.push('/dashboard/settings')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-all font-inter"
          title={isCollapsed ? 'Configurações' : undefined}
        >
          <Settings className={`flex-shrink-0 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
          {!isCollapsed && <span className="text-sm">Configurações</span>}
        </button>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-all font-inter"
          title={isCollapsed ? 'Sair' : undefined}
        >
          <LogOut className={`flex-shrink-0 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
          {!isCollapsed && <span className="text-sm font-medium">Sair</span>}
        </button>

        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center py-2 text-gray-400 hover:text-gray-600 transition-all"
          title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>
    </aside>
  );
}
