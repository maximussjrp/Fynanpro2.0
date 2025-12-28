'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  Target, CheckCircle, ChevronRight, ArrowLeft, 
  Zap, Home, Heart, Rocket, AlertTriangle, X,
  Settings, Loader2
} from 'lucide-react';

// ==================== TYPES ====================

interface TopPendingCategory {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  pendingAmount: number;
  pendingCount: number;
  currentStatus: 'not_validated' | 'inferred' | 'missing' | 'default';
  suggestedPreset: 'survival' | 'choice' | 'future' | 'loss' | 'hybrid';
  suggestedWeights: { survival: number; choice: number; future: number; loss: number };
}

interface CoverageData {
  validatedPercent: number;
  validatedAmount: number;
  totalExpenseAmount: number;
  validatedCount: number;
  pendingCount: number;
  totalCategoriesUsed: number;
}

interface WizardData {
  coverage: CoverageData;
  topPendingCategories: TopPendingCategory[];
}

// ==================== CONSTANTS ====================

const ENERGY_PRESETS = {
  survival: { 
    label: 'Sobrevivência', 
    icon: '🏠', 
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgLight: 'bg-blue-50',
    description: 'Gasto essencial para viver (aluguel, luz, saúde)'
  },
  choice: { 
    label: 'Escolha', 
    icon: '🎯', 
    color: 'bg-purple-500',
    textColor: 'text-purple-700',
    bgLight: 'bg-purple-50',
    description: 'Gasto opcional que melhora sua vida'
  },
  future: { 
    label: 'Futuro', 
    icon: '🚀', 
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgLight: 'bg-green-50',
    description: 'Investimento para liberdade financeira'
  },
  loss: { 
    label: 'Energia Perdida', 
    icon: '💸', 
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgLight: 'bg-red-50',
    description: 'Dinheiro perdido (juros, multas, taxas)'
  },
  hybrid: { 
    label: 'Híbrido', 
    icon: '⚡', 
    color: 'bg-amber-500',
    textColor: 'text-amber-700',
    bgLight: 'bg-amber-50',
    description: 'Mix de essencial e opcional'
  },
};

// ==================== UTILITY ====================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

// ==================== MAIN COMPONENT ====================

interface OnboardingValidationWizardProps {
  onClose: () => void;
  onComplete?: () => void;
}

export default function OnboardingValidationWizard({ 
  onClose, 
  onComplete 
}: OnboardingValidationWizardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [validatedCategories, setValidatedCategories] = useState<Set<string>>(new Set());
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customWeights, setCustomWeights] = useState({ survival: 0, choice: 0, future: 0, loss: 0 });
  const [showCustom, setShowCustom] = useState(false);

  // Carregar dados
  const loadWizardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/reports/top-pending-categories?limit=10');
      if (response.data.success) {
        setWizardData(response.data.data);
        // Se não tem categorias pendentes, fechar wizard
        if (response.data.data.topPendingCategories.length === 0) {
          onComplete?.();
          onClose();
        }
      }
    } catch (error) {
      console.error('Erro ao carregar wizard:', error);
    } finally {
      setLoading(false);
    }
  }, [onClose, onComplete]);

  useEffect(() => {
    loadWizardData();
  }, [loadWizardData]);

  // Categoria atual
  const currentCategory = wizardData?.topPendingCategories[currentIndex];
  const totalCategories = wizardData?.topPendingCategories.length || 0;
  const isLastCategory = currentIndex >= totalCategories - 1;

  // Inicializar preset sugerido
  useEffect(() => {
    if (currentCategory && !validatedCategories.has(currentCategory.categoryId)) {
      setSelectedPreset(currentCategory.suggestedPreset);
      setCustomWeights(currentCategory.suggestedWeights);
      setShowCustom(currentCategory.suggestedPreset === 'hybrid');
    }
  }, [currentCategory, validatedCategories]);

  // Salvar categoria
  const handleSave = async () => {
    if (!currentCategory) return;
    
    setSaving(true);
    try {
      const weights = showCustom 
        ? customWeights 
        : getWeightsFromPreset(selectedPreset || 'hybrid');
      
      // Chamar API de governança
      await api.put(`/energy-governance/categories/${currentCategory.categoryId}`, {
        survivalWeight: weights.survival,
        choiceWeight: weights.choice,
        futureWeight: weights.future,
        lossWeight: weights.loss,
        isFixed: false,
        isEssential: selectedPreset === 'survival',
        isInvestment: selectedPreset === 'future',
        justification: `Validado via onboarding wizard`
      });

      // Marcar como validada
      setValidatedCategories(prev => new Set([...prev, currentCategory.categoryId]));
      
      // Avançar ou finalizar
      if (isLastCategory) {
        // Recarregar dados para atualizar coverage
        await loadWizardData();
        onComplete?.();
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      alert(error.response?.data?.error || 'Erro ao salvar classificação');
    } finally {
      setSaving(false);
    }
  };

  // Pular categoria
  const handleSkip = () => {
    if (isLastCategory) {
      onComplete?.();
      onClose();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Obter pesos de preset
  function getWeightsFromPreset(preset: string) {
    switch (preset) {
      case 'survival': return { survival: 1, choice: 0, future: 0, loss: 0 };
      case 'choice': return { survival: 0, choice: 1, future: 0, loss: 0 };
      case 'future': return { survival: 0, choice: 0, future: 1, loss: 0 };
      case 'loss': return { survival: 0, choice: 0, future: 0, loss: 1 };
      default: return { survival: 0.5, choice: 0.5, future: 0, loss: 0 };
    }
  }

  // Calcular progresso
  const validatedImpact = wizardData?.topPendingCategories
    .filter(c => validatedCategories.has(c.categoryId))
    .reduce((sum, c) => sum + c.pendingAmount, 0) || 0;
  
  const totalImpact = wizardData?.topPendingCategories
    .reduce((sum, c) => sum + c.pendingAmount, 0) || 0;

  const impactPercent = totalImpact > 0 
    ? ((validatedImpact / totalImpact) * 100).toFixed(0) 
    : '0';

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando categorias...</p>
        </div>
      </div>
    );
  }

  // Sem dados
  if (!wizardData || totalCategories === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Tudo validado!</h2>
          <p className="text-gray-600 mb-6">Não há categorias pendentes de validação.</p>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Target size={24} />
              Validar Categorias
            </h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-indigo-100">
              <span>{validatedCategories.size}/{totalCategories} validadas</span>
              <span>{impactPercent}% do gasto validado</span>
            </div>
            <div className="h-2 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${(validatedCategories.size / totalCategories) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentCategory && (
            <div className="space-y-6">
              {/* Categoria atual */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full text-4xl mb-4">
                  {currentCategory.categoryIcon || '📦'}
                </div>
                <h3 className="text-2xl font-bold text-gray-800">{currentCategory.categoryName}</h3>
                <p className="text-gray-500 mt-1">
                  {formatCurrency(currentCategory.pendingAmount)} em {currentCategory.pendingCount} transações
                </p>
              </div>

              {/* Presets */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Como você classifica este gasto?</p>
                
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(ENERGY_PRESETS).filter(([key]) => key !== 'hybrid').map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedPreset(key);
                        setShowCustom(false);
                      }}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selectedPreset === key && !showCustom
                          ? `${preset.bgLight} border-current ${preset.textColor}`
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{preset.icon}</span>
                        <div>
                          <p className={`font-semibold ${selectedPreset === key && !showCustom ? preset.textColor : 'text-gray-800'}`}>
                            {preset.label}
                          </p>
                          <p className="text-xs text-gray-500">{preset.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Híbrido / Custom */}
                <button
                  onClick={() => {
                    setSelectedPreset('hybrid');
                    setShowCustom(true);
                  }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    showCustom
                      ? 'bg-amber-50 border-amber-400 text-amber-700'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <p className={`font-semibold ${showCustom ? 'text-amber-700' : 'text-gray-800'}`}>
                        Híbrido (Personalizado)
                      </p>
                      <p className="text-xs text-gray-500">Defina a proporção manualmente</p>
                    </div>
                  </div>
                </button>

                {/* Sliders para híbrido */}
                {showCustom && (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                    <p className="text-sm text-gray-600 font-medium">Proporção (soma = 100%)</p>
                    
                    {(['survival', 'choice', 'future', 'loss'] as const).map((type) => (
                      <div key={type} className="flex items-center gap-3">
                        <span className="text-lg w-8">{ENERGY_PRESETS[type].icon}</span>
                        <span className="text-sm text-gray-600 w-24">{ENERGY_PRESETS[type].label}</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={customWeights[type] * 100}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) / 100;
                            const others = (['survival', 'choice', 'future', 'loss'] as const).filter(t => t !== type);
                            const remaining = 1 - value;
                            const otherTotal = others.reduce((sum, t) => sum + customWeights[t], 0);
                            
                            const newWeights = { ...customWeights, [type]: value };
                            
                            // Distribuir o restante proporcionalmente
                            if (otherTotal > 0) {
                              others.forEach(t => {
                                newWeights[t] = (customWeights[t] / otherTotal) * remaining;
                              });
                            } else {
                              // Se todos os outros são 0, dividir igualmente
                              others.forEach(t => {
                                newWeights[t] = remaining / others.length;
                              });
                            }
                            
                            setCustomWeights(newWeights);
                          }}
                          className="flex-1 accent-indigo-600"
                        />
                        <span className="text-sm text-gray-800 w-12 text-right font-medium">
                          {(customWeights[type] * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sugestão */}
              {currentCategory.suggestedPreset && !showCustom && selectedPreset !== currentCategory.suggestedPreset && (
                <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span>
                    Sugestão do sistema: <strong>{ENERGY_PRESETS[currentCategory.suggestedPreset]?.label}</strong>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 p-4 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition text-sm"
          >
            Pular
          </button>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {currentIndex + 1} de {totalCategories}
            </span>
            <button
              onClick={handleSave}
              disabled={saving || !selectedPreset}
              className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${
                saving || !selectedPreset
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Salvando...
                </>
              ) : isLastCategory ? (
                <>
                  <CheckCircle size={18} />
                  Finalizar
                </>
              ) : (
                <>
                  Salvar e Próxima
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
