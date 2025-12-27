'use client';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * PÁGINA DE GOVERNANÇA DE ENERGIA
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * UI para visualização e edição da classificação energética de categorias.
 * 
 * Funcionalidades:
 * - Listar todas as categorias com seus pesos de energia
 * - Indicar status de validação (validado, inferido, não validado)
 * - Permitir edição dos pesos
 * - Auditoria de categorias com problemas
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
  category, 
  onEdit 
}: { 
  category: CategoryWithSemantics;
  onEdit: (category: CategoryWithSemantics) => void;
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
          <button
            onClick={() => onEdit(category)}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Ajustar
          </button>
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

function EditModal({
  category,
  onClose,
  onSave
}: {
  category: CategoryWithSemantics;
  onClose: () => void;
  onSave: (categoryId: string, data: Partial<CategorySemantics> & { justification?: string }) => Promise<void>;
}) {
  const [survival, setSurvival] = useState(category.semantics.survivalWeight * 100);
  const [choice, setChoice] = useState(category.semantics.choiceWeight * 100);
  const [future, setFuture] = useState(category.semantics.futureWeight * 100);
  const [loss, setLoss] = useState(category.semantics.lossWeight * 100);
  const [isFixed, setIsFixed] = useState(category.semantics.isFixed);
  const [isEssential, setIsEssential] = useState(category.semantics.isEssential);
  const [isInvestment, setIsInvestment] = useState(category.semantics.isInvestment);
  const [justification, setJustification] = useState(category.semantics.justification || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const total = survival + choice + future + loss;
  const isValid = Math.abs(total - 100) < 0.1;
  const isHybrid = [survival, choice, future, loss].filter(v => v > 0).length > 1;
  
  const handleSave = async () => {
    if (!isValid) {
      setError('A soma dos pesos deve ser exatamente 100%');
      return;
    }
    
    if (isHybrid && !justification.trim()) {
      setError('Classificações híbridas requerem justificativa');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      await onSave(category.id, {
        survivalWeight: survival / 100,
        choiceWeight: choice / 100,
        futureWeight: future / 100,
        lossWeight: loss / 100,
        isFixed,
        isEssential,
        isInvestment,
        justification: justification.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };
  
  // Presets
  const applyPreset = (preset: string) => {
    switch (preset) {
      case 'survival':
        setSurvival(100); setChoice(0); setFuture(0); setLoss(0);
        setIsFixed(true); setIsEssential(true); setIsInvestment(false);
        setJustification('');
        break;
      case 'choice':
        setSurvival(0); setChoice(100); setFuture(0); setLoss(0);
        setIsFixed(false); setIsEssential(false); setIsInvestment(false);
        setJustification('');
        break;
      case 'future':
        setSurvival(0); setChoice(0); setFuture(100); setLoss(0);
        setIsFixed(false); setIsEssential(false); setIsInvestment(true);
        setJustification('');
        break;
      case 'loss':
        setSurvival(0); setChoice(0); setFuture(0); setLoss(100);
        setIsFixed(false); setIsEssential(false); setIsInvestment(false);
        setJustification('');
        break;
      case 'survival_choice':
        setSurvival(60); setChoice(40); setFuture(0); setLoss(0);
        setIsFixed(false); setIsEssential(true); setIsInvestment(false);
        setJustification('Necessidade básica com componente de conforto');
        break;
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{category.icon || '📂'}</span>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
                <p className="text-sm text-gray-500">Classificação energética</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
              ×
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Presets rápidos
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => applyPreset('survival')} className="px-3 py-1.5 text-sm rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200">
                🏠 100% Sobrevivência
              </button>
              <button onClick={() => applyPreset('choice')} className="px-3 py-1.5 text-sm rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200">
                🎯 100% Escolha
              </button>
              <button onClick={() => applyPreset('future')} className="px-3 py-1.5 text-sm rounded-lg bg-green-100 text-green-700 hover:bg-green-200">
                🚀 100% Futuro
              </button>
              <button onClick={() => applyPreset('loss')} className="px-3 py-1.5 text-sm rounded-lg bg-red-100 text-red-700 hover:bg-red-200">
                💸 100% Perdida
              </button>
              <button onClick={() => applyPreset('survival_choice')} className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
                🔀 60/40 Híbrido
              </button>
            </div>
          </div>
          
          {/* Sliders */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: ENERGY_COLORS.survival }}>🏠 Sobrevivência</span>
                <span className="font-medium">{survival.toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={survival}
                onChange={(e) => setSurvival(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: ENERGY_COLORS.survival }}
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: ENERGY_COLORS.choice }}>🎯 Escolha</span>
                <span className="font-medium">{choice.toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={choice}
                onChange={(e) => setChoice(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: ENERGY_COLORS.choice }}
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: ENERGY_COLORS.future }}>🚀 Futuro</span>
                <span className="font-medium">{future.toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={future}
                onChange={(e) => setFuture(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: ENERGY_COLORS.future }}
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: ENERGY_COLORS.loss }}>💸 Energia Perdida</span>
                <span className="font-medium">{loss.toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={loss}
                onChange={(e) => setLoss(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: ENERGY_COLORS.loss }}
              />
            </div>
          </div>
          
          {/* Total */}
          <div className={`p-3 rounded-lg ${isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex justify-between items-center">
              <span className={isValid ? 'text-green-700' : 'text-red-700'}>Total:</span>
              <span className={`font-bold ${isValid ? 'text-green-700' : 'text-red-700'}`}>
                {total.toFixed(0)}% {isValid ? '✓' : '(deve ser 100%)'}
              </span>
            </div>
            <EnergyBar survival={survival/100} choice={choice/100} future={future/100} loss={loss/100} />
          </div>
          
          {/* Flags */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFixed}
                onChange={(e) => setIsFixed(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Gasto fixo (valor não varia)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isEssential}
                onChange={(e) => setIsEssential(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Essencial (não pode ser cortado)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isInvestment}
                onChange={(e) => setIsInvestment(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">É investimento</span>
            </label>
          </div>
          
          {/* Justificativa */}
          {isHybrid && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Justificativa (obrigatória para híbridos)
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Ex: Alimentação inclui supermercado (essencial) e restaurantes (escolha)"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                rows={3}
              />
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Salvar Classificação'}
          </button>
        </div>
      </div>
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
  const [editingCategory, setEditingCategory] = useState<CategoryWithSemantics | null>(null);
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
  
  const handleSave = async (categoryId: string, data: any) => {
    await api.put(`/energy-governance/categories/${categoryId}`, data);
    await fetchCategories();
  };
  
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
          Classifique suas categorias para que o sistema entenda o impacto de cada gasto na sua vida financeira.
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
                  <button
                    onClick={() => {
                      const cat = categories.find(c => c.id === issue.categoryId);
                      if (cat) setEditingCategory(cat);
                    }}
                    className="px-2 py-1 text-xs bg-white rounded hover:bg-gray-50"
                  >
                    Corrigir
                  </button>
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
              onEdit={setEditingCategory}
            />
          ))
        )}
      </div>
      
      {/* Edit Modal */}
      {editingCategory && (
        <EditModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
