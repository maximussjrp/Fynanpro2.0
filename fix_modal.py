import sys

filepath = "/opt/utop/frontend/src/app/dashboard/page.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Substituir o modal antigo pelo novo com condicionais
old_modal = """      {/* Modal de Transação Unificado */}
      <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        onSuccess={() => {
          loadDashboardData();
          setShowTransactionModal(false);
        }}
      />"""

new_modal = """      {/* Modal de Criar - com tabs Única/Recorrente/Parcelada */}
      <CreateTransactionModal
        isOpen={showTransactionModal && isCreating}
        onClose={() => {
          setShowTransactionModal(false);
          setIsCreating(false);
        }}
        onSuccess={() => {
          loadDashboardData();
          setShowTransactionModal(false);
          setIsCreating(false);
        }}
      />"""

content = content.replace(old_modal, new_modal)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Dashboard modal fix aplicado!")
