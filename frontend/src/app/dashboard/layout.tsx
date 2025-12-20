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
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Pequeno delay para verificar autenticação do localStorage
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

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
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#F4F7FB] to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1F4FD8] mx-auto"></div>
          <p className="text-gray-600 mt-4 font-inter">Carregando...</p>
        </div>
      </div>
    );
  }

  // Não renderizar se não autenticado
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#F4F7FB] to-white overflow-hidden">
      {/* Sidebar - Desktop sempre visível, Mobile controlado */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <div className="fixed left-0 top-0 h-screen w-64 z-40">
          <Sidebar />
        </div>
      </div>

      {/* Sidebar Mobile */}
      <Sidebar 
        isMobileOpen={isMobileMenuOpen} 
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        className="lg:hidden"
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Mobile Header com Menu Hamburger */}
        <div className="lg:hidden flex items-center gap-3 p-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </button>
          <span className="text-lg font-semibold text-gray-900">FynanPro</span>
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
