'use client';

/**
 * DashboardLayoutWrapper - Wrapper simplificado
 * 
 * O layout principal (sidebar, header, chatbot) já é gerenciado pelo layout.tsx
 * Este componente serve apenas para páginas que precisam de callbacks específicos
 * como onAddTransaction, mas NÃO renderiza layout adicional.
 */

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
  // Este componente agora apenas passa children
  // O layout (sidebar, header) é gerenciado pelo layout.tsx
  return <>{children}</>;
}
