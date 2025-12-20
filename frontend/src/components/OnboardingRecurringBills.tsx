'use client';

import { useState, useEffect } from 'react';
import { X, Check, DollarSign, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';

interface Template {
  id: string;
  name: string;
  type: 'income' | 'expense';
  amount: number;
  dueDay: number;
  frequency: string;
  isFixed: boolean;
  notes?: string;
  category: {
    id: string;
    name: string;
    icon?: string;
    color?: string;
  };
}

interface TemplateGroup {
  parent: string;
  icon: string;
  templates: Template[];
}

interface SelectedTemplate {
  templateId: string;
  amount: number;
  dueDay: number;
  bankAccountId?: string;
  paymentMethodId?: string;
}

interface OnboardingRecurringBillsProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function OnboardingRecurringBills({
  isOpen,
  onClose,
  onComplete,
}: OnboardingRecurringBillsProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [templateGroups, setTemplateGroups] = useState<TemplateGroup[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Map<string, SelectedTemplate>>(new Map());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState<'selection' | 'review'>('selection');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/recurring-bills/templates');
      setTemplateGroups(response.data.data.templates || []);
      
      // Expandir primeiro grupo por padrão
      if (response.data.data.templates?.length > 0) {
        setExpandedGroups(new Set([response.data.data.templates[0].parent]));
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleTemplate = (template: Template) => {
    const newSelected = new Map(selectedTemplates);
    
    if (newSelected.has(template.id)) {
      newSelected.delete(template.id);
    } else {
      newSelected.set(template.id, {
        templateId: template.id,
        amount: Number(template.amount),
        dueDay: template.dueDay,
      });
    }
    
    setSelectedTemplates(newSelected);
  };

  const updateTemplateValue = (templateId: string, field: 'amount' | 'dueDay', value: number) => {
    const newSelected = new Map(selectedTemplates);
    const current = newSelected.get(templateId);
    
    if (current) {
      newSelected.set(templateId, {
        ...current,
        [field]: value,
      });
      setSelectedTemplates(newSelected);
    }
  };

  const handleSubmit = async () => {
    if (selectedTemplates.size === 0) {
      onComplete();
      return;
    }

    try {
      setSubmitting(true);
      
      const templates = Array.from(selectedTemplates.values());
      
      await api.post('/recurring-bills/activate-templates', {
        templates,
      });

      onComplete();
    } catch (error) {
      console.error('Erro ao ativar templates:', error);
      alert('Erro ao ativar contas. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {currentStep === 'selection' ? '🎉 Configure suas Contas Recorrentes' : '📋 Revise suas Escolhas'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {currentStep === 'selection' 
                ? 'Selecione as contas que você tem e ajuste os valores'
                : `${selectedTemplates.size} contas selecionadas para ativação`
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Carregando templates...</p>
              </div>
            </div>
          ) : currentStep === 'selection' ? (
            <div className="space-y-4">
              {templateGroups.map((group) => (
                <div key={group.parent} className="border rounded-lg overflow-hidden">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.parent)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{group.icon}</span>
                      <span className="font-semibold text-gray-900">{group.parent}</span>
                      <span className="text-sm text-gray-500">({group.templates.length} contas)</span>
                    </div>
                    {expandedGroups.has(group.parent) ? (
                      <ChevronUp size={20} className="text-gray-600" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-600" />
                    )}
                  </button>

                  {/* Templates List */}
                  {expandedGroups.has(group.parent) && (
                    <div className="divide-y">
                      {group.templates.map((template) => {
                        const isSelected = selectedTemplates.has(template.id);
                        const selectedData = selectedTemplates.get(template.id);

                        return (
                          <div
                            key={template.id}
                            className={`p-4 transition-colors ${
                              isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              {/* Checkbox */}
                              <div className="pt-1">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleTemplate(template)}
                                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                />
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-gray-900">{template.name}</h4>
                                  {!template.isFixed && (
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                      Variável
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{template.category.name}</p>
                                {template.notes && (
                                  <p className="text-xs text-gray-500">{template.notes}</p>
                                )}
                              </div>

                              {/* Editable Values */}
                              {isSelected && selectedData && (
                                <div className="flex gap-3">
                                  {/* Amount */}
                                  <div className="w-32">
                                    <label className="block text-xs text-gray-600 mb-1">
                                      Valor (R$)
                                    </label>
                                    <div className="relative">
                                      <DollarSign size={16} className="absolute left-2 top-2 text-gray-400" />
                                      <input
                                        type="number"
                                        value={selectedData.amount}
                                        onChange={(e) =>
                                          updateTemplateValue(template.id, 'amount', parseFloat(e.target.value) || 0)
                                        }
                                        className="w-full pl-8 pr-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                                        step="0.01"
                                        min="0"
                                      />
                                    </div>
                                  </div>

                                  {/* Due Day */}
                                  <div className="w-24">
                                    <label className="block text-xs text-gray-600 mb-1">
                                      Dia
                                    </label>
                                    <div className="relative">
                                      <Calendar size={16} className="absolute left-2 top-2 text-gray-400" />
                                      <input
                                        type="number"
                                        value={selectedData.dueDay}
                                        onChange={(e) =>
                                          updateTemplateValue(template.id, 'dueDay', parseInt(e.target.value) || 1)
                                        }
                                        className="w-full pl-8 pr-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                                        min="1"
                                        max="31"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Default Display */}
                              {!isSelected && (
                                <div className="text-right">
                                  <div className="font-semibold text-gray-900">
                                    R$ {Number(template.amount).toFixed(2)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Dia {template.dueDay}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Review Step
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">
                  ✨ Tudo pronto para começar!
                </h3>
                <p className="text-sm text-blue-800">
                  Ao confirmar, criaremos suas {selectedTemplates.size} contas recorrentes e começaremos
                  a gerar as ocorrências automaticamente nos próximos meses.
                </p>
              </div>

              {templateGroups.map((group) => {
                const groupTemplates = group.templates.filter((t) =>
                  selectedTemplates.has(t.id)
                );

                if (groupTemplates.length === 0) return null;

                return (
                  <div key={group.parent} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 flex items-center gap-2">
                      <span className="text-xl">{group.icon}</span>
                      <span className="font-semibold text-gray-900">{group.parent}</span>
                      <span className="text-sm text-gray-500">
                        ({groupTemplates.length} contas)
                      </span>
                    </div>
                    <div className="divide-y">
                      {groupTemplates.map((template) => {
                        const data = selectedTemplates.get(template.id)!;
                        return (
                          <div key={template.id} className="p-4 flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{template.name}</div>
                            <div className="text-sm text-gray-600">{template.category.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">
                              R$ {Number(data.amount).toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">Todo dia {data.dueDay}</div>
                          </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedTemplates.size > 0 ? (
                <span>
                  <strong className="text-gray-900">{selectedTemplates.size}</strong> contas selecionadas
                </span>
              ) : (
                <span>Nenhuma conta selecionada</span>
              )}
            </div>

            <div className="flex gap-3">
              {currentStep === 'selection' ? (
                <>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
                  >
                    Pular por enquanto
                  </button>
                  <button
                    onClick={() => selectedTemplates.size > 0 && setCurrentStep('review')}
                    disabled={selectedTemplates.size === 0}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    Continuar
                    <Check size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setCurrentStep('selection')}
                    disabled={submitting}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 transition-colors flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Ativando...
                      </>
                    ) : (
                      <>
                        Confirmar e Ativar
                        <Check size={18} />
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
