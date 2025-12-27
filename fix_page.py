import re
import sys

# Arquivo a modificar
filepath = sys.argv[1] if len(sys.argv) > 1 else "/opt/utop/frontend/src/app/dashboard/transactions/page.tsx"

# Ler arquivo
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Adicionar import do UnifiedTransactionModal
old_import = "import TransactionModal from '@/components/NewTransactionModal';"
new_imports = """import EditTransactionModal from '@/components/NewTransactionModal';
import CreateTransactionModal from '@/components/UnifiedTransactionModal';"""
content = content.replace(old_import, new_imports)

# 2. Adicionar estado para modal de criação vs edição
old_show_modal = "const [showModal, setShowModal] = useState(false);"
new_show_modal = """const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);"""
content = content.replace(old_show_modal, new_show_modal)

# 3. Modificar para setar isCreating corretamente
# Quando abre para criar
content = content.replace(
    "setEditingTransaction(null);\n    setShowModal(true);",
    "setEditingTransaction(null);\n    setIsCreating(true);\n    setShowModal(true);"
)

# Quando abre para editar
content = content.replace(
    "setEditingTransaction(transaction);\n    setShowModal(true);",
    "setEditingTransaction(transaction);\n    setIsCreating(false);\n    setShowModal(true);"
)

# 4. Substituir o modal único por dois modals condicionais
old_modal = """<TransactionModal
        isOpen={showModal}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        transaction={editingTransaction}
      />"""

new_modals = """{/* Modal de Criar - com tabs Única/Recorrente/Parcelada */}
      {isCreating && (
        <CreateTransactionModal
          isOpen={showModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Modal de Editar - formulário simples */}
      {!isCreating && editingTransaction && (
        <EditTransactionModal
          isOpen={showModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          transaction={editingTransaction}
        />
      )}"""

content = content.replace(old_modal, new_modals)

# Salvar
with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Arquivo {filepath} atualizado com sucesso!")
