#!/usr/bin/env python3
import re

# Ler o arquivo
with open('/opt/utop/frontend/src/app/dashboard/transactions/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Correção 1: Adicionar min-height à div da tabela e remover maxHeight que está cortando
old_div = '<div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 280px)" }}>'

new_div = '<div className="bg-white rounded-lg shadow-md overflow-visible flex flex-col min-h-[500px]">'

content = content.replace(old_div, new_div)

# Correção 2: Procurar a div interna de overflow-x-auto e adicionar overflow-visible para o dropdown
# Encontrar o elemento que contém overflow-x-auto dentro da tabela
old_overflow = 'className="overflow-x-auto flex-1"'
new_overflow = 'className="overflow-x-auto overflow-y-visible flex-1"'
content = content.replace(old_overflow, new_overflow)

# Salvar
with open('/opt/utop/frontend/src/app/dashboard/transactions/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Arquivo modificado com sucesso!')
