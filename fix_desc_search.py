#!/usr/bin/env python3

# Ler o arquivo
with open('/opt/utop/frontend/src/app/dashboard/transactions/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remover referências a descriptionSearch que não existe

# 1. Remover da função getActiveFilters
old_desc_check = """
    if (descriptionSearch.trim()) {
      active.push({ key: 'description', label: 'Descrição', value: descriptionSearch });
    }
    """
content = content.replace(old_desc_check, "")

# 2. Remover do clearFilter
old_desc_clear = """      case 'description':
        setDescriptionSearch('');
        break;"""
content = content.replace(old_desc_clear, "")

# 3. Remover do clearAllFilters
old_desc_clearall = """    setDescriptionSearch('');"""
content = content.replace(old_desc_clearall, "")

# Salvar
with open('/opt/utop/frontend/src/app/dashboard/transactions/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Correções aplicadas!')
