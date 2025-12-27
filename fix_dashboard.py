import re
import sys

# Arquivo a modificar
filepath = sys.argv[1] if len(sys.argv) > 1 else "/opt/utop/frontend/src/app/dashboard/page.tsx"

# Ler arquivo
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Adicionar import do UnifiedTransactionModal
old_import = "import TransactionModal from '@/components/NewTransactionModal';"
new_imports = """import EditTransactionModal from '@/components/NewTransactionModal';
import CreateTransactionModal from '@/components/UnifiedTransactionModal';"""
content = content.replace(old_import, new_imports)

# 2. Adicionar estado para modal de criação vs edição
old_show_modal = "const [showTransactionModal, setShowTransactionModal] = useState(false);"
new_show_modal = """const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);"""
content = content.replace(old_show_modal, new_show_modal)

# Tentar também outras variantes
content = content.replace(
    "const [showModal, setShowModal] = useState(false);",
    "const [showModal, setShowModal] = useState(false);\n  const [isCreating, setIsCreating] = useState(false);"
)

# 3. Modificar para setar isCreating corretamente quando abre para criar
# Variante 1
content = content.replace(
    "setEditTransaction(null);\n    setShowTransactionModal(true);",
    "setEditTransaction(null);\n    setIsCreating(true);\n    setShowTransactionModal(true);"
)

# Variante 2
content = content.replace(
    "setEditTransaction(null);\n      setShowTransactionModal(true);",
    "setEditTransaction(null);\n      setIsCreating(true);\n      setShowTransactionModal(true);"
)

# Variante 3 - com setSelectedType
content = content.replace(
    "setEditTransaction(null);\n    setSelectedType(type);\n    setShowTransactionModal(true);",
    "setEditTransaction(null);\n    setSelectedType(type);\n    setIsCreating(true);\n    setShowTransactionModal(true);"
)

# 4. Quando abre para editar
content = content.replace(
    "setEditTransaction(transaction);\n    setShowTransactionModal(true);",
    "setEditTransaction(transaction);\n    setIsCreating(false);\n    setShowTransactionModal(true);"
)

content = content.replace(
    "setEditTransaction(transaction);\n      setShowTransactionModal(true);",
    "setEditTransaction(transaction);\n      setIsCreating(false);\n      setShowTransactionModal(true);"
)

# 5. Substituir o modal único por dois modals condicionais
# Variante 1 - TransactionModal
old_modal1 = """<TransactionModal
        isOpen={showTransactionModal}
        onClose={() => {
          setShowTransactionModal(false);
          setEditTransaction(null);
        }}
        onSuccess={() => {
          setShowTransactionModal(false);
          setEditTransaction(null);
          loadDashboardData();
        }}
        transaction={editTransaction}
        defaultType={selectedType}
      />"""

new_modals1 = """{/* Modal de Criar - com tabs Única/Recorrente/Parcelada */}
      {isCreating && (
        <CreateTransactionModal
          isOpen={showTransactionModal}
          onClose={() => {
            setShowTransactionModal(false);
            setEditTransaction(null);
          }}
          onSuccess={() => {
            setShowTransactionModal(false);
            setEditTransaction(null);
            loadDashboardData();
          }}
          defaultType={selectedType}
        />
      )}

      {/* Modal de Editar - formulário simples */}
      {!isCreating && editTransaction && (
        <EditTransactionModal
          isOpen={showTransactionModal}
          onClose={() => {
            setShowTransactionModal(false);
            setEditTransaction(null);
          }}
          onSuccess={() => {
            setShowTransactionModal(false);
            setEditTransaction(null);
            loadDashboardData();
          }}
          transaction={editTransaction}
          defaultType={selectedType}
        />
      )}"""

content = content.replace(old_modal1, new_modals1)

# Salvar
with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Arquivo {filepath} atualizado com sucesso!")
