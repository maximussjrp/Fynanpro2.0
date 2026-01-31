#!/usr/bin/env python3
import re

# Ler o arquivo
with open('/opt/utop/frontend/src/app/dashboard/transactions/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Adicionar estado de seleção de transações após os outros estados
old_state = "const [isCreating, setIsCreating] = useState(false);"
new_state = """const [isCreating, setIsCreating] = useState(false);
  
  // Seleção de transações para ações em lote
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);"""

content = content.replace(old_state, new_state)

# 2. Adicionar função para toggle seleção individual e selecionar todos
# Procurar onde estão as funções e adicionar após togglePaidStatus
old_func_marker = "const handleSort = (key: string) => {"
new_funcs = """// Funções de seleção em lote
  const toggleSelectTransaction = (id: string) => {
    setSelectedTransactions(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.length === filteredTransactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(filteredTransactions.map(t => t.id));
    }
  };

  const handleBulkMarkAsPaid = async () => {
    if (selectedTransactions.length === 0) return;
    
    try {
      await Promise.all(
        selectedTransactions.map(id => 
          api.patch(`/transactions/${id}`, { status: 'completed', paidDate: new Date().toISOString().split('T')[0] })
        )
      );
      toast.success(`${selectedTransactions.length} transações marcadas como pagas!`);
      setSelectedTransactions([]);
      loadData();
    } catch (error: any) {
      toast.error('Erro ao marcar transações como pagas');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTransactions.length === 0) return;
    
    if (!confirm(`Tem certeza que deseja excluir ${selectedTransactions.length} transações?`)) return;
    
    try {
      await Promise.all(
        selectedTransactions.map(id => api.delete(`/transactions/${id}`))
      );
      toast.success(`${selectedTransactions.length} transações excluídas!`);
      setSelectedTransactions([]);
      loadData();
    } catch (error: any) {
      toast.error('Erro ao excluir transações');
    }
  };

  // Função para obter filtros ativos
  const getActiveFilters = () => {
    const active: { key: string; label: string; value: string }[] = [];
    
    if (dateFilter !== 'all') {
      const labels: Record<string, string> = {
        today: 'Hoje',
        week: 'Esta semana',
        month: 'Este mês',
        custom: `${customDateRange.start || ''} - ${customDateRange.end || ''}`
      };
      active.push({ key: 'dateFilter', label: 'Período', value: labels[dateFilter] || dateFilter });
    }
    
    if (columnFilters.categories.length > 0) {
      active.push({ key: 'categories', label: 'Categorias', value: `${columnFilters.categories.length} selecionadas` });
    }
    
    if (columnFilters.accounts.length > 0) {
      active.push({ key: 'accounts', label: 'Contas', value: `${columnFilters.accounts.length} selecionadas` });
    }
    
    if (columnFilters.paymentMethods.length > 0) {
      active.push({ key: 'paymentMethods', label: 'Meios de Pagamento', value: `${columnFilters.paymentMethods.length} selecionados` });
    }
    
    if (columnFilters.statuses.length > 0) {
      active.push({ key: 'statuses', label: 'Status', value: `${columnFilters.statuses.length} selecionados` });
    }
    
    if (descriptionSearch.trim()) {
      active.push({ key: 'description', label: 'Descrição', value: descriptionSearch });
    }
    
    return active;
  };

  const clearFilter = (key: string) => {
    switch (key) {
      case 'dateFilter':
        setDateFilter('all');
        // Resetar para mês atual
        const now = new Date();
        setFilters(prev => ({
          ...prev,
          startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
          endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
        }));
        break;
      case 'categories':
        setColumnFilters(prev => ({ ...prev, categories: [] }));
        break;
      case 'accounts':
        setColumnFilters(prev => ({ ...prev, accounts: [] }));
        break;
      case 'paymentMethods':
        setColumnFilters(prev => ({ ...prev, paymentMethods: [] }));
        break;
      case 'statuses':
        setColumnFilters(prev => ({ ...prev, statuses: [] }));
        break;
      case 'description':
        setDescriptionSearch('');
        break;
    }
  };

  const clearAllFilters = () => {
    setDateFilter('all');
    setColumnFilters({ categories: [], accounts: [], paymentMethods: [], statuses: [] });
    setDescriptionSearch('');
    const now = new Date();
    setFilters(prev => ({
      ...prev,
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    }));
  };

  const activeFilters = getActiveFilters();

  """ + old_func_marker

content = content.replace(old_func_marker, new_funcs)

# 3. Modificar o botão Filtros para ser um dropdown de gerenciamento
old_filters_button = """<button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
            >
              <Filter className="w-5 h-5" />
              <span>Filtros</span>
            </button>"""

new_filters_button = """<div className="relative">
              <button
                onClick={() => setShowFiltersDropdown(!showFiltersDropdown)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${activeFilters.length > 0 ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
              >
                <Filter className="w-5 h-5" />
                <span>Filtros {activeFilters.length > 0 && `(${activeFilters.length})`}</span>
              </button>
              
              {showFiltersDropdown && (
                <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[300px]">
                  <div className="p-3 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">Filtros Ativos</span>
                      <button onClick={() => setShowFiltersDropdown(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {activeFilters.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      Nenhum filtro ativo
                    </div>
                  ) : (
                    <>
                      <div className="p-2 max-h-[300px] overflow-auto">
                        {activeFilters.map(filter => (
                          <div key={filter.key} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded">
                            <div>
                              <span className="text-sm font-medium text-gray-700">{filter.label}</span>
                              <span className="text-sm text-gray-500 ml-2">{filter.value}</span>
                            </div>
                            <button
                              onClick={() => clearFilter(filter.key)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              title="Remover filtro"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="p-2 border-t border-gray-100">
                        <button
                          onClick={() => { clearAllFilters(); setShowFiltersDropdown(false); }}
                          className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded font-medium"
                        >
                          Limpar Todos os Filtros
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>"""

content = content.replace(old_filters_button, new_filters_button)

# 4. Adicionar coluna de checkbox no cabeçalho da tabela (antes de Data)
old_header = '<ColumnHeader label="Data" sortKey="date" isDateColumn />'
new_header = """<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.length === filteredTransactions.length && filteredTransactions.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  <ColumnHeader label="Data" sortKey="date" isDateColumn />"""

content = content.replace(old_header, new_header)

# 5. Adicionar checkbox em cada linha da tabela (antes da data)
# Procurar o início da linha de transação
old_row_start = '<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">'
new_row_start = """<td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedTransactions.includes(transaction.id)}
                          onChange={() => toggleSelectTransaction(transaction.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">"""

# Só substituir a primeira ocorrência (que é a coluna de data)
content = content.replace(old_row_start, new_row_start, 1)

# 6. Adicionar barra de ações em lote (antes da tabela)
old_table_div = '<div className="bg-white rounded-lg shadow-md overflow-visible flex flex-col min-h-[500px]">'
new_table_div = """
        {/* Barra de ações em lote */}
        {selectedTransactions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-800">
                {selectedTransactions.length} transação(ões) selecionada(s)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkMarkAsPaid}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Marcar como Paga
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
              <button
                onClick={() => setSelectedTransactions([])}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-visible flex flex-col min-h-[500px]">"""

content = content.replace(old_table_div, new_table_div)

# 7. Adicionar import do X se não existir
if "import { X }" not in content and ", X," not in content and ", X }" not in content:
    old_import = "import { Filter, ChevronUp, ChevronDown, Check, CheckCircle, Clock, AlertTriangle, Trash2, Receipt, TrendingUp, TrendingDown, ArrowLeft, Plus, Search } from 'lucide-react';"
    if old_import in content:
        new_import = "import { Filter, ChevronUp, ChevronDown, Check, CheckCircle, Clock, AlertTriangle, Trash2, Receipt, TrendingUp, TrendingDown, ArrowLeft, Plus, Search, X } from 'lucide-react';"
        content = content.replace(old_import, new_import)
    else:
        # Tentar outra variação do import
        content = content.replace(
            "} from 'lucide-react';",
            ", X } from 'lucide-react';",
            1
        )

# Salvar
with open('/opt/utop/frontend/src/app/dashboard/transactions/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Arquivo modificado com sucesso!')
print('Alterações:')
print('1. Adicionado estado de seleção de transações')
print('2. Adicionadas funções de ações em lote')
print('3. Botão Filtros agora mostra filtros ativos e permite limpar')
print('4. Coluna de checkbox no cabeçalho')
print('5. Checkbox em cada linha')
print('6. Barra de ações em lote')
