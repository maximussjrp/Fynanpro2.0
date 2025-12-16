# 🤖 CHATBOT ISIS - DOCUMENTAÇÃO TÉCNICA COMPLETA

> **IMPORTANTE**: Este documento define a lógica completa do chatbot Isis.
> O chatbot NÃO usa IA externa - funciona 100% com regras programáticas e fluxos condicionais.
> 
> **✅ IMPLEMENTADO!** - Backend e Frontend prontos para uso.

---

## 🧠 SISTEMA DE APRENDIZADO

O chatbot Isis **aprende com os lançamentos** do usuário! Quanto mais você usa, mais inteligente ela fica.

### Como funciona:

1. **Captura de Padrões**: Toda transação com descrição é salva
2. **Extração de Keywords**: Remove stop words, normaliza texto
3. **Similaridade**: Calcula score entre nova descrição e histórico
4. **Sugestão Automática**: Se similaridade ≥ 50%, sugere categoria

### Exemplo Prático:

```
1ª vez: "Gastei 50 no mercado extra"
   → Usuário escolhe categoria "🍔 Alimentação > Mercado"
   → Sistema salva: {description: "mercado extra", category: "Mercado", amount: 50}

2ª vez: "Gastei 80 no extra"
   → Sistema detecta similaridade com "mercado extra"
   → Sugere automaticamente: "🧠 Reconheci! Categoria: Mercado"
   → Usuário só confirma!
```

### Dados Aprendidos:

| Campo | Descrição |
|-------|-----------|
| `description` | Texto original normalizado |
| `keywords` | Palavras-chave extraídas |
| `categoryId` | Categoria mais usada |
| `paymentMethodId` | Meio de pagamento frequente |
| `averageAmount` | Valor médio histórico |
| `count` | Quantas vezes usado |
| `lastUsed` | Última utilização |

---

## 📋 ÍNDICE

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Arquitetura do Chatbot](#2-arquitetura-do-chatbot)
3. [Conhecimento do Sistema](#3-conhecimento-do-sistema)
4. [Fluxo de Onboarding](#4-fluxo-de-onboarding)
5. [Fluxo de Assistência Diária](#5-fluxo-de-assistência-diária)
6. [Lógica de Respostas](#6-lógica-de-respostas)
7. [Integrações com API](#7-integrações-com-api)
8. [Exemplos de Diálogos](#8-exemplos-de-diálogos)

---

## 1. VISÃO GERAL DO SISTEMA

### 1.1 Sobre o FynanPro

**FynanPro** é um sistema de gestão financeira pessoal/familiar com as seguintes características:

| Aspecto | Descrição |
|---------|-----------|
| **Público** | Pessoas físicas (uso pessoal ou familiar) |
| **Multi-tenant** | Cada usuário tem seu próprio "tenant" isolado |
| **Período** | Planejamento anual (Janeiro a Dezembro) |
| **Moeda** | Real (R$) |

### 1.2 Estrutura de Dados Principal

```
TENANT (Espaço do Usuário)
├── USER (Proprietário)
├── BANK_ACCOUNTS (Contas Bancárias)
│   ├── Tipo: bank, wallet, credit_card, investment
│   └── PF ou PJ (Pessoa Física ou Jurídica/CNPJ)
├── PAYMENT_METHODS (Meios de Pagamento)
│   ├── pix, credit_card, debit_card, boleto, cash
│   └── Vinculados a uma conta ou independentes
├── CATEGORIES (Categorias - 3 níveis)
│   ├── Level 1: 🏠 Moradia
│   ├── Level 2: └── Luz
│   └── Level 3:     └── Enel
├── TRANSACTIONS (Transações)
│   ├── income (Receita)
│   ├── expense (Despesa)
│   └── transfer (Transferência)
├── RECURRING_BILLS (Contas Recorrentes)
│   ├── Fixas (mesmo valor todo mês)
│   └── Variáveis (valor muda - ex: luz, água)
├── INSTALLMENT_PURCHASES (Compras Parceladas)
│   └── Parcelas individuais com vencimentos
└── BUDGETS (Orçamentos por Categoria)
```

---

## 2. ARQUITETURA DO CHATBOT

### 2.1 Princípios Fundamentais

```
┌─────────────────────────────────────────────────────────────┐
│                    CHATBOT ISIS                              │
├─────────────────────────────────────────────────────────────┤
│  ✅ 100% baseado em regras (sem IA externa)                 │
│  ✅ Fluxos condicionais pré-definidos                       │
│  ✅ Validação de inputs                                     │
│  ✅ Criação automática de dados                             │
│  ✅ Conhecimento completo do sistema                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Estados do Chatbot

```typescript
enum ChatbotState {
  // ONBOARDING
  ONBOARDING_WELCOME = 'onboarding_welcome',
  ONBOARDING_PROFILE = 'onboarding_profile',
  ONBOARDING_YEAR = 'onboarding_year',
  ONBOARDING_ACCOUNTS = 'onboarding_accounts',
  ONBOARDING_INCOME = 'onboarding_income',
  ONBOARDING_FIXED_EXPENSES = 'onboarding_fixed_expenses',
  ONBOARDING_VARIABLE_EXPENSES = 'onboarding_variable_expenses',
  ONBOARDING_GOALS = 'onboarding_goals',
  ONBOARDING_COMPLETE = 'onboarding_complete',
  
  // ASSISTÊNCIA DIÁRIA
  IDLE = 'idle',
  ADDING_TRANSACTION = 'adding_transaction',
  ADDING_RECURRING = 'adding_recurring',
  ASKING_CATEGORY = 'asking_category',
  ASKING_ACCOUNT = 'asking_account',
  ASKING_AMOUNT = 'asking_amount',
  ASKING_DATE = 'asking_date',
  CONFIRMING = 'confirming',
  
  // CONSULTAS
  QUERYING_BALANCE = 'querying_balance',
  QUERYING_MONTH = 'querying_month',
  QUERYING_CATEGORY = 'querying_category',
}
```

### 2.3 Estrutura de Sessão

```typescript
interface ChatSession {
  id: string;
  tenantId: string;
  userId: string;
  state: ChatbotState;
  context: {
    // Dados temporários sendo coletados
    tempTransaction?: Partial<Transaction>;
    tempRecurring?: Partial<RecurringBill>;
    
    // Controle de fluxo
    currentStep: number;
    totalSteps: number;
    
    // Ano de planejamento
    planningYear: number;
    
    // Preferências do usuário
    profileType: 'personal' | 'family';
    userName: string;
    
    // Listas para escolhas rápidas
    bankAccountsList: BankAccount[];
    paymentMethodsList: PaymentMethod[];
    categoriesList: Category[];
  };
  history: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 3. CONHECIMENTO DO SISTEMA

### 3.1 Telas do Sistema (Menu Lateral)

| # | Ícone | Nome | Rota | Descrição |
|---|-------|------|------|-----------|
| 1 | 📊 | Dashboard | `/dashboard` | Visão geral: saldo, resumo do mês, gráficos |
| 2 | 📝 | Transações | `/dashboard/transactions` | Lista de todas as transações |
| 3 | 🏦 | Contas Bancárias | `/dashboard/bank-accounts` | Gerenciar contas |
| 4 | 🏷️ | Categorias | `/dashboard/categories` | Gerenciar categorias (3 níveis) |
| 5 | 🔄 | Contas Recorrentes | `/dashboard/recurring-bills` | Contas fixas mensais |
| 6 | 📊 | Parcelamentos | `/dashboard/installments` | Compras parceladas |
| 7 | 💰 | Orçamentos | `/dashboard/budgets` | Limites por categoria |
| 8 | 📅 | Calendário | `/dashboard/calendar` | Visualização mensal |
| 9 | 📈 | Relatórios | `/dashboard/reports` | Análises e gráficos |
| 10 | ⬆️ | Importar CSV | `/dashboard/imports` | Importar extratos |
| 11 | ⚙️ | Configurações | `/dashboard/settings` | Preferências |

### 3.2 Categorias Padrão do Sistema

#### RECEITAS (💵 Receitas)
```
💵 Receitas
├── Salário
├── Freelance
├── Investimentos
├── Vendas
└── Outros
```

#### DESPESAS (Por Prioridade)

**PRIORIDADE 1 — ESSENCIAIS**
```
🏠 Moradia
├── Aluguel
├── Condomínio
├── Luz
├── Água
├── Gás
├── Internet
├── IPTU
├── Seguro Residencial
└── Manutenção
    ├── Reparos
    └── Reforma

🍔 Alimentação
├── Mercado
├── Açougue / Hortifruti
├── Padaria
├── Restaurante
├── Delivery
│   ├── iFood
│   └── Outros Apps
└── Bebidas Não Alcoólicas

🏥 Saúde
├── Plano de Saúde
├── Consultas
├── Exames
├── Farmácia
├── Terapia / Psicólogo
├── Dentista
└── Emergências
```

**PRIORIDADE 2 — COMPROMISSOS FINANCEIROS**
```
💰 Dívidas
├── Cartões de Crédito
│   ├── Fatura Nubank
│   ├── Fatura Inter
│   └── Outros Cartões
├── Empréstimos
├── Cheque Especial
├── Acordos
└── Refinanciamento

🏛️ Impostos
├── IPVA
├── Taxas Bancárias
├── Multas
└── Tarifas de Serviços
```

**PRIORIDADE 3 — FUNCIONAMENTO DA VIDA**
```
🚗 Transporte
├── Carro
│   ├── Combustível
│   ├── Manutenção
│   ├── Documentação
│   ├── IPVA
│   ├── Seguro
│   └── Parcelas do Carro
├── Moto
├── Transporte Público
├── Uber / Táxi
├── Estacionamento
└── Pedágio

💼 Trabalho
├── Ferramentas
├── Uniformes
├── Cursos Profissionais
├── Gastos com Clientes
└── Documentação Profissional

🎓 Educação
├── Escola / Faculdade
├── Cursos
├── Livros / Materiais
└── Pós / Especialização
```

**PRIORIDADE 4 — QUALIDADE DE VIDA**
```
👨‍👩‍👧 Família
├── Filhos
│   ├── Escola
│   ├── Roupas
│   ├── Presentes
│   └── Outros
├── Animais de Estimação
│   ├── Ração
│   ├── Veterinário
│   └── Banho & Tosa
└── Pais / Avós

💅 Beleza e Saúde
├── Cosméticos
├── Maquiagem
├── Perfumaria
├── Cabeleireiro / Salão
├── Manicure / Pedicure
├── Tratamentos Estéticos
├── Spa / Massagem
└── Academia

👕 Vestuário
├── Roupas
├── Calçados
├── Acessórios
└── Lavanderia
```

**PRIORIDADE 5 — SUPÉRFLUOS**
```
🎮 Lazer
├── Cinema
├── Viagens
├── Bares / Restaurantes
├── Streaming / Assinaturas
├── Presentes
└── Hobbies
    ├── Games
    ├── Música
    └── Esportes
```

**PRIORIDADE 6 — GASTOS DE RISCO (VÍCIOS)**
```
🚬 Vícios
├── Cigarro
├── Bebida
├── Jogos / Apostas
├── Doces / Chocolates (Excesso)
└── Delivery Excessivo

💸 Impulso Financeiro
├── Compras Sem Planejamento
├── Gastos Repentinos
└── Compras Emocionais
```

**PRIORIDADE 7 — METAS E FUTURO**
```
📈 Investimentos
├── Reserva de Emergência
├── Renda Fixa
├── Ações
├── Fundos
├── Cripto
└── Previdência

🎯 Metas Financeiras
├── Comprar Carro
├── Comprar Casa
├── Quitar Dívidas
├── Viagem
├── Casamento
├── Estudos
└── Reserva Financeira
```

### 3.3 Tipos de Transação

| Tipo | Descrição | Comportamento |
|------|-----------|---------------|
| `single` | Transação única | Acontece uma vez |
| `recurring` | Recorrente | Repete mensalmente (ou outro período) |
| `installment` | Parcelada | Dividida em X parcelas |

### 3.4 Status de Transação

| Status | Cor | Descrição |
|--------|-----|-----------|
| `scheduled` | 🔵 Azul | Agendada para o futuro |
| `pending` | 🟡 Amarelo | Aguardando pagamento |
| `overdue` | 🔴 Vermelho | Atrasada |
| `completed` | 🟢 Verde | Paga/Concluída |
| `cancelled` | ⚫ Cinza | Cancelada |
| `skipped` | ⚪ Branco | Pulada (não vai pagar) |

### 3.5 Tipos de Conta Bancária

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `bank` | Conta corrente/poupança | Nubank, Inter, Bradesco |
| `wallet` | Carteira digital | PicPay, MercadoPago |
| `credit_card` | Cartão de crédito | Nubank, Inter |
| `investment` | Conta de investimento | XP, Rico, Nomad |
| `other` | Outros | Dinheiro físico |

### 3.6 Tipos de Meio de Pagamento

| Tipo | Descrição |
|------|-----------|
| `pix` | Transferência PIX |
| `credit_card` | Cartão de crédito |
| `debit_card` | Cartão de débito |
| `boleto` | Boleto bancário |
| `cash` | Dinheiro |
| `bank_transfer` | TED/DOC |
| `automatic_debit` | Débito automático |

---

## 4. FLUXO DE ONBOARDING

### 4.1 Diagrama Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FLUXO DE ONBOARDING                             │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 1: BOAS-VINDAS                                                │
│ • Apresentação da Isis                                              │
│ • Perguntar nome                                                    │
│ • Perguntar: Pessoal ou Familiar?                                   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 1.5: ANO DE PLANEJAMENTO (só se Nov/Dez)                      │
│ • Se mês atual >= 11: perguntar qual ano planejar                   │
│ • Opções: Ano atual OU Próximo ano                                  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 2: CONTAS BANCÁRIAS                                           │
│ • Para cada conta:                                                  │
│   - Nome do banco                                                   │
│   - PF ou PJ?                                                       │
│   - Saldo atual                                                     │
│ • Loop até usuário dizer "não" para mais contas                     │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 3: RECEITAS                                                   │
│ • Qual a principal fonte de renda?                                  │
│ • Valor é fixo ou variável?                                         │
│   - Se FIXO: Qual dia do mês recebe?                                │
│   - Se VARIÁVEL: Pode pular (lançar manualmente)                    │
│ • Tem outras fontes? Loop até "não"                                 │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 4: DESPESAS FIXAS                                             │
│ • Pergunta categoria por categoria (ordem de prioridade):           │
│   1. Moradia (Aluguel, Luz, Água, Internet, IPTU)                   │
│   2. Transporte (Combustível, Seguro, Financiamento)                │
│   3. Comunicação (Celular, Internet, Streaming)                     │
│   4. Saúde (Plano, Academia)                                        │
│   5. Educação (Escola, Cursos)                                      │
│   6. Dívidas (Empréstimos, Financiamentos)                          │
│   7. Assinaturas (Netflix, Spotify, etc)                            │
│ • Para cada item:                                                   │
│   - Valor                                                           │
│   - Número de parcelas (se aplicável)                               │
│   - Dia do vencimento                                               │
│   - Conta/cartão de pagamento                                       │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 5: RESUMO E INSIGHTS                                          │
│ • Mostrar resumo de tudo cadastrado                                 │
│ • Análise simples:                                                  │
│   - Total de receitas                                               │
│   - Total de despesas fixas                                         │
│   - Sobra prevista                                                  │
│ • Próximos passos sugeridos                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Lógica Detalhada por Etapa

#### ETAPA 1: Boas-Vindas

```typescript
// Estado: ONBOARDING_WELCOME
const welcomeFlow = {
  messages: [
    "Olá! 👋 Eu sou a Isis, sua assistente financeira!",
    "Vou te ajudar a configurar seu sistema de finanças.",
    "Para começar, como posso te chamar?"
  ],
  waitFor: 'name',
  validation: (input: string) => input.length >= 2,
  errorMessage: "Por favor, me diga seu nome (mínimo 2 caracteres)",
  onSuccess: (input: string, context: ChatContext) => {
    context.userName = input;
    return {
      nextState: 'ONBOARDING_PROFILE',
      message: `Prazer, ${input}! 😊\n\nVocê vai usar o FynanPro para finanças pessoais ou familiares?\n\n1️⃣ Pessoal (só você)\n2️⃣ Familiar (casal/família)`
    };
  }
};
```

```typescript
// Estado: ONBOARDING_PROFILE
const profileFlow = {
  waitFor: 'choice',
  options: ['1', '2', 'pessoal', 'familiar'],
  normalize: (input: string) => {
    if (input === '1' || input.toLowerCase().includes('pessoal')) return 'personal';
    if (input === '2' || input.toLowerCase().includes('familiar')) return 'family';
    return null;
  },
  errorMessage: "Por favor, escolha 1 para Pessoal ou 2 para Familiar",
  onSuccess: (input: string, context: ChatContext) => {
    context.profileType = input as 'personal' | 'family';
    
    // Verificar se precisa perguntar o ano
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const currentYear = new Date().getFullYear();
    
    if (currentMonth >= 11) {
      return {
        nextState: 'ONBOARDING_YEAR',
        message: `Perfeito! Como estamos em ${currentMonth === 11 ? 'novembro' : 'dezembro'}, você quer planejar:\n\n1️⃣ ${currentYear} (finalizar este ano)\n2️⃣ ${currentYear + 1} (começar do zero)`
      };
    } else {
      context.planningYear = currentYear;
      return {
        nextState: 'ONBOARDING_ACCOUNTS',
        message: "Ótimo! Vamos cadastrar suas contas bancárias.\n\nQual é o seu banco principal? (ex: Nubank, Inter, Bradesco)"
      };
    }
  }
};
```

#### ETAPA 2: Contas Bancárias

```typescript
// Estado: ONBOARDING_ACCOUNTS
const accountsFlow = {
  subStates: {
    ASK_BANK: {
      message: "Qual banco/instituição?",
      waitFor: 'text',
      onSuccess: (input, context) => {
        context.tempAccount = { institution: input };
        return { nextSubState: 'ASK_PF_PJ' };
      }
    },
    ASK_PF_PJ: {
      message: "Essa conta é PF (Pessoa Física) ou PJ (CNPJ)?",
      options: ['pf', 'pj', '1', '2'],
      onSuccess: (input, context) => {
        context.tempAccount.type = input.includes('pj') || input === '2' ? 'PJ' : 'PF';
        return { nextSubState: 'ASK_BALANCE' };
      }
    },
    ASK_BALANCE: {
      message: "Qual o saldo atual dessa conta?",
      waitFor: 'money',
      validation: (input) => parseMoneyValue(input) !== null,
      onSuccess: (input, context) => {
        const value = parseMoneyValue(input);
        context.tempAccount.currentBalance = value;
        
        // Criar a conta via API
        const account = await createBankAccount({
          tenantId: context.tenantId,
          name: `${context.tempAccount.institution} ${context.tempAccount.type}`,
          institution: context.tempAccount.institution,
          type: 'bank',
          currentBalance: value,
          initialBalance: value,
        });
        
        context.bankAccountsList.push(account);
        context.tempAccount = null;
        
        return {
          nextSubState: 'ASK_MORE',
          message: `✅ Conta cadastrada!\n\n${context.tempAccount.institution} ${context.tempAccount.type}: R$ ${formatMoney(value)}\n\nTem mais alguma conta bancária?`
        };
      }
    },
    ASK_MORE: {
      options: ['sim', 'não', 's', 'n', 'yes', 'no'],
      onSuccess: (input, context) => {
        if (isPositive(input)) {
          return { nextSubState: 'ASK_BANK', message: "Qual o próximo banco?" };
        } else {
          return {
            nextState: 'ONBOARDING_INCOME',
            message: resumoContas(context.bankAccountsList) + "\n\nAgora vamos falar sobre suas receitas! 💰\n\nQual sua principal fonte de renda?\n(ex: Salário CLT, Autônomo, Freelancer, Empresário)"
          };
        }
      }
    }
  }
};
```

#### ETAPA 3: Receitas

```typescript
// Estado: ONBOARDING_INCOME
const incomeFlow = {
  subStates: {
    ASK_SOURCE: {
      waitFor: 'text',
      suggestions: ['Salário CLT', 'Autônomo', 'Freelancer', 'Empresário', 'Aposentado'],
      onSuccess: (input, context) => {
        context.tempIncome = { source: input };
        return {
          nextSubState: 'ASK_FIXED_VARIABLE',
          message: "Seu rendimento é fixo (mesmo valor todo mês) ou variável?"
        };
      }
    },
    ASK_FIXED_VARIABLE: {
      options: ['fixo', 'variável', 'variavel', '1', '2'],
      onSuccess: (input, context) => {
        const isFixed = input.includes('fix') || input === '1';
        context.tempIncome.isFixed = isFixed;
        
        if (isFixed) {
          return {
            nextSubState: 'ASK_AMOUNT',
            message: "Qual o valor mensal? (ex: 5000 ou 5.000,00)"
          };
        } else {
          return {
            nextSubState: 'ASK_SKIP_VARIABLE',
            message: "Como sua renda é variável, você pode:\n\n1️⃣ Informar uma média mensal\n2️⃣ Pular e lançar manualmente quando receber\n\nO que prefere?"
          };
        }
      }
    },
    ASK_SKIP_VARIABLE: {
      options: ['1', '2', 'média', 'media', 'pular', 'skip'],
      onSuccess: (input, context) => {
        if (input === '2' || input.includes('pular') || input.includes('skip')) {
          // Pular - não criar receita recorrente
          return {
            nextSubState: 'ASK_MORE',
            message: "Entendido! Você poderá lançar suas receitas manualmente.\n\nTem outra fonte de renda?"
          };
        } else {
          return {
            nextSubState: 'ASK_AMOUNT',
            message: "Qual a média mensal aproximada?"
          };
        }
      }
    },
    ASK_AMOUNT: {
      waitFor: 'money',
      onSuccess: (input, context) => {
        context.tempIncome.amount = parseMoneyValue(input);
        
        if (context.tempIncome.isFixed) {
          return {
            nextSubState: 'ASK_DAY',
            message: "Em qual dia do mês você recebe? (1 a 31)"
          };
        } else {
          return {
            nextSubState: 'ASK_ACCOUNT',
            message: "Em qual conta você recebe?"
          };
        }
      }
    },
    ASK_DAY: {
      waitFor: 'number',
      validation: (input) => {
        const day = parseInt(input);
        return day >= 1 && day <= 31;
      },
      onSuccess: (input, context) => {
        context.tempIncome.dueDay = parseInt(input);
        return {
          nextSubState: 'ASK_ACCOUNT',
          message: `Em qual conta você recebe?\n\n${formatAccountOptions(context.bankAccountsList)}`
        };
      }
    },
    ASK_ACCOUNT: {
      waitFor: 'choice',
      onSuccess: async (input, context) => {
        const account = findAccountByInput(input, context.bankAccountsList);
        
        // Criar receita recorrente via API
        if (context.tempIncome.amount) {
          await createRecurringBill({
            tenantId: context.tenantId,
            type: 'income',
            name: context.tempIncome.source,
            amount: context.tempIncome.amount,
            isVariableAmount: !context.tempIncome.isFixed,
            frequency: 'monthly',
            dueDay: context.tempIncome.dueDay || 1,
            bankAccountId: account?.id,
          });
        }
        
        return {
          nextSubState: 'ASK_MORE',
          message: "✅ Receita cadastrada!\n\nTem outra fonte de renda?"
        };
      }
    },
    ASK_MORE: {
      // Similar ao anterior...
    }
  }
};
```

#### ETAPA 4: Despesas Fixas

```typescript
// Estado: ONBOARDING_FIXED_EXPENSES
const fixedExpensesFlow = {
  // Categorias a perguntar em ordem
  categories: [
    {
      id: 'moradia',
      name: '🏠 Moradia',
      items: [
        { key: 'aluguel', label: 'Aluguel ou Financiamento de Imóvel' },
        { key: 'condominio', label: 'Condomínio' },
        { key: 'iptu', label: 'IPTU' },
        { key: 'luz', label: 'Energia Elétrica' },
        { key: 'agua', label: 'Água/Esgoto' },
        { key: 'gas', label: 'Gás' },
        { key: 'internet', label: 'Internet' },
      ]
    },
    {
      id: 'transporte',
      name: '🚗 Transporte',
      items: [
        { key: 'combustivel', label: 'Combustível (média mensal)' },
        { key: 'financiamento_carro', label: 'Financiamento de Veículo' },
        { key: 'seguro_carro', label: 'Seguro do Veículo' },
        { key: 'ipva', label: 'IPVA' },
      ]
    },
    {
      id: 'comunicacao',
      name: '📱 Comunicação',
      items: [
        { key: 'celular', label: 'Plano de Celular', allowMultiple: true },
      ]
    },
    {
      id: 'saude',
      name: '🏥 Saúde',
      items: [
        { key: 'plano_saude', label: 'Plano de Saúde' },
        { key: 'academia', label: 'Academia' },
        { key: 'terapia', label: 'Terapia/Psicólogo' },
      ]
    },
    {
      id: 'educacao',
      name: '🎓 Educação',
      items: [
        { key: 'escola', label: 'Escola/Faculdade' },
        { key: 'cursos', label: 'Cursos' },
      ]
    },
    {
      id: 'financeiro',
      name: '💳 Financeiro',
      items: [
        { key: 'emprestimo', label: 'Empréstimos' },
        { key: 'consorcio', label: 'Consórcio' },
      ]
    },
    {
      id: 'assinaturas',
      name: '📺 Assinaturas',
      items: [
        { key: 'streaming', label: 'Streaming (Netflix, Spotify, etc)', allowMultiple: true },
      ]
    },
  ],
  
  askItem: (item: ExpenseItem, context: ChatContext) => {
    return {
      message: `Você tem ${item.label}?`,
      options: ['sim', 'não'],
      onPositive: () => ({ nextSubState: 'ASK_AMOUNT' }),
      onNegative: () => nextItem(context),
    };
  },
  
  askAmount: {
    message: "Qual o valor?",
    waitFor: 'money',
    onSuccess: (input, context) => {
      context.tempExpense.amount = parseMoneyValue(input);
      return { nextSubState: 'ASK_INSTALLMENTS' };
    }
  },
  
  askInstallments: {
    message: "É parcelado? Se sim, quantas parcelas restam? (ou 0 se não for parcelado)",
    onSuccess: (input, context) => {
      const installments = parseInt(input) || 0;
      context.tempExpense.totalInstallments = installments;
      return { nextSubState: 'ASK_DUE_DAY' };
    }
  },
  
  askDueDay: {
    message: "Qual o dia do vencimento? (1 a 31, ou 'fatura' para cartão)",
    onSuccess: (input, context) => {
      if (input.toLowerCase().includes('fatura')) {
        context.tempExpense.paymentType = 'credit_card';
        return { nextSubState: 'ASK_CARD' };
      } else {
        context.tempExpense.dueDay = parseInt(input);
        return { nextSubState: 'ASK_PAYMENT' };
      }
    }
  },
  
  askPayment: {
    message: (context) => `Como você paga?\n\n${formatPaymentOptions(context)}`,
    onSuccess: async (input, context) => {
      const paymentMethod = findOrCreatePaymentMethod(input, context);
      await saveExpense(context.tempExpense, paymentMethod);
      return nextItem(context);
    }
  },
  
  askCard: {
    message: "Qual cartão? (pode ser os 4 últimos dígitos, ex: 5826)",
    onSuccess: async (input, context) => {
      const card = await findOrCreateCard(input, context);
      await saveExpense(context.tempExpense, card);
      return { 
        nextSubState: 'ASK_MORE',
        message: "✅ Cadastrado! Tem mais algum item nessa categoria?"
      };
    }
  },
};
```

### 4.3 Funções Auxiliares

```typescript
// Parsear valores monetários (aceita vários formatos)
function parseMoneyValue(input: string): number | null {
  // Remove caracteres não numéricos exceto vírgula e ponto
  let cleaned = input.replace(/[^\d,\.]/g, '');
  
  // Formato brasileiro: 1.234,56
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

// Verificar se resposta é positiva
function isPositive(input: string): boolean {
  const positives = ['sim', 's', 'yes', 'y', 'si', 'ok', 'tenho', 'tem', '1'];
  return positives.some(p => input.toLowerCase().includes(p));
}

// Verificar se resposta é negativa
function isNegative(input: string): boolean {
  const negatives = ['não', 'nao', 'n', 'no', 'nope', 'não tenho', '2'];
  return negatives.some(p => input.toLowerCase().includes(p));
}

// Formatar opções de contas
function formatAccountOptions(accounts: BankAccount[]): string {
  return accounts
    .map((acc, i) => `${i + 1}️⃣ ${acc.name}`)
    .join('\n');
}

// Encontrar conta pelo input do usuário
function findAccountByInput(input: string, accounts: BankAccount[]): BankAccount | null {
  // Por número
  const num = parseInt(input);
  if (!isNaN(num) && num >= 1 && num <= accounts.length) {
    return accounts[num - 1];
  }
  
  // Por nome (parcial)
  const normalized = input.toLowerCase();
  return accounts.find(acc => 
    acc.name.toLowerCase().includes(normalized) ||
    acc.institution?.toLowerCase().includes(normalized)
  ) || null;
}

// Encontrar ou criar cartão
async function findOrCreateCard(input: string, context: ChatContext): Promise<PaymentMethod> {
  const lastFour = input.replace(/\D/g, '').slice(-4);
  
  // Procurar cartão existente
  let card = context.paymentMethodsList.find(pm => 
    pm.lastFourDigits === lastFour
  );
  
  if (!card) {
    // Criar novo cartão
    card = await createPaymentMethod({
      tenantId: context.tenantId,
      name: `Cartão ${lastFour}`,
      type: 'credit_card',
      lastFourDigits: lastFour,
    });
    context.paymentMethodsList.push(card);
  }
  
  return card;
}
```

---

## 5. FLUXO DE ASSISTÊNCIA DIÁRIA

### 5.1 Comandos Rápidos

O chatbot reconhece comandos do usuário e executa ações:

```typescript
const quickCommands: QuickCommand[] = [
  // ADICIONAR TRANSAÇÕES
  {
    patterns: [
      /gastei?\s+([\d,\.]+)/i,
      /paguei?\s+([\d,\.]+)/i,
      /comprei?\s+.+\s+([\d,\.]+)/i,
    ],
    action: 'CREATE_EXPENSE',
    extractAmount: (match) => parseMoneyValue(match[1]),
    response: (amount) => `Entendi, R$ ${formatMoney(amount)}.\n\nEm qual categoria?`
  },
  {
    patterns: [
      /recebi?\s+([\d,\.]+)/i,
      /entrou\s+([\d,\.]+)/i,
    ],
    action: 'CREATE_INCOME',
    extractAmount: (match) => parseMoneyValue(match[1]),
  },
  
  // CONSULTAS
  {
    patterns: [
      /quanto\s+(gastei|gastar)/i,
      /meus?\s+gastos?/i,
      /minhas?\s+despesas?/i,
    ],
    action: 'QUERY_EXPENSES',
    response: async (context) => {
      const summary = await getMonthSummary(context.tenantId);
      return `📊 Este mês você gastou R$ ${formatMoney(summary.totalExpenses)}`;
    }
  },
  {
    patterns: [
      /saldo/i,
      /quanto\s+tenho/i,
      /meu\s+dinheiro/i,
    ],
    action: 'QUERY_BALANCE',
    response: async (context) => {
      const balance = await getTotalBalance(context.tenantId);
      return `💰 Seu saldo total é R$ ${formatMoney(balance)}`;
    }
  },
  {
    patterns: [
      /contas?\s+(a\s+)?pagar/i,
      /vencimentos?/i,
      /o\s+que\s+vence/i,
    ],
    action: 'QUERY_BILLS',
    response: async (context) => {
      const bills = await getUpcomingBills(context.tenantId, 7);
      return formatBillsList(bills);
    }
  },
  
  // NAVEGAÇÃO
  {
    patterns: [
      /ir\s+para?\s+(.+)/i,
      /abrir?\s+(.+)/i,
      /mostrar?\s+(.+)/i,
    ],
    action: 'NAVIGATE',
    extractPage: (match) => findPage(match[1]),
  },
];
```

### 5.2 Mapeamento de Navegação

```typescript
const pageMapping: PageMap = {
  // Dashboard
  'dashboard': '/dashboard',
  'início': '/dashboard',
  'home': '/dashboard',
  
  // Transações
  'transações': '/dashboard/transactions',
  'transacoes': '/dashboard/transactions',
  'lançamentos': '/dashboard/transactions',
  
  // Contas
  'contas': '/dashboard/bank-accounts',
  'bancos': '/dashboard/bank-accounts',
  'saldo': '/dashboard/bank-accounts',
  
  // Categorias
  'categorias': '/dashboard/categories',
  
  // Recorrentes
  'recorrentes': '/dashboard/recurring-bills',
  'contas fixas': '/dashboard/recurring-bills',
  'mensalidades': '/dashboard/recurring-bills',
  
  // Parcelamentos
  'parcelamentos': '/dashboard/installments',
  'parcelas': '/dashboard/installments',
  
  // Orçamentos
  'orçamentos': '/dashboard/budgets',
  'orcamentos': '/dashboard/budgets',
  'limites': '/dashboard/budgets',
  
  // Calendário
  'calendário': '/dashboard/calendar',
  'calendario': '/dashboard/calendar',
  'agenda': '/dashboard/calendar',
  
  // Relatórios
  'relatórios': '/dashboard/reports',
  'relatorios': '/dashboard/reports',
  'gráficos': '/dashboard/reports',
  
  // Importar
  'importar': '/dashboard/imports',
  'csv': '/dashboard/imports',
  'extrato': '/dashboard/imports',
  
  // Configurações
  'configurações': '/dashboard/settings',
  'config': '/dashboard/settings',
  'perfil': '/dashboard/settings',
};
```

### 5.3 Sugestões Contextuais

```typescript
// O chatbot sugere ações baseado no contexto
const contextualSuggestions = {
  // Início do mês
  monthStart: () => [
    "📅 Novo mês! Quer revisar suas contas a vencer?",
    "💰 Suas receitas já entraram? Posso ajudar a registrar.",
  ],
  
  // Contas vencendo
  billsDue: (bills: Bill[]) => [
    `⚠️ Você tem ${bills.length} conta(s) vencendo nos próximos 3 dias.`,
    "Quer que eu mostre os detalhes?",
  ],
  
  // Contas atrasadas
  overdueBills: (bills: Bill[]) => [
    `🔴 Atenção! ${bills.length} conta(s) estão atrasadas.`,
    "Quer marcar alguma como paga?",
  ],
  
  // Fim do mês
  monthEnd: () => [
    "📊 Fim do mês chegando! Quer ver um resumo dos seus gastos?",
    "🎯 Como estão seus orçamentos por categoria?",
  ],
  
  // Orçamento estourado
  budgetExceeded: (category: string, percent: number) => [
    `⚠️ Você já usou ${percent}% do orçamento de ${category}.`,
    "Cuidado com os gastos nessa categoria!",
  ],
};
```

---

## 6. LÓGICA DE RESPOSTAS

### 6.1 Processamento de Input

```typescript
async function processUserInput(input: string, session: ChatSession): Promise<ChatResponse> {
  const normalized = input.trim().toLowerCase();
  
  // 1. Verificar se está em um fluxo ativo
  if (session.state !== 'IDLE') {
    return processFlowInput(input, session);
  }
  
  // 2. Verificar comandos rápidos
  for (const cmd of quickCommands) {
    for (const pattern of cmd.patterns) {
      const match = normalized.match(pattern);
      if (match) {
        return executeCommand(cmd, match, session);
      }
    }
  }
  
  // 3. Verificar palavras-chave
  if (containsKeywords(normalized, ['ajuda', 'help', 'comandos'])) {
    return showHelp();
  }
  
  if (containsKeywords(normalized, ['oi', 'olá', 'ola', 'hey', 'bom dia', 'boa tarde', 'boa noite'])) {
    return greet(session.context.userName);
  }
  
  // 4. Tentar interpretar como transação
  const moneyMatch = normalized.match(/([\d,\.]+)/);
  if (moneyMatch) {
    session.context.tempTransaction = { 
      amount: parseMoneyValue(moneyMatch[1]) 
    };
    session.state = 'ADDING_TRANSACTION';
    return {
      message: `Vi que você mencionou R$ ${formatMoney(session.context.tempTransaction.amount)}.\n\nIsso foi uma despesa ou receita?`,
      options: ['Despesa', 'Receita'],
    };
  }
  
  // 5. Resposta padrão
  return {
    message: "Não entendi. Posso te ajudar com:\n\n" +
      "💸 Registrar gastos/receitas\n" +
      "💰 Consultar saldo\n" +
      "📅 Ver contas a vencer\n" +
      "📊 Ver relatórios\n\n" +
      "Digite 'ajuda' para mais opções.",
  };
}
```

### 6.2 Mensagens de Ajuda

```typescript
const helpMessages = {
  general: `
🤖 **Comandos da Isis**

**📝 Registrar:**
• "Gastei 50 reais" - Adiciona despesa
• "Recebi 3000" - Adiciona receita
• "Paguei conta de luz" - Registra pagamento

**🔍 Consultar:**
• "Meu saldo" - Mostra saldo total
• "Quanto gastei" - Resumo do mês
• "Contas a vencer" - Próximos vencimentos

**🧭 Navegar:**
• "Ir para transações"
• "Abrir calendário"
• "Mostrar relatórios"

**⚙️ Outros:**
• "Ajuda categorias" - Ver categorias
• "Ajuda contas" - Ver contas bancárias
  `,
  
  categories: (categories: Category[]) => {
    return "🏷️ **Suas categorias:**\n\n" + 
      categories
        .filter(c => c.level === 1)
        .map(c => `${c.icon || '•'} ${c.name}`)
        .join('\n');
  },
  
  accounts: (accounts: BankAccount[]) => {
    return "🏦 **Suas contas:**\n\n" +
      accounts.map(a => `• ${a.name}: R$ ${formatMoney(a.currentBalance)}`).join('\n');
  },
};
```

---

## 7. INTEGRAÇÕES COM API

### 7.1 Endpoints Utilizados

```typescript
const apiEndpoints = {
  // Contas Bancárias
  bankAccounts: {
    list: 'GET /api/v1/bank-accounts',
    create: 'POST /api/v1/bank-accounts',
    update: 'PUT /api/v1/bank-accounts/:id',
  },
  
  // Meios de Pagamento
  paymentMethods: {
    list: 'GET /api/v1/payment-methods',
    create: 'POST /api/v1/payment-methods',
  },
  
  // Categorias
  categories: {
    list: 'GET /api/v1/categories',
    // Categorias são criadas automaticamente no registro
  },
  
  // Transações
  transactions: {
    list: 'GET /api/v1/transactions',
    create: 'POST /api/v1/transactions',
    update: 'PUT /api/v1/transactions/:id',
    delete: 'DELETE /api/v1/transactions/:id',
  },
  
  // Recorrentes
  recurringBills: {
    list: 'GET /api/v1/recurring-bills',
    create: 'POST /api/v1/recurring-bills',
    generateOccurrences: 'POST /api/v1/recurring-bills/:id/generate',
  },
  
  // Parcelamentos
  installments: {
    list: 'GET /api/v1/installments',
    create: 'POST /api/v1/installments',
  },
  
  // Dashboard
  dashboard: {
    summary: 'GET /api/v1/dashboard/summary',
    monthData: 'GET /api/v1/dashboard/month/:year/:month',
  },
  
  // Calendário
  calendar: {
    month: 'GET /api/v1/calendar/:year/:month',
  },
};
```

### 7.2 Exemplos de Chamadas

```typescript
// Criar conta bancária
async function createBankAccount(data: CreateBankAccountDTO) {
  return api.post('/api/v1/bank-accounts', {
    name: data.name,
    type: data.type || 'bank',
    institution: data.institution,
    currentBalance: data.currentBalance,
    initialBalance: data.initialBalance || data.currentBalance,
    isActive: true,
  });
}

// Criar receita/despesa recorrente
async function createRecurringBill(data: CreateRecurringBillDTO) {
  return api.post('/api/v1/recurring-bills', {
    name: data.name,
    type: data.type, // 'income' ou 'expense'
    amount: data.amount,
    isVariableAmount: data.isVariableAmount || false,
    frequency: 'monthly',
    dueDay: data.dueDay,
    bankAccountId: data.bankAccountId,
    paymentMethodId: data.paymentMethodId,
    categoryId: data.categoryId,
    autoGenerate: true,
    monthsAhead: 12, // Gerar 12 meses
    status: 'active',
  });
}

// Criar transação única
async function createTransaction(data: CreateTransactionDTO) {
  return api.post('/api/v1/transactions', {
    type: data.type, // 'income' ou 'expense'
    categoryId: data.categoryId,
    bankAccountId: data.bankAccountId,
    paymentMethodId: data.paymentMethodId,
    amount: data.amount,
    description: data.description,
    transactionDate: data.date,
    status: data.isPaid ? 'completed' : 'pending',
    transactionType: 'single',
  });
}

// Buscar resumo do mês
async function getMonthSummary(tenantId: string, year?: number, month?: number) {
  const now = new Date();
  const y = year || now.getFullYear();
  const m = month || now.getMonth() + 1;
  
  return api.get(`/api/v1/dashboard/month/${y}/${m}`);
}

// Buscar contas a vencer
async function getUpcomingBills(tenantId: string, days: number = 7) {
  const today = new Date();
  const endDate = new Date();
  endDate.setDate(today.getDate() + days);
  
  return api.get('/api/v1/calendar/' + today.getFullYear() + '/' + (today.getMonth() + 1), {
    params: { status: 'pending' }
  });
}
```

---

## 8. EXEMPLOS DE DIÁLOGOS

### 8.1 Adicionando Gasto Rápido

```
👤 Usuário: Gastei 150 no mercado

🤖 Isis: Entendi! Despesa de R$ 150,00 em "Mercado" 🛒

Em qual conta/cartão você pagou?
1️⃣ Nubank PF
2️⃣ Nubank PJ
3️⃣ Cartão 5826

👤 Usuário: 1

🤖 Isis: ✅ Registrado!

📝 Mercado: R$ 150,00
💳 Nubank PF
📅 14/12/2025

Quer adicionar mais alguma coisa?
```

### 8.2 Consultando Saldo

```
👤 Usuário: Qual meu saldo?

🤖 Isis: 💰 Seu saldo total é R$ 17.500,00

📊 Por conta:
• Nubank PF: R$ 15.000,00
• Nubank PJ: R$ 2.500,00

Quer ver mais detalhes ou fazer algo?
```

### 8.3 Verificando Contas a Vencer

```
👤 Usuário: O que vence essa semana?

🤖 Isis: 📅 Contas dos próximos 7 dias:

| Vencimento | Descrição | Valor | Status |
|------------|-----------|-------|--------|
| 15/12 | Energia Elétrica | R$ 160,00 | 🟡 Pendente |
| 16/12 | Celular Max | R$ 35,00 | 🟡 Pendente |
| 18/12 | Celular Dandara | R$ 35,00 | 🟡 Pendente |
| 20/12 | IPTU | R$ 20,00 | 🟡 Pendente |
| 20/12 | Água | R$ 135,00 | 🟡 Pendente |
| 20/12 | YouTube Premium | R$ 49,90 | 🟡 Pendente |

💰 Total: R$ 434,90

Quer marcar alguma como paga?
```

### 8.4 Marcando Conta como Paga

```
👤 Usuário: Paguei a energia

🤖 Isis: ✅ Energia Elétrica marcada como PAGA!

📝 Detalhes:
• Valor: R$ 160,00
• Vencimento: 15/12/2025
• Pago em: 14/12/2025 (1 dia antecipado 🎉)

Mais alguma coisa?
```

### 8.5 Registrando Receita

```
👤 Usuário: Recebi um freelance de 2500

🤖 Isis: 💵 Ótimo! Receita de R$ 2.500,00

Em qual categoria?
1️⃣ Freelance
2️⃣ Vendas
3️⃣ Outros

👤 Usuário: 1

🤖 Isis: Em qual conta o dinheiro entrou?
1️⃣ Nubank PF
2️⃣ Nubank PJ

👤 Usuário: PJ

🤖 Isis: ✅ Receita registrada!

💵 Freelance: R$ 2.500,00
🏦 Nubank PJ
📅 14/12/2025

Seu novo saldo na Nubank PJ: R$ 5.000,00 🎉
```

---

## 9. PRÓXIMOS PASSOS DE IMPLEMENTAÇÃO

### 9.1 Backend

```
[ ] Criar modelo ChatSession no Prisma
[ ] Criar ChatbotService com toda a lógica
[ ] Criar rotas /api/v1/chatbot/*
[ ] Integrar com WebSocket para tempo real
```

### 9.2 Frontend

```
[ ] Criar componente ChatWidget (flutuante)
[ ] Criar página /dashboard/assistant
[ ] Integrar com API do chatbot
[ ] Adicionar notificações proativas
```

### 9.3 Funcionalidades Futuras

```
[ ] Reconhecimento de voz
[ ] Foto de nota fiscal → OCR → Transação
[ ] Lembretes por push notification
[ ] Integração com WhatsApp
```

---

**Documento criado em:** 14/12/2025  
**Versão:** 1.0  
**Autor:** Documentação gerada para equipe de desenvolvimento
