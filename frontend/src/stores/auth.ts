/**
 * Store Zustand para gerenciar estado de autenticação
 * 
 * Features:
 * - Persiste dados no localStorage automaticamente
 * - Estado reativo (re-renderiza componentes quando muda)
 * - TypeScript type-safe
 * - Funções helper para login, logout, atualização de tokens
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Interface do usuário autenticado
 */
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

/**
 * Interface do tenant (organização)
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

/**
 * Interface do estado de autenticação
 */
interface AuthState {
  // Estado
  user: User | null;
  tenant: Tenant | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  // Ações
  setAuth: (
    tokens: { accessToken: string; refreshToken: string },
    user: User,
    tenant: Tenant
  ) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  hydrate: () => void;
}

/**
 * Store principal de autenticação
 * 
 * Uso:
 * ```tsx
 * import { useAuth } from '@/stores/auth';
 * 
 * function MyComponent() {
 *   const { user, isAuthenticated, logout } = useAuth();
 *   
 *   if (!isAuthenticated) {
 *     return <div>Não autenticado</div>;
 *   }
 *   
 *   return (
 *     <div>
 *       <p>Olá, {user?.fullName}!</p>
 *       <button onClick={logout}>Sair</button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      user: null,
      tenant: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      /**
       * Define dados de autenticação após login bem-sucedido
       */
      setAuth: (tokens, user, tenant) => {
        // Salva também no localStorage para compatibilidade com API client
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('tenant', JSON.stringify(tenant));

        set({
          user,
          tenant,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: true,
        });
      },

      /**
       * Atualiza apenas os tokens (usado após refresh)
       */
      updateTokens: (accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);

        set({
          accessToken,
          refreshToken,
        });
      },

      /**
       * Limpa todos os dados e desloga usuário
       */
      logout: () => {
        // Limpa localStorage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('tenant');

        // Reseta estado
        set({
          user: null,
          tenant: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      /**
       * Hidrata o estado a partir do localStorage
       * (útil para recuperar sessão após reload)
       */
      hydrate: () => {
        try {
          const accessToken = localStorage.getItem('accessToken');
          const refreshToken = localStorage.getItem('refreshToken');
          const userStr = localStorage.getItem('user');
          const tenantStr = localStorage.getItem('tenant');

          if (accessToken && refreshToken && userStr && tenantStr) {
            const user = JSON.parse(userStr);
            const tenant = JSON.parse(tenantStr);

            set({
              user,
              tenant,
              accessToken,
              refreshToken,
              isAuthenticated: true,
            });
          }
        } catch (error) {
          console.error('Erro ao hidratar estado de autenticação:', error);
          get().logout();
        }
      },
    }),
    {
      name: 'fynanpro-auth', // Nome da chave no localStorage
      storage: createJSONStorage(() => localStorage),
      // Não persiste tokens sensíveis no storage do Zustand
      // (eles ficam apenas no localStorage padrão para o interceptor)
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

/**
 * Hook para obter apenas o usuário
 */
export const useUser = () => useAuth((state) => state.user);

/**
 * Hook para obter apenas o tenant
 */
export const useTenant = () => useAuth((state) => state.tenant);

/**
 * Hook para obter apenas status de autenticação
 */
export const useIsAuthenticated = () => useAuth((state) => state.isAuthenticated);
