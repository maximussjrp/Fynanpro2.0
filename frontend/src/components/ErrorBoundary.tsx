/**
 * Error Boundary Component
 * 
 * Captura erros de React não tratados e exibe uma UI de fallback amigável.
 * Previne que todo o app quebre quando um componente filho falha.
 * 
 * Uso:
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */

'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo: errorInfo.componentStack,
    });

    // Aqui você pode enviar o erro para um serviço de monitoramento
    // como Sentry, DataDog, etc.
    // sendErrorToMonitoring(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Se um fallback customizado foi fornecido, use-o
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI de fallback padrão
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-2xl p-8 border-t-4 border-red-500">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Algo deu errado
                </h1>
                <p className="text-gray-600 mt-1">
                  Desculpe, encontramos um erro inesperado.
                </p>
              </div>
            </div>

            {/* Mensagem de erro */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-semibold text-red-800 mb-2">
                Erro:
              </p>
              <p className="text-sm text-red-700 font-mono break-all">
                {this.state.error?.message || 'Erro desconhecido'}
              </p>
            </div>

            {/* Stack trace (apenas em desenvolvimento) */}
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <summary className="text-sm font-semibold text-gray-700 cursor-pointer">
                  Stack Trace (desenvolvimento)
                </summary>
                <pre className="text-xs text-gray-600 mt-2 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                  {this.state.errorInfo}
                </pre>
              </details>
            )}

            {/* Ações */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] transition-colors font-medium"
              >
                <RefreshCw className="w-5 h-5" />
                Tentar Novamente
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                <Home className="w-5 h-5" />
                Voltar ao Início
              </button>
            </div>

            {/* Dicas */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2 font-semibold">
                O que você pode fazer:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Tente atualizar a página (F5)</li>
                <li>Limpe o cache do navegador</li>
                <li>Verifique sua conexão com a internet</li>
                <li>Se o problema persistir, entre em contato com o suporte</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-like wrapper para usar em componentes funcionais
 * 
 * Uso:
 * ```tsx
 * export default function MyPage() {
 *   return (
 *     <ErrorBoundary>
 *       <MyContent />
 *     </ErrorBoundary>
 *   );
 * }
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
