'use client';

import { useAuth } from '@/stores/auth';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Tag, Plus, Edit2, Trash2, Eye, EyeOff, ChevronRight, ChevronDown, FolderTree } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  level: number;
  parentId: string | null;
  isActive: boolean;
  children?: Category[];
  _count?: {
    transactions: number;
    children?: number;
  };
}

interface CategoryForm {
  name: string;
  type: string;
  icon: string;
  color: string;
  parentId: string | null;
}

export default function CategoriesPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [allExpanded, setAllExpanded] = useState(false);

  const [categoryForm, setCategoryForm] = useState<CategoryForm>({
    name: '',
    type: 'expense',
    icon: '📝',
    color: '#3B82F6',
    parentId: null,
  });

  useEffect(() => {
    const token = accessToken;
    if (!token) {
      router.push('/');
      return;
    }
    loadCategories();
  }, []);

  // Expandir todas as categorias que têm filhos ao carregar
  useEffect(() => {
    if (categories.length > 0 && expandedCategories.size === 0) {
      const categoriesWithChildren = categories.filter(c => c.children && c.children.length > 0);
      if (categoriesWithChildren.length > 0) {
        setExpandedCategories(new Set(categoriesWithChildren.map(c => c.id)));
        setAllExpanded(true);
      }
    }
  }, [categories]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories?isActive=true');
      setCategories(response.data.data.categories || []);
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error.response?.data || error.message);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post('/categories', categoryForm);
      
      setShowCreateModal(false);
      setCategoryForm({ name: '', type: 'expense', icon: '📝', color: '#3B82F6', parentId: null });
      loadCategories();
    } catch (error: any) {
      console.error('Erro ao criar categoria:', error.response?.data || error.message);
      alert(error.response?.data?.message || 'Erro ao criar categoria');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setSubmitting(true);

    try {
      await api.put(`/categories/${editingCategory.id}`, categoryForm);
      
      setShowEditModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', type: 'expense', icon: '📝', color: '#3B82F6', parentId: null });
      loadCategories();
    } catch (error: any) {
      console.error('Erro ao editar categoria:', error.response?.data || error.message);
      alert(error.response?.data?.message || 'Erro ao editar categoria');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategoryStatus = async (id: string, currentStatus: boolean) => {
    try {
      await api.put(`/categories/${id}`, { isActive: !currentStatus });
      loadCategories();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error.response?.data || error.message);
      alert(error.response?.data?.message || 'Erro ao alterar status da categoria');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.')) return;

    try {
      await api.delete(`/categories/${id}`);
      loadCategories();
    } catch (error: any) {
      console.error('Erro ao excluir categoria:', error.response?.data || error.message);
      alert(error.response?.data?.message || 'Erro ao excluir categoria');
    }
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      type: category.type,
      icon: category.icon,
      color: category.color,
      parentId: category.parentId,
    });
    setShowEditModal(true);
  };

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Expandir/Contrair todas as categorias
  const toggleAllExpanded = useCallback(() => {
    if (allExpanded) {
      setExpandedCategories(new Set());
      setAllExpanded(false);
    } else {
      const allWithChildren = categories.filter(c => c.children && c.children.length > 0);
      setExpandedCategories(new Set(allWithChildren.map(c => c.id)));
      setAllExpanded(true);
    }
  }, [allExpanded, categories]);

  const renderCategory = (category: Category, level: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const childCount = category.children?.length || category._count?.children || 0;

    return (
      <div key={category.id} className="relative">
        {/* Linha de conexão vertical para subcategorias */}
        {level > 0 && (
          <div 
            className="absolute left-0 top-0 bottom-0 border-l-2 border-gray-200"
            style={{ left: `${(level - 1) * 24 + 28}px` }}
          />
        )}
        
        <div
          className={`
            flex items-center justify-between p-3 sm:p-4
            hover:bg-gray-50 border-b border-gray-200
            transition-colors duration-150
            ${level > 0 ? 'bg-gray-50/50' : 'bg-white'}
          `}
          style={{ paddingLeft: `${level * 24 + 16}px` }}
        >
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Botão de expandir - com tamanho mínimo para touch */}
            {hasChildren ? (
              <button 
                onClick={() => toggleExpanded(category.id)} 
                className="flex-shrink-0 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center 
                           rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors
                           text-gray-500 touch-manipulation"
                aria-label={isExpanded ? 'Recolher subcategorias' : 'Expandir subcategorias'}
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>
            ) : (
              <div className="w-10 sm:w-8 flex-shrink-0" />
            )}
            
            {/* Cor e ícone */}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: category.color }}
            />
            <span className="text-xl sm:text-2xl flex-shrink-0">{category.icon}</span>
            
            {/* Nome e detalhes */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-gray-800 truncate">{category.name}</p>
                {hasChildren && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {childCount} sub
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Nível {category.level} • {category._count?.transactions || 0} transações
              </p>
            </div>
            
            {/* Badge de tipo */}
            <span className={`
              hidden sm:inline-block px-2 py-1 rounded text-xs flex-shrink-0
              ${category.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
            `}>
              {category.type === 'income' ? 'Receita' : 'Despesa'}
            </span>
          </div>

          {/* Botões de ação - sempre visíveis no mobile */}
          <div className="flex gap-1 sm:gap-2 ml-2 flex-shrink-0">
            <button
              onClick={() => toggleCategoryStatus(category.id, category.isActive)}
              className="p-2 sm:p-2 min-w-[40px] min-h-[40px] flex items-center justify-center
                         hover:bg-gray-200 rounded-lg transition-colors touch-manipulation"
              title={category.isActive ? 'Desativar' : 'Ativar'}
            >
              {category.isActive ? (
                <Eye className="w-4 h-4 text-gray-600" />
              ) : (
                <EyeOff className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <button
              onClick={() => openEditModal(category)}
              className="p-2 sm:p-2 min-w-[40px] min-h-[40px] flex items-center justify-center
                         hover:bg-blue-100 rounded-lg transition-colors touch-manipulation"
              title="Editar"
            >
              <Edit2 className="w-4 h-4 text-blue-600" />
            </button>
            <button
              onClick={() => handleDeleteCategory(category.id)}
              className="p-2 sm:p-2 min-w-[40px] min-h-[40px] flex items-center justify-center
                         hover:bg-red-100 rounded-lg transition-colors touch-manipulation"
              title="Excluir"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </div>

        {/* Renderizar filhos se expandido */}
        {hasChildren && isExpanded && (
          <div className="relative">
            {category.children!.map((child, index) => (
              <div key={child.id} className="relative">
                {/* Linha horizontal de conexão */}
                <div 
                  className="absolute border-t-2 border-gray-200"
                  style={{ 
                    left: `${level * 24 + 28}px`,
                    width: '16px',
                    top: '24px'
                  }}
                />
                {renderCategory(child, level + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const getFilteredCategories = () => {
    let filtered = categories.filter(c => c.level === 1);
    
    if (filterType !== 'all') {
      filtered = filtered.filter(c => c.type === filterType);
    }
    
    return filtered;
  };

  const getRootCategories = () => {
    return categories.filter(c => c.level === 1 && c.type === categoryForm.type);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Carregando categorias...</p>
        </div>
      </div>
    );
  }

  const filteredCategories = getFilteredCategories();
  const totalWithChildren = categories.filter(c => c.children && c.children.length > 0).length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header - Responsivo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center 
                         hover:bg-gray-200 rounded-lg transition-colors touch-manipulation"
              aria-label="Voltar ao dashboard"
            >
              ←
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
                <Tag className="w-6 h-6 sm:w-8 sm:h-8" />
                Categorias
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Organize suas receitas e despesas</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       transition-colors flex items-center justify-center gap-2 min-h-[44px]
                       touch-manipulation w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Nova Categoria
          </button>
        </div>

        {/* Filtros e ações */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            {/* Filtros de tipo */}
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg transition-colors min-h-[44px] whitespace-nowrap touch-manipulation
                  ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilterType('income')}
                className={`px-4 py-2 rounded-lg transition-colors min-h-[44px] whitespace-nowrap touch-manipulation
                  ${filterType === 'income' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Receitas
              </button>
              <button
                onClick={() => setFilterType('expense')}
                className={`px-4 py-2 rounded-lg transition-colors min-h-[44px] whitespace-nowrap touch-manipulation
                  ${filterType === 'expense' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Despesas
              </button>
            </div>
            
            {/* Botão expandir/recolher tudo */}
            {totalWithChildren > 0 && (
              <button
                onClick={toggleAllExpanded}
                className="flex items-center justify-center gap-2 px-4 py-2 min-h-[44px]
                           bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg 
                           transition-colors touch-manipulation"
              >
                <FolderTree className="w-4 h-4" />
                <span className="text-sm">
                  {allExpanded ? 'Recolher Tudo' : 'Expandir Tudo'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Lista de Categorias */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Legenda da hierarquia */}
          {filteredCategories.some(c => c.children && c.children.length > 0) && (
            <div className="p-3 bg-blue-50 border-b border-blue-100 text-sm text-blue-700 flex items-center gap-2">
              <FolderTree className="w-4 h-4" />
              <span>Toque no <ChevronRight className="w-4 h-4 inline" /> para expandir subcategorias</span>
            </div>
          )}
          
          {filteredCategories.length > 0 ? (
            filteredCategories.map((category) => renderCategory(category))
          ) : (
            <div className="text-center py-12">
              <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Nenhuma categoria encontrada</p>
              <p className="text-gray-400 text-sm mt-2">
                {filterType !== 'all' 
                  ? `Não há categorias de ${filterType === 'income' ? 'receita' : 'despesa'}`
                  : 'Crie sua primeira categoria clicando no botão acima'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Criar Categoria */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">Nova Categoria</h2>
              <button 
                onClick={() => setShowCreateModal(false)} 
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center
                           text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg touch-manipulation"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500
                             text-gray-900 placeholder:text-gray-400 min-h-[44px]"
                  placeholder="Ex: Transporte, Alimentação..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                <select
                  required
                  value={categoryForm.type}
                  onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value, parentId: null })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500
                             text-gray-900 bg-white min-h-[44px] cursor-pointer"
                >
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoria Pai (opcional)</label>
                <select
                  value={categoryForm.parentId || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, parentId: e.target.value || null })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500
                             text-gray-900 bg-white min-h-[44px] cursor-pointer"
                >
                  <option value="">Nenhuma (categoria raiz)</option>
                  {getRootCategories().map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Selecione uma categoria pai para criar uma subcategoria
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ícone *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500
                             text-gray-900 text-2xl min-h-[44px] text-center"
                  placeholder="📝"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cor *</label>
                <input
                  type="color"
                  required
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  className="w-full h-12 px-2 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 
                             transition-colors min-h-[44px] touch-manipulation text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                             transition-colors disabled:opacity-50 min-h-[44px] touch-manipulation"
                >
                  {submitting ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Categoria */}
      {showEditModal && editingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">Editar Categoria</h2>
              <button 
                onClick={() => setShowEditModal(false)} 
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center
                           text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg touch-manipulation"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditCategory} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500
                             text-gray-900 placeholder:text-gray-400 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ícone *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500
                             text-gray-900 text-2xl min-h-[44px] text-center"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cor *</label>
                <input
                  type="color"
                  required
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  className="w-full h-12 px-2 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 
                             transition-colors min-h-[44px] touch-manipulation text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                             transition-colors disabled:opacity-50 min-h-[44px] touch-manipulation"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
