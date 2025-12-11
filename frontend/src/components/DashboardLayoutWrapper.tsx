'use client';

import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';

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
  return (
    <div className="flex h-screen bg-gradient-to-br from-[#F4F7FB] to-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader 
          onAddTransaction={onAddTransaction}
          showAddButton={showAddButton}
        />
        
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
