'use client';

import { useAuth } from '@/stores/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Upload, FileText, CheckCircle, AlertCircle, 
  Download, Loader2, X, Edit2, Check, ChevronDown, History,
  Trash2, RefreshCw, Info, FileSpreadsheet, File
} from 'lucide-react';

// ==================== TIPOS ====================

interface ImportedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
  categoryId?: string;
  categoryName?: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
  isSelected?: boolean;
}

interface ImportPreview {
  id: string;
  fileName: string;
  fileType: 'csv' | 'ofx' | 'xml';
  totalTransactions: number;
  totalIncome: number;
  totalExpense: number;
  duplicates: number;
  transactions: ImportedTransaction[];
  columnMapping?: {
    date: number | string;
    description: number | string;
    amount: number | string;
  };
}

interface BankAccount {
  id: string;
  name: string;
  institution?: string;
  type: string;
  currentBalance: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  lastFourDigits?: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon?: string;
  level: number;
  parentId?: string;
}

interface ImportHistoryItem {
  id: string;
  fileName: string;
  fileType: string;
  bankAccountName?: string;
  totalImported: number;
  totalSkipped: number;
  totalDuplicates: number;
  status: string;
  createdAt: string;
}

// ==================== COMPONENTE PRINCIPAL ====================

export default function ImportsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados principais
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'result'>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Dados do arquivo
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  // Preview
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
  
  // Configurações
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Histórico
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  
  // Edição
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string>('');
  
  // Resultado
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    duplicates: number;
    errors: string[];
  } | null>(null);

  // ==================== EFEITOS ====================

  useEffect(() => {
    if (accessToken) {
      loadBankAccounts();
      loadPaymentMethods();
      loadCategories();
    }
  }, [accessToken]);

  // ==================== FUNÇÕES DE CARREGAMENTO ====================

  const loadBankAccounts = async () => {
    try {
      const response = await fetch(`${API_URL}/import/accounts`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await response.json();
      setBankAccounts(data.accounts || []);
      // NÃO auto-selecionar - usuário deve escolher manualmente
    } catch (err) {
      console.error('Erro ao carregar contas:', err);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const response = await fetch(`${API_URL}/payment-methods`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await response.json();
      setPaymentMethods(data.data?.methods || []);
    } catch (err) {
      console.error('Erro ao carregar meios de pagamento:', err);
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

  const loadHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/import/history`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    }
  };

  // ==================== DRAG & DROP ====================

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.ofx') && !name.endsWith('.xml') && !name.endsWith('.txt')) {
      setError('Formato não suportado. Use arquivos CSV, OFX ou XML.');
      return;
    }
    
    setFileName(file.name);
    setError(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
    };
    reader.readAsText(file, 'UTF-8');
  };

  // ==================== UPLOAD E PREVIEW ====================

  const handleUpload = async () => {
    if (!fileContent || !fileName) {
      setError('Selecione um arquivo primeiro');
      return;
    }

    if (!selectedAccountId) {
      setError('Selecione uma conta bancária de destino');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      const blob = new Blob([fileContent], { type: 'text/plain' });
      formData.append('file', blob, fileName);

      const response = await fetch(`${API_URL}/import/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (data.success && data.preview) {
        setPreview(data.preview);
        setTransactions(data.preview.transactions || []);
        setStep('preview');
      } else {
        setError(data.error || 'Erro ao processar arquivo');
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  // ==================== EDIÇÃO DE TRANSAÇÕES ====================

  const toggleTransaction = (id: string) => {
    setTransactions(prev => 
      prev.map(t => 
        t.id === id ? { ...t, isSelected: !t.isSelected } : t
      )
    );
  };

  const toggleAllTransactions = (selected: boolean) => {
    setTransactions(prev => 
      prev.map(t => ({ ...t, isSelected: selected && !t.isDuplicate }))
    );
  };

  const startEditCategory = (tx: ImportedTransaction) => {
    setEditingId(tx.id);
    setEditingCategoryId(tx.categoryId || '');
  };

  const saveCategory = (id: string) => {
    const category = categories.find(c => c.id === editingCategoryId);
    setTransactions(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, categoryId: editingCategoryId, categoryName: category?.name }
          : t
      )
    );
    setEditingId(null);
  };

  // ==================== CONFIRMAR IMPORTAÇÃO ====================

  const handleConfirm = async () => {
    if (!selectedAccountId) {
      setError('Selecione uma conta bancária');
      return;
    }

    if (!preview) {
      setError('Nenhum preview disponível');
      return;
    }

    const selectedCount = transactions.filter(t => t.isSelected).length;
    if (selectedCount === 0) {
      setError('Selecione pelo menos uma transação para importar');
      return;
    }

    setLoading(true);
    setError(null);
    setStep('processing');

    try {
      const response = await fetch(`${API_URL}/import/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          previewId: preview.id,
          bankAccountId: selectedAccountId,
          paymentMethodId: selectedPaymentMethodId || undefined,
          transactions: transactions,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setResult({
          imported: data.imported,
          skipped: data.skipped,
          duplicates: data.duplicates,
          errors: data.errors || [],
        });
        setStep('result');
      } else {
        setError(data.error || 'Erro ao importar');
        setStep('preview');
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  // ==================== DESFAZER IMPORTAÇÃO ====================

  const handleUndo = async (id: string) => {
    if (!confirm('Deseja realmente desfazer esta importação? As transações serão removidas.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/import/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccessMessage(`${data.deleted} transações removidas com sucesso!`);
        loadHistory();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'Erro ao desfazer importação');
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão');
    }
  };

  // ==================== RESET ====================

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setFileContent('');
    setPreview(null);
    setTransactions([]);
    setResult(null);
    setError(null);
    setSuccessMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ==================== FORMATAÇÃO ====================

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('pt-BR');
  };

  // ==================== RENDERIZAÇÃO ====================

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-gray-800 rounded-lg transition"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">📥 Importar Extrato</h1>
            <p className="text-gray-400 text-sm">
              Importe transações de arquivos CSV, OFX ou XML do seu banco
            </p>
          </div>
        </div>
        
        <button
          onClick={() => {
            setShowHistory(!showHistory);
            if (!showHistory) loadHistory();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
        >
          <History size={20} />
          Histórico
        </button>
      </div>

      {/* Mensagens */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg flex items-center gap-3">
          <AlertCircle className="text-red-400" size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={20} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-900/50 border border-green-500 rounded-lg flex items-center gap-3">
          <CheckCircle className="text-green-400" size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Histórico */}
      {showHistory && (
        <div className="mb-6 bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <History size={20} />
            Histórico de Importações
          </h2>
          
          {history.length === 0 ? (
            <p className="text-gray-400">Nenhuma importação realizada ainda.</p>
          ) : (
            <div className="space-y-3">
              {history.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-600 rounded-lg">
                      {item.fileType === 'ofx' ? (
                        <File size={20} className="text-blue-400" />
                      ) : (
                        <FileSpreadsheet size={20} className="text-green-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{item.fileName}</p>
                      <p className="text-sm text-gray-400">
                        {item.bankAccountName} • {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm">
                        <span className="text-green-400">{item.totalImported}</span> importadas
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.totalSkipped} ignoradas • {item.totalDuplicates} duplicadas
                      </p>
                    </div>
                    
                    {item.status !== 'undone' && (
                      <button
                        onClick={() => handleUndo(item.id)}
                        className="p-2 text-red-400 hover:bg-red-900/50 rounded-lg transition"
                        title="Desfazer importação"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    
                    {item.status === 'undone' && (
                      <span className="text-xs text-gray-500 px-2 py-1 bg-gray-600 rounded">
                        Desfeita
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="bg-gray-800 rounded-xl p-6">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Área de Drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition
                ${isDragging
                  ? 'border-emerald-500 bg-emerald-900/20'
                  : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/50'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.ofx,.xml,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <Upload
                size={48}
                className={`mx-auto mb-4 ${isDragging ? 'text-emerald-400' : 'text-gray-400'}`}
              />
              
              {fileName ? (
                <div>
                  <p className="text-lg font-medium text-emerald-400 mb-2">
                    📄 {fileName}
                  </p>
                  <p className="text-sm text-gray-400">
                    Clique para trocar o arquivo
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium mb-2">
                    Arraste um arquivo aqui ou clique para selecionar
                  </p>
                  <p className="text-sm text-gray-400">
                    Formatos suportados: CSV, OFX, XML
                  </p>
                </div>
              )}
            </div>

            {/* Seleção de Conta - OBRIGATÓRIA */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Conta Bancária de Destino <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className={`w-full p-3 bg-gray-700 border rounded-lg focus:ring-1 ${
                  !selectedAccountId && fileName
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-600 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
              >
                <option value="">Selecione uma conta...</option>
                {bankAccounts.length === 0 ? (
                  <option value="" disabled>Carregando contas...</option>
                ) : (
                  bankAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} {account.institution ? `(${account.institution})` : ''} - {formatCurrency(Number(account.currentBalance))}
                    </option>
                  ))
                )}
              </select>
              {!selectedAccountId && fileName && (
                <p className="text-red-400 text-sm mt-1">⚠️ Selecione uma conta bancária para continuar</p>
              )}
            </div>

            {/* Seleção de Meio de Pagamento - OPCIONAL */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Meio de Pagamento <span className="text-gray-400 text-xs">(opcional)</span>
              </label>
              <select
                value={selectedPaymentMethodId}
                onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-1 focus:border-emerald-500 focus:ring-emerald-500"
              >
                <option value="">Selecione (opcional)</option>
                {paymentMethods.map(method => (
                  <option key={method.id} value={method.id}>
                    {method.name} {method.lastFourDigits ? `(****${method.lastFourDigits})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-gray-400 text-xs mt-1">
                Todas as transações importadas usarão este meio de pagamento
              </p>
            </div>

            {/* Dicas */}
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info size={20} className="text-blue-400 mt-0.5" />
                <div className="text-sm text-gray-300">
                  <p className="font-medium text-blue-400 mb-2">Dicas para importação:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Arquivos CSV devem ter colunas de data, descrição e valor</li>
                    <li>Arquivos OFX são automaticamente processados</li>
                    <li>Transações duplicadas são detectadas automaticamente</li>
                    <li>Categorias são sugeridas com base no histórico</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Botão de Enviar */}
            <button
              onClick={handleUpload}
              disabled={!fileName || !selectedAccountId || loading}
              className={`
                w-full py-4 rounded-lg font-medium text-lg flex items-center justify-center gap-3 transition
                ${(!fileName || !selectedAccountId || loading)
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }
              `}
            >
              {loading ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload size={24} />
                  Processar Arquivo
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && preview && (
          <div className="space-y-6">
            {/* Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-400">Total</p>
                <p className="text-2xl font-bold">{preview.totalTransactions}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-400">Receitas</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatCurrency(preview.totalIncome)}
                </p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-400">Despesas</p>
                <p className="text-2xl font-bold text-red-400">
                  {formatCurrency(preview.totalExpense)}
                </p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-400">Duplicadas</p>
                <p className="text-2xl font-bold text-yellow-400">{preview.duplicates}</p>
              </div>
            </div>

            {/* Ações em massa */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => toggleAllTransactions(true)}
                  className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                >
                  Selecionar Todas
                </button>
                <button
                  onClick={() => toggleAllTransactions(false)}
                  className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                >
                  Desmarcar Todas
                </button>
                <span className="text-sm text-gray-400">
                  {transactions.filter(t => t.isSelected).length} de {transactions.length} selecionadas
                </span>
              </div>
            </div>

            {/* Tabela de Transações */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="p-3 text-left">Sel.</th>
                    <th className="p-3 text-left">Data</th>
                    <th className="p-3 text-left">Descrição</th>
                    <th className="p-3 text-left">Categoria</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`
                        border-b border-gray-700 transition
                        ${tx.isDuplicate ? 'bg-yellow-900/20' : 'hover:bg-gray-700/50'}
                        ${!tx.isSelected && !tx.isDuplicate ? 'opacity-50' : ''}
                      `}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={tx.isSelected || false}
                          onChange={() => toggleTransaction(tx.id)}
                          disabled={tx.isDuplicate}
                          className="w-4 h-4 rounded accent-emerald-500"
                        />
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="p-3 max-w-xs truncate" title={tx.description}>
                        {tx.description}
                      </td>
                      <td className="p-3">
                        {editingId === tx.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editingCategoryId}
                              onChange={(e) => setEditingCategoryId(e.target.value)}
                              className="p-1 bg-gray-600 border border-gray-500 rounded text-sm"
                            >
                              <option value="">Sem categoria</option>
                              {categories
                                .filter(c => c.type === tx.type)
                                .map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.level > 1 ? '└ ' : ''}{c.name}
                                  </option>
                                ))
                              }
                            </select>
                            <button
                              onClick={() => saveCategory(tx.id)}
                              className="p-1 text-green-400 hover:bg-green-900/50 rounded"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-red-400 hover:bg-red-900/50 rounded"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditCategory(tx)}
                            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white"
                          >
                            {tx.categoryName || (
                              <span className="text-gray-500 italic">Sem categoria</span>
                            )}
                            <Edit2 size={14} className="opacity-50" />
                          </button>
                        )}
                      </td>
                      <td className={`p-3 text-right font-medium ${
                        tx.type === 'income' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                      </td>
                      <td className="p-3 text-center">
                        {tx.isDuplicate ? (
                          <span className="px-2 py-1 bg-yellow-900/50 text-yellow-400 text-xs rounded-full">
                            Duplicada
                          </span>
                        ) : tx.categoryId ? (
                          <span className="px-2 py-1 bg-green-900/50 text-green-400 text-xs rounded-full">
                            Categorizada
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-600 text-gray-400 text-xs rounded-full">
                            Pendente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-4">
              <button
                onClick={handleReset}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || transactions.filter(t => t.isSelected).length === 0}
                className={`
                  flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition
                  ${(loading || transactions.filter(t => t.isSelected).length === 0)
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }
                `}
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Confirmar Importação ({transactions.filter(t => t.isSelected).length})
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <div className="text-center py-12">
            <Loader2 size={64} className="animate-spin mx-auto mb-6 text-emerald-400" />
            <h2 className="text-xl font-bold mb-2">Importando transações...</h2>
            <p className="text-gray-400">Por favor, aguarde enquanto processamos seu arquivo.</p>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && result && (
          <div className="text-center py-8 space-y-6">
            <div className="inline-flex p-4 bg-emerald-900/30 rounded-full mb-4">
              <CheckCircle size={64} className="text-emerald-400" />
            </div>
            
            <h2 className="text-2xl font-bold">Importação Concluída!</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-3xl font-bold text-green-400">{result.imported}</p>
                <p className="text-sm text-gray-400">Importadas</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-3xl font-bold text-gray-400">{result.skipped}</p>
                <p className="text-sm text-gray-400">Ignoradas</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-3xl font-bold text-yellow-400">{result.duplicates}</p>
                <p className="text-sm text-gray-400">Duplicadas</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 max-w-lg mx-auto text-left">
                <p className="font-medium text-red-400 mb-2">Erros encontrados:</p>
                <ul className="text-sm text-gray-300 space-y-1">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li className="text-gray-500">...e mais {result.errors.length - 5} erros</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex gap-4 justify-center pt-4">
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition flex items-center gap-2"
              >
                <RefreshCw size={20} />
                Nova Importação
              </button>
              <button
                onClick={() => router.push('/dashboard/transactions')}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition"
              >
                Ver Transações
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
