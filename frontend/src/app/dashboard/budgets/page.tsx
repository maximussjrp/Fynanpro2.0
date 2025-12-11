'use client';

import { useAuth } from '@/stores/auth';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, TrendingUp, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
}

interface Budget {
  id: string;
  name: string;
  categoryId: string;
  category: Category;
  amount: number;
  period: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  alertAt80: boolean;
  alertAt90: boolean;
  alertAt100: boolean;
  spent: number;
  percentage: number;
  remaining: number;
  status: 'normal' | 'warning' | 'exceeded';
  isCurrentPeriod: boolean;
}

export default function BudgetsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth() + 1 + '');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear() + '');
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    amount: '',
    period: 'monthly',
    alertAt80: true,
    alertAt90: true,
    alertAt100: true
  });

  useEffect(() => {
    loadBudgets();
    loadCategories();
  }, [selectedMonth, selectedYear]);

  const loadBudgets = async () => {
    try {
      const token = accessToken;
      const url = `http://localhost:3000/api/v1/budgets?month=${selectedMonth}&year=${selectedYear}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setBudgets(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar orçamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const token = accessToken;
      const response = await fetch('http://localhost:3000/api/v1/categories?type=expense&isActive=true', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      console.log('Resposta completa da API:', data);
      if (data.success && data.data.categories) {
        console.log('Categorias encontradas:', data.data.categories);
        setCategories(data.data.categories);
      } else {
        console.error('Formato inesperado de resposta:', data);
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = accessToken;
      const url = editingBudget
        ? `http://localhost:3000/api/v1/budgets/${editingBudget.id}`
        : 'http://localhost:3000/api/v1/budgets';
      
      const response = await fetch(url, {
        method: editingBudget ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount)
        })
      });

      const data = await response.json();
      if (data.success) {
        loadBudgets();
        closeModal();
      } else {
        alert(data.error?.message || 'Erro ao salvar orçamento');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar orçamento');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente deletar este orçamento?')) return;
    
    try {
      const token = accessToken;
      const response = await fetch(`http://localhost:3000/api/v1/budgets/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        loadBudgets();
      } else {
        alert(data.error?.message || 'Erro ao deletar');
      }
    } catch (error) {
      console.error('Erro ao deletar:', error);
      alert('Erro ao deletar orçamento');
    }
  };

  const openCreateModal = () => {
    setEditingBudget(null);
    setFormData({
      name: '',
      categoryId: '',
      amount: '',
      period: 'monthly',
      alertAt80: true,
      alertAt90: true,
      alertAt100: true
    });
    setShowModal(true);
  };

  const openEditModal = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      name: budget.name,
      categoryId: budget.categoryId,
      amount: budget.amount.toString(),
      period: budget.period,
      alertAt80: budget.alertAt80,
      alertAt90: budget.alertAt90,
      alertAt100: budget.alertAt100
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBudget(null);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 90) return 'bg-orange-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'exceeded') return <AlertTriangle className="w-5 h-5 text-red-500" />;
    if (status === 'warning') return <TrendingUp className="w-5 h-5 text-yellow-500" />;
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Voltar ao Dashboard"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📊 Orçamentos</h1>
            <p className="text-gray-600 mt-1">Controle seus gastos por categoria</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition"
        >
          <PlusCircle className="w-5 h-5" />
          Novo Orçamento
        </button>
      </div>

      {/* Filtros de Período */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filtrar por período:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="1">Janeiro</option>
            <option value="2">Fevereiro</option>
            <option value="3">Março</option>
            <option value="4">Abril</option>
            <option value="5">Maio</option>
            <option value="6">Junho</option>
            <option value="7">Julho</option>
            <option value="8">Agosto</option>
            <option value="9">Setembro</option>
            <option value="10">Outubro</option>
            <option value="11">Novembro</option>
            <option value="12">Dezembro</option>
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setSelectedMonth(new Date().getMonth() + 1 + '');
              setSelectedYear(new Date().getFullYear() + '');
            }}
            className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
          >
            Mês Atual
          </button>
        </div>
      </div>

      {budgets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-lg">Nenhum orçamento cadastrado</p>
          <button
            onClick={openCreateModal}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            Criar primeiro orçamento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((budget) => (
            <div
              key={budget.id}
              className={`bg-white rounded-xl shadow-lg p-6 border-2 ${
                budget.status === 'exceeded'
                  ? 'border-red-300'
                  : budget.status === 'warning'
                  ? 'border-yellow-300'
                  : 'border-green-300'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                    style={{ backgroundColor: budget.category.color + '20' }}
                  >
                    {budget.category.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{budget.name}</h3>
                    <p className="text-sm text-gray-500">{budget.category.name}</p>
                  </div>
                </div>
                {getStatusIcon(budget.status)}
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Orçado</span>
                  <span className="font-semibold">
                    R$ {budget.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Gasto</span>
                  <span className={budget.percentage >= 100 ? 'text-red-600 font-bold' : 'font-semibold'}>
                    R$ {budget.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-gray-600">Restante</span>
                  <span className={budget.remaining < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-semibold'}>
                    R$ {Math.abs(budget.remaining).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    {budget.remaining < 0 && ' (excedido)'}
                  </span>
                </div>

                <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${getProgressColor(budget.percentage)}`}
                    style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                  />
                </div>
                <div className="text-center mt-2">
                  <span className={`text-lg font-bold ${
                    budget.percentage >= 100 ? 'text-red-600' : 
                    budget.percentage >= 90 ? 'text-orange-600' : 
                    'text-green-600'
                  }`}>
                    {budget.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => openEditModal(budget)}
                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg font-medium transition"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(budget.id)}
                  className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 py-2 rounded-lg font-medium transition"
                >
                  Deletar
                </button>
              </div>

              {!budget.isCurrentPeriod && (
                <div className="mt-2 text-center text-sm text-gray-500">
                  Período encerrado
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Orçamento
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Alimentação Mensal"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={!!editingBudget}
                >
                  <option value="">Selecione uma categoria</option>
                  {Array.isArray(categories) && categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor do Orçamento (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Período
                </label>
                <select
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="monthly">Mensal (Renova todo mês)</option>
                  <option value="quarterly">Trimestral (Renova a cada 3 meses)</option>
                  <option value="semester">Semestral (Renova a cada 6 meses)</option>
                  <option value="annual">Anual (Renova todo ano)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  O orçamento será renovado automaticamente conforme o período selecionado
                </p>
              </div>

              <div className="space-y-2 border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alertas
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.alertAt80}
                    onChange={(e) => setFormData({ ...formData, alertAt80: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Alertar ao atingir 80%</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.alertAt90}
                    onChange={(e) => setFormData({ ...formData, alertAt90: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Alertar ao atingir 90%</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.alertAt100}
                    onChange={(e) => setFormData({ ...formData, alertAt100: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Alertar ao atingir 100%</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition"
                >
                  {editingBudget ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
