'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/stores/auth';

/**
 * Provider que garante que o estado de autenticação seja hidratado
 * antes de renderizar os componentes filhos.
 * 
 * Isso previne o problema de logout indesejado no reload da página.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Garante que o localStorage foi lido antes de renderizar
    const checkHydration = () => {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      
      // Se tem tokens no localStorage, o Zustand deve hidratar automaticamente
      // Mas vamos dar um tempo para garantir
      if (accessToken && refreshToken) {
        // Pequeno delay para garantir que o Zustand terminou de hidratar
        setTimeout(() => {
          setIsHydrated(true);
        }, 100);
      } else {
        // Sem tokens, pode renderizar imediatamente
        setIsHydrated(true);
      }
    };

    checkHydration();
  }, []);

  // Enquanto não hidratar, mostra loading
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F4F7FB] to-white">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1C6DD0]"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
