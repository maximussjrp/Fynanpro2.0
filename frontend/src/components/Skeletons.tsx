/**
 * Loading Skeleton Components
 * 
 * Componentes de skeleton para estados de loading.
 * Fornecem feedback visual enquanto os dados estão carregando.
 */

import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

/**
 * Skeleton para cards de métricas do dashboard
 */
export function DashboardCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <Skeleton width={120} height={20} />
        <Skeleton circle width={40} height={40} />
      </div>
      <Skeleton width={150} height={32} className="mb-2" />
      <Skeleton width={100} height={16} />
    </div>
  );
}

/**
 * Skeleton para o dashboard completo (4 cards)
 */
export function DashboardMetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <DashboardCardSkeleton />
      <DashboardCardSkeleton />
      <DashboardCardSkeleton />
      <DashboardCardSkeleton />
    </div>
  );
}

/**
 * Skeleton para gráficos
 */
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <Skeleton width={200} height={24} className="mb-4" />
      <Skeleton height={height} />
    </div>
  );
}

/**
 * Skeleton para tabela de transações
 */
export function TransactionTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-6 gap-4">
          <Skeleton width={80} height={16} />
          <Skeleton width={120} height={16} />
          <Skeleton width={100} height={16} />
          <Skeleton width={80} height={16} />
          <Skeleton width={100} height={16} />
          <Skeleton width={60} height={16} />
        </div>
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="px-6 py-4 border-b border-gray-100 last:border-b-0"
        >
          <div className="grid grid-cols-6 gap-4 items-center">
            <Skeleton width={70} height={16} />
            <Skeleton width={140} height={16} />
            <Skeleton width={90} height={20} />
            <Skeleton width={70} height={16} />
            <Skeleton width={110} height={16} />
            <div className="flex gap-2">
              <Skeleton width={32} height={32} circle />
              <Skeleton width={32} height={32} circle />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton para lista simples
 */
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg shadow-sm p-4 border border-gray-100"
        >
          <div className="flex items-center gap-4">
            <Skeleton circle width={48} height={48} />
            <div className="flex-1">
              <Skeleton width={200} height={20} className="mb-2" />
              <Skeleton width={150} height={16} />
            </div>
            <Skeleton width={80} height={32} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton para cards de ranking (receitas/despesas top)
 */
export function RankingCardSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <Skeleton width={180} height={24} className="mb-6" />
      <div className="space-y-4">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton width={32} height={32} />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <Skeleton width={120} height={16} />
                <Skeleton width={80} height={16} />
              </div>
              <Skeleton height={8} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton para formulário
 */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton width={120} height={16} className="mb-2" />
          <Skeleton height={40} />
        </div>
      ))}
      <div className="flex gap-3 mt-6">
        <Skeleton width={100} height={40} />
        <Skeleton width={100} height={40} />
      </div>
    </div>
  );
}

/**
 * Skeleton para página completa de dashboard
 */
export function DashboardPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <Skeleton width={250} height={32} className="mb-2" />
        <Skeleton width={180} height={20} />
      </div>

      {/* Metrics */}
      <DashboardMetricsSkeleton />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankingCardSkeleton />
        <RankingCardSkeleton />
      </div>
    </div>
  );
}

/**
 * Skeleton inline para texto
 */
export function InlineTextSkeleton({ width = 100 }: { width?: number }) {
  return <Skeleton width={width} height={16} inline />;
}

/**
 * Skeleton para botão
 */
export function ButtonSkeleton({ width = 120, height = 40 }: { width?: number; height?: number }) {
  return <Skeleton width={width} height={height} />;
}
