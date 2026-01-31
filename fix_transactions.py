#!/usr/bin/env python3
import re

# Ler o arquivo
with open('/opt/utop/frontend/src/app/dashboard/transactions/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Correção 1: Modificar onClick das opções do dateFilter para atualizar filters
old_onclick = "onClick={() => { setDateFilter(opt.value as any); if (opt.value !== 'custom') setOpenDropdown(null); }}"

new_onclick = '''onClick={() => {
                    setDateFilter(opt.value as any);
                    // Atualizar filtros do backend
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    let newStartDate = filters.startDate;
                    let newEndDate = filters.endDate;
                    
                    switch (opt.value) {
                      case 'all':
                        const yearAgo = new Date(today);
                        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                        newStartDate = yearAgo.toISOString().split('T')[0];
                        newEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
                        break;
                      case 'today':
                        newStartDate = today.toISOString().split('T')[0];
                        newEndDate = today.toISOString().split('T')[0];
                        break;
                      case 'week':
                        const weekAgo = new Date(today);
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        newStartDate = weekAgo.toISOString().split('T')[0];
                        newEndDate = today.toISOString().split('T')[0];
                        break;
                      case 'month':
                        const monthAgo = new Date(today);
                        monthAgo.setMonth(monthAgo.getMonth() - 1);
                        newStartDate = monthAgo.toISOString().split('T')[0];
                        newEndDate = today.toISOString().split('T')[0];
                        break;
                    }
                    
                    if (opt.value !== 'custom') {
                      setFilters(prev => ({ ...prev, startDate: newStartDate, endDate: newEndDate }));
                      setOpenDropdown(null);
                    }
                  }}'''

content = content.replace(old_onclick, new_onclick)

# Correção 2: Modificar botão Aplicar para atualizar filters
old_apply = '<button onClick={() => setOpenDropdown(null)} className="w-full px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Aplicar</button>'

new_apply = '<button onClick={() => { if (customDateRange.start && customDateRange.end) { setFilters(prev => ({ ...prev, startDate: customDateRange.start, endDate: customDateRange.end })); } setOpenDropdown(null); }} className="w-full px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Aplicar</button>'

content = content.replace(old_apply, new_apply)

# Salvar
with open('/opt/utop/frontend/src/app/dashboard/transactions/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Arquivo modificado com sucesso!')
