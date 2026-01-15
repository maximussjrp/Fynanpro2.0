'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, AlertTriangle, ArrowRight, Trash2, CheckCircle } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  level: number;
  parentId: string | null;
  _count?: {
    transactions: number;
  };
}

interface MigrationMapping {
  oldCategory: Category;
  newCategory: Category | null;
}

export default function MigrateCategoriesPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [oldCategories, setOldCategories] = useState<Category[]>([]);
  const [newCategories, setNewCategories] = useState<Category[]>([]);
  const [mappings, setMappings] = useState<MigrationMapping[]>([]);
  const [step, setStep] = useState<'analysis' | 'mapping' | 'confirmation' | 'done'>('analysis');

  useEffect(() => {
    if (!accessToken) {
      router.push('/');
      return;
    }
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories?isActive=true');
      const allCategories = response.data.data.categories || [];

      // Separar antigas (flat, sem children) das novas (hierárquicas)
      const oldCats = allCategories.filter((cat: Category) => {
        const hasNoParent = !cat.parentId;
        const isLevel1 = cat.level === 1;
        const hasChildren = allCategories.some((c: Category) => c.parentId === cat.id);
        return hasNoParent && isLevel1 && !hasChildren;
      });

      const newCats = allCategories.filter((cat: Category) => {
        const hasChildren = allCategories.some((c: Category) => c.parentId === cat.id);
        const hasParent = !!cat.parentId;
        return hasChildren || hasParent;
      });

      setOldCategories(oldCats.filter((c: Category) => c._count && c._count.transactions > 0));
      setNewCategories(newCats);
      
      // Inicializar mappings
      const initialMappings = oldCats
        .filter((c: Category) => c._count && c._count.transactions > 0)
        .map((oldCat: Category) => ({
          oldCategory: oldCat,
          newCategory: null
        }));
      
      setMappings(initialMappings);
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error);
      toast.error('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectNewCategory = (oldCatId: string, newCat: Category) => {
    setMappings(prev => prev.map(m => 
      m.oldCategory.id === oldCatId 
        ? { ...m, newCategory: newCat }
        : m
    ));
  };

  const handleMigrate = async () => {
    const incompleteMappings = mappings.filter(m => !m.newCategory);
    if (incompleteMappings.length > 0) {
      toast.error(`Selecione uma categoria destino para todas as ${incompleteMappings.length} categorias antigas`);
      return;
    }

    setMigrating(true);
    try {
      // Migrar transações
      for (const mapping of mappings) {
        await api.post('/categories/migrate', {
          oldCategoryId: mapping.oldCategory.id,
          newCategoryId: mapping.newCategory!.id
        });
      }

      toast.success('Migração concluída com sucesso!');
      setStep('done');
      
      // Recarregar categorias
      setTimeout(() => {
        router.push('/dashboard/categories');
      }, 2000);
    } catch (error: any) {
      console.error('Erro na migração:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao migrar categorias');
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Carregando...</div>
      </div>
    );
  }

  if (oldCategories.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push('/dashboard/categories')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          
          <div className="bg-white rounded-xl p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Tudo certo!</h2>
            <p className="text-gray-600">Não há categorias antigas para migrar.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => router.push('/dashboard/categories')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Migração de Categorias</h1>
            <p className="text-gray-600 mt-2">Mova as transações das categorias antigas para as novas hierárquicas</p>
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${step === 'analysis' ? 'bg-[#DBEAFE] text-[#1A44BF]' : 'bg-gray-100 text-gray-500'}`}>
            <span className="font-bold">1</span> Análise
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${step === 'mapping' ? 'bg-[#DBEAFE] text-[#1A44BF]' : 'bg-gray-100 text-gray-500'}`}>
            <span className="font-bold">2</span> Mapeamento
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${step === 'confirmation' ? 'bg-[#DBEAFE] text-[#1A44BF]' : 'bg-gray-100 text-gray-500'}`}>
            <span className="font-bold">3</span> Confirmação
          </div>
        </div>

        {/* Analysis Step */}
        {step === 'analysis' && (
          <div className="bg-white rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4 mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-yellow-900 mb-1">Atenção!</h3>
                <p className="text-yellow-800">
                  Foram encontradas {oldCategories.length} categorias antigas com transações vinculadas.
                  É necessário migrar essas transações para as novas categorias hierárquicas.
                </p>
              </div>
            </div>

            <h3 className="text-lg font-bold mb-4">Categorias a migrar:</h3>
            <div className="space-y-3 mb-6">
              {oldCategories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <div>
                      <p className="font-semibold">{cat.name}</p>
                      <p className="text-sm text-gray-500">
                        {cat._count?.transactions || 0} transações
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded text-sm ${cat.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {cat.type === 'income' ? 'Receita' : 'Despesa'}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('mapping')}
              className="w-full py-3 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] font-semibold"
            >
              Iniciar Mapeamento
            </button>
          </div>
        )}

        {/* Mapping Step */}
        {step === 'mapping' && (
          <div className="space-y-6">
            {mappings.map((mapping, idx) => (
              <div key={mapping.oldCategory.id} className="bg-white rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-1">De (antiga):</p>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className="text-2xl">{mapping.oldCategory.icon}</span>
                      <div>
                        <p className="font-semibold">{mapping.oldCategory.name}</p>
                        <p className="text-sm text-gray-500">
                          {mapping.oldCategory._count?.transactions || 0} transações
                        </p>
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-8 h-8 text-gray-400 flex-shrink-0" />

                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-1">Para (nova):</p>
                    {mapping.newCategory ? (
                      <div className="flex items-center gap-3 p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                        <span className="text-2xl">{mapping.newCategory.icon}</span>
                        <div className="flex-1">
                          <p className="font-semibold">{mapping.newCategory.name}</p>
                          <p className="text-xs text-gray-500">Nível {mapping.newCategory.level}</p>
                        </div>
                        <button
                          onClick={() => handleSelectNewCategory(mapping.oldCategory.id, null as any)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <select
                        onChange={(e) => {
                          const selected = newCategories.find(c => c.id === e.target.value);
                          if (selected) handleSelectNewCategory(mapping.oldCategory.id, selected);
                        }}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F4FD8]"
                      >
                        <option value="">Selecione uma categoria...</option>
                        {newCategories
                          .filter(c => c.type === mapping.oldCategory.type)
                          .map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {'  '.repeat(cat.level - 1)}{cat.icon} {cat.name} (Nível {cat.level})
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-4">
              <button
                onClick={() => setStep('analysis')}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep('confirmation')}
                disabled={mappings.some(m => !m.newCategory)}
                className="flex-1 py-3 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Step */}
        {step === 'confirmation' && (
          <div className="bg-white rounded-xl p-6">
            <h3 className="text-xl font-bold mb-6">Confirme a migração:</h3>
            
            <div className="space-y-4 mb-6">
              {mappings.map(mapping => (
                <div key={mapping.oldCategory.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <span className="text-2xl">{mapping.oldCategory.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold">{mapping.oldCategory.name}</p>
                    <p className="text-sm text-gray-500">{mapping.oldCategory._count?.transactions} transações</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                  <span className="text-2xl">{mapping.newCategory?.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold">{mapping.newCategory?.name}</p>
                    <p className="text-xs text-gray-500">Nível {mapping.newCategory?.level}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-[#EFF6FF] border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-900">
                <strong>Total:</strong> {mappings.reduce((sum, m) => sum + (m.oldCategory._count?.transactions || 0), 0)} transações serão migradas.
              </p>
              <p className="text-sm text-[#1A44BF] mt-2">
                As categorias antigas serão arquivadas após a migração.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep('mapping')}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Voltar
              </button>
              <button
                onClick={handleMigrate}
                disabled={migrating}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50"
              >
                {migrating ? 'Migrando...' : 'Confirmar Migração'}
              </button>
            </div>
          </div>
        )}

        {/* Done Step */}
        {step === 'done' && (
          <div className="bg-white rounded-xl p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Migração Concluída!</h2>
            <p className="text-gray-600 mb-6">
              Todas as transações foram migradas com sucesso para as novas categorias.
            </p>
            <button
              onClick={() => router.push('/dashboard/categories')}
              className="px-6 py-3 bg-[#1F4FD8] text-white rounded-lg hover:bg-[#1A44BF] font-semibold"
            >
              Voltar para Categorias
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
