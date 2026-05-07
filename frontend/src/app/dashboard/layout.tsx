'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import ChatbotWidget from '@/components/ChatbotWidget';
import { Menu } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Verificar autenticação do localStorage diretamente
    const checkAuth = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        // Sem token, redirecionar imediatamente
        router.push('/');
        return;
      }
      setIsLoading(false);
    };
    
    // Pequeno delay para permitir hidratação do Zustand
    const timer = setTimeout(checkAuth, 150);
    return () => clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !accessToken) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router, accessToken]);

  // Fechar menu mobile ao redimensionar para desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="utop-v2 flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C9A962] mx-auto"></div>
          <p className="mt-4" style={{ color: 'var(--v2-text-muted)', fontFamily: 'Inter, sans-serif' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  // Não renderizar se não autenticado
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="utop-v2 flex h-screen overflow-hidden">
      {/* Sidebar - Desktop sempre visível */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <div className="fixed left-0 top-0 h-screen w-64 z-40">
          <Sidebar />
        </div>
      </div>

      {/* Sidebar Mobile - Controlado por estado */}
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        className="lg:hidden"
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Mobile Header com Menu Hamburger */}
        <div
          className="lg:hidden flex items-center gap-3 p-4"
          style={{ background: 'var(--v2-bg-surface)', borderBottom: '1px solid var(--v2-border)' }}
        >
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--v2-text-primary)' }}
            aria-label="Abrir menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-lg font-semibold" style={{ color: 'var(--v2-text-primary)' }}>UTOP</span>
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:block">
          <DashboardHeader showAddButton={false} />
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Chatbot Isis */}
      <ChatbotWidget />
    </div>
  );
}
