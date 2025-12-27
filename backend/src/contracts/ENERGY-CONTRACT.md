# 📜 CONTRATO OFICIAL DE ENERGIA FINANCEIRA - UTOP

> **Versão:** 1.0.0  
> **Data:** 27/Dezembro/2025  
> **Status:** CONGELADO - Não alterar sem aprovação

---

## 🎯 O QUE É ESTE DOCUMENTO

Este documento define o **contrato oficial e imutável** das energias financeiras do UTOP.

**Todo o sistema DEVE respeitar estas definições:**
- Backend (cálculos, scores, relatórios)
- Frontend (UI, labels, cores)
- IA (quando implementada)
- Relatórios (narrativas, insights)

---

## ⚡ OS 4 TIPOS DE ENERGIA

### 🏠 SOBREVIVÊNCIA (survival)

> **Definição:** Gastos obrigatórios para manter a vida funcionando.

Sem eles, a vida básica seria impossível ou severamente comprometida.

| Características | Exemplos |
|----------------|----------|
| Geralmente fixos | Aluguel, Financiamento |
| Não podem ser cortados | Luz, Água, Gás |
| Necessidades básicas | Plano de Saúde, Alimentação básica |

**Cor:** 🔵 Azul (#3B82F6)

---

### 🎯 ESCOLHA (choice)

> **Definição:** Gastos opcionais que melhoram conforto, prazer ou qualidade de vida.

A vida continua sem eles, mas com menos satisfação.

| Características | Exemplos |
|----------------|----------|
| Podem ser cortados | Netflix, Spotify |
| Estilo de vida | Restaurantes, Viagens |
| Variam conforme momento | Roupas, Academia |

**Cor:** 🟣 Roxo (#8B5CF6)

---

### 🚀 FUTURO (future)

> **Definição:** Gastos que AUMENTAM liberdade financeira futura.

Dinheiro que sai hoje para voltar multiplicado amanhã.

| Características | Exemplos |
|----------------|----------|
| Criam patrimônio | Investimentos, Poupança |
| Diminuem dependência | Previdência, Tesouro |
| Sementes plantadas | Cursos profissionalizantes |

**Cor:** 🟢 Verde (#10B981)

---

### 💸 ENERGIA PERDIDA (loss)

> **Definição:** Dinheiro que saiu sem retorno algum. Puro desperdício.

| Características | Exemplos |
|----------------|----------|
| Não gera valor | Juros de cartão |
| Poderia ser evitado | Multas, Taxas |
| Ineficiência | Cheque especial, Anuidade não usada |

**Cor:** 🔴 Vermelho (#EF4444)

---

## 📊 REGRAS DE CLASSIFICAÇÃO

### 1️⃣ Receita NÃO é energia de gasto

```
Receita = "Energia Gerada" (a fonte que alimenta o sistema)
Receita ≠ survival/choice/future/loss
```

### 2️⃣ Todo gasto DEVE ter classificação

```
❌ Gasto sem energia
✅ Gasto com energy = NOT_VALIDATED (se não souber)
```

### 3️⃣ Híbridos são permitidos COM justificativa

```
✅ Alimentação: 60% survival + 40% choice
   Justificativa: "Necessidade básica, mas inclui restaurantes"

❌ Alimentação: 50% survival + 50% choice
   Sem justificativa
```

### 4️⃣ Default 50/50 é PROIBIDO

```
❌ Categoria desconhecida = 50/50 silencioso
✅ Categoria desconhecida = NOT_VALIDATED + aviso ao usuário
```

### 5️⃣ Usuário SEMPRE pode corrigir

```
Sistema sugere → Usuário valida → Sistema aprende
```

### 6️⃣ Transação NÃO altera categoria

```
Override de transação → Afeta só aquela transação
Mudança de categoria → Usar tela de classificação
```

---

## 🏷️ STATUS DE VALIDAÇÃO

| Status | Significado | Confiança |
|--------|-------------|-----------|
| `VALIDATED` | Confirmado por humano | ⭐⭐⭐⭐⭐ Alta |
| `INFERRED` | Pattern matching automático | ⭐⭐⭐ Média |
| `NOT_VALIDATED` | Sistema não tem certeza | ⭐ Baixa |
| `DEFAULT` | Nenhum pattern encontrado | ⚠️ Requer correção |

---

## 🧮 REGRAS DO HEALTH SCORE

O Health Score NÃO pode mentir:

| Situação | Nota Máxima |
|----------|-------------|
| `futureRatio > 0` | A (Excelente) |
| `futureRatio = 0` | **B (Bom)** máximo |
| `futureRatio = 0 + déficit` | **C (Regular)** máximo |

**Justificativa:** Não existe saúde financeira "excelente" sem construir futuro.

---

## 📁 ARQUIVOS DO CONTRATO

```
backend/src/contracts/
├── energy.contract.ts   ← Tipos e funções
└── ENERGY-CONTRACT.md   ← Este documento

frontend/src/lib/
└── energyContract.ts    ← Cópia para frontend (se necessário)
```

---

## ⚠️ ALTERAÇÕES

Para alterar este contrato:

1. Criar issue explicando a necessidade
2. Documentar impacto em todas as partes do sistema
3. Aprovar com stakeholders
4. Atualizar TODOS os arquivos relacionados
5. Criar migration de dados se necessário

**Última alteração:** 27/Dez/2025 - Criação do contrato

---

## 📚 REFERÊNCIAS

- `backend/src/services/energy-reports.service.ts` - Usa este contrato
- `backend/src/utils/default-categories.ts` - Padrões de categorias
- `frontend/src/lib/energyColors.ts` - Cores e labels
