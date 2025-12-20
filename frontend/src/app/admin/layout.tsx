'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useUser } from '@/stores/auth';
import Link from 'next/link';
import { 
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  Tag,
  BarChart3,
  Settings,
  FileText,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Visão Geral' },
  { href: '/admin/tenants', icon: Building2, label: 'Workspaces' },
  { href: '/admin/users', icon: Users, label: 'Usuários' },
  { href: '/admin/subscriptions', icon: CreditCard, label: 'Assinaturas' },
  { href: '/admin/coupons', icon: Tag, label: 'Cupons' },
  { href: '/admin/reports', icon: BarChart3, label: 'Relatórios' },
  { href: '/admin/announcements', icon: Bell, label: 'Anúncios' },
  { href: '/admin/logs', icon: FileText, label: 'Logs' },
  { href: '/admin/settings', icon: Settings, label: 'Configurações' },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout, isAuthenticated } = useAuth();
  const user = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!isAuthenticated || user?.role !== 'super_master') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-[#2D3748] text-white transform transition-transform duration-200
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-[#6C5CE7]" />
            <span className="text-xl font-bold">UTOP Admin</span>
          </div>
          <button 
            className="lg:hidden p-1 hover:bg-gray-700 rounded"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-gray-700">
          <p className="text-sm text-gray-400">Logado como</p>
          <p className="font-medium truncate">{user?.fullName}</p>
          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-[#6C5CE7] text-white' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white shadow-sm flex items-center px-4 lg:px-6">
          <button
            className="lg:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="ml-4 lg:ml-0">
            <h1 className="text-xl font-semibold text-gray-800">
              Painel Administrativo
            </h1>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <Link 
              href="/dashboard"
              className="text-sm text-[#6C5CE7] hover:underline"
            >
              Ir para Dashboard
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
