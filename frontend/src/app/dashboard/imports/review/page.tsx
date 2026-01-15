'use client';

/**
 * FASE 2.4.1: Import Review Page - Enhanced
 * 
 * Melhorias:
 * - Ordenação por impacto (valor absoluto) e confidence
 * - Motivo humanizado com tooltip técnico
 * - Botão "Aplicar Sugestão" 1-clique por item
 * - Ações em lote inteligentes (≥85%, taxas, transferências)
 * - KPIs dinâmicos (pendências, R$ pendente)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/stores/auth';
import { 
  ArrowLeft, RefreshCw, Check, X, AlertTriangle, 
  ArrowLeftRight, CreditCard, Filter, CheckSquare,
  Square, Zap, ZapOff, Tag, Loader2, ChevronDown,
  Sparkles, TrendingDown, CheckCircle2, Info, Clock
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// ==================== TYPES ====================

interface ReviewItem {
  transactionId: string;
  date: string;
  amount: number;
  absAmount: number;
  rawDescription: string;
  normalizedDescription: string;
  accountId: string;
  categoryId?: string;
  categoryName?: string;
  needsReview: boolean;
  flags: {
    isTransfer: boolean;
    transactionKind: string;
    excludedFromEnergy: boolean;
  };
  suggestions: {
    suggestedAction: string;
    confidence: number;
    reason: string;
    reasonHumanized: string;
  };
}

interface ReviewSummary {
  created: number;
  deduped: number;
  transferPairs: number;
  invoicePayments: number;
  excludedFromEnergy: number;
  needsReview: number;
  pendingAmount: number;
  resolvedAmount: number;
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
  const [singleActionLoading, setSingleActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [filter, setFilter] = useState<string>('needs_review');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  
  // Track resolved count for UX feedback
  const [resolvedInSession, setResolvedInSession] = useState(0);
  
  // ==================== DATA LOADING ====================
  
  const loadReviewData = useCallback(async () => {
    if (!batchId || !accessToken) return;
    
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
  }, [batchId, accessToken, filter]);
  
  const loadCategories = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      const response = await fetch(`${API_URL}/import/categories`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    }
  }, [accessToken]);
  
  useEffect(() => {
    loadReviewData();
    loadCategories();
  }, [loadReviewData, loadCategories]);
  
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
  
  // ==================== SINGLE ITEM ACTIONS ====================
  
  const applySingleSuggestion = async (transactionId: string) => {
    setSingleActionLoading(transactionId);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/import/review/${batchId}/apply-single`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transactionId })
      });
      
      if (!response.ok) throw new Error('Erro ao aplicar sugestão');
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        setResolvedInSession(prev => prev + 1);
        await loadReviewData();
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSingleActionLoading(null);
    }
  };
  
  const dismissSingle = async (transactionId: string) => {
    setSingleActionLoading(transactionId);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/import/review/${batchId}/dismiss`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transactionIds: [transactionId] })
      });
      
      if (!response.ok) throw new Error('Erro ao ignorar item');
      
      setSuccess('Item ignorado');
      setResolvedInSession(prev => prev + 1);
      await loadReviewData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSingleActionLoading(null);
    }
  };
  
  // ==================== BULK ACTIONS ====================
  
  const applyBulkSuggestions = async (criteria: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    setShowBulkMenu(false);
    
    try {
      const response = await fetch(`${API_URL}/import/review/${batchId}/apply-suggestions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ criteria, minConfidence: 0.85 })
      });
      
      if (!response.ok) throw new Error('Erro ao aplicar sugestões');
      
      const data = await response.json();
      setSuccess(`${data.updated} transações atualizadas!`);
      setResolvedInSession(prev => prev + data.updated);
      setSelectedIds(new Set());
      
      await loadReviewData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };
  
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
      setResolvedInSession(prev => prev + data.updated);
      setSelectedIds(new Set());
      
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
  
  const handleDismissSelected = async () => {
    if (selectedIds.size === 0) {
      setError('Selecione pelo menos uma transação');
      return;
    }
    
    setActionLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/import/review/${batchId}/dismiss`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transactionIds: Array.from(selectedIds) })
      });
      
      if (!response.ok) throw new Error('Erro ao ignorar itens');
      
      const data = await response.json();
      setSuccess(data.message);
      setResolvedInSession(prev => prev + data.updated);
      setSelectedIds(new Set());
      
      await loadReviewData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
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
            <TrendingDown className="w-3 h-3" />
            Taxa/Juros
          </span>
        );
      default:
        return null;
    }
  };
  
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'mark_transfer':
        return <span className="text-blue-400">→ Transferência</span>;
      case 'mark_invoice_payment':
        return <span className="text-purple-400">→ Pag. Fatura</span>;
      case 'mark_loss':
        return <span className="text-red-400">→ Taxa/Prejuízo</span>;
      default:
        return null;
    }
  };
  
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) {
      return <span className="text-green-400 text-xs">●●● Alta</span>;
    } else if (confidence >= 0.5) {
      return <span className="text-yellow-400 text-xs">●●○ Média</span>;
    } else {
      return <span className="text-red-400 text-xs">●○○ Baixa</span>;
    }
  };
  
  // ==================== COMPLETION CHECK ====================
  
  const isCompleted = summary && summary.needsReview === 0;
  const progressPercent = summary 
    ? Math.round(((summary.created - summary.needsReview) / summary.created) * 100) 
    : 0;
  
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
      
      {/* KPI Cards - Enhanced */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Total</p>
            <p className="text-2xl font-bold">{summary.created}</p>
          </div>
          <div className={`bg-zinc-900 border rounded-xl p-4 ${
            summary.needsReview === 0 
              ? 'border-green-500/50 bg-green-500/5' 
              : 'border-yellow-500/50 bg-yellow-500/5'
          }`}>
            <p className="text-zinc-400 text-sm flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Pendências
            </p>
            <p className={`text-2xl font-bold ${
              summary.needsReview === 0 ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {summary.needsReview}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">R$ Pendente</p>
            <p className="text-xl font-bold text-yellow-400">
              {formatAmount(summary.pendingAmount)}
            </p>
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
            <p className="text-zinc-400 text-sm">Progresso</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-green-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-sm font-bold">{progressPercent}%</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Completion Banner */}
      {isCompleted && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 mb-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-green-400 mb-2">✅ Revisão Concluída!</h2>
          <p className="text-zinc-300 mb-4">
            Todas as pendências foram resolvidas. Você liberou {formatAmount(summary?.resolvedAmount || 0)} em qualidade de dados.
          </p>
          <button
            onClick={() => router.push('/dashboard/energy')}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Ver Relatório de Energia
          </button>
        </div>
      )}
      
      {/* Session Progress Feedback */}
      {resolvedInSession > 0 && !isCompleted && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 mb-4">
          <p className="text-purple-400 text-sm">
            ⚡ Nesta sessão: <strong>{resolvedInSession}</strong> itens resolvidos
          </p>
        </div>
      )}
      
      {/* Bulk Actions - Smart */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setShowBulkMenu(!showBulkMenu)}
            disabled={actionLoading || (summary?.needsReview === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            Ações Rápidas
            <ChevronDown className="w-4 h-4" />
          </button>
          
          {showBulkMenu && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
              <button
                onClick={() => applyBulkSuggestions('high_confidence')}
                className="w-full px-4 py-3 text-left hover:bg-zinc-800 transition-colors flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="font-medium">Aplicar ≥85%</p>
                  <p className="text-xs text-zinc-400">Alta confiança apenas</p>
                </div>
              </button>
              <button
                onClick={() => applyBulkSuggestions('all_transfers')}
                className="w-full px-4 py-3 text-left hover:bg-zinc-800 transition-colors flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">Todas Transferências</p>
                  <p className="text-xs text-zinc-400">Marcar + excluir energia</p>
                </div>
              </button>
              <button
                onClick={() => applyBulkSuggestions('all_fees')}
                className="w-full px-4 py-3 text-left hover:bg-zinc-800 transition-colors flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="font-medium">Todas Taxas/Juros</p>
                  <p className="text-xs text-zinc-400">Marcar como prejuízo</p>
                </div>
              </button>
              <button
                onClick={() => applyBulkSuggestions('all_invoice_payments')}
                className="w-full px-4 py-3 text-left hover:bg-zinc-800 transition-colors flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium">Pag. de Fatura</p>
                  <p className="text-xs text-zinc-400">Marcar + excluir energia</p>
                </div>
              </button>
              <button
                onClick={() => applyBulkSuggestions('apply_all')}
                className="w-full px-4 py-3 text-left hover:bg-zinc-800 transition-colors flex items-center gap-3 border-t border-zinc-700"
              >
                <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                  <p className="font-medium">Aplicar Tudo</p>
                  <p className="text-xs text-zinc-400">Todas as sugestões</p>
                </div>
              </button>
            </div>
          )}
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2 ml-auto">
          <Filter className="w-4 h-4 text-zinc-400" />
          {['needs_review', 'all', 'transfers', 'invoice_payments', 'fees'].map(f => (
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
              {f === 'needs_review' && `Pendentes (${summary?.needsReview || 0})`}
              {f === 'transfers' && 'Transferências'}
              {f === 'invoice_payments' && 'Pag. Fatura'}
              {f === 'fees' && 'Taxas'}
            </button>
          ))}
        </div>
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
      
      {/* Batch Actions for Selection */}
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
                Transferência
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
              <button
                onClick={handleDismissSelected}
                disabled={actionLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 text-sm"
              >
                <X className="w-4 h-4" />
                Ignorar
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
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-zinc-400">Nenhuma transação pendente para este filtro.</p>
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
                <th className="p-4 text-left text-sm font-medium text-zinc-400">Tipo/Sugestão</th>
                <th className="p-4 text-center text-sm font-medium text-zinc-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr 
                  key={item.transactionId}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                    selectedIds.has(item.transactionId) ? 'bg-purple-500/10' : ''
                  } ${item.needsReview ? 'bg-yellow-500/5' : ''}`}
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
                    {item.needsReview && item.suggestions.suggestedAction !== 'none' && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-yellow-400" title={item.suggestions.reason}>
                          💡 {item.suggestions.reasonHumanized}
                        </span>
                        {getConfidenceBadge(item.suggestions.confidence)}
                      </div>
                    )}
                  </td>
                  <td className={`p-4 text-sm text-right font-medium ${
                    item.amount < 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {formatAmount(item.amount)}
                  </td>
                  <td className="p-4">
                    {item.flags.transactionKind !== 'bank' && item.flags.transactionKind !== 'unknown' ? (
                      getKindBadge(item.flags.transactionKind)
                    ) : item.needsReview && item.suggestions.suggestedAction !== 'none' ? (
                      <div className="flex items-center gap-2">
                        {getActionBadge(item.suggestions.suggestedAction)}
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-sm">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1">
                      {item.needsReview && item.suggestions.suggestedAction !== 'none' && (
                        <button
                          onClick={() => applySingleSuggestion(item.transactionId)}
                          disabled={singleActionLoading === item.transactionId}
                          className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 text-xs font-medium"
                          title="Aplicar sugestão"
                        >
                          {singleActionLoading === item.transactionId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3 h-3" />
                              Aplicar
                            </>
                          )}
                        </button>
                      )}
                      {item.needsReview && (
                        <button
                          onClick={() => dismissSingle(item.transactionId)}
                          disabled={singleActionLoading === item.transactionId}
                          className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded"
                          title="Ignorar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      {item.flags.excludedFromEnergy ? (
                        <span title="Excluído da energia" className="p-1">
                          <ZapOff className="w-4 h-4 text-zinc-500" />
                        </span>
                      ) : (
                        <span title="Incluído na energia" className="p-1">
                          <Zap className="w-4 h-4 text-yellow-500" />
                        </span>
                      )}
                    </div>
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
      
      {/* Click outside to close bulk menu */}
      {showBulkMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowBulkMenu(false)}
        />
      )}
    </div>
  );
}
