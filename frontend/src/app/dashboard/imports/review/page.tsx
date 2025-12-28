'use client';

/**
 * FASE 2.4: Import Review Page
 * 
 * Tela de revisão pós-import para:
 * - Verificar transferências detectadas
 * - Revisar pagamentos de fatura
 * - Marcar/desmarcar exclusões de energia
 * - Ações em lote
 */

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/stores/auth';
import { 
  ArrowLeft, RefreshCw, Check, X, AlertTriangle, 
  ArrowLeftRight, CreditCard, Filter, CheckSquare,
  Square, Zap, ZapOff, Tag, Loader2, ChevronDown
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// ==================== TYPES ====================

interface ReviewItem {
  transactionId: string;
  date: string;
  amount: number;
  rawDescription: string;
  normalizedDescription: string;
  accountId: string;
  categoryId?: string;
  categoryName?: string;
  flags: {
    isTransfer: boolean;
    transactionKind: string;
    excludedFromEnergy: boolean;
  };
  suggestions: {
    suggestedAction: string;
    confidence: number;
    reason: string;
  };
}

interface ReviewSummary {
  created: number;
  deduped: number;
  transferPairs: number;
  invoicePayments: number;
  excludedFromEnergy: number;
  needsReview: number;
}

interface Category {
  id: string;
  name: string;
  type: string;
  level: number;
}

// ==================== COMPONENT ====================

export default function ReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get('batchId');
  const { accessToken } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [filter, setFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  
  // ==================== DATA LOADING ====================
  
  useEffect(() => {
    if (batchId && accessToken) {
      loadReviewData();
      loadCategories();
    }
  }, [batchId, accessToken, filter]);
  
  const loadReviewData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${API_URL}/import/review/${batchId}?filter=${filter}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      
      if (!response.ok) throw new Error('Erro ao carregar dados');
      
      const data = await response.json();
      setSummary(data.summary);
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const loadCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/import/categories`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    }
  };
  
  // ==================== SELECTION ====================
  
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };
  
  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.transactionId)));
    }
  };
  
  // ==================== BATCH ACTIONS ====================
  
  const applyAction = async (action: string, payload?: any) => {
    if (selectedIds.size === 0) {
      setError('Selecione pelo menos uma transação');
      return;
    }
    
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch(`${API_URL}/import/review/${batchId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transactionIds: Array.from(selectedIds),
          action,
          payload
        })
      });
      
      if (!response.ok) throw new Error('Erro ao aplicar ação');
      
      const data = await response.json();
      setSuccess(`${data.updated} transações atualizadas`);
      setSelectedIds(new Set());
      
      // Reload data
      await loadReviewData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleMarkTransfer = () => applyAction('mark_transfer');
  const handleUnmarkTransfer = () => applyAction('unmark_transfer');
  const handleMarkInvoice = () => applyAction('mark_invoice_payment');
  const handleToggleExcluded = () => applyAction('toggle_excluded');
  
  const handleSetCategory = () => {
    if (!selectedCategoryId) {
      setError('Selecione uma categoria');
      return;
    }
    applyAction('set_category', { categoryId: selectedCategoryId });
    setShowCategoryModal(false);
    setSelectedCategoryId('');
  };
  
  // ==================== RENDER HELPERS ====================
  
  const formatAmount = (amount: number) => {
    const formatted = Math.abs(amount).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
    return amount < 0 ? `-${formatted}` : formatted;
  };
  
  const getKindBadge = (kind: string) => {
    switch (kind) {
      case 'transfer':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
            <ArrowLeftRight className="w-3 h-3" />
            Transferência
          </span>
        );
      case 'invoice_payment':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
            <CreditCard className="w-3 h-3" />
            Pag. Fatura
          </span>
        );
      case 'fee':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
            <AlertTriangle className="w-3 h-3" />
            Taxa/Juros
          </span>
        );
      default:
        return null;
    }
  };
  
  // ==================== RENDER ====================
  
  if (!batchId) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400">Nenhum lote de importação selecionado.</p>
          <button
            onClick={() => router.push('/dashboard/imports')}
            className="mt-4 text-purple-400 hover:underline"
          >
            ← Voltar para Importações
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/imports')}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Revisão de Importação</h1>
            <p className="text-zinc-400 text-sm">Lote: {batchId.slice(0, 8)}...</p>
          </div>
        </div>
        
        <button
          onClick={loadReviewData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>
      
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Total</p>
            <p className="text-2xl font-bold">{summary.created}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Transferências</p>
            <p className="text-2xl font-bold text-blue-400">{summary.transferPairs * 2}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Pag. Fatura</p>
            <p className="text-2xl font-bold text-purple-400">{summary.invoicePayments}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Excluídos Energia</p>
            <p className="text-2xl font-bold text-orange-400">{summary.excludedFromEnergy}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Para Revisar</p>
            <p className="text-2xl font-bold text-yellow-400">{summary.needsReview}</p>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400" />
          <span className="text-zinc-400 text-sm">Filtrar:</span>
        </div>
        {['all', 'needs_review', 'transfers', 'invoice_payments', 'fees'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f 
                ? 'bg-purple-500 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {f === 'all' && 'Todos'}
            {f === 'needs_review' && 'Para Revisar'}
            {f === 'transfers' && 'Transferências'}
            {f === 'invoice_payments' && 'Pag. Fatura'}
            {f === 'fees' && 'Taxas'}
          </button>
        ))}
      </div>
      
      {/* Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
          <p className="text-green-400">{success}</p>
        </div>
      )}
      
      {/* Batch Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-purple-400">
              {selectedIds.size} transação(ões) selecionada(s)
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleMarkTransfer}
                disabled={actionLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 text-sm"
              >
                <ArrowLeftRight className="w-4 h-4" />
                Marcar Transferência
              </button>
              <button
                onClick={handleUnmarkTransfer}
                disabled={actionLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 text-sm"
              >
                <X className="w-4 h-4" />
                Desmarcar
              </button>
              <button
                onClick={handleMarkInvoice}
                disabled={actionLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 text-sm"
              >
                <CreditCard className="w-4 h-4" />
                Pag. Fatura
              </button>
              <button
                onClick={handleToggleExcluded}
                disabled={actionLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 text-sm"
              >
                <ZapOff className="w-4 h-4" />
                Toggle Energia
              </button>
              <button
                onClick={() => setShowCategoryModal(true)}
                disabled={actionLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 text-sm"
              >
                <Tag className="w-4 h-4" />
                Categorizar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400">Nenhuma transação encontrada para este filtro.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="p-4 text-left">
                  <button 
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-zinc-800 rounded"
                  >
                    {selectedIds.size === items.length ? (
                      <CheckSquare className="w-5 h-5 text-purple-500" />
                    ) : (
                      <Square className="w-5 h-5 text-zinc-500" />
                    )}
                  </button>
                </th>
                <th className="p-4 text-left text-sm font-medium text-zinc-400">Data</th>
                <th className="p-4 text-left text-sm font-medium text-zinc-400">Descrição</th>
                <th className="p-4 text-right text-sm font-medium text-zinc-400">Valor</th>
                <th className="p-4 text-left text-sm font-medium text-zinc-400">Tipo</th>
                <th className="p-4 text-left text-sm font-medium text-zinc-400">Categoria</th>
                <th className="p-4 text-center text-sm font-medium text-zinc-400">Energia</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr 
                  key={item.transactionId}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                    selectedIds.has(item.transactionId) ? 'bg-purple-500/10' : ''
                  }`}
                >
                  <td className="p-4">
                    <button 
                      onClick={() => toggleSelect(item.transactionId)}
                      className="p-1 hover:bg-zinc-800 rounded"
                    >
                      {selectedIds.has(item.transactionId) ? (
                        <CheckSquare className="w-5 h-5 text-purple-500" />
                      ) : (
                        <Square className="w-5 h-5 text-zinc-500" />
                      )}
                    </button>
                  </td>
                  <td className="p-4 text-sm">{item.date}</td>
                  <td className="p-4">
                    <p className="text-sm font-medium truncate max-w-xs" title={item.rawDescription}>
                      {item.rawDescription}
                    </p>
                    {item.suggestions.suggestedAction !== 'none' && (
                      <p className="text-xs text-yellow-400 mt-1">
                        💡 {item.suggestions.reason.slice(0, 50)}...
                      </p>
                    )}
                  </td>
                  <td className={`p-4 text-sm text-right font-medium ${
                    item.amount < 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {formatAmount(item.amount)}
                  </td>
                  <td className="p-4">
                    {getKindBadge(item.flags.transactionKind)}
                  </td>
                  <td className="p-4 text-sm text-zinc-400">
                    {item.categoryName || '-'}
                  </td>
                  <td className="p-4 text-center">
                    {item.flags.excludedFromEnergy ? (
                      <span title="Excluído da energia">
                        <ZapOff className="w-5 h-5 text-zinc-500 mx-auto" />
                      </span>
                    ) : (
                      <span title="Incluído na energia">
                        <Zap className="w-5 h-5 text-yellow-500 mx-auto" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Selecionar Categoria</h3>
            
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white mb-4"
            >
              <option value="">Selecione uma categoria...</option>
              {categories
                .filter(c => c.level >= 2)
                .map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))
              }
            </select>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setSelectedCategoryId('');
                }}
                className="px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSetCategory}
                disabled={!selectedCategoryId || actionLoading}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Aplicar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
