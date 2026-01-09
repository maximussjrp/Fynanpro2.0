/**
 * Cliente HTTP centralizado com interceptors
 * 
 * Features:
 * - Auto-inject de Bearer token em todas as requisições
 * - Refresh automático de token em caso de 401
 * - Logout automático se refresh falhar
 * - Timeout configurável
 * - Base URL centralizada
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// Configuração base
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const TIMEOUT = 10000; // 10 segundos

/**
 * Instância principal do Axios
 */
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Flag para prevenir múltiplas tentativas de refresh simultâneas
 */
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

/**
 * Adiciona callback na fila de espera do refresh
 */
function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

/**
 * Executa todos os callbacks da fila após refresh bem-sucedido
 */
function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

/**
 * Interceptor de REQUEST
 * Adiciona automaticamente o Bearer token em todas as requisições
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Interceptor de RESPONSE
 * Trata erros 401 (não autorizado) e 402 (pagamento necessário)
 */
api.interceptors.response.use(
  (response) => response, // Sucesso, retorna normalmente
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Tratar 402 - Assinatura expirada/suspensa
    if (error.response?.status === 402) {
      console.warn('Assinatura expirada ou suspensa, redirecionando para página de bloqueio...');
      const errorData = error.response.data as any;
      const reason = errorData?.error?.trialExpired ? 'trial_expired' 
        : errorData?.error?.subscriptionStatus === 'cancelled' ? 'cancelled' 
        : 'suspended';
      
      // Redireciona para página de bloqueio
      window.location.href = `/blocked?reason=${reason}`;
      return Promise.reject(error);
    }

    // Se não é 401 ou não tem config, rejeita direto
    if (!error.response || error.response.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // Se já tentou refresh nessa request, não tenta de novo
    if (originalRequest._retry) {
      // Refresh falhou, desloga usuário
      console.error('Refresh token inválido ou expirado, redirecionando para login...');
      localStorage.clear();
      window.location.href = '/';
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // Se já está fazendo refresh, adiciona essa request na fila
    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeTokenRefresh((token: string) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          resolve(api(originalRequest));
        });
      });
    }

    // Marca que está fazendo refresh
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      // Sem refresh token, desloga
      console.error('Refresh token não encontrado, redirecionando para login...');
      isRefreshing = false;
      localStorage.clear();
      window.location.href = '/';
      return Promise.reject(error);
    }

    try {
      // Tenta fazer refresh (usa axios direto para evitar interceptor)
      const response = await axios.post(`${BASE_URL}/auth/refresh`, {
        refreshToken,
      });

      const { accessToken, refreshToken: newRefreshToken } = response.data.data;

      // Salva novos tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      console.log('Token renovado com sucesso');

      // Atualiza header da request original
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      }

      // Notifica todas as requests na fila
      onTokenRefreshed(accessToken);

      // Libera flag
      isRefreshing = false;

      // Reexecuta a request original
      return api(originalRequest);
    } catch (refreshError) {
      // Refresh falhou, desloga
      console.error('Erro ao renovar token:', refreshError);
      isRefreshing = false;
      localStorage.clear();
      window.location.href = '/';
      return Promise.reject(refreshError);
    }
  }
);

/**
 * Helper para fazer logout (limpa tokens e redireciona)
 */
export function logout() {
  const refreshToken = localStorage.getItem('refreshToken');
  
  // Tenta revogar token no backend (fire-and-forget)
  if (refreshToken) {
    api.post('/auth/logout', { refreshToken }).catch(() => {
      // Ignora erro, vamos deslogar de qualquer forma
    });
  }
  
  localStorage.clear();
  window.location.href = '/';
}

export default api;
