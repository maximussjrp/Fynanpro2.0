import sys

filepath = "/opt/utop/frontend/src/app/dashboard/page.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Atualizar QuickActions para setar isCreating
content = content.replace(
    "onAddTransaction={() => setShowTransactionModal(true)}",
    "onAddTransaction={() => { setIsCreating(true); setShowTransactionModal(true); }}"
)

# Também procurar outras ocorrências onde o modal é aberto
content = content.replace(
    'onClick={() => setShowTransactionModal(true)}',
    'onClick={() => { setIsCreating(true); setShowTransactionModal(true); }}'
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Dashboard fix aplicado!")
