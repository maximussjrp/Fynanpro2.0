'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  LayoutDashboard,
  Receipt,
  Wallet,
  Tag,
  Repeat,
  PieChart,
  Calendar,
  FileText,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Settings,
  LogOut,
  Bell,
  Target,
  Upload,
  Zap
} from 'lucide-react';
import Logo from './Logo';
import { logout } from '@/lib/api';
import { useUser, useTenant } from '@/stores/auth';

interface SidebarProps {
  className?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
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
  { icon: Upload, label: 'Importar Extrato', href: '/dashboard/imports' },
  { icon: Wallet, label: 'Contas Bancárias', href: '/dashboard/bank-accounts' },
  { icon: Tag, label: 'Categorias', href: '/dashboard/categories' },
  { icon: Repeat, label: 'Contas Recorrentes', href: '/dashboard/recurring-bills' },
  { icon: PieChart, label: 'Parcelamentos', href: '/dashboard/installments' },
  { icon: TrendingUp, label: 'Orçamentos', href: '/dashboard/budgets' },
  { icon: Target, label: 'Planejamento Anual', href: '/dashboard/planning' },
  { icon: Calendar, label: 'Calendário', href: '/dashboard/calendar' },
  { icon: FileText, label: 'Relatórios', href: '/dashboard/reports' },
  // Temporariamente desabilitados - aguardando finalização
  // { icon: Zap, label: 'Energia Financeira', href: '/dashboard/reports/energy' },
  // { icon: Zap, label: '⚡ Governança', href: '/dashboard/energy-governance' },
];

export default function Sidebar({ className = '', isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useUser();
  const tenant = useTenant();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleNavigation = (href: string) => {
    router.push(href);
    onCloseMobile?.();
  };

  const handleLogout = () => {
    if (confirm('Tem certeza que deseja sair?')) {
      logout();
    }
  };

  return (
    <>
      {/* Overlay para mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      
      <aside 
        className={`flex flex-col transition-all duration-300 h-full utop-sidebar
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${className}
          fixed lg:relative z-50 lg:z-auto
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{
          background: 'var(--v2-bg-surface)',
          borderRight: '1px solid var(--v2-border)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
      {/* Header */}
      <div className="p-4" style={{ borderBottom: '1px solid var(--v2-border)' }}>
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
        <div className="p-4" style={{ borderBottom: '1px solid var(--v2-border)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
              style={{
                background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
                border: '1px solid #C9A962',
                color: '#C9A962',
              }}
            >
              {user?.fullName?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--v2-text-primary)' }}>
                {user?.fullName}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--v2-text-muted)' }}>
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
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));

            return (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className="utop-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                data-active={isActive ? 'true' : 'false'}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={`flex-shrink-0 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
                {!isCollapsed && <span className="text-sm">{item.label}</span>}
                {!isCollapsed && item.badge && (
                  <span
                    className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--v2-danger)', color: '#fff' }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer Actions */}
      <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--v2-border)' }}>
        <button
          onClick={() => handleNavigation('/dashboard/settings')}
          className="utop-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
          data-active={pathname === '/dashboard/settings' ? 'true' : 'false'}
          title={isCollapsed ? 'Configurações' : undefined}
        >
          <Settings className={`flex-shrink-0 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
          {!isCollapsed && <span className="text-sm">Configurações</span>}
        </button>

        <button
          onClick={handleLogout}
          className="utop-nav-danger w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
          title={isCollapsed ? 'Sair' : undefined}
        >
          <LogOut className={`flex-shrink-0 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
          {!isCollapsed && <span className="text-sm font-medium">Sair</span>}
        </button>

        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center py-2 transition-all"
          style={{ color: 'var(--v2-text-faint)' }}
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
    </>
  );
}
