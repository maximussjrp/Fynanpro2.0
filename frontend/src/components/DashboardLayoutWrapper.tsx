'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import ChatbotWidget from '@/components/ChatbotWidget';
import { Menu } from 'lucide-react';

interface DashboardLayoutWrapperProps {
  children: React.ReactNode;
  onAddTransaction?: () => void;
  showAddButton?: boolean;
}

export default function DashboardLayoutWrapper({ 
  children, 
  onAddTransaction,
  showAddButton = true 
}: DashboardLayoutWrapperProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#F4F7FB] to-white overflow-hidden">
      {/* Sidebar - Desktop sempre visível */}
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
          <DashboardHeader 
            onAddTransaction={onAddTransaction}
            showAddButton={showAddButton}
          />
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
