'use client';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * PÁGINA DE GOVERNANÇA DE ENERGIA - VISUALIZAÇÃO
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * UI para VISUALIZAÇÃO da classificação energética de categorias.
 * 
 * ⚠️ IMPORTANTE: A classificação é determinada AUTOMATICAMENTE pelo sistema.
 * O usuário NÃO pode editar a classificação diretamente.
 * 
 * Funcionalidades:
 * - Listar todas as categorias com seus pesos de energia
 * - Indicar status de validação (validado, inferido, não validado)
 * - Visualizar justificativa da classificação automática
 * - Auditoria de categorias com problemas
 * 
 * A lógica de classificação está em: backend/src/contracts/energy-auto-classification.ts
 * 
 * Ref: backend/src/contracts/ENERGY-CONTRACT.md
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/stores/auth';
import api from '@/lib/api';

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

interface CategorySemantics {
  survivalWeight: number;
  choiceWeight: number;
  futureWeight: number;
  lossWeight: number;
  isFixed: boolean;
  isEssential: boolean;
  isInvestment: boolean;
  validationStatus: 'validated' | 'inferred' | 'not_validated' | 'default';
  validatedAt: string | null;
  justification: string | null;
  userOverride: boolean;
}

interface CategoryWithSemantics {
  id: string;
  name: string;
  icon: string | null;
  level: number;
  parentId: string | null;
  parentName: string | null;
  parentIcon: string | null;
  semantics: CategorySemantics;
  hasSemantics: boolean;
  needsValidation: boolean;
}

interface Stats {
  total: number;
  validated: number;
  inferred: number;
  notValidated: number;
  default: number;
  withoutSemantics: number;
}

interface AuditIssue {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
}

interface EnergyType {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  examples: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

const ENERGY_COLORS: Record<string, string> = {
  survival: '#3B82F6',
  choice: '#8B5CF6',
  future: '#10B981',
  loss: '#EF4444'
};

const ENERGY_ICONS: Record<string, string> = {
  survival: '🏠',
  choice: '🎯',
  future: '🚀',
  loss: '💸'
};

const ENERGY_LABELS: Record<string, string> = {
  survival: 'Sobrevivência',
  choice: 'Escolha',
  future: 'Futuro',
  loss: 'Energia Perdida'
};

const VALIDATION_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  validated: { label: 'Validado', color: 'text-green-700', bg: 'bg-green-100' },
  inferred: { label: 'Inferido', color: 'text-blue-700', bg: 'bg-blue-100' },
  not_validated: { label: 'Não Validado', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  default: { label: 'Default', color: 'text-red-700', bg: 'bg-red-100' }
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════════

function EnergyBar({ survival, choice, future, loss }: { survival: number; choice: number; future: number; loss: number }) {
  const total = survival + choice + future + loss;
  if (total === 0) {
    return <div className="h-3 rounded-full bg-gray-200 w-full" />;
  }
  
  return (
    <div className="h-3 rounded-full overflow-hidden flex w-full">
      {survival > 0 && (
        <div 
          style={{ width: `${(survival / total) * 100}%`, backgroundColor: ENERGY_COLORS.survival }}
          title={`${ENERGY_LABELS.survival}: ${(survival * 100).toFixed(0)}%`}
        />
      )}
      {choice > 0 && (
        <div 
          style={{ width: `${(choice / total) * 100}%`, backgroundColor: ENERGY_COLORS.choice }}
          title={`${ENERGY_LABELS.choice}: ${(choice * 100).toFixed(0)}%`}
        />
      )}
      {future > 0 && (
        <div 
          style={{ width: `${(future / total) * 100}%`, backgroundColor: ENERGY_COLORS.future }}
          title={`${ENERGY_LABELS.future}: ${(future * 100).toFixed(0)}%`}
        />
      )}
      {loss > 0 && (
        <div 
          style={{ width: `${(loss / total) * 100}%`, backgroundColor: ENERGY_COLORS.loss }}
          title={`${ENERGY_LABELS.loss}: ${(loss * 100).toFixed(0)}%`}
        />
      )}
    </div>
  );
}

function ValidationBadge({ status }: { status: string }) {
  const config = VALIDATION_STATUS_LABELS[status] || VALIDATION_STATUS_LABELS.not_validated;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  );
}

function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <p className="text-sm text-gray-500">Total</p>
        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
      </div>
      <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-100">
        <p className="text-sm text-green-600">Validadas</p>
        <p className="text-2xl font-bold text-green-700">{stats.validated}</p>
      </div>
      <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-100">
        <p className="text-sm text-blue-600">Inferidas</p>
        <p className="text-2xl font-bold text-blue-700">{stats.inferred}</p>
      </div>
      <div className="bg-yellow-50 rounded-xl p-4 shadow-sm border border-yellow-100">
        <p className="text-sm text-yellow-600">Não Validadas</p>
        <p className="text-2xl font-bold text-yellow-700">{stats.notValidated}</p>
      </div>
      <div className="bg-red-50 rounded-xl p-4 shadow-sm border border-red-100">
        <p className="text-sm text-red-600">Sem Semântica</p>
        <p className="text-2xl font-bold text-red-700">{stats.withoutSemantics}</p>
      </div>
    </div>
  );
}

function CategoryRow({ 
  category
}: { 
  category: CategoryWithSemantics;
}) {
  const { semantics } = category;
  
  return (
    <div className={`p-4 rounded-xl border ${category.needsValidation ? 'border-yellow-300 bg-yellow-50/50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {category.level > 1 && (
            <span className="text-gray-400 text-sm">└─</span>
          )}
          <span className="text-xl">{category.icon || '📂'}</span>
          <div>
            <span className="font-medium text-gray-900">{category.name}</span>
            {category.parentName && (
              <span className="text-sm text-gray-500 ml-2">
                (em {category.parentIcon} {category.parentName})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ValidationBadge status={semantics.validationStatus} />
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-lg">
            🤖 Auto
          </span>
        </div>
      </div>
      
      <div className="mb-2">
        <EnergyBar 
          survival={semantics.survivalWeight}
          choice={semantics.choiceWeight}
          future={semantics.futureWeight}
          loss={semantics.lossWeight}
        />
      </div>
      
      <div className="flex flex-wrap gap-2 text-xs">
        {semantics.survivalWeight > 0 && (
          <span className="px-2 py-1 rounded-full" style={{ backgroundColor: `${ENERGY_COLORS.survival}20`, color: ENERGY_COLORS.survival }}>
            {ENERGY_ICONS.survival} {(semantics.survivalWeight * 100).toFixed(0)}% Sobrevivência
          </span>
        )}
        {semantics.choiceWeight > 0 && (
          <span className="px-2 py-1 rounded-full" style={{ backgroundColor: `${ENERGY_COLORS.choice}20`, color: ENERGY_COLORS.choice }}>
            {ENERGY_ICONS.choice} {(semantics.choiceWeight * 100).toFixed(0)}% Escolha
          </span>
        )}
        {semantics.futureWeight > 0 && (
          <span className="px-2 py-1 rounded-full" style={{ backgroundColor: `${ENERGY_COLORS.future}20`, color: ENERGY_COLORS.future }}>
            {ENERGY_ICONS.future} {(semantics.futureWeight * 100).toFixed(0)}% Futuro
          </span>
        )}
        {semantics.lossWeight > 0 && (
          <span className="px-2 py-1 rounded-full" style={{ backgroundColor: `${ENERGY_COLORS.loss}20`, color: ENERGY_COLORS.loss }}>
            {ENERGY_ICONS.loss} {(semantics.lossWeight * 100).toFixed(0)}% Perdida
          </span>
        )}
        {!category.hasSemantics && (
          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">
            ⚠️ Sem classificação
          </span>
        )}
      </div>
      
      {semantics.justification && (
        <p className="mt-2 text-xs text-gray-500 italic">
          💬 {semantics.justification}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function EnergyGovernancePage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategoryWithSemantics[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, validated: 0, inferred: 0, notValidated: 0, default: 0, withoutSemantics: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'needs_validation' | 'validated'>('all');
  const [showAudit, setShowAudit] = useState(false);
  const [auditIssues, setAuditIssues] = useState<AuditIssue[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/energy-governance/categories');
      setCategories(response.data.categories);
      setStats(response.data.stats);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  }, []);
  
  const fetchAudit = useCallback(async () => {
    try {
      setAuditLoading(true);
      const response = await api.get('/energy-governance/audit');
      setAuditIssues(response.data.issues);
    } catch (err: any) {
      console.error('Erro na auditoria:', err);
    } finally {
      setAuditLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);
  
  const filteredCategories = categories.filter(cat => {
    if (filter === 'needs_validation') return cat.needsValidation;
    if (filter === 'validated') return cat.semantics.validationStatus === 'validated';
    return true;
  });
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }
  
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">⚡</span>
          <h1 className="text-2xl font-bold text-gray-900">Governança de Energia</h1>
        </div>
        <p className="text-gray-600">
          Visualize como suas categorias são classificadas automaticamente pelo sistema para calcular o impacto de cada gasto na sua vida financeira.
        </p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl">
          {error}
        </div>
      )}
      
      {/* Stats */}
      <StatsCards stats={stats} />
      
      {/* Legenda */}
      <div className="mb-6 p-4 bg-gray-50 rounded-xl">
        <h3 className="font-medium text-gray-900 mb-3">Tipos de Energia</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: ENERGY_COLORS.survival }} />
            <span className="text-sm text-gray-700">🏠 Sobrevivência</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: ENERGY_COLORS.choice }} />
            <span className="text-sm text-gray-700">🎯 Escolha</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: ENERGY_COLORS.future }} />
            <span className="text-sm text-gray-700">🚀 Futuro</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: ENERGY_COLORS.loss }} />
            <span className="text-sm text-gray-700">💸 Perdida</span>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todas ({stats.total})
          </button>
          <button
            onClick={() => setFilter('needs_validation')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'needs_validation' ? 'bg-yellow-500 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            }`}
          >
            Precisam validação ({stats.notValidated + stats.withoutSemantics})
          </button>
          <button
            onClick={() => setFilter('validated')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'validated' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            Validadas ({stats.validated})
          </button>
        </div>
        
        <button
          onClick={() => {
            setShowAudit(!showAudit);
            if (!showAudit) fetchAudit();
          }}
          className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200"
        >
          🔍 Auditoria
        </button>
      </div>
      
      {/* Audit Panel */}
      {showAudit && (
        <div className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-200">
          <h3 className="font-bold text-orange-800 mb-3">🔍 Auditoria de Categorias</h3>
          {auditLoading ? (
            <p className="text-orange-600">Carregando...</p>
          ) : auditIssues.length === 0 ? (
            <p className="text-green-600">✓ Nenhum problema encontrado!</p>
          ) : (
            <div className="space-y-2">
              {auditIssues.map((issue, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-lg flex items-center justify-between ${
                    issue.severity === 'critical' ? 'bg-red-100' :
                    issue.severity === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{issue.categoryIcon || '📂'}</span>
                    <span className="font-medium">{issue.categoryName}</span>
                    <span className="text-sm text-gray-600">— {issue.issue}</span>
                  </div>
                  <span className="px-2 py-1 text-xs bg-white/50 rounded text-gray-500">
                    Classificação automática pendente
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Category List */}
      <div className="space-y-3">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Nenhuma categoria encontrada com este filtro
          </div>
        ) : (
          filteredCategories.map(cat => (
            <CategoryRow 
              key={cat.id} 
              category={cat} 
            />
          ))
        )}
      </div>
      
      {/* Informação sobre classificação automática */}
      <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2">ℹ️ Classificação Automática</h4>
        <p className="text-sm text-blue-600">
          As categorias são classificadas automaticamente pelo sistema com base em regras pré-definidas.
          A classificação não pode ser editada manualmente para garantir consistência nos relatórios de energia.
        </p>
      </div>
    </div>
  );
}
