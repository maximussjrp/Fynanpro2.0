'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/stores/auth';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, 
  Heart, Lightbulb, BookOpen, GitCompare, Settings, 
  LayoutDashboard, ChevronLeft, ChevronRight, Calendar,
  AlertTriangle, Target, Zap, Home, Rocket, Wind,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadialBarChart, RadialBar, AreaChart, Area
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ENERGY_COLORS, ENERGY_ICONS, ENERGY_LABELS, ENERGY_DESCRIPTIONS,
  METRIC_POLARITY, getVariationBadgeColor, shouldShowNoData,
  formatCurrency, formatPercentage, getSentimentColor, getSentimentLabel,
  type EnergyType, type PeriodEnergy, type FinancialHealthIndex,
  type Insight, type AnnualNarrative, type PeriodComparison
} from '@/lib/energyColors';

// ==================== COMPONENTES ====================

// Card de Energia Individual
function EnergyCard({ 
  type, 
  value, 
  percentage,
  trend 
}: { 
  type: EnergyType; 
  value: number; 
  percentage?: number;
  trend?: 'up' | 'down' | 'stable';
}) {
  const colors = ENERGY_COLORS[type];
  const icon = ENERGY_ICONS[type];
  const label = ENERGY_LABELS[type];

  return (
    <div className={`rounded-xl p-4 ${colors.bgLight} border ${colors.border} border-opacity-30`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {trend && (
          <span className={trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400'}>
            {trend === 'up' ? <ArrowUpRight size={18} /> : 
             trend === 'down' ? <ArrowDownRight size={18} /> : 
             <Minus size={18} />}
          </span>
        )}
      </div>
      <p className={`text-sm ${colors.text} font-medium`}>{label}</p>
      <p className="text-xl font-bold text-gray-800 mt-1">
        {formatCurrency(value)}
      </p>
      {percentage !== undefined && (
        <p className="text-xs text-gray-500 mt-1">
          {formatPercentage(percentage)} da renda
        </p>
      )}
    </div>
  );
}

// Gauge do Health Index
function HealthGauge({ healthIndex }: { healthIndex: FinancialHealthIndex }) {
  const circumference = 2 * Math.PI * 80;
  const progress = (healthIndex.score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          {/* Background circle */}
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="16"
          />
          {/* Progress circle */}
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke={healthIndex.color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold" style={{ color: healthIndex.color }}>
            {healthIndex.score}
          </span>
          <span className="text-xl font-semibold text-gray-600">{healthIndex.grade}</span>
          <span className="text-sm text-gray-500">{healthIndex.label}</span>
        </div>
      </div>
      
      {/* Trend indicator */}
      <div className="mt-4 flex items-center gap-2">
        {healthIndex.trend.direction === 'improving' && (
          <>
            <TrendingUp className="text-green-500" size={20} />
            <span className="text-sm text-green-600">Melhorando</span>
          </>
        )}
        {healthIndex.trend.direction === 'declining' && (
          <>
            <TrendingDown className="text-red-500" size={20} />
            <span className="text-sm text-red-600">Piorando</span>
          </>
        )}
        {healthIndex.trend.direction === 'stable' && (
          <>
            <Minus className="text-gray-400" size={20} />
            <span className="text-sm text-gray-500">Estável</span>
          </>
        )}
      </div>
    </div>
  );
}

// Componentes do Health Index
function HealthComponents({ healthIndex }: { healthIndex: FinancialHealthIndex }) {
  const components = Object.values(healthIndex.components);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-emerald-400';
      case 'fair': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      case 'no_data': return 'bg-gray-300';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = (comp: any) => {
    if (comp.status === 'no_data') {
      return 'Sem dados';
    }
    return comp.score.toFixed(0);
  };

  return (
    <div className="space-y-3">
      {components.map((comp, idx) => (
        <div key={idx} className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{comp.name}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              comp.status === 'no_data' ? 'text-gray-500 bg-gray-200' : 'text-white'
            } ${getStatusColor(comp.status)}`}>
              {getStatusLabel(comp)}
            </span>
          </div>
          {comp.status !== 'no_data' ? (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${getStatusColor(comp.status)}`}
                style={{ width: `${comp.score}%`, transition: 'width 0.5s ease' }}
              />
            </div>
          ) : (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="h-2 rounded-full bg-gray-300 animate-pulse" style={{ width: '100%' }} />
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {comp.status === 'no_data' 
              ? 'Não há dados suficientes para calcular esta métrica'
              : comp.description}
          </p>
        </div>
      ))}
    </div>
  );
}

// Card de Insight com CTAs acionáveis
function InsightCard({ insight, onAction }: { insight: Insight; onAction?: (actionType: string, insightId: string) => void }) {
  const router = useRouter();
  
  const typeColors = {
    achievement: 'border-green-300 bg-green-50',
    warning: 'border-amber-300 bg-amber-50',
    opportunity: 'border-blue-300 bg-blue-50',
    trend: 'border-purple-300 bg-purple-50'
  };

  const priorityBadge = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-600'
  };

  // Mapeia tipos de insight para ações e rotas
  const getInsightCTA = () => {
    switch (insight.id) {
      case 'survival-high':
        return { label: 'Ver gastos essenciais', route: '/dashboard/transactions?filter=survival' };
      case 'no-future':
        return { label: 'Configurar investimento', route: '/dashboard/planning' };
      case 'high-waste':
        return { label: 'Ver perdas', route: '/dashboard/transactions?filter=loss' };
      case 'deficit':
        return { label: 'Ver todas as despesas', route: '/dashboard/transactions?type=expense' };
      case 'strong-surplus':
        return { label: 'Planejar investimento', route: '/dashboard/planning' };
      case 'great-savings':
      case 'great-freedom':
        return { label: 'Ver resumo', route: '/dashboard/reports' };
      default:
        return { label: 'Ver detalhes', route: '/dashboard/transactions' };
    }
  };

  const cta = getInsightCTA();

  return (
    <div className={`rounded-xl p-4 border-2 ${typeColors[insight.type]}`}>
      <div className="flex items-start justify-between">
        <span className="text-2xl">{insight.icon}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityBadge[insight.priority]}`}>
          {insight.priority === 'high' ? 'Alta' : insight.priority === 'medium' ? 'Média' : 'Baixa'}
        </span>
      </div>
      <h4 className="font-semibold text-gray-800 mt-2">{insight.title}</h4>
      <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
      
      {insight.metric && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-lg font-bold" style={{ color: insight.color }}>
            {insight.metric.unit === 'R$' 
              ? formatCurrency(insight.metric.current) 
              : `${insight.metric.current.toFixed(1)}${insight.metric.unit}`}
          </span>
          {insight.metric.target && (
            <span className="text-xs text-gray-500">
              Meta: {insight.metric.target}{insight.metric.unit}
            </span>
          )}
        </div>
      )}

      {insight.actions && insight.actions.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium text-gray-500">Ações sugeridas:</p>
          {insight.actions.slice(0, 2).map((action, idx) => (
            <div key={idx} className="text-xs text-gray-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
              {action.label}
            </div>
          ))}
        </div>
      )}

      {/* CTA Button */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => router.push(cta.route)}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition ${
            insight.type === 'warning' 
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : insight.type === 'achievement'
              ? 'bg-green-600 text-white hover:bg-green-700'
              : insight.type === 'opportunity'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {cta.label}
        </button>
        <button
          onClick={() => onAction?.('details', insight.id)}
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
        >
          Ver detalhes
        </button>
      </div>
    </div>
  );
}

// Card de Mês na Narrativa - com tratamento para meses vazios
function MonthCard({ month, isActive, onClick, isEmpty }: { 
  month: any; 
  isActive: boolean;
  onClick: () => void;
  isEmpty?: boolean;
}) {
  const sentimentColors = {
    excellent: 'border-green-400 bg-green-50',
    good: 'border-emerald-300 bg-emerald-50',
    neutral: 'border-gray-300 bg-gray-50',
    concerning: 'border-orange-300 bg-orange-50',
    critical: 'border-red-300 bg-red-50'
  };

  // Se o mês está vazio
  if (isEmpty) {
    return (
      <div 
        className={`rounded-lg p-3 border-2 border-dashed border-gray-200 bg-gray-50 opacity-60 ${
          isActive ? 'ring-2 ring-indigo-500' : ''
        }`}
        onClick={onClick}
      >
        <p className="font-semibold text-sm text-gray-400">{month.month}</p>
        <p className="text-xs text-gray-400 mt-1 italic">Sem registros</p>
        <div className="mt-2 flex items-center justify-center">
          <span className="text-xs text-gray-400">—</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`rounded-lg p-3 border-2 cursor-pointer transition-all ${
        isActive ? 'ring-2 ring-indigo-500' : ''
      } ${sentimentColors[month.sentiment as keyof typeof sentimentColors] || 'border-gray-200 bg-white'}`}
      onClick={onClick}
    >
      <p className="font-semibold text-sm text-gray-800">{month.month}</p>
      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{month.headline}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-medium text-green-600">
          {formatCurrency(month.energy?.generated || 0)}
        </span>
        <span className={`text-xs ${(month.energy?.netEnergy || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {(month.energy?.netEnergy || 0) >= 0 ? '+' : ''}{formatCurrency(month.energy?.netEnergy || 0)}
        </span>
      </div>
    </div>
  );
}

// Badge de Variação com polarity correta
function VariationBadge({ variation, metricKey }: { variation: any; metricKey?: string }) {
  if (!variation) return null;
  
  // Usa a função de polarity para determinar cor correta
  const badgeColor = metricKey 
    ? getVariationBadgeColor(metricKey, variation.trend)
    : (variation.sentiment === 'positive' ? 'green' : variation.sentiment === 'negative' ? 'red' : 'gray');
  
  const colorClasses = {
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-600'
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses[badgeColor]}`}>
      {variation.trend === 'up' ? <ArrowUpRight size={12} /> : 
       variation.trend === 'down' ? <ArrowDownRight size={12} /> : null}
      {variation.percentage > 0 ? '+' : ''}{variation.percentage.toFixed(1)}%
    </span>
  );
}

// ==================== VIEWS ====================

// Overview View
function OverviewView({ energyData, healthIndex, insights }: {
  energyData: PeriodEnergy | null;
  healthIndex: FinancialHealthIndex | null;
  insights: Insight[];
}) {
  if (!energyData) {
    return <div className="text-center py-12 text-gray-500">Carregando dados...</div>;
  }

  // Dados para o gráfico de distribuição
  const distributionData = [
    { name: 'Sobrevivência', value: energyData.survival, color: ENERGY_COLORS.survival.primary },
    { name: 'Escolha', value: energyData.choice, color: ENERGY_COLORS.choice.primary },
    { name: 'Futuro', value: energyData.future, color: ENERGY_COLORS.future.primary },
    { name: 'Dissipada', value: energyData.loss, color: ENERGY_COLORS.loss.primary },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Cards de Energia */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <EnergyCard type="generated" value={energyData.generated} />
        <EnergyCard type="survival" value={energyData.survival} percentage={energyData.survivalRatio * 100} />
        <EnergyCard type="choice" value={energyData.choice} percentage={(energyData.choice / energyData.generated) * 100} />
        <EnergyCard type="future" value={energyData.future} percentage={energyData.futureRatio * 100} />
        <EnergyCard type="loss" value={energyData.loss} percentage={energyData.wasteRatio * 100} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição de Energia */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribuição de Energia</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {distributionData.map((d, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                <span className="text-sm text-gray-600">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Health Index */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Saúde Financeira</h3>
          {healthIndex ? (
            <div className="flex flex-col items-center">
              <HealthGauge healthIndex={healthIndex} />
              <div className="w-full mt-6">
                <HealthComponents healthIndex={healthIndex} />
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">Calculando...</div>
          )}
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Lightbulb className="text-amber-500" size={20} />
            Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.slice(0, 6).map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Resumo Numérico */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <h3 className="text-lg font-semibold mb-4">Resumo do Período</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-indigo-100">Energia Líquida</p>
            <p className="text-2xl font-bold">{formatCurrency(energyData.netEnergy)}</p>
          </div>
          <div>
            <p className="text-sm text-indigo-100">Taxa de Liberdade</p>
            <p className="text-2xl font-bold">{formatPercentage(energyData.freedomRatio * 100)}</p>
          </div>
          <div>
            <p className="text-sm text-indigo-100">Disponível</p>
            <p className="text-2xl font-bold">{formatCurrency(energyData.available)}</p>
          </div>
          <div>
            <p className="text-sm text-indigo-100">Transações</p>
            <p className="text-2xl font-bold">{energyData.transactionCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Narrative View com toggle para meses vazios
function NarrativeView({ narrative }: { narrative: AnnualNarrative | null }) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [showEmptyMonths, setShowEmptyMonths] = useState(false);

  if (!narrative) {
    return <div className="text-center py-12 text-gray-500">Carregando narrativa...</div>;
  }

  const selectedMonthData = selectedMonth !== null ? narrative.monthlyStory[selectedMonth] : null;
  
  // Filtra meses vazios baseado no toggle
  const isMonthEmpty = (month: any) => {
    const transactionCount = month.energy?.transactionCount ?? (
      (month.energy?.generated || 0) === 0 && 
      (month.energy?.survival || 0) === 0 && 
      (month.energy?.choice || 0) === 0
    );
    return transactionCount === true || transactionCount === 0;
  };
  
  const filteredMonths = showEmptyMonths 
    ? narrative.monthlyStory 
    : narrative.monthlyStory.filter((m, idx) => !isMonthEmpty(m) || idx >= narrative.monthlyStory.length - 1);

  return (
    <div className="space-y-6">
      {/* Headline do Ano */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-8 text-white">
        <h2 className="text-3xl font-bold mb-2">{narrative.headline}</h2>
        <p className="text-lg text-indigo-100">{narrative.summary}</p>
        <div className="mt-4 flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            narrative.overallSentiment === 'excellent' || narrative.overallSentiment === 'good' 
              ? 'bg-green-500/30' 
              : narrative.overallSentiment === 'neutral'
              ? 'bg-yellow-500/30'
              : 'bg-red-500/30'
          }`}>
            {getSentimentLabel(narrative.overallSentiment)}
          </span>
        </div>
      </div>

      {/* Destaques e Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Highlights */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="text-green-500" size={20} />
            Conquistas
          </h3>
          {narrative.highlights.length > 0 ? (
            <div className="space-y-3">
              {narrative.highlights.map((h, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <span className="text-xl">{h.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800">{h.title}</p>
                    <p className="text-sm text-gray-600">{h.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Nenhuma conquista registrada ainda.</p>
          )}
        </div>

        {/* Warnings */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20} />
            Pontos de Atenção
          </h3>
          {narrative.warnings.length > 0 ? (
            <div className="space-y-3">
              {narrative.warnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                  <span className="text-xl">{w.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800">{w.title}</p>
                    <p className="text-sm text-gray-600">{w.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Sem alertas no momento.</p>
          )}
        </div>
      </div>

      {/* Timeline Mensal */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="text-indigo-500" size={20} />
            Sua Jornada Mês a Mês
          </h3>
          {/* Toggle para mostrar meses vazios */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-500">Mostrar meses vazios</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={showEmptyMonths}
                onChange={(e) => setShowEmptyMonths(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </div>
          </label>
        </div>
        
        {filteredMonths.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Nenhum mês com registros encontrado.</p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {(showEmptyMonths ? narrative.monthlyStory : filteredMonths).map((month, idx) => {
              const originalIdx = showEmptyMonths ? idx : narrative.monthlyStory.findIndex(m => m === month);
              const isEmpty = isMonthEmpty(month);
              return (
                <MonthCard 
                  key={originalIdx} 
                  month={month} 
                  isActive={selectedMonth === originalIdx}
                  onClick={() => setSelectedMonth(selectedMonth === originalIdx ? null : originalIdx)}
                  isEmpty={isEmpty}
                />
              );
            })}
          </div>
        )}

        {/* Detalhe do mês selecionado */}
        {selectedMonthData && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-800">{selectedMonthData.month}: {selectedMonthData.headline}</h4>
            <p className="text-sm text-gray-600 mt-2">{selectedMonthData.story}</p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Gerada</p>
                <p className="font-semibold text-green-600">{formatCurrency(selectedMonthData.energy.generated)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Sobrevivência</p>
                <p className="font-semibold text-blue-600">{formatCurrency(selectedMonthData.energy.survival)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Escolha</p>
                <p className="font-semibold text-amber-600">{formatCurrency(selectedMonthData.energy.choice)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Saldo</p>
                <p className={`font-semibold ${selectedMonthData.energy.netEnergy >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(selectedMonthData.energy.netEnergy)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Comparison View
function ComparisonView({ comparison }: { comparison: PeriodComparison | null }) {
  if (!comparison) {
    return <div className="text-center py-12 text-gray-500">Carregando comparação...</div>;
  }

  const energyKeys: EnergyType[] = ['generated', 'survival', 'choice', 'future', 'loss'];

  return (
    <div className="space-y-6">
      {/* Header da Comparação */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-center flex-1">
            <p className="text-sm text-gray-500">Período Base</p>
            <p className="font-semibold text-gray-800">{comparison.basePeriod.label}</p>
          </div>
          <div className="px-4">
            <GitCompare className="text-gray-400" size={24} />
          </div>
          <div className="text-center flex-1">
            <p className="text-sm text-gray-500">Período Atual</p>
            <p className="font-semibold text-gray-800">{comparison.targetPeriod.label}</p>
          </div>
        </div>
        <p className="text-center text-gray-600">{comparison.summary}</p>
      </div>

      {/* Comparação por Energia */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {energyKeys.map((key) => {
          const base = comparison.basePeriod.energy[key] || 0;
          const target = comparison.targetPeriod.energy[key] || 0;
          const variation = comparison.variations[key];
          
          return (
            <div key={key} className={`rounded-xl p-4 ${ENERGY_COLORS[key].bgLight} border ${ENERGY_COLORS[key].border} border-opacity-30`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl">{ENERGY_ICONS[key]}</span>
                <VariationBadge variation={variation} metricKey={key} />
              </div>
              <p className={`text-sm ${ENERGY_COLORS[key].text} font-medium`}>{ENERGY_LABELS[key]}</p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Base:</span>
                  <span className="font-medium">{formatCurrency(base)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Atual:</span>
                  <span className="font-medium">{formatCurrency(target)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Highlights */}
      {comparison.highlights.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Destaques da Comparação</h3>
          <div className="space-y-3">
            {comparison.highlights.map((h, idx) => (
              <div key={idx} className={`p-4 rounded-lg ${
                h.type === 'improvement' ? 'bg-green-50 border border-green-200' :
                h.type === 'deterioration' ? 'bg-red-50 border border-red-200' :
                'bg-blue-50 border border-blue-200'
              }`}>
                <p className="font-medium text-gray-800">{h.title}</p>
                <p className="text-sm text-gray-600 mt-1">{h.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== PÁGINA PRINCIPAL ====================

export default function EnergyReportsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'narrative' | 'comparison' | 'insights'>('overview');
  
  // Estados de período
  const [year, setYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState<'1m' | '3m' | '6m' | '12m' | 'ytd'>('3m');
  const [comparisonPreset, setComparisonPreset] = useState<string>('month-vs-previous');
  
  // Estados de dados
  const [energyData, setEnergyData] = useState<PeriodEnergy | null>(null);
  const [timeline, setTimeline] = useState<PeriodEnergy[]>([]);
  const [healthIndex, setHealthIndex] = useState<FinancialHealthIndex | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [narrative, setNarrative] = useState<AnnualNarrative | null>(null);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);

  // Carregar dados
  useEffect(() => {
    loadData();
  }, [accessToken, period, year, comparisonPreset, activeView]);

  async function loadData() {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      // Carregar energia do período
      if (activeView === 'overview') {
        const [energyRes, healthRes, insightsRes] = await Promise.all([
          api.get(`/reports/energy-flow?groupBy=single&period=${period}`),
          api.get(`/reports/health-index?period=${period}`),
          api.get(`/reports/insights?limit=6`)
        ]);
        
        if (energyRes.data.success) setEnergyData(energyRes.data.data);
        if (healthRes.data.success) setHealthIndex(healthRes.data.data);
        if (insightsRes.data.success) setInsights(insightsRes.data.data);
      }
      
      // Carregar narrativa
      if (activeView === 'narrative') {
        const narrativeRes = await api.get(`/reports/annual-narrative/${year}`);
        if (narrativeRes.data.success) setNarrative(narrativeRes.data.data);
      }
      
      // Carregar comparação
      if (activeView === 'comparison') {
        const compRes = await api.get(`/reports/comparison?preset=${comparisonPreset}`);
        if (compRes.data.success) setComparison(compRes.data.data);
      }
      
      // Carregar insights
      if (activeView === 'insights') {
        const insightsRes = await api.get(`/reports/insights?limit=20`);
        if (insightsRes.data.success) setInsights(insightsRes.data.data);
      }
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'narrative', label: 'História', icon: BookOpen },
    { id: 'comparison', label: 'Comparar', icon: GitCompare },
    { id: 'insights', label: 'Insights', icon: Lightbulb },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Demonstração de Vida Financeira</h1>
                <p className="text-sm text-gray-500">Análise cognitiva das suas energias financeiras</p>
              </div>
            </div>
            
            {/* Controles de Período */}
            <div className="flex items-center gap-2">
              {activeView === 'overview' && (
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as any)}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="1m">Último mês</option>
                  <option value="3m">Últimos 3 meses</option>
                  <option value="6m">Últimos 6 meses</option>
                  <option value="12m">Último ano</option>
                  <option value="ytd">Ano corrente</option>
                </select>
              )}
              
              {activeView === 'narrative' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setYear(y => y - 1)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="font-semibold text-gray-800 w-16 text-center">{year}</span>
                  <button
                    onClick={() => setYear(y => Math.min(y + 1, new Date().getFullYear()))}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    disabled={year >= new Date().getFullYear()}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
              
              {activeView === 'comparison' && (
                <select
                  value={comparisonPreset}
                  onChange={(e) => setComparisonPreset(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="month-vs-previous">Mês vs Anterior</option>
                  <option value="month-vs-year-ago">Mês vs Ano Passado</option>
                  <option value="quarter-vs-previous">Trimestre vs Anterior</option>
                  <option value="year-vs-previous">Ano vs Anterior</option>
                </select>
              )}
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeView === tab.id
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {activeView === 'overview' && (
              <OverviewView 
                energyData={energyData} 
                healthIndex={healthIndex} 
                insights={insights} 
              />
            )}
            {activeView === 'narrative' && (
              <NarrativeView narrative={narrative} />
            )}
            {activeView === 'comparison' && (
              <ComparisonView comparison={comparison} />
            )}
            {activeView === 'insights' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Todos os Insights</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {insights.map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
                {insights.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Nenhum insight disponível para este período.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
